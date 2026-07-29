import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://jtfzhraqhkouwgrhnxxe.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_m3E7qshhvfVZycrpgA791Q_i_udLHb8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
