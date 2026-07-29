import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, updateDoc, writeBatch, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function executeUpdate() {
  await signInAnonymously(auth);

  console.log("=== STEP 1: Updating Procedure Definitions in Firestore ===");
  // Update pr_eqnn4i152 (Điện châm)
  try {
    await updateDoc(doc(db, "procedures", "pr_eqnn4i152"), {
      mainBusyStart: 0,
      mainBusyEnd: 6
    });
    console.log("Updated procedures/pr_eqnn4i152 -> mainBusy: [0, 6]");
  } catch (err) {
    console.error("Error updating procedures/pr_eqnn4i152:", err);
  }

  // Update pr_yosjw3y2w (Thủy châm)
  try {
    await updateDoc(doc(db, "procedures", "pr_yosjw3y2w"), {
      mainBusyStart: 5,
      mainBusyEnd: 11
    });
    console.log("Updated procedures/pr_yosjw3y2w -> mainBusy: [5, 11]");
  } catch (err) {
    console.error("Error updating procedures/pr_yosjw3y2w:", err);
  }

  // Also check if pr_lao_diencham or pr_lao_thuycham exist in procedures
  const procsSnap = await getDocs(collection(db, "procedures"));
  for (const d of procsSnap.docs) {
    const p = d.data();
    if (p.deptId === 'dept_lao') {
      if (p.name?.includes('Điện châm')) {
        await updateDoc(doc(db, "procedures", d.id), { mainBusyStart: 0, mainBusyEnd: 6 });
        console.log(`Updated procedure ${d.id} (${p.name}) -> mainBusy: [0, 6]`);
      } else if (p.name?.includes('Thủy châm')) {
        await updateDoc(doc(db, "procedures", d.id), { mainBusyStart: 5, mainBusyEnd: 11 });
        console.log(`Updated procedure ${d.id} (${p.name}) -> mainBusy: [5, 11]`);
      }
    }
  }

  console.log("\n=== STEP 2: Identifying Target Patients ===");
  const patientsSnap = await getDocs(collection(db, "patients"));
  const targetPatientIds = new Set<string>();

  patientsSnap.docs.forEach(d => {
    const p = { id: d.id, ...d.data() } as any;
    const isLao = p.admittedByDeptId === 'dept_lao' || p.deptId === 'dept_lao';
    if (!isLao) return;

    const isTreating = p.status === 'TREATING' || !p.dischargeDate;
    const dischargedOnOrAfter29 = p.dischargeDate && p.dischargeDate >= '2026-07-29';

    if (isTreating || dischargedOnOrAfter29) {
      targetPatientIds.add(p.id);
    }
  });

  console.log(`Identified ${targetPatientIds.size} target patients in Khoa Lão.`);

  console.log("\n=== STEP 3: Updating Appointments in Firestore ===");
  const apptsSnap = await getDocs(query(
    collection(db, "appointments"),
    where("deptId", "==", "dept_lao"),
    where("date", ">=", "2026-07-29")
  ));

  let countDienChamUpdated = 0;
  let countThuyChamUpdated = 0;
  let totalUpdated = 0;

  // Perform updates in batches of 400 (Firestore batch limit is 500)
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const d of apptsSnap.docs) {
    const a = { id: d.id, ...d.data() } as any;

    if (!targetPatientIds.has(a.patientId)) {
      continue;
    }

    let updateData: any = null;

    if (a.procedureId === 'pr_eqnn4i152' || (a.procedureName && a.procedureName.includes('Điện châm'))) {
      updateData = {
        mainBusyStart: 0,
        mainBusyEnd: 6
      };
      countDienChamUpdated++;
    } else if (a.procedureId === 'pr_yosjw3y2w' || (a.procedureName && a.procedureName.includes('Thủy châm'))) {
      updateData = {
        mainBusyStart: 5,
        mainBusyEnd: 11
      };
      countThuyChamUpdated++;
    }

    if (updateData) {
      const apptRef = doc(db, "appointments", d.id);
      batch.update(apptRef, updateData);
      batchCount++;
      totalUpdated++;

      if (batchCount >= 400) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} appointment updates...`);
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchCount} appointment updates.`);
  }

  console.log(`\n=== UPDATE SUMMARY ===`);
  console.log(`Total Điện châm appointments updated: ${countDienChamUpdated}`);
  console.log(`Total Thủy châm appointments updated: ${countThuyChamUpdated}`);
  console.log(`Total appointments updated: ${totalUpdated}`);
  console.log("Update completed successfully!");
}

executeUpdate().then(() => process.exit(0)).catch(e => { console.error("Update failed:", e); process.exit(1); });
