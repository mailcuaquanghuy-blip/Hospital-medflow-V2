import { fetchSupabaseTable } from "../utils/supabaseService";

async function verifyAllTables() {
  const tables = ['patients', 'staff', 'procedures', 'templates', 'attendance', 'machine_shifts', 'users'];
  for (const t of tables) {
    const data = await fetchSupabaseTable<any>(t) || [];
    console.log(`Table '${t}': ${data.length} rows`);
    const fakes = data.filter(item => item.id && (item.id.startsWith('test_') || item.id.startsWith('fake_')));
    if (fakes.length > 0) {
      console.log(`  -> Found ${fakes.length} fake items in ${t}`);
    }
  }
}

verifyAllTables();
