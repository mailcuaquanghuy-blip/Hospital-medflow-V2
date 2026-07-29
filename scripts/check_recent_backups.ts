import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function checkBackups() {
  await signInAnonymously(auth);
  const backupsSnap = await getDocs(query(collection(db, "backups")));
  console.log(`Found ${backupsSnap.size} backups.`);
  backupsSnap.docs.forEach(d => {
    const data = d.data();
    console.log(`- ${d.id}: ${data.name} (CreatedAt: ${data.createdAt})`);
  });
}

checkBackups().then(() => process.exit(0)).catch(e => console.error(e));
