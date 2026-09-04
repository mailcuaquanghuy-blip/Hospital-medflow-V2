import { supabase } from '../supabaseClient';

async function main() {
  const { data: tmpls } = await supabase.from('templates').select('*');
  const templates = tmpls?.map(t => t.data || t) || [];

  console.log(`Total templates: ${templates.length}`);
  
  // Group templates by group
  const byGroup: Record<string, any[]> = {};
  for (const t of templates) {
    const grp = t.group || 'Chưa phân nhóm';
    if (!byGroup[grp]) byGroup[grp] = [];
    byGroup[grp].push(t);
  }

  for (const [grp, list] of Object.entries(byGroup)) {
    console.log(`\n=== GROUP: "${grp}" (${list.length} templates) ===`);
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    for (const t of list) {
      console.log(`  [${t.id}] "${t.name}" (${t.deptId})`);
      if (t.procedures) {
        t.procedures.forEach((p: any, i: number) => {
          console.log(`     #${i+1}: proc=${p.procedureId}, staff=${p.staffId}, time=${p.startTime}-${p.endTime}`);
        });
      }
    }
  }
}

main().then(() => process.exit(0)).catch(console.error);
