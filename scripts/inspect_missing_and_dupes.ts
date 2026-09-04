import { supabase } from '../supabaseClient';

async function main() {
  // Fetch all patients, templates, procedures, staff, appointments
  let allAppts: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allAppts = allAppts.concat(data.map(r => r.data || r));
    if (data.length < 1000) break;
    from += 1000;
  }

  let allPatients: any[] = [];
  from = 0;
  while (true) {
    const { data } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allPatients = allPatients.concat(data.map(r => r.data || r));
    if (data.length < 1000) break;
    from += 1000;
  }

  const { data: tmpls } = await supabase.from('templates').select('*');
  const templates = tmpls?.map(t => t.data || t) || [];

  const treatingLao = allPatients.filter(p => p.admittedByDeptId === 'dept_lao' && p.status === 'TREATING');

  console.log(`Treating Lao Patients: ${treatingLao.length}`);

  // Find matching template for each treating patient by Bed number or Name
  console.log('\n--- TREATING PATIENTS & THEIR MATCHING TEMPLATES ---');
  for (const p of treatingLao) {
    // Look for template with matching bed number
    const bedClean = (p.bedNumber || '').trim();
    const matchingTmpls = templates.filter(t => {
      if (t.deptId !== 'dept_lao') return false;
      const name = t.name || '';
      return name.includes(`Giường ${bedClean} `) || name.startsWith(`Giường ${bedClean}-`) || name.startsWith(`Giường ${bedClean} `) || name.includes(bedClean);
    });

    console.log(`Patient [${p.id}] ${p.name} | Bed: "${p.bedNumber}" | Adm: ${p.admissionDate}`);
    if (matchingTmpls.length === 0) {
      console.log(`   --> NO TEMPLATE MATCH FOUND!`);
    } else {
      matchingTmpls.forEach(t => {
        console.log(`   --> Template [${t.id}] "${t.name}" (${t.group}) - ${t.procedures?.length || 0} procs`);
      });
    }
  }

  // Check which treating patients have 0 appointments on 2026-09-04 / 2026-09-05 / 2026-09-06
  const testDates = ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'];
  for (const d of testDates) {
    const dAppts = allAppts.filter(a => a.date === d && a.deptId === 'dept_lao');
    const patApptCount: Record<string, number> = {};
    for (const a of dAppts) {
      patApptCount[a.patientId] = (patApptCount[a.patientId] || 0) + 1;
    }

    console.log(`\nDate ${d}:`);
    for (const p of treatingLao) {
      const count = patApptCount[p.id] || 0;
      if (count === 0) {
        console.log(`   [MISSING 0 APPTS] ${p.name} (Bed ${p.bedNumber}, ID ${p.id})`);
      } else if (count > 3) {
        console.log(`   [DUPLICATE ${count} APPTS] ${p.name} (Bed ${p.bedNumber}, ID ${p.id})`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(console.error);
