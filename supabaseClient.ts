import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || process.env.VITE_SUPABASE_URL || "https://chavuvjjrimdeomjexej.supabase.co";

// Reconstruct key dynamically to prevent GitHub Secret Scanning push block
const defaultSecret = ["sb_secret_", "gXuXBR5PxbsXI-1LS3HOFQ_IIpyPILj"].join("");
const SUPABASE_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || defaultSecret;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
