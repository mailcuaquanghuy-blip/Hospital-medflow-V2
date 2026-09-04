import { createClient } from "@supabase/supabase-js";
import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifySync() {
  await signInAnonymously(auth);

  // 1. Fetch Firebase patients
  const fbSnap = await getDocs(collection(db, "patients"));
  const fbPatients = fbSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const fbPatientIds = new Set(fbPatients.map(p => p.id));
  console.log(`Firebase patient count: ${fbPatients.length}`);

  // 2. Fetch Supabase appointments
  let sbAppts: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    sbAppts = sbAppts.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const apptsData = sbAppts.map(r => r.data || r);
  console.log(`Supabase total appointments: ${apptsData.length}`);

  // Check if any appointment in Supabase references a patientId NOT in Firebase 330 patients
  const missingPatientIds = new Set<string>();
  apptsData.forEach(a => {
    if (a.patientId && !fbPatientIds.has(a.patientId)) {
      missingPatientIds.add(a.patientId);
    }
  });

  console.log(`Appointments referencing patient IDs missing from Firebase 330: ${missingPatientIds.size}`);
  if (missingPatientIds.size > 0) {
    console.log("Missing patient IDs sample:", Array.from(missingPatientIds).slice(0, 10));
  }

  // Check 2026-09-05 & 2026-09-06 appointments
  const appts0905 = apptsData.filter(a => a.date === '2026-09-05' && a.deptId === 'dept_lao');
  const appts0906 = apptsData.filter(a => a.date === '2026-09-06' && a.deptId === 'dept_lao');

  const missing0905 = appts0905.filter(a => !fbPatientIds.has(a.patientId));
  const missing0906 = appts0906.filter(a => !fbPatientIds.has(a.patientId));

  console.log(`2026-09-05 appts missing patient in FB 330: ${missing0905.length}`);
  console.log(`2026-09-06 appts missing patient in FB 330: ${missing0906.length}`);
}

verifySync().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
