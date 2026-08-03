import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const tables = ['procedures', 'staff', 'patients', 'appointments', 'attendance', 'templates', 'machine_shifts', 'users'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`Supabase table ${t}: ${count} rows (error: ${error ? error.message : 'none'})`);
  }

  // Check procedures
  const { data: procs } = await supabase.from('procedures').select('*');
  const procList = (procs || []).map(r => r.data || r);
  console.log(`\nProcedures count: ${procList.length}`);
  procList.forEach(p => console.log(` - ${p.id}: ${p.name} (dept: ${p.deptId})`));

  // Check appointments <= 2026-07-31
  const { data: appts } = await supabase.from('appointments').select('*');
  const apptList = (appts || []).map(r => r.data || r);
  const jul31Appts = apptList.filter(a => a.date <= '2026-07-31');
  console.log(`\nAppointments count total: ${apptList.length}, <= 2026-07-31: ${jul31Appts.length}`);

  // Check invalid procedure references in appointments
  const validProcIds = new Set(procList.map(p => p.id));
  const invalidAppts = apptList.filter(a => a.procedureId && !validProcIds.has(a.procedureId));
  console.log(`Invalid procedureId appointments in Supabase: ${invalidAppts.length}`);
  if (invalidAppts.length > 0) {
    console.log("Invalid procedureIds:", Array.from(new Set(invalidAppts.map(a => a.procedureId))));
  }
}

check();
