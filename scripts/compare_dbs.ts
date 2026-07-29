import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function compareDatabases() {
  await signInAnonymously(auth);
  
  const tables = ['patients', 'appointments', 'staff', 'procedures', 'attendance', 'machine_shifts', 'templates', 'users'];
  const fbCollections = ['patients', 'appointments', 'staff', 'procedures', 'attendance', 'machineShifts', 'templates', 'users'];
  
  console.log("================= DATABASE COMPARISON =================");
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const col = fbCollections[i];
    
    // Fetch Firestore
    let fsCount = 0;
    try {
      const fsSnap = await getDocs(collection(db, col));
      fsCount = fsSnap.size;
    } catch (e: any) {
      console.warn(`Firestore collection "${col}" error:`, e.message);
    }
    
    // Fetch Supabase
    let sbCount = 0;
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      sbCount = data?.length || 0;
    } catch (e: any) {
      console.warn(`Supabase table "${table}" error:`, e.message);
    }
    
    console.log(`Table/Collection: ${table.padEnd(15)} | Firestore: ${fsCount.toString().padEnd(5)} | Supabase: ${sbCount}`);
  }
}

compareDatabases().then(() => process.exit(0)).catch(err => console.error(err));
