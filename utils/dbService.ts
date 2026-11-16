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
import { supabase } from '../supabaseClient';
import { 
  saveSupabaseItem, 
  deleteSupabaseItem, 
  saveSupabaseBatch, 
  deleteSupabaseBatch, 
  fetchSupabaseTable 
} from './supabaseService';

export { db };

export const normalizeCollectionName = (collectionName: string): string => {
  if (collectionName === 'machine_shifts') return 'machineShifts';
  if (collectionName === 'schedule_snapshots') return 'scheduleSnapshots';
  return collectionName;
};

export const getSupabaseTableName = (collectionName: string): string => {
  const norm = normalizeCollectionName(collectionName);
  if (norm === 'machineShifts') return 'machine_shifts';
  if (norm === 'scheduleSnapshots') return 'templates';
  return norm;
};

const resolveTargets = (collectionName: string, docId: string) => {
  const normColl = normalizeCollectionName(collectionName);
  const sbTable = getSupabaseTableName(normColl);
  const isSnapshot = normColl === 'scheduleSnapshots';
  const cleanId = isSnapshot ? docId.replace(/^snap_/, '') : docId;
  const sbId = isSnapshot ? `snap_${cleanId}` : cleanId;
  return { normColl, sbTable, sbId, cleanId, isSnapshot };
};

// Safely release ~20MB of blocked localStorage quota if old dump is present
if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem('medflow_local_appointments')) {
      localStorage.removeItem('medflow_local_appointments');
    }
  } catch (e) {}
}

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

// In-memory latest doc cache so partial updates (updateDoc) always preserve full JSONB records
const latestDocCache = new Map<string, any>();

export const seedDocCache = (collectionName: string, items: any[]) => {
  if (!Array.isArray(items)) return;
  const norm = normalizeCollectionName(collectionName);
  for (const item of items) {
    if (item && item.id) {
      const key = `${norm}:${item.id}`;
      // Do not overwrite cache if there is a pending local write waiting to sync
      if (!pendingSyncOps.has(key)) {
        latestDocCache.set(key, item);
      }
    }
  }
};

// Per-document write serialization queue so rapid edits on the same doc never arrive out-of-order
const docWriteChains = new Map<string, Promise<any>>();

const runSerializedForDoc = <T>(docKey: string, task: () => Promise<T>): Promise<T> => {
  const prev = docWriteChains.get(docKey) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  const wrapped = next.finally(() => {
    if (docWriteChains.get(docKey) === wrapped) {
      docWriteChains.delete(docKey);
    }
  });
  docWriteChains.set(docKey, wrapped);
  return next;
};

// Background pending retry queue for transient Supabase network failures
interface PendingSyncOp {
  collectionName: string;
  docId: string;
  sbTable: string;
  sbId: string;
  action: 'set' | 'delete';
  data?: any;
  retries: number;
}

const pendingSyncOps = new Map<string, PendingSyncOp>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export const hasPendingSync = (collectionName: string, docId: string): boolean => {
  const norm = normalizeCollectionName(collectionName);
  const cleanId = norm === 'scheduleSnapshots' ? docId.replace(/^snap_/, '') : docId;
  return pendingSyncOps.has(`${norm}:${cleanId}`);
};

const flushPendingSyncOps = async () => {
  if (pendingSyncOps.size === 0) return;
  const entries = Array.from(pendingSyncOps.entries());
  for (const [key, op] of entries) {
    try {
      let ok = false;
      if (op.action === 'set') {
        ok = await saveSupabaseItem(op.sbTable, op.sbId, op.data);
      } else {
        ok = await deleteSupabaseItem(op.sbTable, op.sbId);
      }
      if (ok) {
        pendingSyncOps.delete(key);
      } else {
        op.retries += 1;
        if (op.retries >= 12) {
          console.error(`[PendingSync] Giving up after 12 retries on ${key}`);
          pendingSyncOps.delete(key);
        }
      }
    } catch (e) {
      op.retries += 1;
    }
  }
  if (pendingSyncOps.size > 0) {
    schedulePendingRetry();
  }
};

const schedulePendingRetry = () => {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    await flushPendingSyncOps();
  }, 5000);
};

const enqueuePendingSync = (op: Omit<PendingSyncOp, 'retries'>) => {
  const key = `${op.collectionName}:${op.docId}`;
  pendingSyncOps.set(key, { ...op, retries: 0 });
  schedulePendingRetry();
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingSyncOps();
  });
}

const updateLocalCollectionCache = (collectionName: string, docId: string, cleanData: any, action: 'set' | 'delete') => {
  if (typeof window === 'undefined' || collectionName === 'appointments' || collectionName === 'scheduleSnapshots') return;
  try {
    const localKey = `medflow_local_${collectionName}`;
    const existing = localStorage.getItem(localKey);
    let list: any[] = existing ? JSON.parse(existing) : [];
    if (!Array.isArray(list)) list = [];
    if (action === 'delete') {
      list = list.filter(item => item.id !== docId);
    } else {
      list = list.filter(item => item.id !== docId);
      list.push({ ...cleanData, id: docId });
    }
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch (e) {}
};

const resolveExistingDoc = async (normColl: string, sbTable: string, sbId: string, cleanId: string): Promise<any | null> => {
  const cacheKey = `${normColl}:${cleanId}`;
  if (latestDocCache.has(cacheKey)) {
    return latestDocCache.get(cacheKey);
  }

  if (typeof window !== 'undefined' && normColl !== 'appointments') {
    for (const key of [`medflow_local_${normColl}`, `medflow_local_${sbTable}`]) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const found = list.find((item: any) => item.id === cleanId || item.id === sbId);
            if (found) return found;
          }
        }
      } catch (e) {}
    }
  }

  try {
    const { data, error } = await supabase.from(sbTable).select('*').eq('id', sbId).maybeSingle();
    if (!error && data) {
      const resolved = data.data && typeof data.data === 'object' ? { ...data.data, id: cleanId } : { ...data, id: cleanId };
      latestDocCache.set(cacheKey, resolved);
      return resolved;
    }
  } catch (e) {}

  try {
    await ensureAuthReady();
    const snap = await firestoreGetDoc(firestoreDoc(db, normColl, cleanId));
    if (snap.exists()) {
      const resolved = { ...snap.data(), id: snap.id };
      latestDocCache.set(cacheKey, resolved);
      return resolved;
    }
  } catch (e) {}

  return null;
};

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
          detail: { collectionName, docId, data, action, source: 'broadcast' }
        });
        window.dispatchEvent(customEvent);
      }
    }
  };
}

// Dispatch a change event so App.tsx can update state reactively locally and across all tabs
export const dispatchDbChange = (
  collectionName: string,
  docId: string,
  data: any,
  action: 'set' | 'delete',
  source: 'local' | 'broadcast' | 'realtime' = 'local'
) => {
  if (typeof window !== 'undefined') {
    const detail = { collectionName, docId, data, action, source };
    const event = new CustomEvent('db-change', { detail });
    window.dispatchEvent(event);

    if (source === 'local' && dbBroadcastChannel) {
      try {
        dbBroadcastChannel.postMessage({ type: 'db-change', detail: { collectionName, docId, data, action } });
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
      if (typeof window !== 'undefined' && collName !== 'appointments') {
        try {
          localStorage.setItem(`medflow_local_${collName}`, JSON.stringify(items));
        } catch (e) {}
      }
      return items;
    }
    return [];
  } catch (err) {
    console.warn(`[Firestore] Fetch error on collection "${collName}":`, err);
  }

  // Fallback to localStorage only when Firestore fetch threw an error
  if (typeof window !== 'undefined' && collName !== 'appointments') {
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
  const { normColl, sbTable, sbId, cleanId } = resolveTargets(collectionName, docId);

  // Clean data of undefined values
  const cleanData = JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));
  if (!cleanData.id) cleanData.id = cleanId;

  const docKey = `${normColl}:${cleanId}`;
  latestDocCache.set(docKey, cleanData);

  // 1. Dispatch optimistic update immediately for 0ms local UI responsiveness
  dispatchDbChange(normColl, cleanId, cleanData, 'set', 'local');

  // 2. Save to localStorage continuous cache (skip appointments to prevent UI freeze)
  updateLocalCollectionCache(normColl, cleanId, cleanData, 'set');

  // 3. Serialize network writes per document so rapid sequential edits never overwrite newer writes out of order
  await runSerializedForDoc(docKey, async () => {
    const sbOk = await saveSupabaseItem(sbTable, sbId, cleanData);
    if (sbOk) {
      pendingSyncOps.delete(docKey);
    } else {
      console.warn(`[Supabase setDoc] Failed to persist ${normColl}/${cleanId}, queued for retry.`);
      enqueuePendingSync({ collectionName: normColl, docId: cleanId, sbTable, sbId, action: 'set', data: cleanData });
    }

    // 4. Mirror to Firestore (awaited if Supabase failed, background otherwise)
    const mirrorFirestore = async () => {
      try {
        await ensureAuthReady();
        const fDocRef = firestoreDoc(db, normColl, cleanId);
        await Promise.race([
          firestoreSetDoc(fDocRef, cleanData, { merge: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 8000))
        ]);
      } catch (err) {
        // Background mirror warning only
      }
    };

    if (!sbOk) {
      await mirrorFirestore();
    } else {
      mirrorFirestore();
    }
  });
};

export const updateDoc = async (docRef: any, data: any) => {
  const { collectionName, docId } = getRefDetails(docRef);
  const { normColl, sbTable, sbId, cleanId } = resolveTargets(collectionName, docId);

  const partialData = JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));
  const docKey = `${normColl}:${cleanId}`;

  // Merge with existing full document so Supabase JSONB 'data' column is NEVER wiped by a partial update
  const existing = await resolveExistingDoc(normColl, sbTable, sbId, cleanId);
  const mergedData = existing ? { ...existing, ...partialData, id: cleanId } : { ...partialData, id: cleanId };
  latestDocCache.set(docKey, mergedData);

  // 1. Instant optimistic update with merged record
  dispatchDbChange(normColl, cleanId, mergedData, 'set', 'local');

  // 2. Update in localStorage cache (skip appointments to prevent UI freeze)
  updateLocalCollectionCache(normColl, cleanId, mergedData, 'set');

  // 3. Serialize per-doc write to Supabase
  await runSerializedForDoc(docKey, async () => {
    const sbOk = await saveSupabaseItem(sbTable, sbId, mergedData);
    if (sbOk) {
      pendingSyncOps.delete(docKey);
    } else {
      console.warn(`[Supabase updateDoc] Failed updating ${normColl}/${cleanId}, queued for retry.`);
      enqueuePendingSync({ collectionName: normColl, docId: cleanId, sbTable, sbId, action: 'set', data: mergedData });
    }

    // 4. Mirror to Firestore
    const mirrorFirestore = async () => {
      try {
        await ensureAuthReady();
        const fDocRef = firestoreDoc(db, normColl, cleanId);
        await Promise.race([
          firestoreSetDoc(fDocRef, mergedData, { merge: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 8000))
        ]);
      } catch (err) {}
    };

    if (!sbOk) {
      await mirrorFirestore();
    } else {
      mirrorFirestore();
    }
  });
};

export const deleteDoc = async (docRef: any) => {
  const { collectionName, docId } = getRefDetails(docRef);
  const { normColl, sbTable, sbId, cleanId } = resolveTargets(collectionName, docId);
  const docKey = `${normColl}:${cleanId}`;

  latestDocCache.delete(docKey);

  // 1. Dispatch optimistic delete immediately
  dispatchDbChange(normColl, cleanId, null, 'delete', 'local');

  // 2. Remove from localStorage cache (skip appointments to prevent UI freeze)
  updateLocalCollectionCache(normColl, cleanId, null, 'delete');

  // 3. Serialize delete per document
  await runSerializedForDoc(docKey, async () => {
    const sbOk = await deleteSupabaseItem(sbTable, sbId);
    if (sbOk) {
      pendingSyncOps.delete(docKey);
    } else {
      console.warn(`[Supabase deleteDoc] Failed deleting ${normColl}/${cleanId}, queued for retry.`);
      enqueuePendingSync({ collectionName: normColl, docId: cleanId, sbTable, sbId, action: 'delete' });
    }

    // 4. Delete from Firestore
    const mirrorFirestore = async () => {
      try {
        await ensureAuthReady();
        const fDocRef = firestoreDoc(db, normColl, cleanId);
        await Promise.race([
          firestoreDeleteDoc(fDocRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 8000))
        ]);
      } catch (err) {}
    };

    if (!sbOk) {
      await mirrorFirestore();
    } else {
      mirrorFirestore();
    }
  });
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

      const resolvedOps: Array<{
        normColl: string;
        sbTable: string;
        sbId: string;
        cleanId: string;
        type: 'set' | 'update' | 'delete';
        data?: any;
      }> = [];

      for (const op of operations) {
        const { collectionName, docId } = getRefDetails(op.docRef);
        const { normColl, sbTable, sbId, cleanId } = resolveTargets(collectionName, docId);
        const docKey = `${normColl}:${cleanId}`;

        if (op.type === 'set' || op.type === 'update') {
          const cleanData = JSON.parse(JSON.stringify(op.data, (key, value) => value === undefined ? null : value));
          let finalData = cleanData;
          if (op.type === 'update') {
            const existing = await resolveExistingDoc(normColl, sbTable, sbId, cleanId);
            finalData = existing ? { ...existing, ...cleanData, id: cleanId } : { ...cleanData, id: cleanId };
          } else if (!finalData.id) {
            finalData.id = cleanId;
          }
          latestDocCache.set(docKey, finalData);
          updateLocalCollectionCache(normColl, cleanId, finalData, 'set');
          dispatchDbChange(normColl, cleanId, finalData, 'set', 'local');
          resolvedOps.push({ normColl, sbTable, sbId, cleanId, type: op.type, data: finalData });
        } else {
          latestDocCache.delete(docKey);
          updateLocalCollectionCache(normColl, cleanId, null, 'delete');
          dispatchDbChange(normColl, cleanId, null, 'delete', 'local');
          resolvedOps.push({ normColl, sbTable, sbId, cleanId, type: 'delete' });
        }
      }

      // 2. Perform chunked Supabase batch upsert / delete AND AWAIT
      const setsByTable: Record<string, Array<{ id: string; data: any; normColl: string; cleanId: string }>> = {};
      const deletesByTable: Record<string, Array<{ id: string; normColl: string; cleanId: string }>> = {};

      for (const op of resolvedOps) {
        if (op.type === 'set' || op.type === 'update') {
          if (!setsByTable[op.sbTable]) setsByTable[op.sbTable] = [];
          setsByTable[op.sbTable].push({ id: op.sbId, data: op.data, normColl: op.normColl, cleanId: op.cleanId });
        } else if (op.type === 'delete') {
          if (!deletesByTable[op.sbTable]) deletesByTable[op.sbTable] = [];
          deletesByTable[op.sbTable].push({ id: op.sbId, normColl: op.normColl, cleanId: op.cleanId });
        }
      }

      const sbTasks: Promise<boolean>[] = [];
      for (const [table, items] of Object.entries(setsByTable)) {
        sbTasks.push(
          saveSupabaseBatch(table, items.map(i => ({ id: i.id, data: i.data }))).then(ok => {
            if (!ok) {
              items.forEach(i => enqueuePendingSync({
                collectionName: i.normColl,
                docId: i.cleanId,
                sbTable: table,
                sbId: i.id,
                action: 'set',
                data: i.data
              }));
            } else {
              items.forEach(i => pendingSyncOps.delete(`${i.normColl}:${i.cleanId}`));
            }
            return ok;
          })
        );
      }
      for (const [table, items] of Object.entries(deletesByTable)) {
        sbTasks.push(
          deleteSupabaseBatch(table, items.map(i => i.id)).then(ok => {
            if (!ok) {
              items.forEach(i => enqueuePendingSync({
                collectionName: i.normColl,
                docId: i.cleanId,
                sbTable: table,
                sbId: i.id,
                action: 'delete'
              }));
            } else {
              items.forEach(i => pendingSyncOps.delete(`${i.normColl}:${i.cleanId}`));
            }
            return ok;
          })
        );
      }

      const results = await Promise.all(sbTasks);
      const allSbOk = results.every(Boolean);

      // 3. Mirror to Firestore (awaited if Supabase batch had any failure, background otherwise)
      const mirrorFirestore = async () => {
        try {
          await ensureAuthReady();
          const BATCH_SIZE = 450;
          for (let i = 0; i < resolvedOps.length; i += BATCH_SIZE) {
            const chunk = resolvedOps.slice(i, i + BATCH_SIZE);
            const batch = firestoreWriteBatch(db);

            for (const op of chunk) {
              const fDocRef = firestoreDoc(db, op.normColl, op.cleanId);
              if (op.type === 'set' || op.type === 'update') {
                batch.set(fDocRef, op.data, { merge: true });
              } else if (op.type === 'delete') {
                batch.delete(fDocRef);
              }
            }

            await Promise.race([
              batch.commit(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore batch timeout')), 8000))
            ]);
          }
        } catch (err) {}
      };

      if (!allSbOk) {
        await mirrorFirestore();
      } else {
        mirrorFirestore();
      }
    }
  } as any;
};


