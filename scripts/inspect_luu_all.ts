import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectHoangThiLuuAllDates() {
  const { data: appts } = await supabase.from('appointments').select('*');
  const allA = (appts || []).map(r => r.data || r);
  
  const luuAppts = allA.filter(a => a.patientId === 'p_s9c9eqrsw');
  console.log(`Total appointments for Hoàng Thị Lưu (p_s9c9eqrsw): ${luuAppts.length}`);
  luuAppts.forEach(a => {
    console.log(`Date: ${a.date} | ID: ${a.id} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime} | Staff: ${a.staffId} | Asst1: ${a.assistant1Id}`);
  });

  // Let's also check if there are appointments in Firebase or scripts or backup files for p_s9c9eqrsw or 2026-07-31!
}

inspectHoangThiLuuAllDates();
