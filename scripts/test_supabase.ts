import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  console.log("Testing Supabase templates table query...");
  const { data, error } = await supabase.from('templates').select('*').limit(1);
  if (error) {
    console.log("Error querying templates:", error.message);
  } else {
    console.log("Templates successful! Query result:", data);
  }
}

testConnection().then(() => process.exit(0)).catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
