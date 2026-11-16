import { supabase } from '../supabaseClient';

export function isSupabaseConfigured(): boolean {
  return true;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const updateLocalTableCache = (tableName: string, updater: (list: any[]) => any[]) => {
  if (typeof window === 'undefined' || tableName === 'appointments') return;
  try {
    const localKey = `medflow_local_${tableName}`;
    const existing = localStorage.getItem(localKey);
    const list: any[] = existing ? JSON.parse(existing) : [];
    const next = updater(Array.isArray(list) ? list : []);
    localStorage.setItem(localKey, JSON.stringify(next));
  } catch (e) {}
};

export async function fetchSupabaseTable<T>(tableName: string): Promise<T[] | null> {
  try {
    let all: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const res = await supabase.from(tableName).select('*').range(from, from + step - 1);
      if (res.error) {
        console.warn(`[Supabase fetch] Error on ${tableName}:`, res.error.message);
        return null;
      }
      if (!res.data || res.data.length === 0) break;
      all = all.concat(res.data);
      if (res.data.length < step) break;
      from += step;
    }

    const mapped = all.map(row => {
      if (row.data && typeof row.data === 'object') {
        return { ...row.data, id: row.id };
      }
      return row;
    }) as T[];

    // Sync local cache with authoritative server state (excluding appointments to avoid quota/freeze)
    if (typeof window !== 'undefined' && tableName !== 'appointments') {
      try {
        localStorage.setItem(`medflow_local_${tableName}`, JSON.stringify(mapped));
      } catch (e) {}
    }

    return mapped;
  } catch (err: any) {
    console.warn(`[Supabase fetch] Exception on ${tableName}:`, err?.message || err);
    return null;
  }
}

export async function saveSupabaseItem(tableName: string, id: string, itemData: any): Promise<boolean> {
  // Save to local storage as continuous fallback (skip appointments to prevent UI freeze)
  updateLocalTableCache(tableName, list => {
    const filtered = list.filter(item => item.id !== id);
    filtered.push({ ...itemData, id });
    return filtered;
  });

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Standard format: tables are structured with a JSONB 'data' column
      const { error } = await supabase.from(tableName).upsert({ id, data: itemData });
      if (!error) {
        return true;
      }
      console.warn(`[Supabase saveItem] Attempt ${attempt}/${maxAttempts} failed on ${tableName}/${id}:`, error.message);
    } catch (err: any) {
      console.warn(`[Supabase saveItem] Attempt ${attempt}/${maxAttempts} exception on ${tableName}/${id}:`, err?.message || err);
    }
    if (attempt < maxAttempts) {
      await wait(attempt * 300);
    }
  }
  return false;
}

export async function saveSupabaseBatch(tableName: string, items: Array<{ id: string; data: any }>): Promise<boolean> {
  if (!items || items.length === 0) return true;

  updateLocalTableCache(tableName, list => {
    const incomingMap = new Map(items.map(i => [i.id, { ...i.data, id: i.id }]));
    const kept = list.filter(item => !incomingMap.has(item.id));
    return [...kept, ...Array.from(incomingMap.values())];
  });

  let allSucceeded = true;
  try {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE).map(item => ({
        id: item.id,
        data: item.data
      }));
      const { error } = await supabase.from(tableName).upsert(chunk);
      if (error) {
        console.warn(`Supabase batch upsert note on ${tableName} (chunk ${i}): ${error.message}`);
        await wait(250);
        const retryRes = await supabase.from(tableName).upsert(chunk);
        if (retryRes.error) {
          // Fallback to individual upsert if chunk still failed
          for (const singleItem of chunk) {
            const singleRes = await supabase.from(tableName).upsert(singleItem);
            if (singleRes.error) {
              console.warn(`Supabase single fallback failed on ${tableName}/${singleItem.id}:`, singleRes.error.message);
              allSucceeded = false;
            }
          }
        }
      }
    }
    return allSucceeded;
  } catch (err: any) {
    console.warn(`Supabase batch save catch note on ${tableName}:`, err);
    return false;
  }
}

export async function deleteSupabaseItem(tableName: string, id: string): Promise<boolean> {
  updateLocalTableCache(tableName, list => list.filter(item => item.id !== id));

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (!error) {
        return true;
      }
      console.warn(`Supabase delete note for ${tableName}/${id} (attempt ${attempt}): ${error.message}`);
    } catch (err: any) {
      console.warn(`Supabase delete note for ${tableName}/${id} (attempt ${attempt}): ${err?.message || err}`);
    }
    if (attempt < maxAttempts) {
      await wait(300);
    }
  }
  return false;
}

export async function deleteSupabaseBatch(tableName: string, ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;

  const idSet = new Set(ids);
  updateLocalTableCache(tableName, list => list.filter(item => !idSet.has(item.id)));

  let allSucceeded = true;
  try {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunkIds = ids.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from(tableName).delete().in('id', chunkIds);
      if (error) {
        console.warn(`Supabase batch delete note on ${tableName}: ${error.message}`);
        await wait(250);
        const retryRes = await supabase.from(tableName).delete().in('id', chunkIds);
        if (retryRes.error) {
          allSucceeded = false;
        }
      }
    }
    return allSucceeded;
  } catch (err: any) {
    console.warn(`Supabase batch delete catch note on ${tableName}:`, err);
    return false;
  }
}

export async function resetSupabaseDatabase(): Promise<boolean> {
  try {
    const tables = ['patients', 'staff', 'appointments', 'machine_shifts', 'attendance', 'procedures', 'users', 'schedule_snapshots', 'scheduleSnapshots', 'backups'];
    for (const tableName of tables) {
      const { error } = await supabase.from(tableName).delete().neq('id', 'dummy_nonexistent_id');
      if (error) {
        console.warn(`Error resetting table ${tableName} on Supabase:`, error.message);
      }
    }
    return true;
  } catch (err: any) {
    console.warn("Catch error in resetSupabaseDatabase:", err?.message || err);
    return false;
  }
}

export async function fetchScheduleSnapshotsFromSupabase(): Promise<any[] | null> {
  try {
    // 1. Fetch from templates table where id starts with snap_
    const { data: tmplSnaps, error: tmplErr } = await supabase
      .from('templates')
      .select('*')
      .like('id', 'snap_%');

    if (tmplErr) {
      console.warn('Error fetching snapshots from Supabase:', tmplErr.message);
      return null;
    }

    if (tmplSnaps && tmplSnaps.length > 0) {
      const mapped = tmplSnaps.map(row => {
        const rawId = row.id.replace(/^snap_/, '');
        if (row.data && typeof row.data === 'object') {
          return { ...row.data, id: rawId };
        }
        return { ...row, id: rawId };
      });
      if (typeof window !== 'undefined') {
        try {
          const trimmed = mapped.slice(-30);
          localStorage.setItem('medflow_schedule_snapshots', JSON.stringify(trimmed));
          localStorage.setItem('medflow_local_schedule_snapshots', JSON.stringify(trimmed));
        } catch (e) {}
      }
      return mapped;
    }

    return [];
  } catch (e) {
    console.warn('Error fetching snapshots from Supabase:', e);
    return null;
  }
}

export async function saveScheduleSnapshotToSupabase(snapshot: any): Promise<boolean> {
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

    // Save to local storage for immediate browser persistence
    if (typeof window !== 'undefined') {
      try {
        const localKey = 'medflow_schedule_snapshots';
        const existing = localStorage.getItem(localKey);
        let list: any[] = existing ? JSON.parse(existing) : [];
        list = list.filter(item => !(item.deptId === cleanSnapshot.deptId && item.date === cleanSnapshot.date));
        list.push(cleanSnapshot);
        const trimmed = list.slice(-30);
        localStorage.setItem(localKey, JSON.stringify(trimmed));
        localStorage.setItem('medflow_local_schedule_snapshots', JSON.stringify(trimmed));
      } catch (e) {}
    }

    // Save to templates table as reliable JSONB store (with retry)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { error: tmplErr } = await supabase.from('templates').upsert({
        id: `snap_${rawSnapId}`,
        data: cleanSnapshot
      });
      if (!tmplErr) {
        return true;
      }
      console.warn(`Error saving snapshot to Supabase templates (attempt ${attempt}):`, tmplErr.message);
      if (attempt < 2) await wait(300);
    }
    return false;
  } catch (e) {
    console.warn('Error in saveScheduleSnapshotToSupabase:', e);
    return false;
  }
}

export async function deleteScheduleSnapshotFromSupabase(snapshotId: string): Promise<boolean> {
  try {
    const rawSnapId = snapshotId.replace(/^snap_/, '');
    const { error } = await supabase.from('templates').delete().eq('id', `snap_${rawSnapId}`);
    return !error;
  } catch (e) {
    return false;
  }
}


