import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus, Staff, Patient, Procedure } from "../types";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function runCopy() {
  await signInAnonymously(auth);

  console.log("=== STEP 1: Fetching Collections ===");
  const staffSnap = await getDocs(collection(db, "staff"));
  const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Staff[];

  const patientsSnap = await getDocs(collection(db, "patients"));
  const patients = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Patient[];

  const proceduresSnap = await getDocs(collection(db, "procedures"));
  const procedures = proceduresSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Procedure[];

  const LAN_ID = "s_hdvlre3q6";   // Vũ Thị Hương Lan
  const TRANG_ID = "s_j70mhmvcl"; // Nguyễn Thị Huyền Trang

  const HUONG_ID = "s_1xca9gdv3"; // Hoàng Thu Hương
  const HA_ID = "s_w8k2iebit";    // Vũ Thúy Hà

  const HUY_ID = "s_hpvg4qt7q";   // Nguyễn Quang Huy
  const GIANG_ID = "s_tppw9td1m"; // Lê Hương Giang

  console.log("Staff verification:");
  console.log("  Vũ Thị Hương Lan ->", staff.find(s => s.id === LAN_ID)?.name);
  console.log("  Nguyễn Thị Huyền Trang ->", staff.find(s => s.id === TRANG_ID)?.name);
  console.log("  Hoàng Thu Hương ->", staff.find(s => s.id === HUONG_ID)?.name);
  console.log("  Vũ Thúy Hà ->", staff.find(s => s.id === HA_ID)?.name);
  console.log("  Nguyễn Quang Huy ->", staff.find(s => s.id === HUY_ID)?.name);
  console.log("  Lê Hương Giang ->", staff.find(s => s.id === GIANG_ID)?.name);

  // Check 2026-09-05 appointments in Firestore
  const qSept5 = query(collection(db, "appointments"), where("date", "==", "2026-09-05"), where("deptId", "==", "dept_lao"));
  let sept5Snap = await getDocs(qSept5);

  let sept5Appts = sept5Snap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];
  console.log(`\nCurrent 2026-09-05 Khoa Lão appointments in Firestore: ${sept5Appts.length}`);

  if (sept5Appts.length === 0) {
    console.log("Populating 2026-09-05 Khoa Lão appointments from master Khoa Lão schedule (2026-08-09)...");
    const qMaster = query(collection(db, "appointments"), where("date", "==", "2026-08-09"), where("deptId", "==", "dept_lao"));
    const masterSnap = await getDocs(qMaster);
    const masterAppts = masterSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];
    console.log(`Loaded ${masterAppts.length} master Khoa Lão appointments from 2026-08-09.`);

    let batch = writeBatch(db);
    let count = 0;
    const newSept5Appts: Appointment[] = [];

    for (const appt of masterAppts) {
      const newId = `appt_20260905_lao_${appt.id}`;
      const newAppt: Appointment = {
        ...appt,
        id: newId,
        date: "2026-09-05",
        status: AppointmentStatus.PENDING,
        conflictDetails: []
      };

      // Clean undefined
      Object.keys(newAppt).forEach(k => {
        if ((newAppt as any)[k] === undefined) delete (newAppt as any)[k];
      });

      batch.set(doc(db, "appointments", newId), newAppt);
      newSept5Appts.push(newAppt);
      count++;

      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
    if (count % 400 !== 0) {
      await batch.commit();
    }
    console.log(`Saved ${newSept5Appts.length} appointments to 2026-09-05.`);
    sept5Appts = newSept5Appts;
  }

  // Clear existing 2026-09-06 Khoa Lão appointments if any
  const qSept6 = query(collection(db, "appointments"), where("date", "==", "2026-09-06"), where("deptId", "==", "dept_lao"));
  const sept6Snap = await getDocs(qSept6);
  if (sept6Snap.size > 0) {
    console.log(`Clearing ${sept6Snap.size} existing 2026-09-06 Khoa Lão appointments...`);
    let batch = writeBatch(db);
    let count = 0;
    for (const d of sept6Snap.docs) {
      batch.delete(doc(db, "appointments", d.id));
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
    if (count % 400 !== 0) {
      await batch.commit();
    }
    console.log("Cleared existing 2026-09-06 appointments.");
  }

  console.log("\n=== STEP 2: Copying 2026-09-05 to 2026-09-06 with Staff Replacement ===");
  let batchCopy = writeBatch(db);
  let copyCount = 0;

  const mapStaff = (staffId: string | null | undefined): string | null => {
    if (!staffId) return null;
    if (staffId === LAN_ID) return TRANG_ID;
    if (staffId === HUONG_ID) return HA_ID;
    if (staffId === HUY_ID) return GIANG_ID;
    return staffId;
  };

  let replacedLanCount = 0;
  let replacedHuongCount = 0;
  let replacedHuyCount = 0;

  for (const appt of sept5Appts) {
    const newId = appt.id.includes("20260905") 
      ? appt.id.replace("20260905", "20260906") 
      : `appt_20260906_lao_${appt.id}`;

    if (appt.staffId === LAN_ID || appt.assistant1Id === LAN_ID || appt.assistant2Id === LAN_ID) replacedLanCount++;
    if (appt.staffId === HUONG_ID || appt.assistant1Id === HUONG_ID || appt.assistant2Id === HUONG_ID) replacedHuongCount++;
    if (appt.staffId === HUY_ID || appt.assistant1Id === HUY_ID || appt.assistant2Id === HUY_ID) replacedHuyCount++;

    const newAppt: any = {
      ...appt,
      id: newId,
      date: "2026-09-06",
      staffId: mapStaff(appt.staffId),
      assistant1Id: mapStaff(appt.assistant1Id),
      assistant2Id: mapStaff(appt.assistant2Id),
      status: AppointmentStatus.PENDING,
      conflictDetails: []
    };

    Object.keys(newAppt).forEach(k => {
      if (newAppt[k] === undefined) delete newAppt[k];
    });

    batchCopy.set(doc(db, "appointments", newId), newAppt);
    copyCount++;

    if (copyCount % 400 === 0) {
      await batchCopy.commit();
      batchCopy = writeBatch(db);
    }
  }

  if (copyCount % 400 !== 0) {
    await batchCopy.commit();
  }

  console.log(`\nSuccessfully copied ${copyCount} appointments to 2026-09-06!`);
  console.log(`Staff replacement summary:`);
  console.log(`  - Vũ Thị Hương Lan -> Nguyễn Thị Huyền Trang: ${replacedLanCount} appointments updated`);
  console.log(`  - Hoàng Thu Hương -> Vũ Thúy Hà: ${replacedHuongCount} appointments updated`);
  console.log(`  - Nguyễn Quang Huy -> Lê Hương Giang: ${replacedHuyCount} appointments updated`);
}

runCopy().then(() => process.exit(0)).catch(err => { console.error("Error in runCopy:", err); process.exit(1); });
