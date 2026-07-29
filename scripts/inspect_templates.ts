import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectTemplates() {
  const { data, error } = await supabase.from('templates').select('*');
  if (error) {
    console.error('Error fetching templates:', error.message);
    return;
  }
  
  console.log(`Total templates in Supabase: ${data.length}`);
  
  // Sort templates by their updatedAt / updated_at
  const list = data.map(row => {
    const t = row.data || row;
    return {
      id: row.id,
      name: t.name,
      deptId: t.deptId,
      proceduresCount: (t.procedures || []).length,
      updatedAt: t.updatedAt || t.updated_at || 'Unknown',
      procedures: t.procedures || []
    };
  });
  
  list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  
  console.log("\nTop 15 most recently updated templates in Supabase:");
  list.slice(0, 15).forEach(t => {
    console.log(`- ID: ${t.id} | Name: "${t.name}" | Dept: ${t.deptId} | Procs: ${t.proceduresCount} | UpdatedAt: ${t.updatedAt}`);
  });
}

inspectTemplates().then(() => process.exit(0)).catch(err => console.error(err));
