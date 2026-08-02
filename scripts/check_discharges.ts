import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDischarges() {
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

  const targetDate = '2026-07-31';
  const dayAppts = appointments.filter(a => a.date === targetDate && a.deptId === 'dept_lao');

  console.log(`=== Appointments on ${targetDate} (dept_lao) ===`);
  dayAppts.forEach(a => {
    const p = patientsMap[a.patientId] || {};
    const proc = proceduresMap[a.procedureId] || {};
    console.log(`- Patient: ${p.name} (Bed: ${p.bedNumber}, Room: ${p.roomNumber}) | Proc: ${proc.name} | Time: ${a.startTime} - ${a.endTime}`);
  });

  // Find all Khám ra viện appointments across all dates
  console.log("\n=== Checking all 'Khám ra viện' appointments in the database ===");
  const raVienAppts = appointments.filter(a => {
    const proc = proceduresMap[a.procedureId] || {};
    return proc.name && proc.name.toLowerCase().includes('ra viện');
  });
  raVienAppts.sort((a,b) => a.date.localeCompare(b.date)).forEach(a => {
    const p = patientsMap[a.patientId] || {};
    const proc = proceduresMap[a.procedureId] || {};
    console.log(`- Date: ${a.date} | Patient: ${p.name} (Bed: ${p.bedNumber}) | Proc: ${proc.name} | StaffId: ${a.staffId} | Time: ${a.startTime} - ${a.endTime}`);
  });

  // Check what templates exist for the target beds
  const { data: templatesData } = await supabase.from('templates').select('*');
  const templates = templatesData ? templatesData.map(r => r.data || r) : [];
  console.log("\n=== Checking templates for target beds ===");
  const targetBeds = ['462', '455', '473', '458', '463'];
  const targetTemplates = templates.filter(t => targetBeds.some(b => t.name && t.name.includes(b)));
  targetTemplates.forEach(t => {
    console.log(`- Template ID: ${t.id} | Name: ${t.name} | DeptId: ${t.deptId}`);
    if (t.procedures) {
      t.procedures.forEach((p: any) => {
        const proc = proceduresMap[p.procedureId] || {};
        console.log(`    - ProcId: ${p.procedureId} (${proc.name}) | Time: ${p.startTime} - ${p.endTime}`);
      });
    }
  });

  // Specifically check for patients with bed matching target beds
  console.log('\n=== Checking matching patients and all their appointments ===');
  const targetPatients = patients.filter(p => targetBeds.some(b => p.bedNumber && p.bedNumber.includes(b)));
  
  targetPatients.forEach(p => {
    console.log(`\nPatient: ${p.name} (Bed: ${p.bedNumber}, Room: ${p.roomNumber})`);
    console.log(`  Status: ${p.status} | Admission: ${p.admissionDate} | Discharge: ${p.dischargeDate}`);
    const patAppts = appointments.filter(a => a.patientId === p.id).sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    console.log('  Appointments:');
    patAppts.forEach(a => {
      const proc = proceduresMap[a.procedureId] || {};
      console.log(`    - ${a.date} | ${a.startTime} - ${a.endTime} | ${proc.name}`);
    });
  });
}

checkDischarges().catch(err => console.error(err));
