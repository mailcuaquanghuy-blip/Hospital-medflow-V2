import { createClient } from "@supabase/supabase-js";
import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function inspectPatients() {
  await signInAnonymously(auth);

  // Fetch Supabase patients
  let sbPatients: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('patients').select('*').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    sbPatients = sbPatients.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  console.log(`Total patients in Supabase table 'patients': ${sbPatients.length}`);

  // Fetch Firebase patients
  const fbPatientsSnap = await getDocs(collection(db, "patients"));
  console.log(`Total patients in Firebase collection 'patients': ${fbPatientsSnap.size}`);

  const sbData = sbPatients.map(r => r.data || r);
  const fbData = fbPatientsSnap.docs.map(d => d.data());

  const sbLaoActive = sbData.filter(p => p.departmentId === 'dept_lao' && !p.isDischarged);
  const fbLaoActive = fbData.filter(p => p.departmentId === 'dept_lao' && !p.isDischarged);

  console.log(`Active (not discharged) Khoa Lão patients in Supabase: ${sbLaoActive.length}`);
  console.log(`Active (not discharged) Khoa Lão patients in Firebase: ${fbLaoActive.length}`);

  // All Khoa Lão patients (including discharged)
  const sbLaoAll = sbData.filter(p => p.departmentId === 'dept_lao');
  const fbLaoAll = fbData.filter(p => p.departmentId === 'dept_lao');

  console.log(`All Khoa Lão patients in Supabase: ${sbLaoAll.length}`);
  console.log(`All Khoa Lão patients in Firebase: ${fbLaoAll.length}`);

  // Let's check why there are 88 patients!
  // How does App.tsx calculate patient list or count in Khoa Lão?
  // Is it 75 or 88? Where did 88 come from?
}

inspectPatients().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
