import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || process.env.VITE_SUPABASE_URL || "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || process.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || 'dummy_anon_key');
