import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function findDatesWithStaff() {
  await signInAnonymously(auth);

  const LAN_ID = "s_hdvlre3q6"; // Vũ Thị Hương Lan
  const HUONG_ID = "s_1xca9gdv3"; // Hoàng Thu Hương
  const HUY_ID = "s_hpvg4qt7q"; // Nguyễn Quang Huy

  const staffSnap = await getDocs(collection(db, "staff"));
  const staffMap: Record<string, string> = {};
  staffSnap.docs.forEach(d => { staffMap[d.id] = d.data().name; });

  const apptsSnap = await getDocs(collection(db, "appointments"));

  const datesList = ["2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09", "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"];

  for (const date of datesList) {
    const dateAppts = apptsSnap.docs.filter(d => d.data().date === date && d.data().deptId === 'dept_lao');
    if (dateAppts.length === 0) continue;

    let lanCount = 0, huongCount = 0, huyCount = 0;
    dateAppts.forEach(d => {
      const a = d.data();
      if ([a.staffId, a.assistant1Id, a.assistant2Id].includes(LAN_ID)) lanCount++;
      if ([a.staffId, a.assistant1Id, a.assistant2Id].includes(HUONG_ID)) huongCount++;
      if ([a.staffId, a.assistant1Id, a.assistant2Id].includes(HUY_ID)) huyCount++;
    });

    console.log(`Date ${date} (${dateAppts.length} appts): Lan=${lanCount}, Huong=${huongCount}, Huy=${huyCount}`);
  }
}

findDatesWithStaff().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
