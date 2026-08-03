import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, getDocs, collection } from "firebase/firestore";
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

async function syncAllStaffCapabilities() {
  console.log("Signing in anonymously to Firebase...");
  await signInAnonymously(auth);

  console.log("Fetching all procedures from Supabase...");
  const { data: procRows, error: procErr } = await supabase.from('procedures').select('*');
  if (procErr || !procRows) {
    console.error("Error fetching procedures:", procErr);
    return;
  }
  const procedures = procRows.map(r => r.data || r);

  console.log("Fetching all staff from Supabase...");
  const { data: staffRows, error: staffErr } = await supabase.from('staff').select('*');
  if (staffErr || !staffRows) {
    console.error("Error fetching staff:", staffErr);
    return;
  }
  const staffList = staffRows.map(r => r.data || r);

  // Map procedures by deptId
  const procsByDept: Record<string, string[]> = {};
  procedures.forEach(p => {
    if (!procsByDept[p.deptId]) procsByDept[p.deptId] = [];
    procsByDept[p.deptId].push(p.id);
  });

  console.log("Procedures per department:", procsByDept);

  console.log("\nUpdating staff capabilities...");
  for (const staff of staffList) {
    const deptProcIds = procsByDept[staff.deptId] || [];
    
    // Combine existing capability IDs with all procedure IDs in their department
    const existingMain = staff.mainCapabilityIds || [];
    const existingAsst = staff.assistantCapabilityIds || [];
    const existingCap = staff.capabilityIds || [];

    const updatedMainSet = new Set([...existingMain, ...deptProcIds]);
    const updatedAsstSet = new Set([...existingAsst, ...deptProcIds]);
    const updatedCapSet = new Set([...existingCap, ...deptProcIds]);

    const updatedStaff = {
      ...staff,
      mainCapabilityIds: Array.from(updatedMainSet),
      assistantCapabilityIds: Array.from(updatedAsstSet),
      capabilityIds: Array.from(updatedCapSet),
    };

    console.log(`- Updating ${staff.name} (${staff.id}) in ${staff.deptId}: ${updatedStaff.mainCapabilityIds.length} capabilities`);

    // Save to Firestore
    try {
      await setDoc(doc(db, "staff", staff.id), updatedStaff, { merge: true });
    } catch (e: any) {
      console.warn(`  Firestore error for ${staff.id}:`, e.message);
    }

    // Save to Supabase
    const cleanData = JSON.parse(JSON.stringify(updatedStaff));
    const { error: sbUpdateErr } = await supabase
      .from('staff')
      .upsert({ id: staff.id, data: cleanData }, { onConflict: 'id' });

    if (sbUpdateErr) {
      console.warn(`  Supabase error for ${staff.id}:`, sbUpdateErr.message);
    }
  }

  console.log("\n✅ All staff capabilities updated successfully!");
}

syncAllStaffCapabilities().catch(err => console.error(err));
