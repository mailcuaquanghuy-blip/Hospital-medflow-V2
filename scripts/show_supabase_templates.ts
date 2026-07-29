import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTemplates() {
  const { data, error } = await supabase.from('templates').select('*');
  if (error) {
    console.error('Error fetching templates:', error.message);
    return;
  }
  
  console.log(`=== SUPABASE TEMPLATES (${data.length}) ===`);
  const parsed = data.map(row => {
    const t = row.data || row;
    return {
      id: row.id,
      name: t.name,
      deptId: t.deptId,
      procedures: t.procedures || [],
      updatedAt: t.updatedAt || t.updated_at || null,
      createdAt: t.createdAt || t.created_at || null
    };
  });
  
  // Show details of each template
  parsed.forEach((t, i) => {
    console.log(`[${i+1}] ID: ${t.id} | Name: "${t.name}" | Dept: ${t.deptId} | Procs: ${t.procedures.length} | Updated: ${t.updatedAt} | Created: ${t.createdAt}`);
    if (t.procedures.length > 0) {
      console.log(`    Procedures:`, t.procedures.map((p: any) => `${p.procedureId} (${p.startTime}-${p.endTime})`).join(', '));
    }
  });
}

checkTemplates().then(() => process.exit(0)).catch(err => console.error(err));
