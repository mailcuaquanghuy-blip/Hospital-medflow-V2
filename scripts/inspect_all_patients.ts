import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectAllPatients() {
  let allPatients: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('patients').select('*').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    allPatients = allPatients.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  console.log(`Total patients in Supabase 'patients' table: ${allPatients.length}`);

  const patientsList = allPatients.map(r => r.data || r);

  const laoAdmitted = patientsList.filter(p => p.admittedByDeptId === 'dept_lao' || p.departmentId === 'dept_lao');
  console.log(`Patients with admittedByDeptId or departmentId == 'dept_lao': ${laoAdmitted.length}`);

  // Check currentDate = '2026-09-03' or '2026-09-05' or '2026-09-06'
  for (const date of ['2026-09-03', '2026-09-05', '2026-09-06']) {
    const visibleForDate = patientsList.filter(p => {
      if (p.admittedByDeptId !== 'dept_lao') return false;
      const admissionDateStr = p.admissionDate ? String(p.admissionDate).substring(0, 10) : '';
      if (admissionDateStr && date < admissionDateStr) return false;

      const isDischarged = p.status === 'DISCHARGED';
      const dischargeDateStr = p.dischargeDate ? String(p.dischargeDate).substring(0, 10) : '';

      if (isDischarged && dischargeDateStr && dischargeDateStr < date) {
        return false;
      }
      return true;
    });

    console.log(`Visible Khoa Lão patients for date ${date}: ${visibleForDate.length}`);
  }

  // Let's check how many total patients have admittedByDeptId === 'dept_lao' in Supabase!
  const deptBreakdown: Record<string, number> = {};
  patientsList.forEach(p => {
    const d = p.admittedByDeptId || 'none';
    deptBreakdown[d] = (deptBreakdown[d] || 0) + 1;
  });
  console.log("admittedByDeptId breakdown:", deptBreakdown);
}

inspectAllPatients().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
