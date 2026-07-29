import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

async function cleanup() {
  await signInAnonymously(auth);
  console.log("=== STARTING MOCK DATA CLEANUP ===");

  // 1. Clean up mock patients
  const pSnap = await getDocs(collection(db, 'patients'));
  let deletedPatients = 0;
  for (const pDoc of pSnap.docs) {
    const id = pDoc.id;
    // Delete any patient with mock IDs like p1, p2, p_lao1..10, p_ngoai*, p_noi*, p_phcn*
    if (id === 'p1' || id === 'p2' || id.startsWith('p_lao') || id.startsWith('p_ngoai') || id.startsWith('p_noi') || id.startsWith('p_phcn')) {
      await deleteDoc(doc(db, 'patients', id));
      deletedPatients++;
      console.log(`Deleted mock patient: ${id} (${pDoc.data().name})`);
    }
  }
  console.log(`Total mock patients deleted: ${deletedPatients}`);

  // 2. Clean up mock staff
  const sSnap = await getDocs(collection(db, 'staff'));
  let deletedStaff = 0;
  for (const sDoc of sSnap.docs) {
    const id = sDoc.id;
    // Keep only real staff (s_lao_101..109, s_uyen)
    if (id === 's1' || id === 's2' || id === 's3' || id === 's4' || id === 's5' || id === 's6' || id.startsWith('s_lao1') || id.startsWith('s_lao2') || id.startsWith('s_lao3') || id.startsWith('s_lao4') || id.startsWith('s_lao5') || id.startsWith('s_lao6')) {
      await deleteDoc(doc(db, 'staff', id));
      deletedStaff++;
      console.log(`Deleted mock staff: ${id} (${sDoc.data().name})`);
    }
  }
  console.log(`Total mock staff deleted: ${deletedStaff}`);

  console.log("=== CLEANUP COMPLETED SUCCESSFULLY ===");
}

cleanup().then(() => process.exit(0)).catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
