import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyAll() {
  console.log("=== FINAL SUPABASE VERIFICATION ===");

  // 1. Check patients count
  let sbPatients: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    sbPatients = sbPatients.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Supabase total patients: ${sbPatients.length}`);

  // 2. Check visible Khoa Lão patients count
  const pList = sbPatients.map(r => r.data || r);
  for (const date of ['2026-09-03', '2026-09-05', '2026-09-06']) {
    const visible = pList.filter(p => {
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
    console.log(`Khoa Lão visible patients on ${date}: ${visible.length}`);
  }

  // 3. Check appointments on 2026-09-05 & 2026-09-06
  let sbAppts: any[] = [];
  from = 0;
  while (true) {
    const { data } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    sbAppts = sbAppts.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const apptList = sbAppts.map(r => r.data || r);

  const a0905 = apptList.filter(a => a.date === '2026-09-05' && a.deptId === 'dept_lao');
  const a0906 = apptList.filter(a => a.date === '2026-09-06' && a.deptId === 'dept_lao');

  console.log(`2026-09-05 Khoa Lão appointments count: ${a0905.length}`);
  console.log(`2026-09-06 Khoa Lão appointments count: ${a0906.length}`);
}

verifyAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
