import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, limit } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function checkDates() {
  await signInAnonymously(auth);

  const apptsSnap = await getDocs(collection(db, "appointments"));
  console.log(`Total appointments in Firestore: ${apptsSnap.size}`);

  const datesMap: Record<string, number> = {};
  apptsSnap.docs.forEach(d => {
    const data = d.data();
    const key = `${data.date}_${data.deptId || 'no_dept'}`;
    datesMap[key] = (datesMap[key] || 0) + 1;
  });

  console.log("=== APPOINTMENT COUNTS BY DATE & DEPT ===");
  Object.keys(datesMap).sort().forEach(k => {
    console.log(`${k}: ${datesMap[k]}`);
  });
}

checkDates().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
