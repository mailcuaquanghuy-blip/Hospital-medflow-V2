import { 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  getDoc as firestoreGetDoc, 
  getDocs as firestoreGetDocs, 
  setDoc as firestoreSetDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc as firestoreDeleteDoc, 
  writeBatch as firestoreWriteBatch,
  query as firestoreQuery,
  where as firestoreWhere
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { ScheduleSnapshot } from '../types';
import { 
  saveSupabaseItem, 
  deleteSupabaseItem, 
  saveSupabaseBatch, 
  deleteSupabaseBatch, 
  fetchSupabaseTable 
} from './supabaseService';

export { db };

export const getSupabaseTableName = (collectionName: string): string => {
  if (collectionName === 'machineShifts') return 'machine_shifts';
  if (collectionName === 'scheduleSnapshots') return 'templates';
  return collectionName;
};



// Ensure auth is initialized
let authInitPromise: Promise<any> | null = null;
export async function ensureAuthReady() {
  if (auth.currentUser) return auth.currentUser;
  if (!authInitPromise) {
    authInitPromise = signInAnonymously(auth).catch(err => {
      console.warn('[Firebase Auth] Anonymous sign in fallback note:', err);
    });
  }
  return authInitPromise;
}

export interface DocRef {
  id: string;
  parent: { id: string };
  path: string;
  collectionName: string;
}

export const collection = (firstArg: any, secondArg?: string) => {
  const collName = typeof secondArg === 'string' 
    ? secondArg 
    : (typeof firstArg === 'string' ? firstArg : (firstArg?.id || firstArg?.collectionName || ''));
  return { id: collName, path: collName, collectionName: collName };
};

export const doc = (firstArg: any, secondArg?: string, thirdArg?: string): DocRef => {
  let collectionName = '';
  let docId = '';
  if (thirdArg) {
    collectionName = secondArg || '';
    docId = thirdArg;
  } else if (secondArg) {
    if (typeof firstArg === 'string') {
      collectionName = firstArg;
    } else if (firstArg && typeof firstArg === 'object') {
      collectionName = firstArg.id || firstArg.path || firstArg.collectionName || '';
    }
    docId = secondArg;
  } else if (typeof firstArg === 'string') {
    const parts = firstArg.split('/');
    collectionName = parts[0] || '';
    docId = parts[1] || '';
  }
  return {
    id: docId,
    parent: { id: collectionName },
    path: `${collectionName}/${docId}`,
    collectionName
  };
};

export const query = (collRef: any, ...queryConstraints: any[]) => {
  return collRef;
};

export const where = (field: string, op: string, value: any) => {
  return { field, op, value };
};

export const getRefDetails = (docRef: any) => {
  let collectionName = docRef?.parent?.id || '';
  if (!collectionName && docRef?.path) {
    collectionName = docRef.path.split('/')[0];
  }
  if (!collectionName && docRef?.collectionName) {
    collectionName = docRef.collectionName;
  }
  const docId = docRef?.id || '';
  return { collectionName, docId };
};

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

export async function fetchCollectionFromFirestore<T>(collName: string): Promise<T[]> {
  try {
    await ensureAuthReady();
    const snap = await firestoreGetDocs(firestoreCollection(db, collName));
    if (!snap.empty) {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id })) as T[];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`medflow_local_${collName}`, JSON.stringify(items));
        } catch (e) {}
      }
      return items;
    }
  } catch (err) {
    console.warn(`[Firestore] Fetch error on collection "${collName}":`, err);
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(`medflow_local_${collName}`);
      if (cached) {
        return JSON.parse(cached) as T[];
      }
    } catch (e) {}
  }

  return [];
}

export async function fetchScheduleSnapshotsFromFirestore(): Promise<ScheduleSnapshot[]> {
  try {
    const snaps = await fetchCollectionFromFirestore<ScheduleSnapshot>('scheduleSnapshots');
    if (snaps && snaps.length > 0) return snaps;
    const fallbackSnaps = await fetchCollectionFromFirestore<ScheduleSnapshot>('schedule_snapshots');
    if (fallbackSnaps && fallbackSnaps.length > 0) return fallbackSnaps;
  } catch (e) {
    console.warn('Error fetching snapshots from Firestore:', e);
  }
  return [];
}

export async function saveScheduleSnapshotToFirestore(snapshot: any): Promise<boolean> {
  try {
    const rawSnapId = snapshot.id?.replace(/^snap_/, '') || `${snapshot.deptId}_${snapshot.date}`;
    const cleanSnapshot = {
      ...snapshot,
      id: rawSnapId,
      deptId: snapshot.deptId,
      date: snapshot.date,
      createdAt: snapshot.createdAt || new Date().toISOString(),
      createdBy: snapshot.createdBy || 'Hệ thống'
    };

    // Save to Supabase
    saveSupabaseItem('templates', `snap_${rawSnapId}`, cleanSnapshot).catch(e => {
      console.warn('Dual-sync snapshot to Supabase note:', e);
    });

    await setDoc(doc(db, 'scheduleSnapshots', rawSnapId), cleanSnapshot);
    return true;
  } catch (e) {
    console.warn('Error saving snapshot to Firestore:', e);
    return false;
  }
}


export const getDoc = async (docRef: any) => {
  const { collectionName, docId } = getRefDetails(docRef);
  try {
    await ensureAuthReady();
    const fDocRef = firestoreDoc(db, collectionName, docId);
    const snap = await firestoreGetDoc(fDocRef);
    const exists = snap.exists();
    const data = exists ? { ...snap.data(), id: snap.id } : null;
    return {
      exists: () => exists,
      data: () => data,
      id: docId
    };
  } catch (err) {
    console.warn(`[Firestore getDoc] Error fetching ${collectionName}/${docId}:`, err);
    // LocalStorage fallback
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`medflow_local_${collectionName}`);
        if (cached) {
          const list = JSON.parse(cached);
          const found = list.find((item: any) => item.id === docId);
          if (found) {
            return { exists: () => true, data: () => found, id: docId };
          }
        }
      } catch (e) {}
    }
    return {
      exists: () => false,
      data: () => null,
      id: docId
    };
  }
};

export const getDocs = async (collRef: any) => {
  const collName = collRef?.id || collRef?.collectionName || (typeof collRef === 'string' ? collRef : '');
  try {
    const sbTable = getSupabaseTableName(collName);
    const sbItems = await fetchSupabaseTable<any>(sbTable);
    if (sbItems && sbItems.length > 0) {
      const docs = sbItems.map(item => ({
        id: item.id,
        data: () => item
      }));
      return {
        docs,
        empty: false,
        size: docs.length
      };
    }
    const items = await fetchCollectionFromFirestore<any>(collName);
    const docs = items.map(item => ({
      id: item.id,
      data: () => item
    }));
    return {
      docs,
      empty: docs.length === 0,
      size: docs.length
    };
  } catch (err) {
    return {
      docs: [],
      empty: true,
      size: 0
    };
  }
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
  const { collectionName, docId } = getRefDetails(docRef);
  
  // Clean data of undefined values
  const cleanData = JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));
  
  // 1. Dispatch optimistic update immediately for 0ms local UI responsiveness
  dispatchDbChange(collectionName, docId, cleanData, 'set');

  // 2. Save to localStorage continuous cache
  if (typeof window !== 'undefined') {
    try {
      const localKey = `medflow_local_${collectionName}`;
      const existing = localStorage.getItem(localKey);
      let list: any[] = existing ? JSON.parse(existing) : [];
      list = list.filter(item => item.id !== docId);
      list.push({ ...cleanData, id: docId });
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch (e) {}
  }

  // 3. Persist to Supabase (Primary)
  try {
    const sbTable = getSupabaseTableName(collectionName);
    saveSupabaseItem(sbTable, docId, cleanData).catch(err => {
      console.warn(`[Supabase setDoc] Note on saving ${sbTable}/${docId}:`, err);
    });
  } catch (err) {
    console.warn(`[Supabase setDoc] Error saving ${collectionName}/${docId}:`, err);
  }

  // 4. Persist to Firestore (Mirror/Backup)
  try {
    await ensureAuthReady();
    const fDocRef = firestoreDoc(db, collectionName, docId);
    await firestoreSetDoc(fDocRef, cleanData, { merge: true });
  } catch (err) {
    console.warn(`[Firestore setDoc] Error saving ${collectionName}/${docId}:`, err);
  }
};

export const updateDoc = async (docRef: any, data: any) => {
  const { collectionName, docId } = getRefDetails(docRef);

  const cleanData = JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));

  // 1. Instant optimistic update
  dispatchDbChange(collectionName, docId, cleanData, 'set');

  // 2. Update in localStorage cache
  if (typeof window !== 'undefined') {
    try {
      const localKey = `medflow_local_${collectionName}`;
      const existing = localStorage.getItem(localKey);
      if (existing) {
        let list: any[] = JSON.parse(existing);
        const idx = list.findIndex(item => item.id === docId);
        if (idx > -1) {
          list[idx] = { ...list[idx], ...cleanData };
          localStorage.setItem(localKey, JSON.stringify(list));
        }
      }
    } catch (e) {}
  }

  // 3. Update in Supabase
  try {
    const sbTable = getSupabaseTableName(collectionName);
    saveSupabaseItem(sbTable, docId, cleanData).catch(err => {
      console.warn(`[Supabase updateDoc] Note on updating ${sbTable}/${docId}:`, err);
    });
  } catch (err) {
    console.warn(`[Supabase updateDoc] Error updating ${collectionName}/${docId}:`, err);
  }

  // 4. Update in Firestore
  try {
    await ensureAuthReady();
    const fDocRef = firestoreDoc(db, collectionName, docId);
    await firestoreSetDoc(fDocRef, cleanData, { merge: true });
  } catch (err) {
    console.warn(`[Firestore updateDoc] Error updating ${collectionName}/${docId}:`, err);
  }
};

export const deleteDoc = async (docRef: any) => {
  const { collectionName, docId } = getRefDetails(docRef);

  // 1. Dispatch optimistic delete immediately
  dispatchDbChange(collectionName, docId, null, 'delete');

  // 2. Remove from localStorage cache
  if (typeof window !== 'undefined') {
    try {
      const localKey = `medflow_local_${collectionName}`;
      const existing = localStorage.getItem(localKey);
      if (existing) {
        let list: any[] = JSON.parse(existing);
        list = list.filter(item => item.id !== docId);
        localStorage.setItem(localKey, JSON.stringify(list));
      }
    } catch (e) {}
  }

  // 3. Delete from Supabase
  try {
    const sbTable = getSupabaseTableName(collectionName);
    deleteSupabaseItem(sbTable, docId).catch(err => {
      console.warn(`[Supabase deleteDoc] Note on deleting ${sbTable}/${docId}:`, err);
    });
  } catch (err) {
    console.warn(`[Supabase deleteDoc] Error deleting ${collectionName}/${docId}:`, err);
  }

  // 4. Delete from Firestore
  try {
    await ensureAuthReady();
    const fDocRef = firestoreDoc(db, collectionName, docId);
    await firestoreDeleteDoc(fDocRef);
  } catch (err) {
    console.warn(`[Firestore deleteDoc] Error deleting ${collectionName}/${docId}:`, err);
  }
};

export const writeBatch = (firestoreDb?: any) => {
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
      if (operations.length === 0) return;

      // 1. Immediately dispatch ALL optimistic updates
      for (const op of operations) {
        const { collectionName, docId } = getRefDetails(op.docRef);
        if (op.type === 'set' || op.type === 'update') {
          const cleanData = JSON.parse(JSON.stringify(op.data, (key, value) => value === undefined ? null : value));
          dispatchDbChange(collectionName, docId, cleanData, 'set');
        } else if (op.type === 'delete') {
          dispatchDbChange(collectionName, docId, null, 'delete');
        }
      }

      // 2. Perform chunked Supabase batch upsert / delete
      try {
        const setsByTable: Record<string, Array<{ id: string; data: any }>> = {};
        const deletesByTable: Record<string, string[]> = {};

        for (const op of operations) {
          const { collectionName, docId } = getRefDetails(op.docRef);
          const sbTable = getSupabaseTableName(collectionName);
          if (op.type === 'set' || op.type === 'update') {
            if (!setsByTable[sbTable]) setsByTable[sbTable] = [];
            const cleanData = JSON.parse(JSON.stringify(op.data, (key, value) => value === undefined ? null : value));
            setsByTable[sbTable].push({ id: docId, data: cleanData });
          } else if (op.type === 'delete') {
            if (!deletesByTable[sbTable]) deletesByTable[sbTable] = [];
            deletesByTable[sbTable].push(docId);
          }
        }

        for (const [table, items] of Object.entries(setsByTable)) {
          saveSupabaseBatch(table, items).catch(err => console.warn(`Supabase batch save note on ${table}:`, err));
        }
        for (const [table, ids] of Object.entries(deletesByTable)) {
          deleteSupabaseBatch(table, ids).catch(err => console.warn(`Supabase batch delete note on ${table}:`, err));
        }
      } catch (err) {
        console.warn("[Supabase writeBatch] Error executing batch write:", err);
      }

      // 3. Perform chunked Firestore batch commit (max 450 ops per batch)
      try {
        await ensureAuthReady();
        const BATCH_SIZE = 450;
        for (let i = 0; i < operations.length; i += BATCH_SIZE) {
          const chunk = operations.slice(i, i + BATCH_SIZE);
          const batch = firestoreWriteBatch(db);

          for (const op of chunk) {
            const { collectionName, docId } = getRefDetails(op.docRef);
            const fDocRef = firestoreDoc(db, collectionName, docId);
            if (op.type === 'set' || op.type === 'update') {
              const cleanData = JSON.parse(JSON.stringify(op.data, (key, value) => value === undefined ? null : value));
              batch.set(fDocRef, cleanData, { merge: true });
            } else if (op.type === 'delete') {
              batch.delete(fDocRef);
            }
          }

          await batch.commit();
        }
      } catch (err) {
        console.warn("[Firestore writeBatch] Error executing batch write:", err);
      }
    }
  } as any;
};

