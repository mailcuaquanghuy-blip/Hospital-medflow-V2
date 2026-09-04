import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Staff } from "../types";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function verify() {
  await signInAnonymously(auth);

  const staffSnap = await getDocs(collection(db, "staff"));
  const staffMap: Record<string, string> = {};
  staffSnap.docs.forEach(d => { staffMap[d.id] = d.data().name; });

  const LAN_ID = "s_hdvlre3q6";   // Vũ Thị Hương Lan
  const TRANG_ID = "s_j70mhmvcl"; // Nguyễn Thị Huyền Trang
  const HUONG_ID = "s_1xca9gdv3"; // Hoàng Thu Hương
  const HA_ID = "s_w8k2iebit";    // Vũ Thúy Hà
  const HUY_ID = "s_hpvg4qt7q";   // Nguyễn Quang Huy
  const GIANG_ID = "s_tppw9td1m"; // Lê Hương Giang

  const q5 = query(collection(db, "appointments"), where("date", "==", "2026-09-05"), where("deptId", "==", "dept_lao"));
  const snap5 = await getDocs(q5);

  const q6 = query(collection(db, "appointments"), where("date", "==", "2026-09-06"), where("deptId", "==", "dept_lao"));
  const snap6 = await getDocs(q6);

  console.log(`=== VERIFICATION RESULTS ===`);
  console.log(`2026-09-05 appointments in Khoa Lão: ${snap5.size}`);
  console.log(`2026-09-06 appointments in Khoa Lão: ${snap6.size}`);

  let lanIn6 = 0, huongIn6 = 0, huyIn6 = 0;
  let trangIn6 = 0, haIn6 = 0, giangIn6 = 0;

  snap6.docs.forEach(d => {
    const a = d.data();
    const ids = [a.staffId, a.assistant1Id, a.assistant2Id].filter(Boolean);
    if (ids.includes(LAN_ID)) lanIn6++;
    if (ids.includes(HUONG_ID)) huongIn6++;
    if (ids.includes(HUY_ID)) huyIn6++;

    if (ids.includes(TRANG_ID)) trangIn6++;
    if (ids.includes(HA_ID)) haIn6++;
    if (ids.includes(GIANG_ID)) giangIn6++;
  });

  console.log(`\n2026-09-06 Staff Appearances:`);
  console.log(`  - Vũ Thị Hương Lan: ${lanIn6} (Expected: 0)`);
  console.log(`  - Hoàng Thu Hương: ${huongIn6} (Expected: 0)`);
  console.log(`  - Nguyễn Quang Huy: ${huyIn6} (Expected: 0)`);
  console.log(`  - Nguyễn Thị Huyền Trang: ${trangIn6}`);
  console.log(`  - Vũ Thúy Hà: ${haIn6}`);
  console.log(`  - Lê Hương Giang: ${giangIn6}`);

  if (lanIn6 === 0 && huongIn6 === 0 && huyIn6 === 0 && snap5.size === snap6.size && snap6.size > 0) {
    console.log("\n✅ ALL VERIFICATION CHECKS PASSED PERFECTLY!");
  } else {
    console.error("\n❌ VERIFICATION FAILED!");
    process.exit(1);
  }
}

verify().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
