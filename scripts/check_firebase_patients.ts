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

async function checkFbPatients() {
  await signInAnonymously(auth);

  const fbSnap = await getDocs(collection(db, "patients"));
  const fbPatients = fbSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  console.log(`Total Firebase patients: ${fbPatients.length}`);

  // Count by department
  const depts: Record<string, number> = {};
  fbPatients.forEach(p => {
    const d = p.admittedByDeptId || p.departmentId || 'none';
    depts[d] = (depts[d] || 0) + 1;
  });
  console.log("Firebase patients by department:", depts);

  // Khoa Lão patients in Firebase
  const laoPatients = fbPatients.filter(p => p.admittedByDeptId === 'dept_lao' || p.departmentId === 'dept_lao');
  console.log(`Total Khoa Lão patients in Firebase: ${laoPatients.length}`);

  for (const date of ['2026-08-09', '2026-09-01', '2026-09-03', '2026-09-05', '2026-09-06']) {
    const visible = laoPatients.filter(p => {
      const admissionDateStr = p.admissionDate ? String(p.admissionDate).substring(0, 10) : '';
      if (admissionDateStr && date < admissionDateStr) return false;

      const isDischarged = p.status === 'DISCHARGED';
      const dischargeDateStr = p.dischargeDate ? String(p.dischargeDate).substring(0, 10) : '';

      if (isDischarged && dischargeDateStr && dischargeDateStr < date) {
        return false;
      }
      return true;
    });
    console.log(`Date ${date} -> Khoa Lão visible patients in Firebase: ${visible.length}`);
  }
}

checkFbPatients().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
