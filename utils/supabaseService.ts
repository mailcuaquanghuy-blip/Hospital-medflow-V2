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
        console.warn(`Supabase fetch error for table ${tableName}:`, res.error.message);
        break;
      }
      if (!res.data || res.data.length === 0) break;
      all = all.concat(res.data);
      if (res.data.length < step) break;
      from += step;
    }

    if (all.length === 0) return [];

    return all.map(row => {
      if (row.data && typeof row.data === 'object') {
        return { ...row.data, id: row.id };
      }
      return row;
    }) as T[];
  } catch (err) {
    console.warn(`Supabase fetch error for ${tableName}:`, err);
    return null;
  }
}

export async function saveSupabaseItem(tableName: string, id: string, itemData: any): Promise<boolean> {
  try {
    // We only use the standard format since all our tables are structured with a JSONB 'data' column
    const { error } = await supabase.from(tableName).upsert({ id, data: itemData });
    if (error) {
      console.warn(`Supabase upsert note on ${tableName}/${id}: ${error.message}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`Supabase save catch note on ${tableName}/${id}: ${err?.message || err}`);
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

export async function resetSupabaseDatabase(): Promise<boolean> {
  try {
    const tables = ['patients', 'staff', 'appointments', 'machine_shifts', 'attendance', 'procedures', 'users'];
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

