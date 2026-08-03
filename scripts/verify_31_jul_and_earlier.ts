import { fetchSupabaseTable } from "../utils/supabaseService";

async function verify31JulAndEarlier() {
  const appts = await fetchSupabaseTable<any>('appointments') || [];
  console.log(`Total appointments in Supabase: ${appts.length}`);

  // Check Hoàng Thị Lưu on 2026-07-31
  const luuJul31 = appts.filter(a => a.date === '2026-07-31' && a.patientId === 'p_s9c9eqrsw');
  console.log(`\nHoàng Thị Lưu appointments on 2026-07-31: ${luuJul31.length}`);
  luuJul31.forEach(a => {
    console.log(`- ID: ${a.id} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime} | Staff: ${a.staffId} | Asst1: ${a.assistant1Id} | Asst2: ${a.assistant2Id}`);
  });

  // Check duplicate patient-procedures on 2026-07-31
  const jul31 = appts.filter(a => a.date === '2026-07-31');
  const groupedJul31: Record<string, any[]> = {};
  jul31.forEach(a => {
    const key = `${a.patientId}__${a.procedureId}`;
    if (!groupedJul31[key]) groupedJul31[key] = [];
    groupedJul31[key].push(a);
  });

  const dupesJul31 = Object.entries(groupedJul31).filter(([k, list]) => list.length > 1);
  console.log(`\nNumber of duplicate patient-procedure groups on 2026-07-31: ${dupesJul31.length}`);
  dupesJul31.forEach(([k, list]) => {
    console.log(`Group ${k}:`);
    list.forEach(a => console.log(`  ID: ${a.id}, Time: ${a.startTime}-${a.endTime}`));
  });

  // Check total appointments on each date in July 2026
  const julyDates: Record<string, number> = {};
  appts.filter(a => a.date && a.date.startsWith('2026-07')).forEach(a => {
    julyDates[a.date] = (julyDates[a.date] || 0) + 1;
  });

  console.log("\nJuly 2026 appointments count per day:");
  Object.keys(julyDates).sort().forEach(d => {
    console.log(`  ${d}: ${julyDates[d]} appointments`);
  });
}

verify31JulAndEarlier();
