import { supabase } from '../supabaseClient';

async function checkStaff() {
  const { data: stf } = await supabase.from('staff').select('*');
  const staff = stf?.map(s => s.data || s) || [];

  staff.forEach(s => {
    console.log(`[${s.id}] Name: "${s.name}" | Role: "${s.role}" | Dept: "${s.deptId}"`);
  });
}

checkStaff().then(() => process.exit(0)).catch(console.error);
