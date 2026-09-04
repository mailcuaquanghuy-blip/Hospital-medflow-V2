import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function checkSept() {
  await signInAnonymously(auth);

  for (const d of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']) {
    const q = query(collection(db, "appointments"), where("date", "==", d));
    const snap = await getDocs(q);
    console.log(`Date ${d}: ${snap.size} appointments total`);
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - Appt ${doc.id}: patient=${data.patientId}, proc=${data.procedureId}, dept=${data.deptId}, staff=${data.staffId}`);
    });
  }
}

checkSept().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
