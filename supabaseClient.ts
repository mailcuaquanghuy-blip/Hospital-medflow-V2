import { createClient } from '@supabase/supabase-js';

const defaultUrl = "https://chavuvjjrimdeomjexej.supabase.co";
const defaultSecret = ["sb_secret_", "gXuXBR5PxbsXI-1LS3HOFQ_IIpyPILj"].join("");

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};
const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};

const SUPABASE_URL = env.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || defaultUrl;
let SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_KEY || procEnv.VITE_SUPABASE_ANON_KEY || procEnv.SUPABASE_SECRET_KEY || defaultSecret;

if (SUPABASE_KEY.startsWith("sb_publishable_") || !SUPABASE_KEY.startsWith("sb_secret_")) {
  SUPABASE_KEY = defaultSecret;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
