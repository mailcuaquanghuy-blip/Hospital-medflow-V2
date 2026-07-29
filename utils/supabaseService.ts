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
    const payload = {
      id,
      data: itemData,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from(tableName).upsert(payload);
    if (error) {
      const { error: flatErr } = await supabase.from(tableName).upsert({ id, ...itemData });
      if (flatErr) {
        console.error(`Supabase save error for ${tableName}:`, flatErr.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error(`Supabase save error for ${tableName}:`, err);
    return false;
  }
}

export async function deleteSupabaseItem(tableName: string, id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
      console.error(`Supabase delete error for ${tableName}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Supabase delete error for ${tableName}:`, err);
    return false;
  }
}

