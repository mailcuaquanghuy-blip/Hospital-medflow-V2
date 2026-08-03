import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";
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

async function fixJuly31Appointments() {
  await signInAnonymously(auth);

  // 1. Fetch Firebase appointments for 2026-07-31
  const fbSnap = await getDocs(collection(db, "appointments"));
  const fbAppts = fbSnap.docs.map(d => ({ ...d.data(), id: d.id })) as any[];
  const fbJul31Appts = fbAppts.filter(a => a.date === '2026-07-31');

  console.log(`Found ${fbJul31Appts.length} appointments on 2026-07-31 in Firebase.`);

  // 2. Fetch current Supabase appointments
  const { data: sbApptsRows } = await supabase.from('appointments').select('*');
  const sbAppts = (sbApptsRows || []).map(r => r.data || r);
  console.log(`Current total appointments in Supabase: ${sbAppts.length}`);

  // 3. Identify the 13 unassigned patients on 2026-07-31
  const missing13Ids = [
    'p_3sp7itc72', 'p_6xs1rfucd', 'p_ixicgg0bz', 'p_gaa5cc6cl', 'p_n5zhiwilh', 
    'p_89ivgc7fs', 'p_ku2puhs82', 'p_nid3tu4j7', 'p_imxinw6h7', 'p_skt4b97cj', 
    'p_pe3bleljj', 'p_v6alkyjjt', 'p_wqyk3vq8e'
  ];

  // Get all Firebase July 31 appointments for these 13 patients
  const restored13Appts = fbJul31Appts.filter(a => missing13Ids.includes(a.patientId));
  console.log(`Found ${restored13Appts.length} Firebase appointments on 2026-07-31 for the 13 patients.`);

  // Upsert these 13 patients' appointments into Supabase
  const rowsToUpsert = restored13Appts.map(item => ({ id: item.id, data: item }));
  if (rowsToUpsert.length > 0) {
    const { error } = await supabase.from('appointments').upsert(rowsToUpsert);
    if (error) {
      console.error("Error upserting 13 patients appts to Supabase:", error.message);
    } else {
      console.log(`Successfully restored ${rowsToUpsert.length} appointments for the 13 patients in Supabase!`);
    }
  }

  // 4. Handle the 5 patients discharged on 2026-07-31
  // Add morning treatment procedures for them
  const dis5 = [
    {
      patientId: 'p_88ipn1c3r', name: 'Điêu Thị Hà', bed: '473',
      morningProcs: [
        { procId: 'pr_yosjw3y2w', start: '08:30', end: '08:55', staffId: 's_hdvlre3q6', asst1Id: 's_1xca9gdv3' },
        { procId: 'pr_eqnn4i152', start: '09:00', end: '09:25', staffId: 's_j70mhmvcl', asst1Id: 's_tppw9td1m' },
        { procId: 'pr_rj91ghjep', start: '09:30', end: '10:00', staffId: 's_c025m4y4p', asst1Id: null }
      ]
    },
    {
      patientId: 'p_f3gqhd716', name: 'Lò Minh Chấn', bed: '463',
      morningProcs: [
        { procId: 'pr_yosjw3y2w', start: '08:35', end: '09:00', staffId: 's_1yclzxcef', asst1Id: 's_1xca9gdv3' },
        { procId: 'pr_eqnn4i152', start: '09:05', end: '09:30', staffId: 's_j70mhmvcl', asst1Id: 's_tppw9td1m' },
        { procId: 'pr_rj91ghjep', start: '09:35', end: '10:05', staffId: 's_c025m4y4p', asst1Id: null }
      ]
    },
    {
      patientId: 'p_70ijcn68t', name: 'Quàng Thị Thanh', bed: '458',
      morningProcs: [
        { procId: 'pr_yosjw3y2w', start: '08:40', end: '09:05', staffId: 's_hdvlre3q6', asst1Id: 's_1xca9gdv3' },
        { procId: 'pr_eqnn4i152', start: '09:10', end: '09:35', staffId: 's_j70mhmvcl', asst1Id: 's_hpvg4qt7q' },
        { procId: 'pr_rj91ghjep', start: '09:40', end: '10:10', staffId: 's_c025m4y4p', asst1Id: null }
      ]
    },
    {
      patientId: 'p_7jtdfrcid', name: 'Lò Thị Nhâu', bed: '455',
      morningProcs: [
        { procId: 'pr_yosjw3y2w', start: '08:45', end: '09:10', staffId: 's_1yclzxcef', asst1Id: 's_1xca9gdv3' },
        { procId: 'pr_eqnn4i152', start: '09:15', end: '09:40', staffId: 's_j70mhmvcl', asst1Id: 's_hpvg4qt7q' },
        { procId: 'pr_rj91ghjep', start: '09:45', end: '10:15', staffId: 's_c025m4y4p', asst1Id: null }
      ]
    },
    {
      patientId: 'p_o5iknqk86', name: 'Lò Văn Nọi', bed: '462',
      morningProcs: [
        { procId: 'pr_yosjw3y2w', start: '08:50', end: '09:15', staffId: 's_hdvlre3q6', asst1Id: 's_1xca9gdv3' },
        { procId: 'pr_eqnn4i152', start: '09:20', end: '09:45', staffId: 's_j70mhmvcl', asst1Id: 's_tppw9td1m' },
        { procId: 'pr_rj91ghjep', start: '09:50', end: '10:20', staffId: 's_lbf6qsiya', asst1Id: null }
      ]
    }
  ];

  const newMorningAppts: any[] = [];
  for (const p of dis5) {
    p.morningProcs.forEach((mp, index) => {
      const apptId = `appt_jul31_am_${p.patientId}_${index + 1}`;
      const apptObj = {
        id: apptId,
        patientId: p.patientId,
        procedureId: mp.procId,
        date: '2026-07-31',
        startTime: mp.start,
        endTime: mp.end,
        deptId: 'dept_lao',
        staffId: mp.staffId,
        assistant1Id: mp.asst1Id,
        assistant2Id: null,
        status: 'PENDING',
        conflictDetails: []
      };
      newMorningAppts.push(apptObj);
    });
  }

  console.log(`Created ${newMorningAppts.length} morning procedure appointments for 5 discharged patients.`);

  // Save morning appointments to Firebase
  for (const appt of newMorningAppts) {
    await setDoc(doc(db, "appointments", appt.id), appt);
  }
  console.log("Saved morning appointments to Firebase.");

  // Save morning appointments to Supabase
  const morningRows = newMorningAppts.map(item => ({ id: item.id, data: item }));
  const { error: morningErr } = await supabase.from('appointments').upsert(morningRows);
  if (morningErr) {
    console.error("Error upserting morning appts to Supabase:", morningErr.message);
  } else {
    console.log("Successfully saved morning appointments to Supabase!");
  }

  console.log("\nFix completed successfully!");
}

fixJuly31Appointments().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
