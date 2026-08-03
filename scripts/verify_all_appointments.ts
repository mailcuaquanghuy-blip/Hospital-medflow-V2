import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAllAppts() {
  console.log("Fetching all procedures, staff, patients from Supabase...");
  const { data: procs } = await supabase.from('procedures').select('*');
  const { data: staff } = await supabase.from('staff').select('*');
  const { data: patients } = await supabase.from('patients').select('*');

  const procMap = new Map((procs || []).map(r => {
    const p = r.data || r;
    return [p.id, p];
  }));
  const staffMap = new Map((staff || []).map(r => {
    const s = r.data || r;
    return [s.id, s];
  }));
  const patientMap = new Map((patients || []).map(r => {
    const p = r.data || r;
    return [p.id, p];
  }));

  console.log(`Procs: ${procMap.size}, Staff: ${staffMap.size}, Patients: ${patientMap.size}`);

  // Paginate through all appointments in Supabase
  let allAppts: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error("Error fetching page:", page, error);
      break;
    }
    if (!data || data.length === 0) break;
    const items = data.map(r => r.data || r);
    allAppts.push(...items);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Total appointments fetched from Supabase: ${allAppts.length}`);

  const jul31OrBefore = allAppts.filter(a => a.date <= '2026-07-31');
  console.log(`Appointments on or before 2026-07-31: ${jul31OrBefore.length}`);

  // Group by date for <= 2026-07-31
  const dateCounts: Record<string, number> = {};
  jul31OrBefore.forEach(a => {
    dateCounts[a.date] = (dateCounts[a.date] || 0) + 1;
  });
  console.log("\nAppt counts per date (<= 2026-07-31):");
  Object.keys(dateCounts).sort().forEach(d => {
    console.log(` ${d}: ${dateCounts[d]} appts`);
  });

  // Check invalid references in all appts
  const invalidProcs: any[] = [];
  const invalidStaff: any[] = [];
  const invalidPatients: any[] = [];

  allAppts.forEach(a => {
    if (a.procedureId && !procMap.has(a.procedureId)) {
      invalidProcs.push(a);
    }
    if (a.staffId && !staffMap.has(a.staffId)) {
      invalidStaff.push(a);
    }
    if (a.patientId && !patientMap.has(a.patientId)) {
      invalidPatients.push(a);
    }
  });

  console.log(`\nValidation results across all ${allAppts.length} appointments:`);
  console.log(`- Invalid procedureId: ${invalidProcs.length}`);
  if (invalidProcs.length > 0) {
    console.log("  Sample invalid procedureId appts:", invalidProcs.slice(0, 5));
  }
  console.log(`- Invalid staffId: ${invalidStaff.length}`);
  if (invalidStaff.length > 0) {
    console.log("  Sample invalid staffId appts:", invalidStaff.slice(0, 5));
  }
  console.log(`- Invalid patientId: ${invalidPatients.length}`);
  if (invalidPatients.length > 0) {
    console.log("  Sample invalid patientId appts:", invalidPatients.slice(0, 5));
  }

  // Check procedures capability matching for staff
  console.log("\nChecking staff capabilities vs procedure requirements...");
  const staffWithoutCaps: string[] = [];
  staffMap.forEach((s: any) => {
    const caps = [...(s.capabilityIds || []), ...(s.mainCapabilityIds || []), ...(s.assistantCapabilityIds || [])];
    if (caps.length === 0) {
      staffWithoutCaps.push(`${s.name} (${s.id})`);
    }
  });
  console.log(`Staff without any capabilities defined: ${staffWithoutCaps.length}`);
  if (staffWithoutCaps.length > 0) {
    console.log("Staff with 0 capabilities:", staffWithoutCaps);
  }
}

checkAllAppts();
