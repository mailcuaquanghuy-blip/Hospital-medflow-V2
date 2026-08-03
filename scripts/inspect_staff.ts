import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectStaff() {
  const { data: staffRows, error } = await supabase.from('staff').select('*');
  if (error) {
    console.error("Error fetching staff:", error.message);
    return;
  }

  console.log(`=== Total staff rows found: ${staffRows.length} ===`);
  const staff = staffRows.map(r => r.data || r);
  staff.forEach(s => {
    console.log(`- ID: ${s.id} | Name: ${s.name} | Role: ${s.role} | DeptId: ${s.deptId}`);
  });
}

inspectStaff().catch(err => console.error(err));
