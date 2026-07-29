import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function inspectSnapshotItems() {
  await signInAnonymously(auth);
  const docRef = doc(db, "backups", "backup_SYSTEM_2026-07-28_auto");
  const snapDoc = await getDoc(docRef);
  if (snapDoc.exists()) {
    const data = snapDoc.data();
    if (data.snapshot) {
      console.log("Snapshot type:", typeof data.snapshot);
      const keys = Object.keys(data.snapshot);
      console.log("Total keys:", keys.length);
      for (let i = 0; i < Math.min(5, keys.length); i++) {
        const k = keys[i];
        console.log(`\nKey "${k}":`, JSON.stringify(data.snapshot[k]).substring(0, 300));
      }
    }
  }
}

inspectSnapshotItems().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
