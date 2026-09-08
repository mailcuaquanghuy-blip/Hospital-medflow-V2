import { supabase } from '../supabaseClient';

export function isSupabaseConfigured(): boolean {
  return true;
}

export async function fetchSupabaseTable<T>(tableName: string): Promise<T[] | null> {
  try {
    let all: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const res = await supabase.from(tableName).select('*').range(from, from + step - 1);
      if (res.error) {
        // If table not found in schema cache, try reading from localStorage fallback
        if (typeof window !== 'undefined') {
          const localData = localStorage.getItem(`medflow_local_${tableName}`);
          if (localData) {
            try {
              return JSON.parse(localData) as T[];
            } catch (e) {
              // ignore
            }
          }
        }
        return [];
      }
      if (!res.data || res.data.length === 0) break;
      all = all.concat(res.data);
      if (res.data.length < step) break;
      from += step;
    }

    if (all.length === 0) {
      if (typeof window !== 'undefined') {
        const localData = localStorage.getItem(`medflow_local_${tableName}`);
        if (localData) {
          try {
            return JSON.parse(localData) as T[];
          } catch (e) {}
        }
      }
      return [];
    }

    return all.map(row => {
      if (row.data && typeof row.data === 'object') {
        return { ...row.data, id: row.id };
      }
      return row;
    }) as T[];
  } catch (err) {
    if (typeof window !== 'undefined') {
      const localData = localStorage.getItem(`medflow_local_${tableName}`);
      if (localData) {
        try {
          return JSON.parse(localData) as T[];
        } catch (e) {}
      }
    }
    return [];
  }
}

export async function saveSupabaseItem(tableName: string, id: string, itemData: any): Promise<boolean> {
  try {
    // Save to local storage as continuous fallback
    if (typeof window !== 'undefined') {
      try {
        const localKey = `medflow_local_${tableName}`;
        const existing = localStorage.getItem(localKey);
        let list: any[] = existing ? JSON.parse(existing) : [];
        list = list.filter(item => item.id !== id);
        list.push({ ...itemData, id });
        localStorage.setItem(localKey, JSON.stringify(list));
      } catch (e) {}
    }

    // We only use the standard format since all our tables are structured with a JSONB 'data' column
    const { error } = await supabase.from(tableName).upsert({ id, data: itemData });
    if (error) {
      return false;
    }
    return true;
  } catch (err: any) {
    return false;
  }
}

export async function saveSupabaseBatch(tableName: string, items: Array<{ id: string; data: any }>): Promise<boolean> {
  if (!items || items.length === 0) return true;
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
        // Fallback to individual upsert if chunk failed
        for (const singleItem of chunk) {
          await supabase.from(tableName).upsert(singleItem);
        }
      }
    }
    return true;
  } catch (err: any) {
    console.warn(`Supabase batch save catch note on ${tableName}:`, err);
    return false;
  }
}

export async function deleteSupabaseItem(tableName: string, id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
      console.warn(`Supabase delete note for ${tableName}: ${error.message}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`Supabase delete note for ${tableName}: ${err?.message || err}`);
    return false;
  }
}

export async function deleteSupabaseBatch(tableName: string, ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  try {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunkIds = ids.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from(tableName).delete().in('id', chunkIds);
      if (error) {
        console.warn(`Supabase batch delete note on ${tableName}: ${error.message}`);
      }
    }
    return true;
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

export async function fetchScheduleSnapshotsFromSupabase(): Promise<any[]> {
  try {
    // 1. Fetch from templates table where id starts with snap_
    const { data: tmplSnaps, error: tmplErr } = await supabase
      .from('templates')
      .select('*')
      .like('id', 'snap_%');

    if (!tmplErr && tmplSnaps && tmplSnaps.length > 0) {
      return tmplSnaps.map(row => {
        const rawId = row.id.replace(/^snap_/, '');
        if (row.data && typeof row.data === 'object') {
          return { ...row.data, id: rawId };
        }
        return { ...row, id: rawId };
      });
    }

    return [];
  } catch (e) {
    console.warn('Error fetching snapshots from Supabase:', e);
    return [];
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
        localStorage.setItem(localKey, JSON.stringify(list));
        localStorage.setItem('medflow_local_schedule_snapshots', JSON.stringify(list));
      } catch (e) {}
    }

    // Save to templates table as reliable JSONB store
    const { error: tmplErr } = await supabase.from('templates').upsert({
      id: `snap_${rawSnapId}`,
      data: cleanSnapshot
    });
    if (tmplErr) {
      console.warn('Error saving snapshot to Supabase templates:', tmplErr);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Error in saveScheduleSnapshotToSupabase:', e);
    return false;
  }
}

export async function deleteScheduleSnapshotFromSupabase(snapshotId: string): Promise<boolean> {
  try {
    const rawSnapId = snapshotId.replace(/^snap_/, '');
    await supabase.from('templates').delete().eq('id', `snap_${rawSnapId}`);
    return true;
  } catch (e) {
    return false;
  }
}

