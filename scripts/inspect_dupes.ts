import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectHoangThiLuu() {
  const { data: patients } = await supabase.from('patients').select('*');
  const luu = (patients || []).map(r => r.data || r).find(p => p.name.includes("Hoàng Thị Lưu") || p.name.includes("Lưu"));
  console.log("Patient:", luu);

  if (luu) {
    const { data: appts } = await supabase.from('appointments').select('*');
    const luuAppts = (appts || []).map(r => r.data || r).filter(a => a.patientId === luu.id && a.date === '2026-07-31');
    console.log(`Appointments for ${luu.name} on 2026-07-31:`, luuAppts.length);
    luuAppts.forEach(a => {
      console.log(`- ID: ${a.id} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime} | Staff: ${a.staffId} | Asst1: ${a.assistant1Id}`);
    });
  }

  // Let's also check if there are duplicate appointments across ALL patients on 2026-07-31 or other dates!
  const { data: allApptsRows } = await supabase.from('appointments').select('*');
  const allAppts = (allApptsRows || []).map(r => r.data || r);

  const jul31 = allAppts.filter(a => a.date === '2026-07-31');
  console.log(`\nTotal appointments on 2026-07-31: ${jul31.length}`);

  // Check how many exact or overlapping duplicate appointments exist for same patient & same procedure on 2026-07-31
  const apptsByPatientProc: Record<string, any[]> = {};
  jul31.forEach(a => {
    const key = `${a.patientId}_${a.procedureId}`;
    if (!apptsByPatientProc[key]) apptsByPatientProc[key] = [];
    apptsByPatientProc[key].push(a);
  });

  const dupes = Object.entries(apptsByPatientProc).filter(([k, list]) => list.length > 1);
  console.log(`Number of patient-procedure groups with >1 appointment on 2026-07-31: ${dupes.length}`);
  dupes.forEach(([key, list]) => {
    console.log(`\nGroup ${key}:`);
    list.forEach(a => console.log(`  ID: ${a.id}, Time: ${a.startTime}-${a.endTime}, Staff: ${a.staffId}`));
  });
}

inspectHoangThiLuu();
