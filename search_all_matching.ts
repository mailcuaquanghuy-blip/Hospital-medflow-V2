import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from './firebase-applet-config.json';
import fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function searchAll() {
  await signInAnonymously(auth);

  const pSnap = await getDocs(collection(db, "patients"));
  const patients = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  console.log(`Total patients: ${patients.length}`);

  const matches = patients.filter(p => {
    const n = (p.name || '').toLowerCase();
    return n.includes('tong') || n.includes('tòng') || 
           n.includes('hặc') || n.includes('hac') || 
           n.includes('piêng') || n.includes('pieng') || n.includes('phiệng') ||
           n.includes('hiêng') || n.includes('hieng');
  });

  console.log(`Matching patients count: ${matches.length}`);
  let out = `Matching patients (${matches.length}):\n`;
  matches.forEach(p => {
    out += `ID: ${p.id} | Name: "${p.name}" | Dept: ${p.admittedByDeptId} | Status: ${p.status} | Bed: ${p.bedNumber} | Referrals: ${JSON.stringify(p.referrals)}\n`;
  });

  const matchIds = new Set(matches.map(m => m.id));

  const aSnap = await getDocs(collection(db, "appointments"));
  const appts = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  out += `\nTotal appointments for matching patients: ${appts.filter(a => matchIds.has(a.patientId)).length}\n`;
  appts.filter(a => matchIds.has(a.patientId)).forEach(a => {
    out += `Appt ID: ${a.id} | Patient: ${a.patientId} | Date: ${a.date} | Dept: ${a.deptId} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime}\n`;
  });

  fs.writeFileSync('all_matching_patients.txt', out);
  console.log("Wrote all_matching_patients.txt");
  process.exit(0);
}

searchAll();
