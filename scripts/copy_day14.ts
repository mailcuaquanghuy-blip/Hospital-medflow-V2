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

  const sourceDate = "2026-06-13";
  const targetDate = "2026-06-14";
  const deptId = "dept_lao";

  // 1. Fetch relevant collections for mapper and checker
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
    console.error(`No appointments found on ${sourceDate} for dept_lao. Please double check.`);
    process.exit(1);
  }

  // Idempotence: Clear any existing appointments on the target date on dept_lao
  const existingTargetAppts = allAppts.filter(a => a.date === targetDate && a.deptId === deptId);
  if (existingTargetAppts.length > 0) {
    console.log(`Clearing ${existingTargetAppts.length} existing Geriatrics appointments on ${targetDate}...`);
    for (const appt of existingTargetAppts) {
      await deleteDoc(doc(db, "appointments", appt.id));
    }
    console.log("Cleared existing target date appointments.");
  }

  // Pre-mapping IDs
  const TRANG_ID = "s_j70mhmvcl"; // Nguyễn Thị Huyền Trang
  const LAM_ID = "s_z83w580hx";   // Nguyễn Tùng Lâm

  const HA_ID = "s_p085044zx";    // Bùi Thị Thu Hà
  const OANH_ID = "s_lbf6qsiya";  // Cà Thị Oanh

  // Track staff members who will be active in target appointments to mark them as DUTY on target date (Sunday)
  const targetStaffToSetDuty = new Set<string>();

  const mappedAppointmentsBeforeWriting: Appointment[] = [];

  for (const appt of sourceAppts) {
    // Determine the map targets for staff
    let mappedStaffId = appt.staffId;
    if (mappedStaffId === TRANG_ID) mappedStaffId = LAM_ID;
    else if (mappedStaffId === HA_ID) mappedStaffId = OANH_ID;

    let mappedAsst1Id = appt.assistant1Id;
    if (mappedAsst1Id === TRANG_ID) mappedAsst1Id = LAM_ID;
    else if (mappedAsst1Id === HA_ID) mappedAsst1Id = OANH_ID;

    let mappedAsst2Id = appt.assistant2Id;
    if (mappedAsst2Id === TRANG_ID) mappedAsst2Id = LAM_ID;
    else if (mappedAsst2Id === HA_ID) mappedAsst2Id = OANH_ID;

    if (mappedStaffId) targetStaffToSetDuty.add(mappedStaffId);
    if (mappedAsst1Id) targetStaffToSetDuty.add(mappedAsst1Id);
    if (mappedAsst2Id) targetStaffToSetDuty.add(mappedAsst2Id);

    const newId = `appt_${targetDate.replace(/-/g, "")}_${appt.patientId.substring(0, 5)}_${appt.procedureId.substring(0, 5)}_${appt.startTime.replace(/:/g, "")}`;

    const newAppt: any = {
      ...appt,
      id: newId,
      date: targetDate,
      staffId: mappedStaffId,
      assistant1Id: mappedAsst1Id || null,
      assistant2Id: mappedAsst2Id || null,
      assignedMachineId: appt.assignedMachineId || null, // Keep the machine requested
      machineShiftId: null,
      conflictDetails: [],
      status: AppointmentStatus.PENDING
    };

    // Clean up undefined values from object
    Object.keys(newAppt).forEach(key => {
      if (newAppt[key] === undefined) {
        delete newAppt[key];
      }
    });

    mappedAppointmentsBeforeWriting.push(newAppt as Appointment);
  }

  // Generate target day attendance record for active staff so that conflict checking won't mark Sunday as off
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
  const activePatients = patients; // for local verification
  const otherDayAppointments = allAppts.filter(a => a.date !== targetDate);

  let successCount = 0;
  for (const appt of mappedAppointmentsBeforeWriting) {
    // Run conflict validations locally prior to saving, in order to mark correct conflicts
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
    console.log(`Saved Appt - BN: "${patientName}", TT: "${procName}" (${appt.startTime} - ${appt.endTime}). Máy: ${appt.assignedMachineId || "-"}. Xung đột: ${conflictRes.hasConflict}`);
  }

  console.log(`\n=== COPY AND MIGRATION COMPLETED ===`);
  console.log(`Successfully processed: ${successCount} Geriatrics entries.`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Critical run error:", err);
  process.exit(1);
});
