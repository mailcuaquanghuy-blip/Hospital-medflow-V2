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

async function restoreFromFirebase() {
  await signInAnonymously(auth);

  console.log("Fetching appointments from Firebase...");
  const snap = await getDocs(collection(db, "appointments"));
  const fbAppts = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  console.log(`Fetched ${fbAppts.length} appointments from Firebase.`);

  // Filter out any fake generated appointments starting with appt_1785 or appt_copy_1785
  const cleanAppts = fbAppts.filter(a => !a.id.startsWith('appt_1785') && !a.id.startsWith('appt_copy_1785'));
  console.log(`Clean appointments count (excluding appt_1785...): ${cleanAppts.length}`);

  // Batch insert into Supabase in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < cleanAppts.length; i += CHUNK_SIZE) {
    const chunk = cleanAppts.slice(i, i + CHUNK_SIZE);
    const rows = chunk.map(item => ({ id: item.id, data: item }));
    const { error } = await supabase.from('appointments').upsert(rows);
    if (error) {
      console.error(`Error inserting chunk ${i}-${i + CHUNK_SIZE}:`, error.message);
    } else {
      console.log(`Inserted chunk ${i}-${i + chunk.length} into Supabase.`);
    }
  }

  console.log("Supabase appointments restoration completed!");
}

restoreFromFirebase().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
