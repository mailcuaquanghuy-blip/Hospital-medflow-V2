import { supabase } from '../supabaseClient';

async function main() {
  // 1. Fetch all data
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

  const { data: procs } = await supabase.from('procedures').select('*');
  const procedures = procs?.map(p => p.data || p) || [];

  const { data: stf } = await supabase.from('staff').select('*');
  const staff = stf?.map(s => s.data || s) || [];

  console.log(`Loaded ${allAppts.length} appointments, ${allPatients.length} patients, ${templates.length} templates, ${procedures.length} procedures, ${staff.length} staff.`);

  const patMap = new Map(allPatients.map(p => [p.id, p]));
  const procMap = new Map(procedures.map(p => [p.id, p]));
  const staffMap = new Map(staff.map(s => [s.id, s]));

  // Check invalid references
  let invalidPat = 0, invalidProc = 0, invalidStaff = 0;
  for (const a of allAppts) {
    if (!patMap.has(a.patientId)) invalidPat++;
    if (!procMap.has(a.procedureId)) invalidProc++;
    if (a.staffId && !staffMap.has(a.staffId)) invalidStaff++;
  }
  console.log(`Invalid references: Pat=${invalidPat}, Proc=${invalidProc}, Staff=${invalidStaff}`);

  // Let's inspect appointments for August 2026 and September 2026
  const dates = Array.from(new Set(allAppts.map(a => a.date))).sort();
  const recentDates = dates.filter(d => d >= '2026-08-01');

  console.log('\n=== DATE-BY-DATE ANALYSIS (From 2026-08-01 onwards) ===');
  for (const date of recentDates) {
    const dayAppts = allAppts.filter(a => a.date === date && a.deptId === 'dept_lao');
    
    // Group by patient
    const byPat: Record<string, any[]> = {};
    for (const a of dayAppts) {
      if (!byPat[a.patientId]) byPat[a.patientId] = [];
      byPat[a.patientId].push(a);
    }

    // Check how many have duplicate procedures (same procedureId multiple times on same day)
    let duplicateProcCount = 0;
    let excessiveCount = 0; // > 3 procedures
    for (const [pId, apptList] of Object.entries(byPat)) {
      const procIds = apptList.map(a => a.procedureId);
      const uniqueProcs = new Set(procIds);
      if (uniqueProcs.size < procIds.length) {
        duplicateProcCount++;
      }
      if (apptList.length > 3) {
        excessiveCount++;
      }
    }

    console.log(`Date: ${date} | Total Appts: ${dayAppts.length} | Unique Patients: ${Object.keys(byPat).length} | Pats with duplicate same-procedure: ${duplicateProcCount} | Pats with >3 procs: ${excessiveCount}`);
    
    // If date is in Aug 1-7 or Sept 1-7, print sample details
    if (['2026-08-01', '2026-08-03', '2026-09-04', '2026-09-05'].includes(date)) {
      console.log(`  Details for ${date}:`);
      for (const [pId, apptList] of Object.entries(byPat).slice(0, 5)) {
        const pat = patMap.get(pId);
        console.log(`    Patient [${pId}] ${pat?.name} (Bed: ${pat?.bedNumber}): ${apptList.length} appts`);
        apptList.forEach(a => {
          const pr = procMap.get(a.procedureId);
          const st = staffMap.get(a.staffId);
          console.log(`      - ${a.id}: ${pr?.name || a.procedureId} (${a.startTime}-${a.endTime}) Staff: ${st?.name || a.staffId}`);
        });
      }
    }
  }
}

main().then(() => process.exit(0)).catch(console.error);
