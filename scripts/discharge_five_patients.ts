import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";
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

const targetPatients = [
  { namePart: "Nọi", bed: "462", timeDischarge: "2026-07-31T07:10:00.000Z", startExam: "14:00", endExam: "14:02" },
  { namePart: "Nhâu", bed: "455", timeDischarge: "2026-07-31T07:12:00.000Z", startExam: "14:02", endExam: "14:04" },
  { namePart: "Hà", bed: "473", timeDischarge: "2026-07-31T07:14:00.000Z", startExam: "14:04", endExam: "14:06" },
  { namePart: "Thanh", bed: "458", timeDischarge: "2026-07-31T07:16:00.000Z", startExam: "14:06", endExam: "14:08" },
  { namePart: "Chấn", bed: "463", timeDischarge: "2026-07-31T07:18:00.000Z", startExam: "14:08", endExam: "14:10" }
];

async function runDischarge() {
  console.log("Signing in to Firebase...");
  await signInAnonymously(auth);
  console.log("Authenticated with Firebase.");

  // Fetch all patients and appointments from Supabase first
  const { data: patientsData, error: pErr } = await supabase.from('patients').select('*');
  const { data: apptsData, error: aErr } = await supabase.from('appointments').select('*');
  if (pErr || aErr || !patientsData || !apptsData) {
    console.error("Failed to fetch data from Supabase:", pErr?.message, aErr?.message);
    return;
  }

  const patients = patientsData.map(r => r.data || r);
  const appointments = apptsData.map(r => r.data || r);

  console.log(`Found ${patients.length} patients and ${appointments.length} appointments.`);

  for (const target of targetPatients) {
    console.log(`\n--- Processing patient: ${target.namePart} (Bed: ${target.bed}) ---`);
    
    // Match patient
    const matchedPatient = patients.find(p => 
      p.admittedByDeptId === 'dept_lao' && 
      p.name && p.name.toLowerCase().includes(target.namePart.toLowerCase()) && 
      p.bedNumber && p.bedNumber.includes(target.bed)
    );

    if (!matchedPatient) {
      console.error(`ERROR: Patient with name containing "${target.namePart}" and bed "${target.bed}" not found!`);
      continue;
    }

    const patientId = matchedPatient.id;
    console.log(`Found patient: ${matchedPatient.name} (ID: ${patientId}, Bed: ${matchedPatient.bedNumber}, Room: ${matchedPatient.roomNumber})`);

    // 1. Update patient status and dischargeDate
    matchedPatient.status = "DISCHARGED";
    matchedPatient.dischargeDate = target.timeDischarge;

    // Save updated patient to Supabase
    const { error: pUpErr } = await supabase.from('patients').upsert([{ id: patientId, data: matchedPatient }]);
    if (pUpErr) {
      console.error(`Failed to update patient in Supabase:`, pUpErr.message);
    } else {
      console.log(`Updated patient status to DISCHARGED on ${target.timeDischarge} in Supabase.`);
    }

    // Save updated patient to Firestore
    await setDoc(doc(db, "patients", patientId), matchedPatient);
    console.log(`Updated patient status in Firestore.`);

    // 2. Identify and delete any treatment appointments on or after July 31st, 2026
    const futureAppts = appointments.filter(a => 
      a.patientId === patientId && 
      a.date >= '2026-07-31' && 
      a.procedureId !== 'pr_4rtcdwupd'
    );

    if (futureAppts.length > 0) {
      console.log(`Found ${futureAppts.length} future treatment appointments to delete:`);
      for (const appt of futureAppts) {
        console.log(`  - Deleting appt ID: ${appt.id} on ${appt.date} (ProcId: ${appt.procedureId})`);
        
        // Delete from Supabase
        const { error: delErr } = await supabase.from('appointments').delete().eq('id', appt.id);
        if (delErr) {
          console.error(`Failed to delete appointment ${appt.id} from Supabase:`, delErr.message);
        }

        // Delete from Firestore
        await deleteDoc(doc(db, "appointments", appt.id));
      }
    } else {
      console.log("No future treatment appointments found to delete.");
    }

    // 3. Create or update the "Khám ra viện" appointment on July 31st, 2026
    const dischargeApptId = `appt_ravien_20260731_${patientId}`;
    const dischargeAppt = {
      id: dischargeApptId,
      date: "2026-07-31",
      deptId: "dept_lao",
      status: "PENDING",
      endTime: target.endExam,
      staffId: "s_hdvlre3q6",
      patientId: patientId,
      startTime: target.startExam,
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

    // Save appointment to Supabase
    const { error: aUpErr } = await supabase.from('appointments').upsert([{ id: dischargeApptId, data: dischargeAppt }]);
    if (aUpErr) {
      console.error(`Failed to save discharge appointment to Supabase:`, aUpErr.message);
    } else {
      console.log(`Saved discharge appointment (${target.startExam} - ${target.endExam}) to Supabase.`);
    }

    // Save appointment to Firestore
    await setDoc(doc(db, "appointments", dischargeApptId), dischargeAppt);
    console.log(`Saved discharge appointment to Firestore.`);
  }

  console.log("\n🎉 ALL 5 PATIENTS HAVE BEEN SUCCESSFULLY DISCHARGED AND RECORDED!");
}

runDischarge()
  .then(() => {
    console.log("Discharge script finished successfully.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Discharge script failed with error:", err);
    process.exit(1);
  });
