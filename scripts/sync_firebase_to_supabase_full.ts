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

async function syncAll() {
  console.log("Signing in anonymously to Firebase...");
  await signInAnonymously(auth);

  const collectionsToSync = [
    { fbName: "procedures", sbTable: "procedures" },
    { fbName: "staff", sbTable: "staff" },
    { fbName: "patients", sbTable: "patients" },
    { fbName: "appointments", sbTable: "appointments" },
    { fbName: "attendance", sbTable: "attendance" },
    { fbName: "templates", sbTable: "templates" },
    { fbName: "machineShifts", sbTable: "machine_shifts" },
    { fbName: "users", sbTable: "users" },
  ];

  for (const { fbName, sbTable } of collectionsToSync) {
    console.log(`\n=== Checking collection: ${fbName} -> ${sbTable} ===`);
    const fbSnap = await getDocs(collection(db, fbName));
    const fbDocs = fbSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    const { data: sbRows, error: sbErr } = await supabase.from(sbTable).select('*');
    if (sbErr) {
      console.error(`Error fetching ${sbTable} from Supabase:`, sbErr);
      continue;
    }
    const sbDocsMap = new Map((sbRows || []).map(r => [r.id, r.data || r]));

    console.log(`Firebase count: ${fbDocs.length}, Supabase count: ${sbRows?.length || 0}`);

    const toUpsert: any[] = [];
    for (const fbItem of fbDocs) {
      const sbItem = sbDocsMap.get(fbItem.id);
      // Clean undefined values
      const cleanFbItem = JSON.parse(JSON.stringify(fbItem, (k, v) => v === undefined ? null : v));
      
      if (!sbItem) {
        console.log(`[Missing in SB] ${fbName}/${fbItem.id}: ${fbItem.name || fbItem.date || fbItem.patientName || ''}`);
        toUpsert.push({ id: fbItem.id, data: cleanFbItem });
      } else {
        // Compare stringified versions to detect differences
        const fbJson = JSON.stringify(cleanFbItem);
        const sbJson = JSON.stringify(sbItem);
        if (fbJson !== sbJson) {
          // If FB has procedure or appointment details that differ from SB, log
          // Check if FB has better/original data
          toUpsert.push({ id: fbItem.id, data: cleanFbItem });
        }
      }
    }

    if (toUpsert.length > 0) {
      console.log(`Upserting ${toUpsert.length} items to Supabase table ${sbTable}...`);
      // Batch upsert in chunks of 50
      for (let i = 0; i < toUpsert.length; i += 50) {
        const chunk = toUpsert.slice(i, i + 50);
        const { error: upsertErr } = await supabase.from(sbTable).upsert(chunk);
        if (upsertErr) {
          console.error(`Error upserting to ${sbTable}:`, upsertErr);
        } else {
          console.log(`Successfully upserted chunk ${i / 50 + 1} (${chunk.length} rows) to ${sbTable}`);
        }
      }
    } else {
      console.log(`All ${fbDocs.length} items in ${fbName} match Supabase ${sbTable}.`);
    }
  }

  // Double check procedures in Supabase now
  const { data: finalProcs } = await supabase.from('procedures').select('*');
  const procIds = (finalProcs || []).map(r => (r.data || r).id);
  console.log(`\nFinal Supabase procedures count: ${procIds.length}`);
  console.log("Procedure IDs:", procIds);

  process.exit(0);
}

syncAll().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
