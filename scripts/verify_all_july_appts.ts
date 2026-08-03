import { fetchSupabaseTable } from "../utils/supabaseService";
import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function verifyAllJuly() {
  await signInAnonymously(auth);

  const patients = await fetchSupabaseTable<any>('patients') || [];
  const staff = await fetchSupabaseTable<any>('staff') || [];
  const procedures = await fetchSupabaseTable<any>('procedures') || [];
  const sbAppts = await fetchSupabaseTable<any>('appointments') || [];

  const fbSnap = await getDocs(collection(db, "appointments"));
  const fbAppts = fbSnap.docs.map(d => ({ ...d.data(), id: d.id })) as any[];

  console.log(`Supabase total appts: ${sbAppts.length}`);
  console.log(`Firebase total appts: ${fbAppts.length}`);

  const julSb = sbAppts.filter(a => a.date >= '2026-07-01' && a.date <= '2026-07-31');
  const julFb = fbAppts.filter(a => a.date >= '2026-07-01' && a.date <= '2026-07-31');

  console.log(`July (2026-07-01 to 2026-07-31) Appts: Supabase = ${julSb.length}, Firebase = ${julFb.length}`);

  // Check procedures breakdown for July
  const procCounts = new Map<string, number>();
  julSb.forEach(a => {
    const pName = procedures.find(p => p.id === a.procedureId)?.name || a.procedureId;
    procCounts.set(pName, (procCounts.get(pName) || 0) + 1);
  });

  console.log("\nJuly Procedures breakdown in DB:");
  procCounts.forEach((count, name) => console.log(`  - ${name}: ${count}`));

  // Check staff assignment
  const unassignedStaff = julSb.filter(a => !a.staffId);
  console.log(`\nAppointments with missing staffId in July: ${unassignedStaff.length}`);

  // Check consistency between Supabase and Firebase for July
  const fbMap = new Map<string, any>();
  julFb.forEach(a => fbMap.set(a.id, a));

  let diffCount = 0;
  julSb.forEach(a => {
    const fb = fbMap.get(a.id);
    if (!fb) {
      diffCount++;
    } else if (fb.startTime !== a.startTime || fb.endTime !== a.endTime || fb.staffId !== a.staffId || fb.procedureId !== a.procedureId) {
      diffCount++;
    }
  });

  console.log(`\nDiff count between Supabase and Firebase for July: ${diffCount}`);
}

verifyAllJuly().then(() => process.exit(0)).catch(console.error);
