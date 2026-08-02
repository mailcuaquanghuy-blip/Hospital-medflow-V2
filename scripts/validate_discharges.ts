import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function validateDischarges() {
  const { data: apptsData } = await supabase.from('appointments').select('*');
  const { data: patientsData } = await supabase.from('patients').select('*');
  const { data: procsData } = await supabase.from('procedures').select('*');

  if (!apptsData || !patientsData || !procsData) {
    console.error("Failed to load data from Supabase");
    return;
  }

  const appointments = apptsData.map(r => r.data || r);
  const patients = patientsData.map(r => r.data || r);
  const procedures = procsData.map(r => r.data || r);

  const patientsMap = patients.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
  const proceduresMap = procedures.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

  // Find all Khám ra viện appointments for dept_lao
  const raVienAppts = appointments.filter(a => {
    const proc = proceduresMap[a.procedureId] || {};
    return a.deptId === 'dept_lao' && proc.name && proc.name.toLowerCase().includes('ra viện');
  });

  console.log("=== Checking Inconsistencies (Khám ra viện appointment but patient is not DISCHARGED or has wrong discharge date) ===");
  let inconsistenciesCount = 0;
  raVienAppts.forEach(a => {
    const p = patientsMap[a.patientId];
    if (p) {
      const dischargeDateStr = p.dischargeDate ? p.dischargeDate.substring(0, 10) : 'null';
      if (p.status !== 'DISCHARGED' || dischargeDateStr !== a.date) {
        console.log(`- Inconsistency: Patient ${p.name} (Bed: ${p.bedNumber}) has 'Khám ra viện' appt on ${a.date} but DB Status: ${p.status}, DB Discharge Date: ${p.dischargeDate}`);
        inconsistenciesCount++;
      }
    }
  });
  console.log(`Total inconsistencies of this type found: ${inconsistenciesCount}`);

  console.log("\n=== Checking Inconsistencies (Patient is DISCHARGED but has no 'Khám ra viện' appointment or has missing appointment on discharge date) ===");
  let secondTypeCount = 0;
  const dischargedLaoPatients = patients.filter(p => p.admittedByDeptId === 'dept_lao' && p.status === 'DISCHARGED');
  
  // Only look at July 2026 discharges to keep it highly relevant to recent data
  const julyDischarges = dischargedLaoPatients.filter(p => p.dischargeDate && p.dischargeDate.startsWith('2026-07'));
  julyDischarges.forEach(p => {
    const dischargeDay = p.dischargeDate ? p.dischargeDate.substring(0, 10) : '';
    const hasApptOnDate = raVienAppts.some(a => a.patientId === p.id && a.date === dischargeDay);
    if (!hasApptOnDate) {
      console.log(`- Inconsistency: Patient ${p.name} (Bed: ${p.bedNumber}) is DISCHARGED on ${p.dischargeDate} but has no 'Khám ra viện' appointment on that date.`);
      secondTypeCount++;
    }
  });
  console.log(`Total July inconsistencies of this type found: ${secondTypeCount}`);
}

validateDischarges().catch(err => console.error(err));
