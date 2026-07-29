import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function testQuota() {
  await signInAnonymously(auth);
  try {
    await setDoc(doc(db, "test_quota", "1"), { test: true });
    console.log("Write successful!");
    const snap = await getDoc(doc(db, "test_quota", "1"));
    console.log("Read successful! Data:", snap.data());
  } catch (err) {
    console.error("Quota error:", err);
  }
}
testQuota().then(() => process.exit(0)).catch(e => console.error(e));
