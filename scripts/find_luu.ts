import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findHoangThiLuu() {
  const { data: patients } = await supabase.from('patients').select('*');
  const allP = (patients || []).map(r => r.data || r);
  console.log("Searching for Lưu:");
  const luus = allP.filter(p => p.name.includes("Lưu"));
  console.log("Lưu patients:", luus);

  // Search all appointments on 2026-07-31 or 31/07/2026 across all dates
  const { data: appts } = await supabase.from('appointments').select('*');
  const allA = (appts || []).map(r => r.data || r);
  
  // Find appointments with patient name matching Hoang Thi Luu or patientId from luus
  const luuIds = new Set(luus.map(p => p.id));
  const luuAppts = allA.filter(a => luuIds.has(a.patientId));
  console.log("\nAppointments for any Lưu patient across all dates:");
  luuAppts.forEach(a => console.log(`Date: ${a.date} | ID: ${a.id} | Patient: ${a.patientId} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime}`));

  // Also search for patient "Hoàng Thị Lưu" specifically in Firebase or other scripts if it was imported/created differently
  const hoangs = allP.filter(p => p.name.toLowerCase().includes("hoàng"));
  console.log("\nHoàng patients:", hoangs.map(p => ({ id: p.id, name: p.name, bedNumber: p.bedNumber })));
}

findHoangThiLuu();
