import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus } from "../types";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  await signInAnonymously(auth);

  // 1. Fetch appointments
  const apptsSnap = await getDocs(collection(db, "appointments"));
  const allAppts = apptsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];

  const sourceDate = "2026-06-20";
  const targetDate = "2026-06-21";
  const deptId = "dept_lao";

  const sourceAppts = allAppts.filter(a => a.date === sourceDate && a.deptId === deptId);
  console.log(`Loaded ${sourceAppts.length} source Geriatrics appointments on ${sourceDate}.`);

  if (sourceAppts.length === 0) {
    console.log("No appointments found on the source date to copy.");
    return;
  }

  // Clear any existing target date Geriatrics appointments (idempotence)
  const existingTargetAppts = allAppts.filter(a => a.date === targetDate && a.deptId === deptId);
  if (existingTargetAppts.length > 0) {
    console.log(`Clearing ${existingTargetAppts.length} existing Geriatrics appointments on ${targetDate}...`);
    for (const appt of existingTargetAppts) {
      await deleteDoc(doc(db, "appointments", appt.id));
    }
    console.log("Cleared existing target date appointments.");
  }

  // Staff mappings:
  // Cà Thị Oanh -> Bùi Thị Thu Hà
  const oanhId = "s_lbf6qsiya";
  const haId = "s_p085044zx";

  // Hoàng Thu Hương -> Lê Hương Giang
  const huongId = "s_1xca9gdv3";
  const giangId = "s_tppw9td1m";

  console.log("\nStarting appointment migration and staff substitution for June 21...");

  let processedCount = 0;

  for (const appt of sourceAppts) {
    const originalId = appt.id;
    // Standardizing new ID for target date
    const newId = originalId.includes("2026-06-20") 
      ? originalId.replace("2026-06-20", "2026-06-21") 
      : `${originalId}_2026-06-21`;

    // Map staffId
    let mappedStaffId = appt.staffId;
    if (mappedStaffId === oanhId) mappedStaffId = haId;
    else if (mappedStaffId === huongId) mappedStaffId = giangId;

    // Map assistant1Id
    let mappedAsst1Id = appt.assistant1Id;
    if (mappedAsst1Id === oanhId) mappedAsst1Id = haId;
    else if (mappedAsst1Id === huongId) mappedAsst1Id = giangId;

    // Map assistant2Id
    let mappedAsst2Id = appt.assistant2Id;
    if (mappedAsst2Id === oanhId) mappedAsst2Id = haId;
    else if (mappedAsst2Id === huongId) mappedAsst2Id = giangId;

    const newAppt: any = {
      ...appt,
      id: newId,
      date: targetDate,
      staffId: mappedStaffId,
      assistant1Id: mappedAsst1Id || null,
      assistant2Id: mappedAsst2Id || null,
      conflictDetails: [], // Starts clean and conflict-free for the new day
      status: AppointmentStatus.PENDING // Standard status for tomorrow's appointments
    };

    // Clean up undefined values from original if any
    Object.keys(newAppt).forEach(key => {
      if (newAppt[key] === undefined) {
        delete newAppt[key];
      }
    });

    await setDoc(doc(db, "appointments", newId), newAppt);
    processedCount++;
  }

  console.log(`\nMigration completed! Successfully copied ${processedCount} appointments to ${targetDate}.`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
