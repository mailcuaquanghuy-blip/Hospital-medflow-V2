import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from './firebase-applet-config.json';
import fs from 'fs';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function processDelete() {
  await signInAnonymously(auth);

  console.log("Fetching all appointments...");
  const aSnap = await getDocs(collection(db, "appointments"));
  const allAppts = aSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  console.log(`Total appointments in DB: ${allAppts.length}`);

  // Save FULL backup of all appointments first
  fs.writeFileSync('full_appointments_backup.json', JSON.stringify(allAppts, null, 2));
  console.log("Full backup written to full_appointments_backup.json");

  // Find target appointments: deptId === 'dept_lao' AND date >= '2026-08-12'
  const toDelete = allAppts.filter(a => a.deptId === 'dept_lao' && a.date >= '2026-08-12');

  console.log(`Found ${toDelete.length} appointments for dept_lao on or after 2026-08-12.`);

  // Save backup of specifically deleted items
  fs.writeFileSync('deleted_lao_appts_from_20260812.json', JSON.stringify(toDelete, null, 2));
  console.log("Backup of deleted items written to deleted_lao_appts_from_20260812.json");

  if (toDelete.length === 0) {
    console.log("No appointments to delete.");
    process.exit(0);
  }

  // Delete in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(item => {
      batch.delete(doc(db, "appointments", item.id));
    });
    await batch.commit();
    console.log(`Deleted batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} items)`);
  }

  console.log(`Successfully deleted ${toDelete.length} procedure appointments for dept_lao from 2026-08-12 onwards.`);
  process.exit(0);
}

processDelete();
