import { createClient } from "@supabase/supabase-js";
import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectAug9Fast() {
  await signInAnonymously(auth);

  // 1. Fetch Firebase 2026-08-09 appointments
  const qFb = query(collection(db, "appointments"), where("date", "==", "2026-08-09"), where("deptId", "==", "dept_lao"));
  const fbAug9Snap = await getDocs(qFb);
  const fbAug9 = fbAug9Snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  // 2. Fetch Supabase 2026-08-09 appointments
  const { data: sbRes } = await supabase.from('appointments').select('*');
  // Or query supabase
  let sbAppts: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    sbAppts = sbAppts.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const sbData = sbAppts.map(r => r.data || r);
  const sbAug9 = sbData.filter(a => a.date === '2026-08-09' && a.deptId === 'dept_lao');

  console.log(`Firebase 2026-08-09 Khoa Lão appts count: ${fbAug9.length}`);
  console.log(`Supabase 2026-08-09 Khoa Lão appts count: ${sbAug9.length}`);

  // Fetch Firebase patients
  const fbPatientsSnap = await getDocs(collection(db, "patients"));
  const fbPatients = fbPatientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const fbPatientMap = new Map(fbPatients.map(p => [p.id, p]));

  // Check unique patient IDs in fbAug9
  const fbAug9Patients = Array.from(new Set(fbAug9.map(a => a.patientId)));
  console.log(`Firebase 2026-08-09 has ${fbAug9Patients.length} unique patient IDs.`);
  const fbAug9InFbPatients = fbAug9Patients.filter(pid => fbPatientMap.has(pid));
  console.log(`Out of ${fbAug9Patients.length} patient IDs in Firebase 2026-08-09, ${fbAug9InFbPatients.length} exist in Firebase 'patients' collection.`);

  // Check unique patient IDs in sbAug9
  const sbAug9Patients = Array.from(new Set(sbAug9.map(a => a.patientId)));
  console.log(`Supabase 2026-08-09 has ${sbAug9Patients.length} unique patient IDs.`);
  const sbAug9InFbPatients = sbAug9Patients.filter(pid => fbPatientMap.has(pid));
  console.log(`Out of ${sbAug9Patients.length} patient IDs in Supabase 2026-08-09, ${sbAug9InFbPatients.length} exist in Firebase 'patients' collection.`);
}

inspectAug9Fast().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
