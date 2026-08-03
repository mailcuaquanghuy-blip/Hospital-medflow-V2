import { fetchSupabaseTable, deleteSupabaseItem } from "../utils/supabaseService";

async function cleanFakeAppts() {
  const appts = await fetchSupabaseTable<any>('appointments') || [];
  console.log(`Initial total appointments in Supabase: ${appts.length}`);

  const fakes = appts.filter(a => a.id.startsWith('appt_1785') || a.id.startsWith('appt_copy_1785'));
  console.log(`Found ${fakes.length} fake/generated appointments to delete.`);

  let deletedCount = 0;
  for (const fake of fakes) {
    const success = await deleteSupabaseItem('appointments', fake.id);
    if (success) deletedCount++;
    if (deletedCount % 50 === 0) {
      console.log(`Deleted ${deletedCount}/${fakes.length} fake appointments...`);
    }
  }

  console.log(`Finished deleting ${deletedCount} fake appointments from Supabase.`);

  // Verify remaining appointments
  const remaining = await fetchSupabaseTable<any>('appointments') || [];
  console.log(`Remaining appointments in Supabase: ${remaining.length}`);
}

cleanFakeAppts();
