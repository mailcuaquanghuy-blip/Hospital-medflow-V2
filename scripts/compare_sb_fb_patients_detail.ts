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

async function compareDetail() {
  await signInAnonymously(auth);

  // Supabase patients
  let sbRows: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    sbRows = sbRows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const sbMap = new Map<string, any>();
  sbRows.forEach(r => sbMap.set(r.id, r.data || r));

  // Firebase patients
  const fbSnap = await getDocs(collection(db, "patients"));
  const fbMap = new Map<string, any>();
  fbSnap.docs.forEach(d => fbMap.set(d.id, d.data()));

  console.log(`Supabase count: ${sbMap.size}`);
  console.log(`Firebase count: ${fbMap.size}`);

  // Find IDs in SB but not in FB
  const extraInSb: any[] = [];
  sbMap.forEach((v, k) => {
    if (!fbMap.has(k)) {
      extraInSb.push(v);
    }
  });

  console.log(`Patients in Supabase but NOT in Firebase: ${extraInSb.length}`);
  if (extraInSb.length > 0) {
    console.log("Sample extra patients in Supabase:", extraInSb.slice(0, 10).map(p => ({ id: p.id, name: p.name, status: p.status, admissionDate: p.admissionDate, dischargeDate: p.dischargeDate })));
  }

  // Find IDs in FB but not in SB
  const extraInFb: any[] = [];
  fbMap.forEach((v, k) => {
    if (!sbMap.has(k)) {
      extraInFb.push(v);
    }
  });
  console.log(`Patients in Firebase but NOT in Supabase: ${extraInFb.length}`);

  // Also check visible Khoa Lão patients in Firebase for date 2026-09-03 / 2026-09-05:
  const fbList = Array.from(fbMap.values());
  for (const date of ['2026-09-03', '2026-09-05', '2026-09-06']) {
    const fbVisible = fbList.filter(p => {
      if (p.admittedByDeptId !== 'dept_lao') return false;
      const admissionDateStr = p.admissionDate ? String(p.admissionDate).substring(0, 10) : '';
      if (admissionDateStr && date < admissionDateStr) return false;

      const isDischarged = p.status === 'DISCHARGED';
      const dischargeDateStr = p.dischargeDate ? String(p.dischargeDate).substring(0, 10) : '';

      if (isDischarged && dischargeDateStr && dischargeDateStr < date) {
        return false;
      }
      return true;
    });
    console.log(`Firebase visible Khoa Lão patients for date ${date}: ${fbVisible.length}`);
  }
}

compareDetail().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
