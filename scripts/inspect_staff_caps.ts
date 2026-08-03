import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectStaffCapabilities() {
  const { data: staffRows, error } = await supabase.from('staff').select('*');
  if (error || !staffRows) {
    console.error("Error fetching staff:", error);
    return;
  }

  console.log(`=== Total staff rows: ${staffRows.length} ===`);
  const staff = staffRows.map(r => r.data || r);
  staff.forEach(s => {
    console.log(`- ID: ${s.id} | Name: ${s.name} | Role: ${s.role}`);
    console.log(`  capabilityIds:`, JSON.stringify(s.capabilityIds));
    console.log(`  mainCapabilityIds:`, JSON.stringify(s.mainCapabilityIds));
    console.log(`  assistantCapabilityIds:`, JSON.stringify(s.assistantCapabilityIds));
  });

  const { data: procRows } = await supabase.from('procedures').select('*');
  if (procRows) {
    console.log(`\n=== Procedures count: ${procRows.length} ===`);
    procRows.map(r => r.data || r).forEach(p => {
      console.log(`- Proc ID: ${p.id} | Code: ${p.code} | Name: ${p.name} | DeptId: ${p.deptId}`);
    });
  }
}

inspectStaffCapabilities().catch(err => console.error(err));
