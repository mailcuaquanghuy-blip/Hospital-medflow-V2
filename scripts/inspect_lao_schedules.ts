import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function inspectLao() {
  await signInAnonymously(auth);

  const datesToTest = ["2026-08-09", "2026-09-01", "2026-09-02"];

  for (const date of datesToTest) {
    const q = query(collection(db, "appointments"), where("date", "==", date), where("deptId", "==", "dept_lao"));
    const snap = await getDocs(q);
    console.log(`=== Date ${date}: ${snap.size} appointments ===`);
    const procCounts: Record<string, number> = {};
    const patientSet = new Set<string>();
    snap.docs.forEach(d => {
      const a = d.data();
      procCounts[a.procedureId] = (procCounts[a.procedureId] || 0) + 1;
      patientSet.add(a.patientId);
    });
    console.log(`  Unique patients: ${patientSet.size}`);
    console.log(`  Procedures break down:`, procCounts);
  }
}

inspectLao().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
