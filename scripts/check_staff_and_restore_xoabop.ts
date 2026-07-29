import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function checkStaffAndTemplates() {
  await signInAnonymously(auth);

  const staffSnap = await getDocs(collection(db, "staff"));
  console.log("=== STAFF IN FIRESTORE ===");
  const staffList = staffSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  staffList.forEach(s => {
    console.log(`ID: ${s.id} | Name: ${s.name} | Role: ${s.role} | Dept: ${s.deptId}`);
  });

  const templatesSnap = await getDocs(query(collection(db, "templates"), where("deptId", "==", "dept_lao")));
  console.log(`\n=== CURRENT TEMPLATES IN KHOA LÃO (${templatesSnap.size}) ===`);
  templatesSnap.docs.forEach(d => {
    const t = d.data();
    console.log(`Template "${t.name}" [${t.id}] | Procs: ${t.procedures ? t.procedures.length : 0}`);
  });
}

checkStaffAndTemplates().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
