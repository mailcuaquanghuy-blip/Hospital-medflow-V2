import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { createClient } from "@supabase/supabase-js";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const SUPABASE_URL = process.env.SUPABASE_URL || "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function migrate() {
  console.log("Starting migration to Supabase...");
  await signInAnonymously(auth);

  const collections = ['users', 'staff', 'procedures', 'patients', 'templates', 'attendance', 'machineShifts', 'appointments'];

  for (const colName of collections) {
    try {
      console.log(`\nFetching ${colName} from Firestore...`);
      const snap = await getDocs(collection(db, colName));
      console.log(`Found ${snap.size} documents in ${colName}.`);

      if (snap.size === 0) continue;

      const targetTable = colName === 'machineShifts' ? 'machine_shifts' : colName;
      const rows = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          data: data
        };
      });

      // Insert in chunks of 500
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from(targetTable).upsert(chunk);
        if (error) {
          console.error(`Error inserting into Supabase ${targetTable}:`, error.message);
        } else {
          console.log(`Successfully migrated ${chunk.length} items to Supabase table '${targetTable}'`);
        }
      }
    } catch (err: any) {
      console.error(`Failed to fetch ${colName} from Firestore:`, err.message || err);
    }
  }

  console.log("\nMigration completed!");
}

migrate().then(() => process.exit(0)).catch(e => {
  console.error("Migration fatal error:", e);
  process.exit(1);
});
