import { fetchSupabaseTable } from "../utils/supabaseService";

async function analyzeAllDupes() {
  const appts = await fetchSupabaseTable<any>('appointments') || [];
  console.log(`Total appointments in database: ${appts.length}`);

  // Group by date, patient, procedure
  const grouped: Record<string, any[]> = {};
  appts.forEach(a => {
    if (!a.date || !a.patientId || !a.procedureId) return;
    const key = `${a.date}__${a.patientId}__${a.procedureId}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  const duplicateGroups = Object.entries(grouped).filter(([k, list]) => list.length > 1);
  console.log(`Total (date + patient + procedure) groups with >1 appointment: ${duplicateGroups.length}`);

  // Let's summarize duplicate groups by date
  const dupesByDate: Record<string, number> = {};
  duplicateGroups.forEach(([key, list]) => {
    const date = key.split('__')[0];
    dupesByDate[date] = (dupesByDate[date] || 0) + 1;
  });

  console.log("\nDuplicate groups by date:");
  Object.keys(dupesByDate).sort().forEach(date => {
    console.log(`  Date ${date}: ${dupesByDate[date]} duplicated patient-procedures`);
  });

  // Let's inspect 2026-07-31 specifically
  console.log("\n--- Breakdown for 2026-07-31 ---");
  const jul31Dupes = duplicateGroups.filter(([k]) => k.startsWith('2026-07-31'));
  jul31Dupes.forEach(([key, list]) => {
    console.log(`\nGroup: ${key}`);
    list.forEach(a => {
      console.log(`  ID: ${a.id} | Time: ${a.startTime}-${a.endTime} | Staff: ${a.staffId} | Asst1: ${a.assistant1Id} | Created/Tmpl: ${a.templateId}`);
    });
  });
}

analyzeAllDupes();
