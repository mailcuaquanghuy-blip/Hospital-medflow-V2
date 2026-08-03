import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProcsAndStaff() {
  const { data: staffRows } = await supabase.from('staff').select('*');
  const { data: procRows } = await supabase.from('procedures').select('*');

  const staffList = (staffRows || []).map(r => r.data || r);
  const procList = (procRows || []).map(r => r.data || r);

  console.log("=== PROCEDURES BY DEPT ===");
  const procsByDept: Record<string, any[]> = {};
  procList.forEach(p => {
    if (!procsByDept[p.deptId]) procsByDept[p.deptId] = [];
    procsByDept[p.deptId].push(p);
  });

  Object.entries(procsByDept).forEach(([deptId, procs]) => {
    console.log(`\nDept: ${deptId}`);
    procs.forEach(p => console.log(`  - Proc ID: ${p.id} | Name: ${p.name}`));
  });

  console.log("\n=== STAFF CAPABILITIES BY DEPT ===");
  staffList.forEach(s => {
    const deptProcs = procsByDept[s.deptId] || [];
    const mainCaps = s.mainCapabilityIds || [];
    const asstCaps = s.assistantCapabilityIds || [];
    const legacyCaps = s.capabilityIds || [];
    console.log(`\nStaff: ${s.name} (${s.id}) - Dept: ${s.deptId} - Role: ${s.role}`);
    console.log(`  mainCapabilityIds:`, mainCaps);
    console.log(`  assistantCapabilityIds:`, asstCaps);
    console.log(`  legacy capabilityIds:`, legacyCaps);

    const missingMain = deptProcs.filter(p => !mainCaps.includes(p.id));
    if (missingMain.length > 0) {
      console.log(`  ⚠️ Missing main capabilities for procs in dept:`, missingMain.map(p => `${p.name} (${p.id})`));
    }
  });
}

checkProcsAndStaff().catch(err => console.error(err));
