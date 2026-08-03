import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkJul31AllAppts() {
  const { data: appts } = await supabase.from('appointments').select('*');
  const allA = (appts || []).map(r => r.data || r);

  const jul31Appts = allA.filter(a => a.date === '2026-07-31');
  console.log("Total appointments on 2026-07-31 in Supabase:", jul31Appts.length);

  const { data: patients } = await supabase.from('patients').select('*');
  const pMap = new Map((patients || []).map(r => {
    const p = r.data || r;
    return [p.id, p];
  }));

  jul31Appts.forEach(a => {
    const p = pMap.get(a.patientId);
    console.log(`- ID: ${a.id} | Patient: ${p ? p.name : a.patientId} (${a.patientId}) | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime} | Staff: ${a.staffId}`);
  });
}

checkJul31AllAppts();
