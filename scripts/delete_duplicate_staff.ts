import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, deleteDoc, getDoc } from "firebase/firestore";
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

const duplicateStaffIds = [
  "s_lao_101",
  "s_lao_102",
  "s_lao_103",
  "s_lao_104",
  "s_lao_105",
  "s_lao_106",
  "s_lao_107",
  "s_lao_108",
  "s_lao_109"
];

async function runCleanup() {
  console.log("Signing in to Firebase...");
  await signInAnonymously(auth);
  console.log("Authenticated with Firebase.");

  console.log("\nDeleting duplicate staff members from Firestore and Supabase...");
  for (const id of duplicateStaffIds) {
    console.log(`- Deleting staff ID: ${id}`);
    
    // 1. Delete from Firestore
    try {
      await deleteDoc(doc(db, "staff", id));
      console.log(`  Deleted from Firestore.`);
    } catch (e: any) {
      console.error(`  Failed to delete from Firestore:`, e.message);
    }

    // 2. Delete from Supabase
    const { error: sbDelErr } = await supabase.from('staff').delete().eq('id', id);
    if (sbDelErr) {
      console.error(`  Failed to delete from Supabase:`, sbDelErr.message);
    } else {
      console.log(`  Deleted from Supabase.`);
    }
  }

  console.log("\n=== Verification: Listing remaining staff members ===");
  const { data: staffRows, error: sbError } = await supabase.from('staff').select('*');
  if (sbError || !staffRows) {
    console.error("Failed to fetch remaining staff from Supabase:", sbError?.message);
    return;
  }
  const staff = staffRows.map(r => r.data || r);
  console.log(`Total remaining staff: ${staff.length}`);
  staff.forEach(s => {
    console.log(`- ID: ${s.id} | Name: ${s.name} | Role: ${s.role} | DeptId: ${s.deptId}`);
  });

  console.log("\n🎉 CLEANUP COMPLETED SUCCESSFULLY!");
}

runCleanup()
  .then(() => {
    console.log("Cleanup script finished.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Cleanup script failed:", err);
    process.exit(1);
  });
