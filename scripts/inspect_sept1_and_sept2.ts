import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function inspect() {
  await signInAnonymously(auth);

  const q1 = query(collection(db, "appointments"), where("date", "==", "2026-09-01"), where("deptId", "==", "dept_lao"));
  const snap1 = await getDocs(q1);
  console.log(`=== 2026-09-01 (${snap1.size} appts) ===`);
  const staffCounts1: Record<string, number> = {};
  snap1.docs.forEach(d => {
    const a = d.data();
    [a.staffId, a.assistant1Id, a.assistant2Id].filter(Boolean).forEach(id => {
      staffCounts1[id] = (staffCounts1[id] || 0) + 1;
    });
  });

  const staffSnap = await getDocs(collection(db, "staff"));
  const staffMap: Record<string, string> = {};
  staffSnap.docs.forEach(d => { staffMap[d.id] = d.data().name; });

  Object.keys(staffCounts1).forEach(id => {
    console.log(`  Staff ${staffMap[id] || id}: ${staffCounts1[id]} appearances`);
  });

  const q2 = query(collection(db, "appointments"), where("date", "==", "2026-09-02"), where("deptId", "==", "dept_lao"));
  const snap2 = await getDocs(q2);
  console.log(`\n=== 2026-09-02 (${snap2.size} appts) ===`);
  const staffCounts2: Record<string, number> = {};
  snap2.docs.forEach(d => {
    const a = d.data();
    [a.staffId, a.assistant1Id, a.assistant2Id].filter(Boolean).forEach(id => {
      staffCounts2[id] = (staffCounts2[id] || 0) + 1;
    });
  });
  Object.keys(staffCounts2).forEach(id => {
    console.log(`  Staff ${staffMap[id] || id}: ${staffCounts2[id]} appearances`);
  });
}

inspect().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
