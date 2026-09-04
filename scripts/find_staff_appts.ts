import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function findStaffAppts() {
  await signInAnonymously(auth);

  const LAN_ID = "s_hdvlre3q6"; // Vũ Thị Hương Lan
  const HUONG_ID = "s_1xca9gdv3"; // Hoàng Thu Hương
  const HUY_ID = "s_hpvg4qt7q"; // Nguyễn Quang Huy

  const apptsSnap = await getDocs(collection(db, "appointments"));
  const datesFound = new Map<string, number>();

  apptsSnap.docs.forEach(d => {
    const a = d.data();
    if (a.deptId === 'dept_lao') {
      if (a.staffId === LAN_ID || a.assistant1Id === LAN_ID || a.assistant2Id === LAN_ID ||
          a.staffId === HUONG_ID || a.assistant1Id === HUONG_ID || a.assistant2Id === HUONG_ID ||
          a.staffId === HUY_ID || a.assistant1Id === HUY_ID || a.assistant2Id === HUY_ID) {
        datesFound.set(a.date, (datesFound.get(a.date) || 0) + 1);
      }
    }
  });

  console.log("=== DATES WHERE TARGET STAFF ARE PRESENT IN KHOA LẢO ===");
  Array.from(datesFound.entries()).sort((a,b) => a[0].localeCompare(b[0])).forEach(([date, count]) => {
    console.log(`Date: ${date} -> ${count} appointments with target staff`);
  });
}

findStaffAppts().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
