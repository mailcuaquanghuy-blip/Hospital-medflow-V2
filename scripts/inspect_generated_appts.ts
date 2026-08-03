import { fetchSupabaseTable } from "../utils/supabaseService";

async function inspectGeneratedAppts() {
  const appts = await fetchSupabaseTable<any>('appointments') || [];
  console.log(`Total appointments: ${appts.length}`);

  const timestampAppts = appts.filter(a => a.id.startsWith('appt_1785') || a.id.startsWith('appt_copy_1785'));
  console.log(`Total timestamp generated appointments (appt_1785...): ${timestampAppts.length}`);

  const byDate: Record<string, number> = {};
  timestampAppts.forEach(a => {
    byDate[a.date] = (byDate[a.date] || 0) + 1;
  });

  console.log("Timestamp generated appointments by date:");
  Object.keys(byDate).sort().forEach(d => {
    console.log(`  ${d}: ${byDate[d]}`);
  });
}

inspectGeneratedAppts();
