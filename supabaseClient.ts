import { createClient } from '@supabase/supabase-js';

const defaultUrl = "https://chavuvjjrimdeomjexej.supabase.co";
const defaultAnonKey = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};
const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};

const SUPABASE_URL = env.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || defaultUrl;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_KEY || procEnv.VITE_SUPABASE_ANON_KEY || procEnv.SUPABASE_KEY || defaultAnonKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
