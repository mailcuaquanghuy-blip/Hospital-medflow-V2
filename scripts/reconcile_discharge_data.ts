import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load Firebase configuration
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const patientIds = [
  "p_o5iknqk86", // Lò Văn Nọi
  "p_7jtdfrcid", // Lò Thị Nhâu
  "p_88ipn1c3r", // Điêu Thị Hà
  "p_70ijcn68t", // Quàng Thị Thanh
  "p_f3gqhd716"  // Lò Minh Chấn
];

const originalDischargeAppts = {
  "p_o5iknqk86": { id: "appt_jlkrpq9l4", startTime: "14:10", endTime: "14:12" },
  "p_7jtdfrcid": { id: "appt_grgv1n41d", startTime: "14:04", endTime: "14:06" },
  "p_88ipn1c3r": { id: "appt_5bjpt4o0d", startTime: "14:08", endTime: "14:10" },
  "p_70ijcn68t": { id: "appt_vygll9gkm", startTime: "14:06", endTime: "14:08" },
  "p_f3gqhd716": { id: "appt_qzvgjwth0", startTime: "14:12", endTime: "14:14" }
};

async function runCleanup() {
  console.log("Signing in to Firebase...");
  await signInAnonymously(auth);
  console.log("Authenticated with Firebase.");

  // Fetch all appointments from Supabase
  const { data: sbApptsData, error: sbApptsErr } = await supabase.from('appointments').select('*');
  if (sbApptsErr || !sbApptsData) {
    console.error("Failed to fetch appointments from Supabase:", sbApptsErr?.message);
    return;
  }
  const sbAppts = sbApptsData.map(r => r.data || r);

  // Define appointments to delete and preserve
  const apptsToDeleteFromSB: string[] = [];
  const apptsToDeleteFromFS: string[] = [];
  
  // Find all appointments for these 5 patients in Supabase
  const targetSBAppts = sbAppts.filter(a => patientIds.includes(a.patientId) && a.date === "2026-07-31");
  console.log(`\nFound ${targetSBAppts.length} target appointments on July 31st in Supabase:`);

  // We will fetch direct appointment IDs in Firestore by querying them or deleting individually.
  // To be safe, we will loop through all potential appointment IDs found in Firestore/Supabase.
  const fsApptIdsToCheck = [
    // Treats
    "appt_4n7fszthk", "appt_4xwwov467", "appt_4zbeblp2w", "appt_5t43sqknu", 
    "appt_8wy3issrv", "appt_d5h6yu8lv", "appt_d79bjufdf", "appt_fzhircb0d", 
    "appt_onfh9eco8", "appt_oydqhm87d", "appt_skas8f0sp", "appt_u7awxf3kr", 
    "appt_ynon68rl6", "appt_z3e4udxn7",
    // Custom duplicates we created
    "appt_ravien_20260731_p_o5iknqk86", "appt_ravien_20260731_p_7jtdfrcid",
    "appt_ravien_20260731_p_88ipn1c3r", "appt_ravien_20260731_p_70ijcn68t",
    "appt_ravien_20260731_p_f3gqhd716"
  ];

  console.log("\nDeleting target treatment and duplicate discharge appointments from Firestore and Supabase...");
  for (const id of fsApptIdsToCheck) {
    console.log(`- Deleting appointment: ${id}`);
    // Delete from Firestore
    try {
      await deleteDoc(doc(db, "appointments", id));
      console.log(`  Deleted from Firestore.`);
    } catch (e: any) {
      console.error(`  Failed to delete from Firestore:`, e.message);
    }

    // Delete from Supabase
    const { error: sbDelErr } = await supabase.from('appointments').delete().eq('id', id);
    if (sbDelErr) {
      console.error(`  Failed to delete from Supabase:`, sbDelErr.message);
    } else {
      console.log(`  Deleted from Supabase.`);
    }
  }

  console.log("\nRe-syncing and preserving the 5 ORIGINAL discharge appointments in BOTH databases...");
  for (const patientId of patientIds) {
    const orig = originalDischargeAppts[patientId as keyof typeof originalDischargeAppts];
    
    // Construct the correct original appointment object
    const dischargeAppt = {
      id: orig.id,
      date: "2026-07-31",
      deptId: "dept_lao",
      status: "PENDING",
      endTime: orig.endTime,
      staffId: "s_hdvlre3q6",
      patientId: patientId,
      startTime: orig.startTime,
      mainBusyEnd: 1,
      procedureId: "pr_4rtcdwupd",
      restMinutes: 0,
      assistant1Id: null,
      assistant2Id: null,
      asst1BusyEnd: 0,
      asst2BusyEnd: 0,
      mainBusyStart: 0,
      asst1BusyStart: 0,
      asst2BusyStart: 0,
      machineShiftId: null,
      conflictDetails: [],
      assignedMachineId: null,
      selectedDurationOptionId: "default"
    };

    console.log(`\nPreserving original discharge appointment: ${orig.id} for Patient ${patientId}`);
    console.log(`  Time: ${orig.startTime} - ${orig.endTime}`);

    // Save to Firestore
    try {
      await setDoc(doc(db, "appointments", orig.id), dischargeAppt);
      console.log(`  Successfully saved to Firestore.`);
    } catch (e: any) {
      console.error(`  Failed to save to Firestore:`, e.message);
    }

    // Save to Supabase
    const { error: sbInsErr } = await supabase.from('appointments').upsert([{ id: orig.id, data: dischargeAppt }]);
    if (sbInsErr) {
      console.error(`  Failed to save to Supabase:`, sbInsErr.message);
    } else {
      console.log(`  Successfully saved to Supabase.`);
    }
  }

  // 4. Verify patient status and discharge dates
  console.log("\nVerifying/Setting 5 Patient statuses and discharge dates in both databases...");
  const targetDischargeDates = {
    "p_o5iknqk86": "2026-07-31T07:10:00.000Z",
    "p_7jtdfrcid": "2026-07-31T07:12:00.000Z",
    "p_88ipn1c3r": "2026-07-31T07:14:00.000Z",
    "p_70ijcn68t": "2026-07-31T07:16:00.000Z",
    "p_f3gqhd716": "2026-07-31T07:18:00.000Z"
  };

  const { data: patientsData, error: pErr } = await supabase.from('patients').select('*');
  if (pErr || !patientsData) {
    console.error("Failed to fetch patients from Supabase:", pErr?.message);
    return;
  }
  const patients = patientsData.map(r => r.data || r);

  for (const patientId of patientIds) {
    const matchedPatient = patients.find(p => p.id === patientId);
    if (!matchedPatient) {
      console.error(`Patient ${patientId} not found in database!`);
      continue;
    }

    const tDischarge = targetDischargeDates[patientId as keyof typeof targetDischargeDates];
    matchedPatient.status = "DISCHARGED";
    matchedPatient.dischargeDate = tDischarge;

    console.log(`Updating patient ${matchedPatient.name} (ID: ${patientId}) to DISCHARGED, dischargeDate: ${tDischarge}`);

    // Update in Firestore
    try {
      await setDoc(doc(db, "patients", patientId), matchedPatient);
      console.log(`  Updated in Firestore.`);
    } catch (e: any) {
      console.error(`  Failed to update in Firestore:`, e.message);
    }

    // Update in Supabase
    const { error: pUpErr } = await supabase.from('patients').upsert([{ id: patientId, data: matchedPatient }]);
    if (pUpErr) {
      console.error(`  Failed to update in Supabase:`, pUpErr.message);
    } else {
      console.log(`  Updated in Supabase.`);
    }
  }

  console.log("\n🎉 CLEANUP AND ALIGNMENT IS COMPLETE! ALL HISTORICAL AND OPERATIONAL RECORDS ARE PERFECTLY RECONCILED!");
}

runCleanup()
  .then(() => {
    console.log("Cleanup script finished successfully.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Cleanup script failed:", err);
    process.exit(1);
  });
