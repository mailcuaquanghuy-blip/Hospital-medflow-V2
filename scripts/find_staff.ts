import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function findStaff() {
  await signInAnonymously(auth);
  const snap = await getDocs(collection(db, "staff"));
  console.log("=== STAFF REGISTER ===");
  snap.docs.forEach(d => {
    const s = d.data();
    console.log(`ID: ${d.id}, Name: "${s.name}", Dept: "${s.deptId}"`);
  });
}

findStaff().then(() => process.exit(0));
