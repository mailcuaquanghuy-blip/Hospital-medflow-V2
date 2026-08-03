import { createClient } from "@supabase/supabase-js";
import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, deleteDoc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";

// Load configuration
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const apptsToDelete = [
  // 5 Newly created duplicate discharge appointments
  "appt_ravien_20260731_p_o5iknqk86",
  "appt_ravien_20260731_p_7jtdfrcid",
  "appt_ravien_20260731_p_88ipn1c3r",
  "appt_ravien_20260731_p_70ijcn68t",
  "appt_ravien_20260731_p_f3gqhd716",
  // 2 Remaining treatment appointments on July 31st for discharged patients
  "appt_jul31_am_p_88ipn1c3r_1",
  "appt_jul31_am_p_o5iknqk86_3"
];

const originalDischargeApptIds = [
  // July 29 discharges
  "appt_na762x9sl",
  "appt_1hoc40quk",
  "appt_gdfzkoe01",
  "appt_rmqhog41a",
  "appt_2u1hyj6nj",
  // July 31 discharges
  "appt_jlkrpq9l4",
  "appt_grgv1n41d",
  "appt_qzvgjwth0",
  "appt_vygll9gkm",
  "appt_5bjpt4o0d"
];

async function runFinalize() {
  console.log("Signing in to Firebase...");
  await signInAnonymously(auth);
  console.log("Authenticated.");

  // 1. Delete unnecessary appointments from both Supabase and Firestore
  console.log("\n=== STEP 1: DELETING UNNECESSARY APPOINTMENTS ===");
  for (const id of apptsToDelete) {
    console.log(`Processing deletion of: ${id}`);

    // Delete from Firestore
    try {
      const docRef = doc(db, "appointments", id);
      await deleteDoc(docRef);
      console.log(`  - Deleted ${id} from Firestore.`);
    } catch (e: any) {
      console.warn(`  - Failed to delete ${id} from Firestore:`, e.message);
    }

    // Delete from Supabase
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) {
        console.warn(`  - Failed to delete ${id} from Supabase:`, error.message);
      } else {
        console.log(`  - Deleted ${id} from Supabase.`);
      }
    } catch (e: any) {
      console.warn(`  - Failed to delete ${id} from Supabase:`, e.message);
    }
  }

  // 2. Update original discharge appointments to use the correct procedureId
  console.log("\n=== STEP 2: UPDATING ORIGINAL DISCHARGE APPOINTMENTS ===");
  for (const id of originalDischargeApptIds) {
    console.log(`Updating original discharge appointment: ${id}`);

    // Update in Firestore
    try {
      const docRef = doc(db, "appointments", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        data.procedureId = "pr_fdmxn9vp6";
        data.procedureName = "Khám ra viện";
        await setDoc(docRef, data);
        console.log(`  - Updated ${id} in Firestore with correct procedureId.`);
      } else {
        console.warn(`  - Appointment ${id} does not exist in Firestore!`);
      }
    } catch (e: any) {
      console.warn(`  - Failed to update ${id} in Firestore:`, e.message);
    }

    // Update in Supabase
    try {
      const { data: rowSnap, error: fErr } = await supabase.from("appointments").select("*").eq("id", id).single();
      if (fErr || !rowSnap) {
        console.warn(`  - Appointment ${id} not found in Supabase:`, fErr?.message);
        continue;
      }

      const apptData = rowSnap.data || rowSnap;
      apptData.procedureId = "pr_fdmxn9vp6";
      apptData.procedureName = "Khám ra viện";

      const { error: uErr } = await supabase.from("appointments").upsert([{ id, data: apptData }]);
      if (uErr) {
        console.warn(`  - Failed to update ${id} in Supabase:`, uErr.message);
      } else {
        console.log(`  - Updated ${id} in Supabase with correct procedureId.`);
      }
    } catch (e: any) {
      console.warn(`  - Failed to update ${id} in Supabase:`, e.message);
    }
  }

  console.log("\n🎉 DATABASE FINALIZE COMPLETED SUCCESSFULLY!");
}

runFinalize()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error("Database finalize failed:", err);
    process.exit(1);
  });
