import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus, Staff, AttendanceRecord, AttendanceStatus, Patient, Procedure } from "../types";
import { checkConflict } from "../utils/timeUtils";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  await signInAnonymously(auth);

  const sourceDate = "2026-07-18";
  const targetDate = "2026-07-19";
  const deptId = "dept_lao";

  // IDs of interest
  const GIANG_ID = "s_tppw9td1m";  // Lê Hương Giang
  const HUONG_ID = "s_1xca9gdv3";  // Hoàng Thu Hương
  
  const LAM_ID = "s_z83w580hx";    // Nguyễn Tùng Lâm
  const LAN_ID = "s_hdvlre3q6";    // Vũ Thị Hương Lan

  console.log("Fetching database collections...");
  const patientsSnap = await getDocs(collection(db, "patients"));
  const patients = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Patient[];

  const staffSnap = await getDocs(collection(db, "staff"));
  const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Staff[];

  const proceduresSnap = await getDocs(collection(db, "procedures"));
  const procedures = proceduresSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Procedure[];

  const attendanceSnap = await getDocs(collection(db, "attendance"));
  const attendanceRecords = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];

  const allApptsSnap = await getDocs(collection(db, "appointments"));
  const allAppts = allApptsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];

  const sourceAppts = allAppts.filter(a => a.date === sourceDate && a.deptId === deptId);
  console.log(`Loaded ${sourceAppts.length} source Geriatrics appointments on ${sourceDate}.`);

  if (sourceAppts.length === 0) {
    console.error(`No appointments found on ${sourceDate} for Geriatrics. Please check source data.`);
    process.exit(1);
  }

  // Clear existing target appointments for idempotence
  const existingTargetAppts = allAppts.filter(a => a.date === targetDate && a.deptId === deptId);
  if (existingTargetAppts.length > 0) {
    console.log(`Clearing ${existingTargetAppts.length} existing Geriatrics appointments on ${targetDate}...`);
    for (const appt of existingTargetAppts) {
      await deleteDoc(doc(db, "appointments", appt.id));
    }
    console.log("Cleared existing target date appointments.");
  }

  const targetStaffToSetDuty = new Set<string>();
  const mappedAppointmentsBeforeWriting: Appointment[] = [];

  for (const appt of sourceAppts) {
    // Perform mapping replacements as requested
    // Lê Hương Giang -> Hoàng Thu Hương
    // Nguyễn Tùng Lâm -> Vũ Thị Hương Lan
    const mapStaff = (id: string | null | undefined): string | null => {
      if (!id) return null;
      if (id === GIANG_ID) return HUONG_ID;
      if (id === LAM_ID) return LAN_ID;
      return id;
    };

    const mappedStaffId = mapStaff(appt.staffId) || appt.staffId;
    const mappedAsst1Id = mapStaff(appt.assistant1Id);
    const mappedAsst2Id = mapStaff(appt.assistant2Id);

    if (mappedStaffId) targetStaffToSetDuty.add(mappedStaffId);
    if (mappedAsst1Id) targetStaffToSetDuty.add(mappedAsst1Id);
    if (mappedAsst2Id) targetStaffToSetDuty.add(mappedAsst2Id);

    const suffix = appt.id.replace(/^appt_/, "");
    const newId = `appt_copy_${targetDate.replace(/-/g, "")}_${suffix}`;

    const newAppt: any = {
      ...appt,
      id: newId,
      date: targetDate,
      staffId: mappedStaffId,
      assistant1Id: mappedAsst1Id,
      assistant2Id: mappedAsst2Id,
      assignedMachineId: appt.assignedMachineId || null,
      machineShiftId: null,
      conflictDetails: [],
      status: AppointmentStatus.PENDING
    };

    // Clean up undefined
    Object.keys(newAppt).forEach(key => {
      if (newAppt[key] === undefined) {
        delete newAppt[key];
      }
    });

    mappedAppointmentsBeforeWriting.push(newAppt as Appointment);
  }

  // Set DUTY attendance for mapped active staff on the target day
  console.log(`\nConfiguring DUTY attendance for ${targetStaffToSetDuty.size} staff members on ${targetDate}...`);
  for (const staffId of targetStaffToSetDuty) {
    const existingRec = attendanceRecords.find(r => r.staffId === staffId && r.date === targetDate);
    if (!existingRec || existingRec.status !== AttendanceStatus.DUTY) {
      const recId = existingRec?.id || `att_${staffId}_${targetDate}`;
      const rec: AttendanceRecord = {
        id: recId,
        staffId,
        date: targetDate,
        status: AttendanceStatus.DUTY
      };
      await setDoc(doc(db, "attendance", recId), rec);
      if (existingRec) {
        existingRec.status = AttendanceStatus.DUTY;
      } else {
        attendanceRecords.push(rec);
      }
    }
  }
  console.log("Attendance configuration complete.");

  console.log(`\nWriting ${mappedAppointmentsBeforeWriting.length} mapped appointments to database for ${targetDate}...`);
  const otherDayAppointments = allAppts.filter(a => a.date !== targetDate);

  let successCount = 0;
  for (const appt of mappedAppointmentsBeforeWriting) {
    // Clear cached dayMap to force checkConflict/getDayAppointmentsFromCache to rebuild it from the updated array
    delete (otherDayAppointments as any).__dayMap;
    delete (mappedAppointmentsBeforeWriting as any).__dayMap;

    const conflictRes = checkConflict(
      appt.startTime,
      appt.endTime,
      targetDate,
      appt.staffId || "",
      appt.patientId,
      [...otherDayAppointments, ...mappedAppointmentsBeforeWriting.slice(0, successCount)],
      staff,
      procedures,
      attendanceRecords,
      patients,
      appt.procedureId,
      undefined,
      appt.assistant1Id,
      appt.assistant2Id,
      { assignedMachineId: appt.assignedMachineId || undefined }
    );

    appt.status = conflictRes.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING;
    appt.conflictDetails = conflictRes.conflictDetails || [];

    await setDoc(doc(db, "appointments", appt.id), appt);
    successCount++;

    const patientName = patients.find(p => p.id === appt.patientId)?.name || "Unknown";
    const procName = procedures.find(p => p.id === appt.procedureId)?.name || "Unknown";
    console.log(`[${successCount}/${mappedAppointmentsBeforeWriting.length}] BN: "${patientName}", Giờ: ${appt.startTime}-${appt.endTime}, Máy: ${appt.assignedMachineId || "-"}, Xung đột: ${conflictRes.hasConflict}`);
  }

  console.log(`\n=== COPY AND MIGRATION COMPLETED SUCCESSFULLY ===`);
  console.log(`Successfully processed and saved: ${successCount} Geriatrics entries.`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Critical run error:", err);
  process.exit(1);
});
