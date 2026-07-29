import { supabase } from '../supabaseClient';

export function isSupabaseConfigured(): boolean {
  const key = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || process.env.VITE_SUPABASE_ANON_KEY || "";
  return Boolean(key && key.trim().length > 0 && key !== 'dummy_anon_key');
}

export async function fetchSupabaseTable<T>(tableName: string): Promise<T[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.warn(`Supabase fetch error for table ${tableName}:`, error.message);
      return null;
    }
    // Parse wrapped json data if stored as { id, data: { ... } } or raw table columns
    return (data || []).map(row => {
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
  if (!isSupabaseConfigured()) return false;
  try {
    const payload = {
      id,
      data: itemData,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from(tableName).upsert(payload);
    if (error) {
      // Try fallback direct upsert if table uses flat schema
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
  if (!isSupabaseConfigured()) return false;
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
