import { fetchSupabaseTable } from "../utils/supabaseService";

async function checkWithout1785() {
  const appts = await fetchSupabaseTable<any>('appointments') || [];
  const realAppts = appts.filter(a => !a.id.startsWith('appt_1785') && !a.id.startsWith('appt_copy_1785'));
  console.log(`Original/Real appointments count: ${realAppts.length}`);

  // Group realAppts by date + patientId + procedureId to check for duplicates
  const grouped: Record<string, any[]> = {};
  realAppts.forEach(a => {
    if (!a.date || !a.patientId || !a.procedureId) return;
    const key = `${a.date}__${a.patientId}__${a.procedureId}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  const dupes = Object.entries(grouped).filter(([k, list]) => list.length > 1);
  console.log(`Remaining duplicate patient-procedures among real appointments: ${dupes.length}`);

  dupes.forEach(([key, list]) => {
    console.log(`\nDuplicate key: ${key}`);
    list.forEach(a => {
      console.log(`  ID: ${a.id} | Time: ${a.startTime}-${a.endTime} | Staff: ${a.staffId}`);
    });
  });

  // Let's check 2026-07-31 for patient Hoàng Thị Lưu (p_s9c9eqrsw)
  const luuJul31 = realAppts.filter(a => a.date === '2026-07-31' && a.patientId === 'p_s9c9eqrsw');
  console.log(`\nHoàng Thị Lưu real appointments on 2026-07-31: ${luuJul31.length}`);
  luuJul31.forEach(a => console.log(a));
}

checkWithout1785();
