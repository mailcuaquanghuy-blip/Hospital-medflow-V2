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

async function analyze() {
  await signInAnonymously(auth);

  // 1. Firebase patients
  const fbSnap = await getDocs(collection(db, "patients"));
  const fbPatients = fbSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  const fbMap = new Map(fbPatients.map(p => [p.id, p]));

  // Visible in FB for 2026-09-03
  const fbVisibleSept3 = fbPatients.filter(p => {
    if (p.admittedByDeptId !== 'dept_lao') return false;
    const admissionDateStr = p.admissionDate ? String(p.admissionDate).substring(0, 10) : '';
    if (admissionDateStr && '2026-09-03' < admissionDateStr) return false;

    const isDischarged = p.status === 'DISCHARGED';
    const dischargeDateStr = p.dischargeDate ? String(p.dischargeDate).substring(0, 10) : '';

    if (isDischarged && dischargeDateStr && dischargeDateStr < '2026-09-03') {
      return false;
    }
    return true;
  });

  console.log(`FB visible Sept 3 count: ${fbVisibleSept3.length}`);

  // 2. Supabase patients
  let sbRows: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    sbRows = sbRows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const sbPatients = sbRows.map(r => r.data || r);

  const sbVisibleSept3 = sbPatients.filter(p => {
    if (p.admittedByDeptId !== 'dept_lao') return false;
    const admissionDateStr = p.admissionDate ? String(p.admissionDate).substring(0, 10) : '';
    if (admissionDateStr && '2026-09-03' < admissionDateStr) return false;

    const isDischarged = p.status === 'DISCHARGED';
    const dischargeDateStr = p.dischargeDate ? String(p.dischargeDate).substring(0, 10) : '';

    if (isDischarged && dischargeDateStr && dischargeDateStr < '2026-09-03') {
      return false;
    }
    return true;
  });

  console.log(`SB visible Sept 3 count: ${sbVisibleSept3.length}`);

  // Find the 28 extra patients in SB visible Sept 3 that are NOT in FB visible Sept 3
  const fbVisIds = new Set(fbVisibleSept3.map(p => p.id));
  const extraInSbVisible = sbVisibleSept3.filter(p => !fbVisIds.has(p.id));

  console.log(`Extra ${extraInSbVisible.length} patients visible in SB but not FB:`);
  extraInSbVisible.forEach(p => {
    const existsInFb = fbMap.has(p.id);
    const fbVer = fbMap.get(p.id);
    console.log(`- ID: ${p.id}, Name: ${p.name}, Status: ${p.status}, Admission: ${p.admissionDate}, Discharge: ${p.dischargeDate} | Exists in FB? ${existsInFb} (FB Status: ${fbVer?.status}, FB Discharge: ${fbVer?.dischargeDate})`);
  });
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
