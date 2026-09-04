import { supabase } from '../supabaseClient';

async function main() {
  // 1. Fetch all appointments
  let allAppts: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allAppts = allAppts.concat(data.map(r => r.data || r));
    if (data.length < 1000) break;
    from += 1000;
  }

  // 2. Fetch all patients
  let allPatients: any[] = [];
  from = 0;
  while (true) {
    const { data } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    allPatients = allPatients.concat(data.map(r => r.data || r));
    if (data.length < 1000) break;
    from += 1000;
  }

  // 3. Fetch all templates
  const { data: tmpls } = await supabase.from('templates').select('*');
  const templates = tmpls?.map(t => t.data || t) || [];

  // 4. Fetch all procedures
  const { data: procs } = await supabase.from('procedures').select('*');
  const procedures = procs?.map(p => p.data || p) || [];

  // 5. Fetch all staff
  const { data: stf } = await supabase.from('staff').select('*');
  const staff = stf?.map(s => s.data || s) || [];

  const patMap = new Map(allPatients.map(p => [p.id, p]));
  const procMap = new Map(procedures.map(p => [p.id, p]));
  const staffMap = new Map(staff.map(s => [s.id, s]));

  console.log(`Total appts: ${allAppts.length}`);

  // Let's check for each date:
  // 1. How many appointments?
  // 2. Are there exact duplicates (same patientId, same date, same procedureId)?
  // 3. Are there overlapping appointments for the same patient?
  const dates = Array.from(new Set(allAppts.map(a => a.date))).sort();

  for (const d of dates) {
    const dayAppts = allAppts.filter(a => a.date === d && a.deptId === 'dept_lao');
    const patGroups: Record<string, any[]> = {};
    for (const a of dayAppts) {
      if (!patGroups[a.patientId]) patGroups[a.patientId] = [];
      patGroups[a.patientId].push(a);
    }

    let dupesCount = 0;
    const dupePats: string[] = [];
    for (const [pId, list] of Object.entries(patGroups)) {
      const procSeen = new Set();
      let hasDupe = false;
      for (const a of list) {
        if (procSeen.has(a.procedureId)) {
          hasDupe = true;
          break;
        }
        procSeen.add(a.procedureId);
      }
      if (hasDupe) {
        dupesCount++;
        const p = patMap.get(pId);
        dupePats.push(`${p?.name || pId} (${list.length} appts)`);
      }
    }

    if (dupesCount > 0) {
      console.log(`Date: ${d} | Appts: ${dayAppts.length} | Pats with duplicate procedures: ${dupesCount}`);
      if (dupePats.length <= 10) {
        console.log(`   Dupes in: ${dupePats.join(', ')}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(console.error);
