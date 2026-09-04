import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, writeBatch, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { createClient } from "@supabase/supabase-js";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus, Staff } from "../types";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  await signInAnonymously(auth);
  console.log("=== STARTING COPY AND DUAL-SYNC (FIREBASE + SUPABASE) ===");

  const LAN_ID = "s_hdvlre3q6";   // Vũ Thị Hương Lan
  const TRANG_ID = "s_j70mhmvcl"; // Nguyễn Thị Huyền Trang

  const HUONG_ID = "s_1xca9gdv3"; // Hoàng Thu Hương
  const HA_ID = "s_w8k2iebit";    // Vũ Thúy Hà

  const HUY_ID = "s_hpvg4qt7q";   // Nguyễn Quang Huy
  const GIANG_ID = "s_tppw9td1m"; // Lê Hương Giang

  // 1. Fetch 2026-09-05 Khoa Lão appts from Firebase
  const q5 = query(collection(db, "appointments"), where("date", "==", "2026-09-05"), where("deptId", "==", "dept_lao"));
  const snap5 = await getDocs(q5);
  let sept5Appts = snap5.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];

  console.log(`Firebase 2026-09-05 Khoa Lão appointments: ${sept5Appts.length}`);

  if (sept5Appts.length === 0) {
    console.log("Loading master schedule from 2026-08-09...");
    const qMaster = query(collection(db, "appointments"), where("date", "==", "2026-08-09"), where("deptId", "==", "dept_lao"));
    const masterSnap = await getDocs(qMaster);
    const masterAppts = masterSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];

    let batch = writeBatch(db);
    for (const appt of masterAppts) {
      const newId = `appt_20260905_lao_${appt.id}`;
      const newAppt: Appointment = {
        ...appt,
        id: newId,
        date: "2026-09-05",
        status: AppointmentStatus.PENDING,
        conflictDetails: []
      };
      Object.keys(newAppt).forEach(k => { if ((newAppt as any)[k] === undefined) delete (newAppt as any)[k]; });
      batch.set(doc(db, "appointments", newId), newAppt);
      sept5Appts.push(newAppt);
    }
    await batch.commit();
    console.log(`Created ${sept5Appts.length} appointments on 2026-09-05 in Firebase.`);
  }

  // Sync 2026-09-05 to Supabase
  console.log("Upserting 2026-09-05 appointments to Supabase...");
  const sept5SbRows = sept5Appts.map(a => ({
    id: a.id,
    data: JSON.parse(JSON.stringify(a, (k, v) => v === undefined ? null : v))
  }));
  for (let i = 0; i < sept5SbRows.length; i += 50) {
    const chunk = sept5SbRows.slice(i, i + 50);
    const { error } = await supabase.from('appointments').upsert(chunk);
    if (error) console.error("Supabase upsert error sept5 chunk:", error);
  }
  console.log("Successfully upserted 2026-09-05 appointments to Supabase!");

  // 2. Generate 2026-09-06 appts with staff replacement
  const mapStaff = (id: string | null | undefined): string | null => {
    if (!id) return null;
    if (id === LAN_ID) return TRANG_ID;
    if (id === HUONG_ID) return HA_ID;
    if (id === HUY_ID) return GIANG_ID;
    return id;
  };

  const sept6Appts: Appointment[] = [];
  for (const a of sept5Appts) {
    const newId = a.id.includes("20260905") 
      ? a.id.replace("20260905", "20260906") 
      : `appt_20260906_lao_${a.id}`;

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
    sept6Appts.push(newAppt);
  }

  console.log(`Generated ${sept6Appts.length} appointments for 2026-09-06.`);

  // Save 2026-09-06 to Firebase
  console.log("Saving 2026-09-06 to Firebase...");
  let fbBatch = writeBatch(db);
  let fbCount = 0;
  for (const appt of sept6Appts) {
    fbBatch.set(doc(db, "appointments", appt.id), appt);
    fbCount++;
    if (fbCount % 400 === 0) {
      await fbBatch.commit();
      fbBatch = writeBatch(db);
    }
  }
  if (fbCount % 400 !== 0) {
    await fbBatch.commit();
  }
  console.log("Saved 2026-09-06 to Firebase.");

  // Save 2026-09-06 to Supabase
  console.log("Saving 2026-09-06 to Supabase...");
  const sept6SbRows = sept6Appts.map(a => ({
    id: a.id,
    data: JSON.parse(JSON.stringify(a, (k, v) => v === undefined ? null : v))
  }));
  for (let i = 0; i < sept6SbRows.length; i += 50) {
    const chunk = sept6SbRows.slice(i, i + 50);
    const { error } = await supabase.from('appointments').upsert(chunk);
    if (error) console.error("Supabase upsert error sept6 chunk:", error);
  }
  console.log("Saved 2026-09-06 to Supabase.");

  // 3. Verification in Supabase
  console.log("\n=== VERIFYING SUPABASE DATA ===");
  let allSbRows: any[] = [];
  let from = 0;
  while (true) {
    const { data: res, error } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (error || !res || res.length === 0) break;
    allSbRows = allSbRows.concat(res);
    if (res.length < 1000) break;
    from += 1000;
  }

  const sb5 = allSbRows.filter(r => (r.data || r).date === '2026-09-05' && (r.data || r).deptId === 'dept_lao');
  const sb6 = allSbRows.filter(r => (r.data || r).date === '2026-09-06' && (r.data || r).deptId === 'dept_lao');

  console.log(`Supabase 2026-09-05 Khoa Lão appts: ${sb5.length}`);
  console.log(`Supabase 2026-09-06 Khoa Lão appts: ${sb6.length}`);

  let lanIn6 = 0, huongIn6 = 0, huyIn6 = 0;
  sb6.forEach(r => {
    const a = r.data || r;
    const ids = [a.staffId, a.assistant1Id, a.assistant2Id].filter(Boolean);
    if (ids.includes(LAN_ID)) lanIn6++;
    if (ids.includes(HUONG_ID)) huongIn6++;
    if (ids.includes(HUY_ID)) huyIn6++;
  });

  console.log(`Old staff count in 2026-09-06 (Supabase): Lan=${lanIn6}, Huong=${huongIn6}, Huy=${huyIn6}`);

  if (sb5.length > 0 && sb6.length > 0 && lanIn6 === 0 && huongIn6 === 0 && huyIn6 === 0) {
    console.log("\n✅ DUAL SYNC AND VERIFICATION COMPLETED SUCCESSFULLY!");
  } else {
    console.error("\n❌ VERIFICATION FAILED!");
  }
}

main().then(() => process.exit(0)).catch(err => { console.error("Fatal:", err); process.exit(1); });
