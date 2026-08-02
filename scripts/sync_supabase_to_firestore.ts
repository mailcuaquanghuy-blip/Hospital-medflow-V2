import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, deleteDoc, collection, getDocs, writeBatch } from "firebase/firestore";
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

async function runSync() {
  console.log("Signing in to Firebase...");
  await signInAnonymously(auth);
  console.log("Authenticated with Firebase.");

  const tablesToSync = [
    { sb: "patients", fs: "patients" },
    { sb: "staff", fs: "staff" },
    { sb: "procedures", fs: "procedures" },
    { sb: "attendance", fs: "attendance" },
    { sb: "machine_shifts", fs: "machineShifts" },
    { sb: "templates", fs: "templates" },
    { sb: "users", fs: "users" },
    { sb: "appointments", fs: "appointments" }
  ];

  for (const mapping of tablesToSync) {
    console.log(`\n--- Syncing ${mapping.sb} to Firestore collection ${mapping.fs} ---`);
    
    // 1. Fetch from Supabase with pagination
    let allRows: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase.from(mapping.sb).select("*").range(from, from + step - 1);
      if (error) {
        console.error(`Supabase fetch error for table ${mapping.sb}:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < step) break;
      from += step;
    }

    console.log(`Fetched ${allRows.length} items from Supabase table '${mapping.sb}'`);
    if (allRows.length === 0) continue;

    // 2. Clear existing items in Firestore for this collection to avoid stale/deleted rows
    console.log(`Clearing existing documents in Firestore collection '${mapping.fs}'...`);
    const fsSnap = await getDocs(collection(db, mapping.fs));
    console.log(`Found ${fsSnap.size} existing documents to clear.`);
    
    // Clear in batches of 200
    let clearCount = 0;
    let batch = writeBatch(db);
    for (const docSnap of fsSnap.docs) {
      batch.delete(docSnap.ref);
      clearCount++;
      if (clearCount % 200 === 0) {
        await batch.commit();
        batch = writeBatch(db);
        console.log(`Cleared ${clearCount}/${fsSnap.size} documents...`);
      }
    }
    if (clearCount % 200 !== 0) {
      await batch.commit();
    }
    console.log(`Completed clearing Firestore collection '${mapping.fs}'`);

    // 3. Insert items to Firestore in batches of 200
    console.log(`Writing ${allRows.length} documents into Firestore collection '${mapping.fs}'...`);
    let writeCount = 0;
    batch = writeBatch(db);
    for (const row of allRows) {
      const docId = row.id;
      const data = row.data || row;
      
      // Remove any unwanted wrapper field if it exists to clean data
      const docRef = doc(db, mapping.fs, docId);
      
      // Standardize data representation
      const cleanData = JSON.parse(JSON.stringify(data, (key, value) => value === undefined ? null : value));
      if (cleanData.id === undefined) {
        cleanData.id = docId;
      }

      batch.set(docRef, cleanData);
      writeCount++;

      if (writeCount % 200 === 0) {
        await batch.commit();
        batch = writeBatch(db);
        console.log(`Written ${writeCount}/${allRows.length} documents...`);
      }
    }
    if (writeCount % 200 !== 0) {
      await batch.commit();
    }
    console.log(`Successfully restored and synchronized '${mapping.fs}' with ${writeCount} documents!`);
  }

  console.log("\n🎉 ALL DATABASE COLLECTIONS HAVE BEEN FULLY RESTORED AND SYNCHRONIZED IN FIRESTORE!");
}

runSync()
  .then(() => {
    console.log("Sync finished successfully.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Sync failed with error:", err);
    process.exit(1);
  });
