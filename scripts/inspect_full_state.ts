import { supabase } from '../supabaseClient';
import fs from 'fs';

async function main() {
  // 1. Fetch all patients
  let patients: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    patients = patients.concat(data.map(r => r.data || r));
    if (data.length < 1000) break;
    from += 1000;
  }

  // 2. Fetch all templates
  const { data: tmpls } = await supabase.from('templates').select('*');
  const templates = tmpls?.map(t => t.data || t) || [];

  // 3. Fetch all procedures
  const { data: procs } = await supabase.from('procedures').select('*');
  const procedures = procs?.map(p => p.data || p) || [];

  // 4. Fetch all staff
  const { data: stf } = await supabase.from('staff').select('*');
  const staff = stf?.map(s => s.data || s) || [];

  console.log('=== SUMMARY ===');
  console.log('Total patients:', patients.length);
  console.log('Total templates:', templates.length);
  console.log('Total procedures:', procedures.length);
  console.log('Total staff:', staff.length);

  // Group patients by department & status
  const patStatus: Record<string, { treating: number; discharged: number; total: number }> = {};
  for (const p of patients) {
    const dept = p.admittedByDeptId || 'unknown';
    if (!patStatus[dept]) patStatus[dept] = { treating: 0, discharged: 0, total: 0 };
    patStatus[dept].total++;
    if (p.status === 'TREATING') patStatus[dept].treating++;
    else patStatus[dept].discharged++;
  }
  console.log('\nPatients by Department and Status:');
  console.log(patStatus);

  // Print all 68 Lao templates
  console.log('\n=== LAO TEMPLATES ===');
  const laoTemplates = templates.filter(t => t.deptId === 'dept_lao');
  laoTemplates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  for (const t of laoTemplates) {
    console.log(`[${t.id}] "${t.name}" | Group: "${t.group || ''}" | Procs: ${t.procedures?.length || 0}`);
  }

  // Print treating Lao patients
  console.log('\n=== TREATING LAO PATIENTS ===');
  const treatingLao = patients.filter(p => p.admittedByDeptId === 'dept_lao' && p.status === 'TREATING');
  for (const p of treatingLao) {
    console.log(`[${p.id}] Code: "${p.code}" | Name: "${p.name}" | Bed: "${p.bedNumber}" | Room: "${p.roomNumber || ''}" | Adm: "${p.admissionDate}"`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
