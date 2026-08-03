import { fetchSupabaseTable } from "../utils/supabaseService";
import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function checkFirebaseVsSupabaseAppts() {
  await signInAnonymously(auth);

  const sbAppts = await fetchSupabaseTable<any>('appointments') || [];
  console.log(`Supabase total appointments: ${sbAppts.length}`);

  const fbSnap = await getDocs(collection(db, "appointments"));
  const fbAppts = fbSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  console.log(`Firebase total appointments: ${fbAppts.length}`);

  // How many appts in Firebase start with appt_1785?
  const fb1785 = fbAppts.filter(a => a.id.startsWith('appt_1785') || a.id.startsWith('appt_copy_1785'));
  console.log(`Firebase appt_1785 count: ${fb1785.length}`);

  // How many appts in Supabase on 2026-07-31 are NOT appt_1785 vs appt_1785?
  const sbJul31 = sbAppts.filter(a => a.date === '2026-07-31');
  const sbJul31_real = sbJul31.filter(a => !a.id.startsWith('appt_1785'));
  const sbJul31_fake = sbJul31.filter(a => a.id.startsWith('appt_1785'));
  console.log(`\nJuly 31 in Supabase: Total ${sbJul31.length} | Real (non-1785): ${sbJul31_real.length} | Fake/Generated (1785): ${sbJul31_fake.length}`);

  // Check July 30 in Supabase
  const sbJul30 = sbAppts.filter(a => a.date === '2026-07-30');
  const sbJul30_real = sbJul30.filter(a => !a.id.startsWith('appt_1785'));
  const sbJul30_fake = sbJul30.filter(a => a.id.startsWith('appt_1785'));
  console.log(`July 30 in Supabase: Total ${sbJul30.length} | Real (non-1785): ${sbJul30_real.length} | Fake/Generated (1785): ${sbJul30_fake.length}`);

  // Check July 29 in Supabase
  const sbJul29 = sbAppts.filter(a => a.date === '2026-07-29');
  const sbJul29_real = sbJul29.filter(a => !a.id.startsWith('appt_1785'));
  const sbJul29_fake = sbJul29.filter(a => a.id.startsWith('appt_1785'));
  console.log(`July 29 in Supabase: Total ${sbJul29.length} | Real (non-1785): ${sbJul29_real.length} | Fake/Generated (1785): ${sbJul29_fake.length}`);

  // Check July 28 in Supabase
  const sbJul28 = sbAppts.filter(a => a.date === '2026-07-28');
  const sbJul28_real = sbJul28.filter(a => !a.id.startsWith('appt_1785'));
  const sbJul28_fake = sbJul28.filter(a => a.id.startsWith('appt_1785'));
  console.log(`July 28 in Supabase: Total ${sbJul28.length} | Real (non-1785): ${sbJul28_real.length} | Fake/Generated (1785): ${sbJul28_fake.length}`);

  // Check July 27 in Supabase
  const sbJul27 = sbAppts.filter(a => a.date === '2026-07-27');
  const sbJul27_real = sbJul27.filter(a => !a.id.startsWith('appt_1785'));
  const sbJul27_fake = sbJul27.filter(a => a.id.startsWith('appt_1785'));
  console.log(`July 27 in Supabase: Total ${sbJul27.length} | Real (non-1785): ${sbJul27_real.length} | Fake/Generated (1785): ${sbJul27_fake.length}`);
}

checkFirebaseVsSupabaseAppts().catch(console.error);
