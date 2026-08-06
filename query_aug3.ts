import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAug3() {
  console.log("\n--- QUERYING SUPABASE ---");
  const { data: sbSnap, error } = await supabase
    .from("appointments")
    .select("*");
  
  if (error) {
    console.error("Supabase error:", error.message);
    return;
  }

  const sbAppts = (sbSnap || []).map(r => r.data || r);
  console.log(`Total appointments in Supabase: ${sbAppts.length}`);

  const aug3Appts = sbAppts.filter(a => a.date && a.date.includes("2026-08-03"));
  console.log(`Supabase appointments with date containing '2026-08-03': ${aug3Appts.length}`);
  aug3Appts.forEach(a => {
    console.log(`  - ID: ${a.id}, PatientId: ${a.patientId}, StaffId: ${a.staffId}, ProcId: ${a.procedureId}, Date: ${a.date}, StartTime: ${a.startTime}`);
  });

  // Let's also print appointments containing today's date
  const todayStr = "2026-08-03";
  const matchedPatients = new Set(aug3Appts.map(a => a.patientId));
  
  if (matchedPatients.size > 0) {
    console.log("\n--- ASSOCIATED PATIENTS ---");
    const { data: patSnap } = await supabase
      .from("patients")
      .select("*")
      .in("id", Array.from(matchedPatients));
    
    (patSnap || []).forEach(p => {
      const pData = p.data || p;
      console.log(`  - Patient ID: ${pData.id}, Name: ${pData.name}, Admission: ${pData.admissionDate}, Discharge: ${pData.dischargeDate}, Status: ${pData.status}`);
    });
  }
}

checkAug3().catch(console.error);
