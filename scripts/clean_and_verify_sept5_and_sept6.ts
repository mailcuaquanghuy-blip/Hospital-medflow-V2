import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { createClient } from "@supabase/supabase-js";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus } from "../types";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanAndSync() {
  await signInAnonymously(auth);
  console.log("=== CLEANING & DUAL SYNC FOR 2026-09-05 & 2026-09-06 ===");

  const LAN_ID = "s_hdvlre3q6";   // Vũ Thị Hương Lan
  const TRANG_ID = "s_j70mhmvcl"; // Nguyễn Thị Huyền Trang

  const HUONG_ID = "s_1xca9gdv3"; // Hoàng Thu Hương
  const HA_ID = "s_w8k2iebit";    // Vũ Thúy Hà

  const HUY_ID = "s_hpvg4qt7q";   // Nguyễn Quang Huy
  const GIANG_ID = "s_tppw9td1m"; // Lê Hương Giang

  // 1. Fetch master Khoa Lão appts (from 2026-08-09)
  const qMaster = query(collection(db, "appointments"), where("date", "==", "2026-08-09"), where("deptId", "==", "dept_lao"));
  const masterSnap = await getDocs(qMaster);
  const masterAppts = masterSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];
  console.log(`Loaded ${masterAppts.length} master Khoa Lão appointments from 2026-08-09.`);

  // Prepare exact 117 for 2026-09-05
  const sept5Appts: Appointment[] = masterAppts.map(appt => {
    const newId = `appt_20260905_lao_${appt.id}`;
    const newAppt: Appointment = {
      ...appt,
      id: newId,
      date: "2026-09-05",
      status: AppointmentStatus.PENDING,
      conflictDetails: []
    };
    Object.keys(newAppt).forEach(k => { if ((newAppt as any)[k] === undefined) delete (newAppt as any)[k]; });
    return newAppt;
  });

  // Prepare exact 117 for 2026-09-06
  const mapStaff = (id: string | null | undefined): string | null => {
    if (!id) return null;
    if (id === LAN_ID) return TRANG_ID;
    if (id === HUONG_ID) return HA_ID;
    if (id === HUY_ID) return GIANG_ID;
    return id;
  };

  const sept6Appts: Appointment[] = sept5Appts.map(a => {
    const newId = a.id.replace("20260905", "20260906");
    const newAppt: any = {
      ...a,
      id: newId,
      date: "2026-09-06",
      staffId: mapStaff(a.staffId),
      assistant1Id: mapStaff(a.assistant1Id),
      assistant2Id: mapStaff(a.assistant2Id),
      status: AppointmentStatus.PENDING,
      conflictDetails: []
    };
    Object.keys(newAppt).forEach(k => { if (newAppt[k] === undefined) delete newAppt[k]; });
    return newAppt;
  });

  // 2. Clear existing 2026-09-05 & 2026-09-06 in Firebase
  for (const dateStr of ["2026-09-05", "2026-09-06"]) {
    const qCur = query(collection(db, "appointments"), where("date", "==", dateStr), where("deptId", "==", "dept_lao"));
    const curSnap = await getDocs(qCur);
    if (curSnap.size > 0) {
      let b = writeBatch(db);
      curSnap.docs.forEach((d, idx) => {
        b.delete(doc(db, "appointments", d.id));
        if ((idx + 1) % 400 === 0) { b.commit(); b = writeBatch(db); }
      });
      await b.commit();
    }
  }

  // Clear existing 2026-09-05 & 2026-09-06 in Supabase
  let allSb: any[] = [];
  let from = 0;
  while (true) {
    const { data: res } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (!res || res.length === 0) break;
    allSb = allSb.concat(res);
    if (res.length < 1000) break;
    from += 1000;
  }

  const idsToDeleteSb = allSb
    .filter(r => {
      const a = r.data || r;
      return (a.date === '2026-09-05' || a.date === '2026-09-06') && a.deptId === 'dept_lao';
    })
    .map(r => r.id);

  console.log(`Deleting ${idsToDeleteSb.length} old 2026-09-05/06 Khoa Lão rows from Supabase...`);
  for (let i = 0; i < idsToDeleteSb.length; i += 100) {
    const chunk = idsToDeleteSb.slice(i, i + 100);
    await supabase.from('appointments').delete().in('id', chunk);
  }

  // 3. Write exact 117 for 2026-09-05 and 117 for 2026-09-06 to Firebase
  console.log("Writing exact appointments to Firebase...");
  let fbBatch = writeBatch(db);
  let count = 0;
  for (const a of [...sept5Appts, ...sept6Appts]) {
    fbBatch.set(doc(db, "appointments", a.id), a);
    count++;
    if (count % 400 === 0) { await fbBatch.commit(); fbBatch = writeBatch(db); }
  }
  if (count % 400 !== 0) await fbBatch.commit();

  // 4. Write exact 117 for 2026-09-05 and 117 for 2026-09-06 to Supabase
  console.log("Writing exact appointments to Supabase...");
  const sbRows = [...sept5Appts, ...sept6Appts].map(a => ({
    id: a.id,
    data: JSON.parse(JSON.stringify(a, (k, v) => v === undefined ? null : v))
  }));
  for (let i = 0; i < sbRows.length; i += 50) {
    const chunk = sbRows.slice(i, i + 50);
    const { error } = await supabase.from('appointments').upsert(chunk);
    if (error) console.error("Supabase upsert error:", error);
  }

  // 5. Final Verification across both databases
  console.log("\n=== FINAL VERIFICATION ===");
  const fb5 = await getDocs(query(collection(db, "appointments"), where("date", "==", "2026-09-05"), where("deptId", "==", "dept_lao")));
  const fb6 = await getDocs(query(collection(db, "appointments"), where("date", "==", "2026-09-06"), where("deptId", "==", "dept_lao")));

  console.log(`Firebase -> 2026-09-05: ${fb5.size}, 2026-09-06: ${fb6.size}`);

  let checkSb: any[] = [];
  from = 0;
  while (true) {
    const { data: res } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (!res || res.length === 0) break;
    checkSb = checkSb.concat(res);
    if (res.length < 1000) break;
    from += 1000;
  }

  const sb5Final = checkSb.filter(r => (r.data || r).date === '2026-09-05' && (r.data || r).deptId === 'dept_lao');
  const sb6Final = checkSb.filter(r => (r.data || r).date === '2026-09-06' && (r.data || r).deptId === 'dept_lao');

  console.log(`Supabase -> 2026-09-05: ${sb5Final.length}, 2026-09-06: ${sb6Final.length}`);

  let oldStaffCount = 0;
  sb6Final.forEach(r => {
    const a = r.data || r;
    const ids = [a.staffId, a.assistant1Id, a.assistant2Id].filter(Boolean);
    if (ids.includes(LAN_ID) || ids.includes(HUONG_ID) || ids.includes(HUY_ID)) oldStaffCount++;
  });
  console.log(`Old staff in 2026-09-06 (Supabase): ${oldStaffCount}`);

  if (fb5.size === 117 && fb6.size === 117 && sb5Final.length === 117 && sb6Final.length === 117 && oldStaffCount === 0) {
    console.log("\n✅ PERFECT MATCH IN BOTH FIREBASE AND SUPABASE!");
  } else {
    console.error("\n❌ MISMATCH DETECTED!");
  }
}

cleanAndSync().then(() => process.exit(0)).catch(err => { console.error("Fatal:", err); process.exit(1); });
