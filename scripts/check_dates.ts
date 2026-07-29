import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

function cleanVN(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function check() {
  await signInAnonymously(auth);
  const snap = await getDocs(collection(db, "patients"));
  snap.docs.forEach(d => {
    const p = d.data();
    if (cleanVN(p.name).includes("quang thi la")) {
      console.log(`ID: ${d.id}, Name: "${p.name}", Bed: "${p.bedNumber}", Room: "${p.roomNumber}", Status: "${p.status}"`);
    }
  });
}

check().then(() => process.exit(0));

