import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSupabaseSept() {
  const { data, error } = await supabase.from('appointments').select('*');
  if (error) {
    console.error("Error fetching appointments from Supabase:", error);
    return;
  }
  console.log(`Total appointments in Supabase: ${data.length}`);

  const sept5 = data.filter(r => (r.data || r).date === '2026-09-05');
  const sept6 = data.filter(r => (r.data || r).date === '2026-09-06');

  console.log(`Supabase 2026-09-05 appointments count: ${sept5.length}`);
  console.log(`Supabase 2026-09-06 appointments count: ${sept6.length}`);
}

checkSupabaseSept().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
