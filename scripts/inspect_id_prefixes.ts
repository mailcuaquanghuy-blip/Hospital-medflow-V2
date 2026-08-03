import { fetchSupabaseTable } from "../utils/supabaseService";

async function inspectAllIdPrefixes() {
  const appts = await fetchSupabaseTable<any>('appointments') || [];
  const prefixes: Record<string, number> = {};

  appts.forEach(a => {
    let prefix = a.id.split('_')[0] + '_' + (a.id.split('_')[1] || '');
    if (a.id.startsWith('appt_1785')) prefix = 'appt_1785...';
    if (a.id.startsWith('appt_copy_')) prefix = 'appt_copy_...';
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  });

  console.log("ID Prefixes in appointments table:");
  Object.entries(prefixes).sort((a,b) => b[1] - a[1]).forEach(([p, count]) => {
    console.log(`  ${p}: ${count}`);
  });
}

inspectAllIdPrefixes();
