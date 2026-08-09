import { isSupabaseConfigured, saveSupabaseItem, deleteSupabaseItem } from './supabaseService';
import { supabase } from '../supabaseClient';

// BroadcastChannel for cross-tab real-time synchronization
const dbBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('medflow_db_sync') 
  : null;

if (dbBroadcastChannel) {
  dbBroadcastChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'db-change') {
      const { collectionName, docId, data, action } = event.data.detail;
      if (typeof window !== 'undefined') {
        const customEvent = new CustomEvent('db-change', {
          detail: { collectionName, docId, data, action }
        });
        window.dispatchEvent(customEvent);
      }
    }
  };
}

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

// Dispatch a change event so App.tsx can update state reactively locally and across all tabs
export const dispatchDbChange = (collectionName: string, docId: string, data: any, action: 'set' | 'delete') => {
  if (typeof window !== 'undefined') {
    const detail = { collectionName, docId, data, action };
    const event = new CustomEvent('db-change', { detail });
    window.dispatchEvent(event);

    if (dbBroadcastChannel) {
      try {
        dbBroadcastChannel.postMessage({ type: 'db-change', detail });
      } catch (e) {
        console.warn('BroadcastChannel postMessage failed:', e);
      }
    }
  }
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
  const { collectionName, tableName, docId } = getRefDetails(docRef);
  console.log(`[Supabase setDoc] Saving to ${tableName}/${docId}:`, data);
  
  // Clean data of undefined values
  const cleanData = JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));
  
  // 1. Dispatch optimistic update immediately for instant local UI responsiveness!
  dispatchDbChange(collectionName, docId, cleanData, 'set');

  const success = await saveSupabaseItem(tableName, docId, cleanData);
  if (!success) {
    console.warn(`[Supabase setDoc] Note: Could not save ${tableName} to Supabase`);
  }
};

export const updateDoc = async (docRef: any, data: any) => {
  const { collectionName, tableName, docId } = getRefDetails(docRef);
  console.log(`[Supabase updateDoc] Updating ${tableName}/${docId}:`, data);

  let mergedData = { ...data };

  // 1. Best-effort optimistic update immediately!
  dispatchDbChange(collectionName, docId, mergedData, 'set');

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

  // 2. Dispatch the fully merged data to keep state completely accurate
  dispatchDbChange(collectionName, docId, cleanData, 'set');
};

export const deleteDoc = async (docRef: any) => {
  const { collectionName, tableName, docId } = getRefDetails(docRef);
  console.log(`[Supabase deleteDoc] Deleting from ${tableName}/${docId}`);

  // 1. Dispatch optimistic delete immediately for instant UI responsiveness!
  dispatchDbChange(collectionName, docId, null, 'delete');

  const success = await deleteSupabaseItem(tableName, docId);
  if (!success) {
    console.warn(`[Supabase deleteDoc] Note: Could not delete ${tableName} from Supabase`);
  }
};

export const writeBatch = (firestoreDb: any) => {
  const operations: Array<{ docRef: any; data?: any; type: 'set' | 'update' | 'delete' }> = [];

  return {
    set: (docRef: any, data: any) => {
      operations.push({ docRef, data, type: 'set' });
    },
    update: (docRef: any, data: any) => {
      operations.push({ docRef, data, type: 'update' });
    },
    delete: (docRef: any) => {
      operations.push({ docRef, type: 'delete' });
    },
    commit: async () => {
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
  } as any;
};
