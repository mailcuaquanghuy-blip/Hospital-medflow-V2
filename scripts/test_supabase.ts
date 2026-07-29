import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  console.log("Testing Supabase connection with publishable key...");
  const { data, error } = await supabase.from('patients').select('*').limit(1);
  if (error) {
    console.log("Error querying patients:", error.message);
  } else {
    console.log("Connection successful! Query result length:", data?.length, "Data:", data);
  }
}

testConnection().then(() => process.exit(0)).catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
