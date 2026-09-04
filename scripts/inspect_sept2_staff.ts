import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function inspectSept2() {
  await signInAnonymously(auth);

  const q = query(collection(db, "appointments"), where("date", "==", "2026-09-02"), where("deptId", "==", "dept_lao"));
  const snap = await getDocs(q);

  const staffSnap = await getDocs(collection(db, "staff"));
  const staffMap: Record<string, string> = {};
  staffSnap.docs.forEach(d => { staffMap[d.id] = d.data().name; });

  console.log(`Found ${snap.size} appointments on 2026-09-02 for dept_lao:`);
  snap.docs.forEach(d => {
    const a = d.data();
    const mainName = staffMap[a.staffId] || a.staffId;
    const asst1Name = staffMap[a.assistant1Id] || a.assistant1Id || 'none';
    const asst2Name = staffMap[a.assistant2Id] || a.assistant2Id || 'none';
    console.log(`- Appt ${d.id}: time=${a.startTime}-${a.endTime}, main=${mainName}, asst1=${asst1Name}, asst2=${asst2Name}, patient=${a.patientId}`);
  });
}

inspectSept2().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
