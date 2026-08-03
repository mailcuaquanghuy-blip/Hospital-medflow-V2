import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectT412Details() {
  const { data: templates } = await supabase.from('templates').select('*');
  const allT = (templates || []).map(r => r.data || r);
  const t412 = allT.find(t => t.id === 'tmpl_tmhmzbghq');
  console.log("Template 412 details:", JSON.stringify(t412, null, 2));

  // Check all templates in dept_lao
  const laoTemplates = allT.filter(t => t.deptId === 'dept_lao');
  console.log("\nTotal Lao templates:", laoTemplates.length);
  laoTemplates.forEach(t => {
    console.log(`- Template: ${t.name} (${t.id}) | Procs: ${t.procedures?.length}`);
    t.procedures?.forEach((p: any) => {
      console.log(`   * Proc: ${p.procedureId} | Time: ${p.startTime}-${p.endTime} | Staff: ${p.staffId} | Asst1: ${p.assistant1Id} | Asst2: ${p.assistant2Id}`);
    });
  });
}

inspectT412Details();
