import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from './firebase-applet-config.json';
import fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function inspectData() {
  console.log("=== Authenticating Anonymously ===");
  await signInAnonymously(auth);
  console.log("Authenticated as:", auth.currentUser?.uid);

  console.log("\n=== Querying Patients ===");
  const pSnap = await getDocs(collection(db, "patients"));
  const patients = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  console.log(`Total patients in Firestore: ${patients.length}`);

  const targetPatients = patients.filter(p => {
    const name = (p.name || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return name.includes('pieng') || name.includes('hac') || name.includes('hieng');
  });

  console.log("\nMatching patients for (Quàng Thị Piêng, Lò Thị Hặc, Tòng Thị Hiêng):");
  targetPatients.forEach(p => {
    console.log(`ID: ${p.id} | Name: "${p.name}" | Dept: ${p.admittedByDeptId} | Status: ${p.status}`);
  });

  const targetIds = new Set(targetPatients.map(p => p.id));

  console.log("\n=== Querying Appointments ===");
  const aSnap = await getDocs(collection(db, "appointments"));
  const appts = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  console.log(`Total appointments in Firestore: ${appts.length}`);

  const targetAppts = appts.filter(a => targetIds.has(a.patientId));
  console.log(`\nAll appointments for target patients (${targetAppts.length}):`);
  targetAppts.forEach(a => {
    console.log(`Appt ID: ${a.id} | PatientId: ${a.patientId} | Date: ${a.date} | Dept: ${a.deptId} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime} | Status: ${a.status}`);
  });

  // Check specifically 2026-08-11 appointments for target patients
  const apptsOnAug11 = targetAppts.filter(a => a.date === '2026-08-11');
  console.log(`\nAppointments on 2026-08-11 for target patients (${apptsOnAug11.length}):`);
  apptsOnAug11.forEach(a => {
    console.log(`Appt ID: ${a.id} | Patient: ${a.patientId} | Dept: ${a.deptId} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime}`);
  });

  // Save backup of ALL appointments before any operations
  fs.writeFileSync('appointments_backup_before_delete.json', JSON.stringify(appts, null, 2));
  console.log(`\n[BACKUP CREATED] Saved backup of ${appts.length} appointments to appointments_backup_before_delete.json`);

  process.exit(0);
}

inspectData().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
