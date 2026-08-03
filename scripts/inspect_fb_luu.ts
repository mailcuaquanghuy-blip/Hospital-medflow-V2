import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function inspectFbLuuAndJul31() {
  await signInAnonymously(auth);

  const q = query(collection(db, "appointments"), where("patientId", "==", "p_s9c9eqrsw"));
  const snap = await getDocs(q);
  console.log("Firebase appointments for Hoàng Thị Lưu (p_s9c9eqrsw):", snap.docs.length);
  snap.docs.forEach(d => {
    const a = d.data();
    console.log(`Date: ${a.date} | ID: ${d.id} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime} | Staff: ${a.staffId} | Asst1: ${a.assistant1Id}`);
  });

  const q2 = query(collection(db, "appointments"), where("date", "==", "2026-07-31"));
  const snap2 = await getDocs(q2);
  console.log("\nFirebase appointments on 2026-07-31:", snap2.docs.length);
  snap2.docs.forEach(d => {
    const a = d.data();
    console.log(`- ID: ${d.id} | Patient: ${a.patientId} | Proc: ${a.procedureId} | Time: ${a.startTime}-${a.endTime} | Staff: ${a.staffId}`);
  });
}

inspectFbLuuAndJul31().catch(console.error);
