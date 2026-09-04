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

async function compare() {
  await signInAnonymously(auth);

  // 1. Fetch Supabase patients
  let sbRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('patients').select('*').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    sbRows = sbRows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const sbPatients = sbRows.map(r => r.data || r);

  // 2. Fetch Firebase patients
  const fbSnap = await getDocs(collection(db, "patients"));
  const fbPatients = fbSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Supabase total patients: ${sbPatients.length}`);
  console.log(`Firebase total patients: ${fbPatients.length}`);

  // Let's check status breakdown in Supabase
  const sbStatus: Record<string, number> = {};
  sbPatients.forEach(p => {
    const st = `${p.status || 'NO_STATUS'}_discharged:${p.isDischarged ?? false}`;
    sbStatus[st] = (sbStatus[st] || 0) + 1;
  });
  console.log("Supabase patients status breakdown:", sbStatus);

  // Let's check status breakdown in Firebase
  const fbStatus: Record<string, number> = {};
  fbPatients.forEach((p: any) => {
    const st = `${p.status || 'NO_STATUS'}_discharged:${p.isDischarged ?? false}`;
    fbStatus[st] = (fbStatus[st] || 0) + 1;
  });
  console.log("Firebase patients status breakdown:", fbStatus);

  // Check unique patients with appointments in Khoa Lão on date 2026-08-09 / 2026-09-01 / 2026-09-05 / 2026-09-06
  // In Supabase appointments:
  let sbAppts: any[] = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase.from('appointments').select('*').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    sbAppts = sbAppts.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const apptsData = sbAppts.map(r => r.data || r);

  const dates = ['2026-08-09', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05', '2026-09-06'];
  for (const date of dates) {
    const dateAppts = apptsData.filter(a => a.date === date && a.deptId === 'dept_lao');
    const pSet = new Set(dateAppts.map(a => a.patientId));
    console.log(`Date ${date} -> ${dateAppts.length} appts in Khoa Lão for ${pSet.size} unique patients`);
  }
}

compare().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
