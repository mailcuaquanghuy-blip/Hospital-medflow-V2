import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function inspect() {
  await signInAnonymously(auth);

  const staffSnap = await getDocs(collection(db, "staff"));
  console.log("=== STAFF MEMBERS ===");
  staffSnap.docs.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id} | Name: ${data.name} | Dept: ${data.deptId}`);
  });

  const apptsSnap = await getDocs(collection(db, "appointments"));
  const sept5Appts = apptsSnap.docs.filter(d => d.data().date === '2026-09-05' && d.data().deptId === 'dept_lao');
  console.log(`\nFound ${sept5Appts.length} appointments on 2026-09-05 for dept_lao.`);

  const sept6Appts = apptsSnap.docs.filter(d => d.data().date === '2026-09-06' && d.data().deptId === 'dept_lao');
  console.log(`Found ${sept6Appts.length} appointments on 2026-09-06 for dept_lao.`);
}

inspect().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
