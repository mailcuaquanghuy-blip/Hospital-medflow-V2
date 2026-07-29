import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || "https://jtfzhraqhkouwgrhnxxe.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  console.log("Testing Supabase connection...");
  const { data, error } = await supabase.from('app_data').select('*').limit(1);
  if (error) {
    console.log("Error querying app_data:", error.message);
  } else {
    console.log("Connection successful! Query result:", data);
  }
}

testConnection().then(() => process.exit(0)).catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
