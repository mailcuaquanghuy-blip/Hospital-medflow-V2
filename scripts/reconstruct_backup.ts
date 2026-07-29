import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function reconstructBackup() {
  await signInAnonymously(auth);
  const docRef = doc(db, "backups", "backup_SYSTEM_2026-07-28_auto");
  const snapDoc = await getDoc(docRef);
  if (snapDoc.exists()) {
    const data = snapDoc.data();
    if (data.snapshot) {
      const keys = Object.keys(data.snapshot).map(Number).sort((a, b) => a - b);
      let reconstructed = "";
      for (const k of keys) {
        reconstructed += data.snapshot[k];
      }
      console.log("Reconstructed String Length:", reconstructed.length);
      console.log("Start of string:", reconstructed.substring(0, 200));
      console.log("End of string:", reconstructed.substring(reconstructed.length - 200));
      
      try {
        const parsed = JSON.parse(reconstructed);
        console.log("Successfully parsed JSON!");
        console.log("Keys of parsed backup:", Object.keys(parsed));
        for (const col of Object.keys(parsed)) {
          console.log(`- Collection ${col}: ${parsed[col]?.length || 0} items`);
        }
      } catch (e: any) {
        console.error("Failed to parse reconstructed JSON:", e.message);
      }
    }
  }
}

reconstructBackup().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
