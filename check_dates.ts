import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function checkDates() {
  await signInAnonymously(auth);

  const aSnap = await getDocs(collection(db, "appointments"));
  const allAppts = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  const deptLaoAppts = allAppts.filter(a => a.deptId === 'dept_lao');

  const datesLao = Array.from(new Set(deptLaoAppts.map(a => a.date))).sort();
  console.log("Dept Lao Dates:", datesLao.slice(-20)); // last 20 dates

  const allDates = Array.from(new Set(allAppts.map(a => a.date))).sort();
  console.log("All DB Dates (last 20):", allDates.slice(-20));

  console.log("\nMax date in DB for dept_lao:", datesLao[datesLao.length - 1]);
  console.log("Max date in DB overall:", allDates[allDates.length - 1]);

  process.exit(0);
}

checkDates();
