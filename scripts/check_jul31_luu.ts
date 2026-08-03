import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkJul31Luu() {
  const { data: appts } = await supabase.from('appointments').select('*');
  const allA = (appts || []).map(r => r.data || r);

  const jul31Luu = allA.filter(a => a.date === '2026-07-31' && a.patientId === 'p_s9c9eqrsw');
  console.log("Supabase appointments for Hoàng Thị Lưu (p_s9c9eqrsw) on 2026-07-31:", jul31Luu.length);
  jul31Luu.forEach(a => console.log(a));
}

checkJul31Luu();
