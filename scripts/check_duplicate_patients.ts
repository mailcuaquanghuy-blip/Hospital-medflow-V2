import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDupes() {
  let allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data: res } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!res || res.length === 0) break;
    allRows = allRows.concat(res);
    if (res.length < 1000) break;
    from += 1000;
  }

  console.log(`Total rows in Supabase 'patients' table: ${allRows.length}`);
  const patients = allRows.map(r => r.data || r);

  // Group by name + dob or name + bedNumber
  const nameMap: Record<string, any[]> = {};
  patients.forEach(p => {
    const key = `${p.name}_${p.dob || ''}_${p.admittedByDeptId || p.departmentId || ''}`;
    if (!nameMap[key]) nameMap[key] = [];
    nameMap[key].push(p);
  });

  console.log("=== DUPLICATE PATIENTS IN SUPABASE ===");
  let dupeCount = 0;
  Object.keys(nameMap).forEach(k => {
    if (nameMap[k].length > 1) {
      dupeCount++;
      console.log(`Key: ${k} -> ${nameMap[k].length} records:`);
      nameMap[k].forEach(p => {
        console.log(`  ID: ${p.id}, status: ${p.status}, bed: ${p.bedNumber}, admission: ${p.admissionDate}, discharge: ${p.dischargeDate}`);
      });
    }
  });

  console.log(`Total duplicate patient groups: ${dupeCount}`);

  // Let's also check active TREATING patients in Khoa Lão on date 2026-09-03
  const activeSept3 = patients.filter(p => {
    if (p.admittedByDeptId !== 'dept_lao') return false;
    const admissionDateStr = p.admissionDate ? String(p.admissionDate).substring(0, 10) : '';
    if (admissionDateStr && '2026-09-03' < admissionDateStr) return false;

    const isDischarged = p.status === 'DISCHARGED';
    const dischargeDateStr = p.dischargeDate ? String(p.dischargeDate).substring(0, 10) : '';

    if (isDischarged && dischargeDateStr && dischargeDateStr < '2026-09-03') {
      return false;
    }
    return true;
  });

  console.log(`\nPatients visible on 2026-09-03 in Khoa Lão: ${activeSept3.length}`);
  const namesSept3 = activeSept3.map(p => p.name);
  const uniqueNamesSept3 = new Set(namesSept3);
  console.log(`Unique names on 2026-09-03: ${uniqueNamesSept3.size} out of ${activeSept3.length} records`);
}

checkDupes().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
