import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const patientIds = [
  "p_o5iknqk86", // Lò Văn Nọi
  "p_7jtdfrcid", // Lò Thị Nhâu
  "p_88ipn1c3r", // Điêu Thị Hà
  "p_70ijcn68t", // Quàng Thị Thanh
  "p_f3gqhd716"  // Lò Minh Chấn
];

async function checkAppts() {
  await signInAnonymously(auth);

  // 1. Check in Firestore
  const fsSnap = await getDocs(query(collection(db, "appointments"), where("date", "==", "2026-07-31")));
  const fsAppts = fsSnap.docs.map(d => d.data());
  const fsFiltered = fsAppts.filter(a => patientIds.includes(a.patientId));

  console.log("=== Appointments in Firestore for July 31st, 2026 ===");
  fsFiltered.forEach(a => {
    console.log(`- ID: ${a.id} | Patient ID: ${a.patientId} | Proc ID: ${a.procedureId} | Time: ${a.startTime} - ${a.endTime}`);
  });

  // 2. Check in Supabase
  const { data: sbSnap } = await supabase.from("appointments").select("*");
  const sbAppts = sbSnap ? sbSnap.map(r => r.data || r) : [];
  const sbFiltered = sbAppts.filter(a => a.date === "2026-07-31" && patientIds.includes(a.patientId));

  console.log("\n=== Appointments in Supabase for July 31st, 2026 ===");
  sbFiltered.forEach(a => {
    console.log(`- ID: ${a.id} | Patient ID: ${a.patientId} | Proc ID: ${a.procedureId} | Time: ${a.startTime} - ${a.endTime}`);
  });
}

checkAppts().catch(err => console.error(err));
