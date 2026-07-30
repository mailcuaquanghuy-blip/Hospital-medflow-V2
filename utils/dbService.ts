import { isSupabaseConfigured, saveSupabaseItem, deleteSupabaseItem } from './supabaseService';
import { supabase } from '../supabaseClient';
import { 
  setDoc as firebaseSetDoc, 
  updateDoc as firebaseUpdateDoc, 
  deleteDoc as firebaseDeleteDoc, 
  writeBatch as firebaseWriteBatch 
} from 'firebase/firestore';

export const getRefDetails = (docRef: any) => {
  let collectionName = docRef.parent?.id || '';
  if (!collectionName && docRef.path) {
    collectionName = docRef.path.split('/')[0];
  }
  const docId = docRef.id || '';
  let tableName = collectionName;
  if (collectionName === 'machineShifts') {
    tableName = 'machine_shifts';
  }
  return { collectionName, tableName, docId };
};

// Dispatch a change event so App.tsx can update state reactively
export const dispatchDbChange = (collectionName: string, docId: string, data: any, action: 'set' | 'delete') => {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('db-change', {
      detail: { collectionName, docId, data, action }
    });
    window.dispatchEvent(event);
  }
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
  if (docRef) {
    try {
      await firebaseSetDoc(docRef, data, options);
    } catch (fbErr) {
      console.warn("Firebase setDoc note:", fbErr);
    }
  }

  if (isSupabaseConfigured()) {
    const { collectionName, tableName, docId } = getRefDetails(docRef);
    console.log(`[Supabase setDoc] Saving to ${tableName}/${docId}:`, data);
    
    // Clean data of undefined values
    const cleanData = JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));
    
    const success = await saveSupabaseItem(tableName, docId, cleanData);
    if (!success) {
      console.warn(`[Supabase setDoc] Note: Could not save ${tableName} to Supabase`);
    }
    
    dispatchDbChange(collectionName, docId, cleanData, 'set');
  }
};

export const updateDoc = async (docRef: any, data: any) => {
  if (docRef) {
    try {
      await firebaseUpdateDoc(docRef, data);
    } catch (fbErr) {
      console.warn("Firebase updateDoc note:", fbErr);
    }
  }

  if (isSupabaseConfigured()) {
    const { collectionName, tableName, docId } = getRefDetails(docRef);
    console.log(`[Supabase updateDoc] Updating ${tableName}/${docId}:`, data);

    let mergedData = { ...data };

    try {
      // Fetch existing nested data column if it exists to merge
      const { data: existingRow, error: fetchErr } = await supabase
        .from(tableName)
        .select('data')
        .eq('id', docId)
        .maybeSingle();
      
      if (!fetchErr && existingRow && existingRow.data) {
        mergedData = { ...existingRow.data, ...data };
      }
    } catch (err) {
      console.warn("Failed to fetch existing row for merge:", err);
    }

    // Clean mergedData of undefined values
    const cleanData = JSON.parse(JSON.stringify(mergedData, (key, value) => value === undefined ? null : value));

    const success = await saveSupabaseItem(tableName, docId, cleanData);
    if (!success) {
      console.warn(`[Supabase updateDoc] Note: Could not update ${tableName} in Supabase`);
    }

    dispatchDbChange(collectionName, docId, cleanData, 'set');
  }
};

export const deleteDoc = async (docRef: any) => {
  if (docRef) {
    try {
      await firebaseDeleteDoc(docRef);
    } catch (fbErr) {
      console.warn("Firebase deleteDoc note:", fbErr);
    }
  }

  if (isSupabaseConfigured()) {
    const { collectionName, tableName, docId } = getRefDetails(docRef);
    console.log(`[Supabase deleteDoc] Deleting from ${tableName}/${docId}`);

    const success = await deleteSupabaseItem(tableName, docId);
    if (!success) {
      console.warn(`[Supabase deleteDoc] Note: Could not delete ${tableName} from Supabase`);
    }

    dispatchDbChange(collectionName, docId, null, 'delete');
  }
};

export const writeBatch = (firestoreDb: any) => {
  const fbBatch = firestoreDb ? firebaseWriteBatch(firestoreDb) : null;
  const operations: Array<{ docRef: any; data?: any; type: 'set' | 'update' | 'delete' }> = [];

  return {
    set: (docRef: any, data: any) => {
      if (fbBatch) fbBatch.set(docRef, data);
      operations.push({ docRef, data, type: 'set' });
    },
    update: (docRef: any, data: any) => {
      if (fbBatch) fbBatch.update(docRef, data);
      operations.push({ docRef, data, type: 'update' });
    },
    delete: (docRef: any) => {
      if (fbBatch) fbBatch.delete(docRef);
      operations.push({ docRef, type: 'delete' });
    },
    commit: async () => {
      if (fbBatch) {
        try {
          await fbBatch.commit();
        } catch (fbErr) {
          console.warn("Firebase batch commit note:", fbErr);
        }
      }

      if (isSupabaseConfigured()) {
        for (const op of operations) {
          const { collectionName, tableName, docId } = getRefDetails(op.docRef);
          if (op.type === 'set') {
            const cleanData = JSON.parse(JSON.stringify(op.data, (key, value) => value === undefined ? null : value));
            await saveSupabaseItem(tableName, docId, cleanData);
            dispatchDbChange(collectionName, docId, cleanData, 'set');
          } else if (op.type === 'update') {
            let mergedData = { ...op.data };
            try {
              const { data: existingRow } = await supabase
                .from(tableName)
                .select('data')
                .eq('id', docId)
                .maybeSingle();
              if (existingRow && existingRow.data) {
                mergedData = { ...existingRow.data, ...op.data };
              }
            } catch (err) {
              console.warn("Failed to fetch existing row for merge in batch:", err);
            }
            const cleanData = JSON.parse(JSON.stringify(mergedData, (key, value) => value === undefined ? null : value));
            await saveSupabaseItem(tableName, docId, cleanData);
            dispatchDbChange(collectionName, docId, cleanData, 'set');
          } else if (op.type === 'delete') {
            await deleteSupabaseItem(tableName, docId);
            dispatchDbChange(collectionName, docId, null, 'delete');
          }
        }
      }
    }
  } as any;
};
