import { isSupabaseConfigured, saveSupabaseItem, saveSupabaseBatch, deleteSupabaseItem, deleteSupabaseBatch } from './supabaseService';
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
  let collectionName = docRef?.parent?.id || '';
  if (!collectionName && docRef?.path) {
    collectionName = docRef.path.split('/')[0];
  }
  if (!collectionName && docRef?.collectionName) {
    collectionName = docRef.collectionName;
  }
  const docId = docRef?.id || '';
  let tableName = collectionName;
  if (collectionName === 'machineShifts') {
    tableName = 'machine_shifts';
  }
  if (collectionName === 'scheduleSnapshots') {
    tableName = 'schedule_snapshots';
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
  
  // Clean data of undefined values
  const cleanData = JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));
  
  // 1. Dispatch optimistic update immediately for instant local UI responsiveness!
  dispatchDbChange(collectionName, docId, cleanData, 'set');

  // Background persistence to Supabase
  try {
    await saveSupabaseItem(tableName, docId, cleanData);
  } catch (err) {
    console.warn(`[Supabase setDoc] Note: Error saving ${tableName}/${docId}:`, err);
  }
};

export const updateDoc = async (docRef: any, data: any) => {
  const { collectionName, tableName, docId } = getRefDetails(docRef);

  // Clean data of undefined values
  const cleanData = JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));

  // 1. Instant optimistic update! (App.tsx state merges fields so no partial data wipes existing fields)
  dispatchDbChange(collectionName, docId, cleanData, 'set');

  // Background async merge with remote Supabase database
  (async () => {
    try {
      let mergedData = { ...cleanData };
      const { data: existingRow, error: fetchErr } = await supabase
        .from(tableName)
        .select('data')
        .eq('id', docId)
        .maybeSingle();
      
      if (!fetchErr && existingRow && existingRow.data && typeof existingRow.data === 'object') {
        mergedData = { ...existingRow.data, ...cleanData };
      }

      await saveSupabaseItem(tableName, docId, mergedData);
    } catch (err) {
      console.warn(`[Supabase updateDoc] Error on ${tableName}/${docId}:`, err);
    }
  })();
};

export const deleteDoc = async (docRef: any) => {
  const { collectionName, tableName, docId } = getRefDetails(docRef);

  // 1. Dispatch optimistic delete immediately for instant UI responsiveness!
  dispatchDbChange(collectionName, docId, null, 'delete');

  try {
    await deleteSupabaseItem(tableName, docId);
  } catch (err) {
    console.warn(`[Supabase deleteDoc] Error deleting ${tableName}/${docId}:`, err);
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
      // 1. Immediately dispatch ALL optimistic updates for instantaneous UI response (0ms delay)
      const itemsToUpsertByTable: Record<string, Array<{ id: string; data: any }>> = {};
      const idsToDeleteByTable: Record<string, string[]> = {};

      for (const op of operations) {
        const { collectionName, tableName, docId } = getRefDetails(op.docRef);
        if (op.type === 'set' || op.type === 'update') {
          const cleanData = JSON.parse(JSON.stringify(op.data, (key, value) => value === undefined ? null : value));
          dispatchDbChange(collectionName, docId, cleanData, 'set');

          if (!itemsToUpsertByTable[tableName]) itemsToUpsertByTable[tableName] = [];
          itemsToUpsertByTable[tableName].push({ id: docId, data: cleanData });
        } else if (op.type === 'delete') {
          dispatchDbChange(collectionName, docId, null, 'delete');

          if (!idsToDeleteByTable[tableName]) idsToDeleteByTable[tableName] = [];
          idsToDeleteByTable[tableName].push(docId);
        }
      }

      // 2. Perform parallel bulk upsert and delete per table in background
      try {
        const promises: Promise<any>[] = [];

        for (const [tableName, items] of Object.entries(itemsToUpsertByTable)) {
          promises.push(saveSupabaseBatch(tableName, items));
        }

        for (const [tableName, ids] of Object.entries(idsToDeleteByTable)) {
          promises.push(deleteSupabaseBatch(tableName, ids));
        }

        await Promise.all(promises);
      } catch (err) {
        console.warn("[writeBatch] Error executing batch save/delete:", err);
      }
    }
  } as any;
};
