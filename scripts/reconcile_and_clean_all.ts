import { supabase } from '../supabaseClient';

async function main() {
  console.log('--- STARTING COMPREHENSIVE RECONCILIATION & CLEANUP ---');

  // 1. Fetch all records from Supabase
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

  // 2. Clean up fake templates (e.g. test_test_...)
  const fakeTemplates = templates.filter(t => t.id && t.id.startsWith('test_test_'));
  for (const ft of fakeTemplates) {
    console.log(`Deleting fake template: ${ft.id}`);
    await supabase.from('templates').delete().eq('id', ft.id);
  }

  // 3. Find duplicate appointments across all dates
  // A duplicate is: same patientId + same date + same procedureId
  // Or multiple appointments that were created as clones
  const idsToDelete: string[] = [];
  const byPatDateProc: Record<string, any[]> = {};

  for (const a of allAppts) {
    if (!a.patientId || !a.date || !a.procedureId) {
      idsToDelete.push(a.id);
      continue;
    }
    const key = `${a.patientId}_${a.date}_${a.procedureId}`;
    if (!byPatDateProc[key]) byPatDateProc[key] = [];
    byPatDateProc[key].push(a);
  }

  for (const [key, list] of Object.entries(byPatDateProc)) {
    if (list.length > 1) {
      // Sort to keep the best one:
      // Prefer non-generated ID if possible, or the one with complete staff and room info
      list.sort((a, b) => {
        // If one has staffId and other doesn't
        if (a.staffId && !b.staffId) return -1;
        if (!a.staffId && b.staffId) return 1;
        // Prefer original short IDs over appt_lao_ or long timestamps if equal
        const aIsLao = a.id.startsWith('appt_lao_') ? 1 : 0;
        const bIsLao = b.id.startsWith('appt_lao_') ? 1 : 0;
        if (aIsLao !== bIsLao) return aIsLao - bIsLao;
        return a.id.localeCompare(b.id);
      });

      // Keep index 0, delete the rest
      for (let i = 1; i < list.length; i++) {
        idsToDelete.push(list[i].id);
      }
    }
  }

  console.log(`Found ${idsToDelete.length} duplicate/invalid appointments to delete.`);

  // Batch delete in chunks of 500
  for (let i = 0; i < idsToDelete.length; i += 500) {
    const chunk = idsToDelete.slice(i, i + 500);
    const { error } = await supabase.from('appointments').delete().in('id', chunk);
    if (error) {
      console.error(`Error deleting chunk ${i}:`, error);
    } else {
      console.log(`Deleted chunk ${i} - ${i + chunk.length}`);
    }
  }

  // Update in-memory allAppts
  const remainingAppts = allAppts.filter(a => !idsToDelete.includes(a.id));
  console.log(`Remaining appointments count: ${remainingAppts.length}`);

  // 4. Check active treating patients in Khoa Lão
  const treatingLao = allPatients.filter(p => p.admittedByDeptId === 'dept_lao' && p.status === 'TREATING');
  console.log(`\nTreating Lao patients: ${treatingLao.length}`);

  // Map bed numbers to templates
  const bedToTemplateMap: Record<string, any> = {};
  for (const t of templates) {
    if (t.deptId !== 'dept_lao' || !t.name) continue;
    const match = t.name.match(/Giường\s*(\d+)/i);
    if (match) {
      bedToTemplateMap[match[1]] = t;
    }
  }

  // Also map special slot templates:
  // L28 -> tmpl_uypuyj2g5 (Thêm chiều)
  // L29 -> tmpl_7zd39v48g (Thêm chiều)
  // L30 -> tmpl_8pvh7p70z (Thêm chiều)
  // L47 -> tmpl_fmqobzm6e (Thêm chiều)
  const slotTemplates: Record<string, any> = {
    '462': templates.find(t => t.name === 'L28' || t.id === 'tmpl_uypuyj2g5'),
    '463': templates.find(t => t.name === 'L29' || t.id === 'tmpl_7zd39v48g'),
    '465': templates.find(t => t.name === 'L30' || t.id === 'tmpl_8pvh7p70z'),
  };

  const apptsToAdd: any[] = [];
  const targetDates = ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'];

  for (const p of treatingLao) {
    const bed = (p.bedNumber || '').trim();
    let tmpl = bedToTemplateMap[bed] || slotTemplates[bed];
    
    if (!tmpl) {
      console.warn(`WARNING: No template for patient ${p.name} (Bed ${bed})`);
      continue;
    }

    const admDate = p.admissionDate ? p.admissionDate.split('T')[0] : '2026-09-03';

    for (const d of targetDates) {
      // Only schedule on or after admission date
      if (d < admDate) continue;

      // Check existing appointments for this patient on date d
      const existing = remainingAppts.filter(a => a.patientId === p.id && a.date === d);
      
      if (existing.length === 0) {
        console.log(`Adding missing appointments for ${p.name} (Bed ${bed}) on ${d} using template "${tmpl.name}"`);
        for (const proc of (tmpl.procedures || [])) {
          const apptId = `appt_${d.replace(/-/g, '')}_${p.id}_${proc.procedureId}`;
          const newAppt = {
            id: apptId,
            patientId: p.id,
            procedureId: proc.procedureId,
            staffId: proc.staffId || null,
            deptId: 'dept_lao',
            date: d,
            startTime: proc.startTime,
            endTime: proc.endTime,
            order: proc.order || 1,
            status: 'COMPLETED'
          };
          apptsToAdd.push(newAppt);
          remainingAppts.push(newAppt);
        }
      }
    }
  }

  if (apptsToAdd.length > 0) {
    console.log(`\nInserting ${apptsToAdd.length} missing appointments into Supabase...`);
    for (let i = 0; i < apptsToAdd.length; i += 500) {
      const chunk = apptsToAdd.slice(i, i + 500);
      const rows = chunk.map(a => ({ id: a.id, data: a }));
      const { error } = await supabase.from('appointments').upsert(rows);
      if (error) console.error(`Error inserting chunk ${i}:`, error);
      else console.log(`Inserted chunk ${i} - ${i + chunk.length}`);
    }
  }

  console.log('\n--- RECONCILIATION & CLEANUP COMPLETED ---');
}

main().then(() => process.exit(0)).catch(console.error);
