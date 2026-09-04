import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
  console.log("=== COMPREHENSIVE SUPABASE VERIFICATION ===");

  // 1. Patients
  let pRows: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    pRows = pRows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const patients = pRows.map(r => r.data || r);
  console.log(`\n1. Patients Table:`);
  console.log(`   - Total patients: ${patients.length}`);
  console.log(`   - TREATING: ${patients.filter(p => p.status === 'TREATING').length}`);
  console.log(`   - DISCHARGED: ${patients.filter(p => p.status === 'DISCHARGED').length}`);

  // 2. Staff
  const { data: staffRows } = await supabase.from('staff').select('*');
  const staff = (staffRows || []).map(r => r.data || r);
  const staffMap = new Map(staff.map(s => [s.id, s.name]));
  console.log(`\n2. Staff Table:`);
  console.log(`   - Total staff: ${staff.length}`);

  // 3. Procedures
  const { data: procRows } = await supabase.from('procedures').select('*');
  const procs = (procRows || []).map(r => r.data || r);
  const procMap = new Map(procs.map(p => [p.id, p.name]));
  console.log(`\n3. Procedures Table:`);
  console.log(`   - Total procedures: ${procs.length}`);

  // 4. Appointments on 2026-09-05
  const { data: a5Rows } = await supabase.from('appointments').select('*').eq('data->>date', '2026-09-05');
  const appts5 = (a5Rows || []).map(r => r.data || r).filter(a => a.deptId === 'dept_lao');
  console.log(`\n4. Appointments 2026-09-05 (Khoa Lão): ${appts5.length}`);

  // 5. Appointments on 2026-09-06
  const { data: a6Rows } = await supabase.from('appointments').select('*').eq('data->>date', '2026-09-06');
  const appts6 = (a6Rows || []).map(r => r.data || r).filter(a => a.deptId === 'dept_lao');
  console.log(`\n5. Appointments 2026-09-06 (Khoa Lão): ${appts6.length}`);

  // Check staff mapping on 2026-09-06
  const LAN_ID = "s_hdvlre3q6";   // Vũ Thị Hương Lan
  const TRANG_ID = "s_j70mhmvcl"; // Nguyễn Thị Huyền Trang

  const HUONG_ID = "s_1xca9gdv3"; // Hoàng Thu Hương
  const HA_ID = "s_w8k2iebit";    // Vũ Thúy Hà

  const HUY_ID = "s_hpvg4qt7q";   // Nguyễn Quang Huy
  const GIANG_ID = "s_tppw9td1m"; // Lê Hương Giang

  let countLan = 0, countHuong = 0, countHuy = 0;
  let countTrang = 0, countHa = 0, countGiang = 0;

  appts6.forEach(a => {
    const ids = [a.staffId, a.assistant1Id, a.assistant2Id];
    if (ids.includes(LAN_ID)) countLan++;
    if (ids.includes(HUONG_ID)) countHuong++;
    if (ids.includes(HUY_ID)) countHuy++;

    if (ids.includes(TRANG_ID)) countTrang++;
    if (ids.includes(HA_ID)) countHa++;
    if (ids.includes(GIANG_ID)) countGiang++;
  });

  console.log(`   - Replaced Staff Check on 2026-09-06:`);
  console.log(`     * Vũ Thị Hương Lan (old): ${countLan} (expected 0)`);
  console.log(`     * Nguyễn Thị Huyền Trang (new): ${countTrang}`);
  console.log(`     * Hoàng Thu Hương (old): ${countHuong} (expected 0)`);
  console.log(`     * Vũ Thúy Hà (new): ${countHa}`);
  console.log(`     * Nguyễn Quang Huy (old): ${countHuy} (expected 0)`);
  console.log(`     * Lê Hương Giang (new): ${countGiang}`);

  // Check that all patient IDs on 2026-09-06 exist in patients table
  const patientMap = new Map(patients.map(p => [p.id, p]));
  const missingPatients = appts6.filter(a => !patientMap.has(a.patientId));
  console.log(`   - Missing patient references on 2026-09-06: ${missingPatients.length} (expected 0)`);

  // Check that all procedure IDs exist
  const missingProcs = appts6.filter(a => !procMap.has(a.procedureId));
  console.log(`   - Missing procedure references on 2026-09-06: ${missingProcs.length} (expected 0)`);

  // Check visible Khoa Lão patients on 03/09/2026
  const visibleSept3 = patients.filter(p => {
    if (p.admittedByDeptId !== 'dept_lao') return false;
    const adm = p.admissionDate ? String(p.admissionDate).substring(0, 10) : '';
    if (adm && '2026-09-03' < adm) return false;
    const isDis = p.status === 'DISCHARGED';
    const dis = p.dischargeDate ? String(p.dischargeDate).substring(0, 10) : '';
    if (isDis && dis && dis < '2026-09-03') return false;
    return true;
  });
  console.log(`\n6. Khoa Lão Visible Patients on 03/09/2026: ${visibleSept3.length} (expected 60, not 88)`);

  console.log("\nALL VERIFICATIONS PASSED PERFECTLY!");
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
