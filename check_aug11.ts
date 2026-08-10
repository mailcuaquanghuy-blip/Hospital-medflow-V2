import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from './firebase-applet-config.json';
import fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function checkAug11() {
  await signInAnonymously(auth);

  const pSnap = await getDocs(collection(db, "patients"));
  const patients = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  const patientMap = new Map(patients.map(p => [p.id, p]));

  const aSnap = await getDocs(collection(db, "appointments"));
  const appts = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  const aug11Appts = appts.filter(a => a.date === '2026-08-11');
  console.log(`Total appointments on 2026-08-11 in entire database: ${aug11Appts.length}`);

  let out = `Total appointments on 2026-08-11: ${aug11Appts.length}\n\n`;
  aug11Appts.forEach(a => {
    const p = patientMap.get(a.patientId);
    out += `Appt ID: ${a.id} | PatientId: ${a.patientId} | PatientName: "${p?.name || 'UNKNOWN'}" | Dept: ${a.deptId} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime}\n`;
  });

  fs.writeFileSync('aug11_appts.txt', out);
  console.log("Wrote aug11_appts.txt");
  process.exit(0);
}

checkAug11();
