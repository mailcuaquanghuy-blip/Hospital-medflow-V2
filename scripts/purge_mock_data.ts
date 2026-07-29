import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

async function purgeMockData() {
  await signInAnonymously(auth);
  console.log("=== PURGING VIRTUAL/MOCK DATA FROM FIRESTORE ===");

  // 1. Purge all mock/generated appointments
  const aSnap = await getDocs(collection(db, 'appointments'));
  let deletedAppts = 0;
  for (const aDoc of aSnap.docs) {
    await deleteDoc(doc(db, 'appointments', aDoc.id));
    deletedAppts++;
  }
  console.log(`Deleted ${deletedAppts} appointments.`);

  // 2. Purge all mock/generated patients
  const pSnap = await getDocs(collection(db, 'patients'));
  let deletedPatients = 0;
  for (const pDoc of pSnap.docs) {
    await deleteDoc(doc(db, 'patients', pDoc.id));
    deletedPatients++;
  }
  console.log(`Deleted ${deletedPatients} patients.`);

  // 3. Purge all attendance records
  const attSnap = await getDocs(collection(db, 'attendance'));
  let deletedAtt = 0;
  for (const attDoc of attSnap.docs) {
    await deleteDoc(doc(db, 'attendance', attDoc.id));
    deletedAtt++;
  }
  console.log(`Deleted ${deletedAtt} attendance records.`);

  console.log("=== FIRESTORE MOCK DATA PURGED CLEANLY ===");
}

purgeMockData().then(() => process.exit(0)).catch(err => {
  console.error("Purge error:", err);
  process.exit(1);
});
