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

async function restorePatients() {
  await signInAnonymously(auth);
  console.log("=== RESTORING SUPABASE PATIENTS FROM CANONICAL FIREBASE PATIENTS ===");

  // 1. Fetch 330 canonical patients from Firebase
  const fbSnap = await getDocs(collection(db, "patients"));
  const fbPatients = fbSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  console.log(`Canonical Firebase patients count: ${fbPatients.length}`);

  const fbPatientIds = new Set(fbPatients.map(p => p.id));

  // 2. Fetch all existing patients in Supabase
  let sbRows: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    sbRows = sbRows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Current Supabase patients count: ${sbRows.length}`);

  // Find IDs in Supabase that are NOT in Firebase
  const idsToDeleteFromSb = sbRows.filter(r => !fbPatientIds.has(r.id)).map(r => r.id);
  console.log(`Deleting ${idsToDeleteFromSb.length} extra/invalid patient rows from Supabase...`);

  for (let i = 0; i < idsToDeleteFromSb.length; i += 100) {
    const chunk = idsToDeleteFromSb.slice(i, i + 100);
    const { error } = await supabase.from('patients').delete().in('id', chunk);
    if (error) console.error("Error deleting chunk from Supabase:", error);
  }

  // 3. Upsert all 330 canonical patients into Supabase
  console.log(`Upserting ${fbPatients.length} canonical patients into Supabase...`);
  const sbRowsToInsert = fbPatients.map(p => ({
    id: p.id,
    data: JSON.parse(JSON.stringify(p, (k, v) => v === undefined ? null : v))
  }));

  for (let i = 0; i < sbRowsToInsert.length; i += 50) {
    const chunk = sbRowsToInsert.slice(i, i + 50);
    const { error } = await supabase.from('patients').upsert(chunk);
    if (error) console.error("Error upserting chunk to Supabase:", error);
  }

  // 4. Verify Supabase patient count
  let checkSb: any[] = [];
  from = 0;
  while (true) {
    const { data } = await supabase.from('patients').select('*').range(from, from + 999);
    if (!data || data.length === 0) break;
    checkSb = checkSb.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`\nVerified Supabase patient count: ${checkSb.length}`);

  // Check visible Khoa Lão patients in Supabase for 2026-09-03, 2026-09-05, 2026-09-06
  const checkSbData = checkSb.map(r => r.data || r);
  for (const date of ['2026-09-03', '2026-09-05', '2026-09-06']) {
    const visible = checkSbData.filter(p => {
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
    console.log(`Date ${date} -> Restored visible Khoa Lão patients in Supabase: ${visible.length}`);
  }

  if (checkSb.length === 330) {
    console.log("\n✅ PATIENTS RESTORED SUCCESSFULLY TO EXACT 330 CANONICAL PATIENTS!");
  } else {
    console.error("\n❌ FAILED TO RESTORE PATIENTS PERFECTLY!");
  }
}

restorePatients().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
