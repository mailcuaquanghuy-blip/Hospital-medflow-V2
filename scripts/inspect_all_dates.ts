import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function inspectAndPrepare() {
  await signInAnonymously(auth);

  const apptsSnap = await getDocs(collection(db, "appointments"));
  console.log(`Total appointments in DB: ${apptsSnap.size}`);

  const dateCounts = new Map<string, number>();
  apptsSnap.docs.forEach(d => {
    const data = d.data();
    dateCounts.set(data.date, (dateCounts.get(data.date) || 0) + 1);
  });

  const sortedDates = Array.from(dateCounts.keys()).sort();
  console.log("\nAll appointment dates and counts:");
  sortedDates.forEach(date => {
    console.log(`  Date: ${date} -> ${dateCounts.get(date)} appointments`);
  });

  // Check dept_lao specifically
  const laoApptsSnap = await getDocs(query(collection(db, "appointments"), where("deptId", "==", "dept_lao")));
  const laoDateCounts = new Map<string, number>();
  laoApptsSnap.docs.forEach(d => {
    const data = d.data();
    laoDateCounts.set(data.date, (laoDateCounts.get(data.date) || 0) + 1);
  });

  console.log("\nKhoa Lão (dept_lao) appointment dates and counts:");
  Array.from(laoDateCounts.keys()).sort().forEach(date => {
    console.log(`  Date: ${date} -> ${laoDateCounts.get(date)} appointments`);
  });
}

inspectAndPrepare().then(() => process.exit(0)).catch(e => console.error(e));
