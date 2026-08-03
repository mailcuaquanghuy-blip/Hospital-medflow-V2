import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
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

async function inspectData() {
  await signInAnonymously(auth);

  // Fetch Firebase data
  const fbApptsSnap = await getDocs(collection(db, "appointments"));
  const fbAppts = fbApptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  const fbProcsSnap = await getDocs(collection(db, "procedures"));
  const fbProcs = fbProcsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  const fbStaffSnap = await getDocs(collection(db, "staff"));
  const fbStaff = fbStaffSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  const fbPatientsSnap = await getDocs(collection(db, "patients"));
  const fbPatients = fbPatientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  // Fetch Supabase data
  const { data: sbApptsRows } = await supabase.from('appointments').select('*');
  const sbAppts = (sbApptsRows || []).map(r => r.data || r);

  const { data: sbProcsRows } = await supabase.from('procedures').select('*');
  const sbProcs = (sbProcsRows || []).map(r => r.data || r);

  const { data: sbStaffRows } = await supabase.from('staff').select('*');
  const sbStaff = (sbStaffRows || []).map(r => r.data || r);

  const { data: sbPatientsRows } = await supabase.from('patients').select('*');
  const sbPatients = (sbPatientsRows || []).map(r => r.data || r);

  console.log("=== COUNTS ===");
  console.log(`Firebase: ${fbAppts.length} appts, ${fbProcs.length} procs, ${fbStaff.length} staff, ${fbPatients.length} patients`);
  console.log(`Supabase: ${sbAppts.length} appts, ${sbProcs.length} procs, ${sbStaff.length} staff, ${sbPatients.length} patients`);

  // Analyze dates in Supabase & Firebase appointments
  const sbDates: Record<string, number> = {};
  sbAppts.forEach(a => { sbDates[a.date] = (sbDates[a.date] || 0) + 1; });
  console.log("\nSupabase Appointments per date:", sbDates);

  const fbDates: Record<string, number> = {};
  fbAppts.forEach(a => { fbDates[a.date] = (fbDates[a.date] || 0) + 1; });
  console.log("\nFirebase Appointments per date:", fbDates);

  // Compare appts <= 2026-07-31
  const July31OrBeforeSb = sbAppts.filter(a => a.date <= '2026-07-31');
  const July31OrBeforeFb = fbAppts.filter(a => a.date <= '2026-07-31');
  console.log(`\nAppts <= 2026-07-31 -> Supabase: ${July31OrBeforeSb.length}, Firebase: ${July31OrBeforeFb.length}`);

  // Check missing appts in Supabase that are in Firebase for <= 2026-07-31
  const sbApptIds = new Set(sbAppts.map(a => a.id));
  const missingInSb = July31OrBeforeFb.filter(a => !sbApptIds.has(a.id));
  console.log(`Missing in Supabase (<= 2026-07-31): ${missingInSb.length}`);
  if (missingInSb.length > 0) {
    console.log("Sample missing:", missingInSb.slice(0, 5));
  }

  // Check procedures comparison
  const sbProcIds = new Set(sbProcs.map(p => p.id));
  const missingProcsInSb = fbProcs.filter(p => !sbProcIds.has(p.id));
  console.log(`\nMissing Procs in Supabase: ${missingProcsInSb.length}`);

  // Check if any appts in Supabase have invalid procedureId or staffId
  const validSbProcIds = new Set(sbProcs.map(p => p.id));
  const validSbStaffIds = new Set(sbStaff.map(s => s.id));
  const invalidProcAppts = sbAppts.filter(a => a.procedureId && !validSbProcIds.has(a.procedureId));
  const invalidStaffAppts = sbAppts.filter(a => a.staffId && !validSbStaffIds.has(a.staffId));
  console.log(`\nAppts with invalid procedureId in Supabase: ${invalidProcAppts.length}`);
  if (invalidProcAppts.length > 0) {
    console.log("Sample invalid proc appts:", invalidProcAppts.slice(0, 10));
  }
  console.log(`Appts with invalid staffId in Supabase: ${invalidStaffAppts.length}`);
  if (invalidStaffAppts.length > 0) {
    console.log("Sample invalid staff appts:", invalidStaffAppts.slice(0, 10));
  }
}

inspectData().catch(console.error);
