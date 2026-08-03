import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectTemplatesAndAppts() {
  const { data: templates } = await supabase.from('templates').select('*');
  const allT = (templates || []).map(r => r.data || r);
  console.log("Total templates:", allT.length);

  const t412 = allT.filter(t => t.name.includes("412") || t.bedNumber === "412");
  console.log("Templates for bed 412:", t412);

  // Check appointments on 31/07/2026 for ALL patients in dept_lao
  const { data: appts } = await supabase.from('appointments').select('*');
  const allA = (appts || []).map(r => r.data || r);
  const jul31Appts = allA.filter(a => a.date === '2026-07-31');
  console.log("\nAppointments on 2026-07-31:", jul31Appts.length);
  jul31Appts.forEach(a => console.log(`- ID: ${a.id} | Patient: ${a.patientId} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime} | Staff: ${a.staffId} | Asst: ${a.assistant1Id}`));
}

inspectTemplatesAndAppts();
