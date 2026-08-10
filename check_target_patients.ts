import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from './firebase-applet-config.json';
import fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function check() {
  await signInAnonymously(auth);

  const pSnap = await getDocs(collection(db, "patients"));
  const patients = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  const targetPatients = patients.filter(p => {
    const name = (p.name || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return name.includes('pieng') || name.includes('hac') || name.includes('hieng');
  });

  let out = "=== TARGET PATIENTS ===\n";
  targetPatients.forEach(p => {
    out += `ID: ${p.id} | Name: ${p.name} | Dept: ${p.admittedByDeptId} | Status: ${p.status} | Bed: ${p.bedNumber} | Referrals: ${JSON.stringify(p.referrals)}\n`;
  });

  const targetIds = new Set(targetPatients.map(p => p.id));

  const aSnap = await getDocs(collection(db, "appointments"));
  const appts = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  out += "\n=== ALL APPOINTMENTS FOR TARGET PATIENTS ===\n";
  const targetAppts = appts.filter(a => targetIds.has(a.patientId));
  targetAppts.forEach(a => {
    out += `ID: ${a.id} | Patient: ${a.patientId} | Date: ${a.date} | Dept: ${a.deptId} | Proc: ${a.procedureId} | Status: ${a.status} | Time: ${a.startTime}-${a.endTime}\n`;
  });

  out += "\n=== APPOINTMENTS ON 2026-08-11 FOR TARGET PATIENTS ===\n";
  const aug11Appts = targetAppts.filter(a => a.date === '2026-08-11');
  aug11Appts.forEach(a => {
    out += `ID: ${a.id} | Patient: ${a.patientId} | Date: ${a.date} | Dept: ${a.deptId} | Proc: ${a.procedureId} | Status: ${a.status} | Time: ${a.startTime}-${a.endTime}\n`;
  });

  fs.writeFileSync('target_patients_output.txt', out);
  console.log("Wrote output to target_patients_output.txt");
  process.exit(0);
}

check();
