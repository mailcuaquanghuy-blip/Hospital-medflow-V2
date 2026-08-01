import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, query, where } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus, Patient, Staff, Procedure, AttendanceRecord } from "../types";
import { checkConflict } from "../utils/timeUtils";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const csvData = `Số giường,Họ tên người bệnh,Thủ thuật,Giờ bắt đầu,Giờ kết thúc,Chính,Phụ 1,Phụ 2,
420,Phan Thị Lộc,Điện châm,07:40,08:05,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
420,Phan Thị Lộc,Thủy châm,08:06,08:31,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
409,Quách Đình Thiều,Điện châm,07:52,08:17,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
409,Quách Đình Thiều,Thủy châm,08:18,08:43,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
410,Vũ Thị Cúc,Điện châm,07:58,08:23,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
410,Vũ Thị Cúc,Thủy châm,08:24,08:49,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
415,Lò Thị Nọi,Điện châm,08:04,08:29,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
415,Lò Thị Nọi,Thủy châm,08:30,08:55,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
416,Cà Thị Đôi,Điện châm,08:10,08:35,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
416,Cà Thị Đôi,Thủy châm,08:36,09:01,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
421,Cà Thị Ýnh,Điện châm,08:16,08:41,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
421,Cà Thị Ýnh,Thủy châm,08:42,09:07,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
439,Quàng Thị Xum,Điện châm,08:22,08:47,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
439,Quàng Thị Xum,Thủy châm,08:48,09:13,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
417,Đinh Thị Mơ,Điện châm,08:28,08:53,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
417,Đinh Thị Mơ,Thủy châm,08:54,09:19,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
414,Lù Thị Hiếng,Điện châm,08:34,08:59,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
414,Lù Thị Hiếng,Thủy châm,09:00,09:25,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
467,Nguyễn Hữu Vệ,Điện châm,08:40,09:05,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
467,Nguyễn Hữu Vệ,Thủy châm,08:12,08:37,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
468,Lò Minh Phiệng,Điện châm,08:46,09:11,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
468,Lò Minh Phiệng,Thủy châm,07:54,08:19,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
470,Lù Thị Mông,Điện châm,08:52,09:17,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
470,Lù Thị Mông,Thủy châm,09:18,09:43,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
472,Bùi Thị Xiêm,Điện châm,08:58,09:23,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
472,Bùi Thị Xiêm,Thủy châm,09:24,09:49,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
452,Trương Thị Minh Thư,Điện châm,09:04,09:29,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
452,Trương Thị Minh Thư,Thủy châm,09:30,09:55,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
453,Đỗ Kim Bằng,Điện châm,09:10,09:35,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
453,Đỗ Kim Bằng,Thủy châm,09:36,10:01,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
412,Mã Nguyên Mục,Điện châm,09:16,09:41,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
412,Mã Nguyên Mục,Thủy châm,09:42,10:07,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
442,Hà Thị Hoa,Điện châm,09:22,09:47,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
442,Hà Thị Hoa,Thủy châm,09:48,10:13,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
429,Hoàng Đức Vượt,Điện châm,13:30,13:55,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
429,Hoàng Đức Vượt,Thủy châm,14:01,14:26,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
477B,Nguyễn Hữu Kiêm,Điện châm,13:36,14:01,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
477B,Nguyễn Hữu Kiêm,Thủy châm,14:07,14:32,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
474,Trần Thị Liên,Điện châm,13:42,14:07,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
474,Trần Thị Liên,Thủy châm,14:13,14:38,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
422,Nguyễn Thị Lý,Điện châm,13:48,14:13,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
422,Nguyễn Thị Lý,Thủy châm,14:19,14:44,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
423,Lò Văn Khé,Điện châm,13:54,14:19,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
423,Lò Văn Khé,Thủy châm,14:25,14:50,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
424,Trần Thị Bình,Điện châm,14:00,14:25,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
424,Trần Thị Bình,Thủy châm,13:31,13:56,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
401,Cầm Hòa Bình,Điện châm,14:06,14:31,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
401,Cầm Hòa Bình,Thủy châm,13:37,14:02,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
402,Đèo Văn Sinh,Điện châm,14:12,14:37,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
402,Đèo Văn Sinh,Thủy châm,13:43,14:08,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
473,Đỗ Đình Khiển,Điện châm,14:18,14:43,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
473,Đỗ Đình Khiển,Thủy châm,13:49,14:14,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
444,Lèo Thị Hẹ,Điện châm,14:24,14:49,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
444,Lèo Thị Hẹ,Thủy châm,13:55,14:20,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
443,Lường Thị Hặc,Điện châm,14:30,14:55,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
443,Lường Thị Hặc,Thủy châm,15:01,15:26,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
446,Lò Thị Ón,Điện châm,14:36,15:01,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
446,Lò Thị Ón,Thủy châm,15:07,15:32,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
458,Trần Văn Sơn,Điện châm,14:42,15:07,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
458,Trần Văn Sơn,Thủy châm,15:13,15:38,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
432,Quàng Thị Đại,Điện châm,14:48,15:13,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
432,Quàng Thị Đại,Thủy châm,15:19,15:44,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
478,Nguyễn Thanh Hải,Điện châm,14:54,15:19,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
478,Nguyễn Thanh Hải,Thủy châm,15:25,15:50,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
430,Dương thị Thúy,Điện châm,15:00,15:25,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
430,Dương thị Thúy,Thủy châm,15:31,15:56,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
461,Doãn Thị Lực,Điện châm,15:06,15:31,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
461,Doãn Thị Lực,Thủy châm,14:31,14:56,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
459,Nguyễn Văn Bằng,Điện châm,15:12,15:37,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
459,Nguyễn Văn Bằng,Thủy châm,14:37,15:02,Nguyễn Tùng Lâm,Vũ Thúy Hà,,
479,Đỗ Thị Thanh Bình,Điện châm,15:18,15:43,Nguyễn Tùng Lâm,Hoàng Thu Hương,Cà Thị Oanh,
479,Đỗ Thị Thanh Bình,Thủy châm,14:43,15:08,Nguyễn Tùng Lâm,Vũ Thúy Hà,,`;

async function run() {
  await signInAnonymously(auth);

  // 1. Fetch collections
  const patientsSnap = await getDocs(collection(db, "patients"));
  const patients = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Patient[];

  const staffSnap = await getDocs(collection(db, "staff"));
  const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Staff[];

  const proceduresSnap = await getDocs(collection(db, "procedures"));
  const procedures = proceduresSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Procedure[];

  const attendanceSnap = await getDocs(collection(db, "attendance"));
  const attendanceRecords = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];

  const existingApptsSnap = await getDocs(collection(db, "appointments"));
  const appointmentsHistory = existingApptsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];

  const dateToImport = "2026-05-30";

  console.log(`Loaded: ${patients.length} patients, ${staff.length} staff, ${procedures.length} procedures, ${attendanceRecords.length} attendance, ${appointmentsHistory.length} existing appointments.`);

  const lines = csvData.trim().split("\n");
  const processedAppointments: Appointment[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Let's print out what we match
  for (let i = 1; i < lines.length; i++) { // Skip header row
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 8) {
      console.error(`Row ${i} has insufficient columns: "${line}"`);
      errorCount++;
      continue;
    }

    const bedNumber = parts[0].trim();
    const patientName = parts[1].trim();
    const procedureName = parts[2].trim();
    const startTimeString = parts[3].trim();
    const endTimeString = parts[4].trim();
    const mainStaffName = parts[5].trim();
    const asst1Name = parts[6].trim();
    const asst2Name = parts[7].trim();

    // 1. Match patient by name, prioritizing active/treating ones and latest admissionDate
    const matchingPatients = patients.filter(p => p.name?.trim().toLowerCase() === patientName.toLowerCase());
    let foundPatient: Patient | undefined;
    if (matchingPatients.length > 0) {
      const sorted = [...matchingPatients].sort((a, b) => {
        if (a.status === "TREATING" && b.status !== "TREATING") return -1;
        if (a.status !== "TREATING" && b.status === "TREATING") return 1;
        return new Date(b.admissionDate || 0).getTime() - new Date(a.admissionDate || 0).getTime();
      });
      if (bedNumber) {
        foundPatient = sorted.find(p => p.bedNumber === bedNumber) || sorted[0];
      } else {
        foundPatient = sorted[0];
      }
    }
    if (!foundPatient) {
      console.error(`Patient NOT found: "${patientName}" (bed ${bedNumber})`);
      errorCount++;
      continue;
    }

    // 2. Match procedure in Geriatrics (deptId === "dept_lao")
    const foundProc = procedures.find(p => p.name.trim().toLowerCase() === procedureName.toLowerCase() && p.deptId === "dept_lao");
    if (!foundProc) {
      console.error(`Procedure NOT found in Geriatrics department: "${procedureName}"`);
      errorCount++;
      continue;
    }

    // 3. Match main staff member
    const foundMainStaff = staff.find(s => s.name.trim().toLowerCase() === mainStaffName.toLowerCase());
    if (!foundMainStaff && mainStaffName) {
      console.error(`Main staff member NOT found: "${mainStaffName}"`);
      errorCount++;
      continue;
    }

    // 4. Match assistant 1
    let foundAsst1 = null;
    if (asst1Name) {
      foundAsst1 = staff.find(s => s.name.trim().toLowerCase() === asst1Name.toLowerCase());
      if (!foundAsst1) {
        console.error(`Assistant 1 NOT found: "${asst1Name}"`);
        errorCount++;
        continue;
      }
    }

    // 5. Match assistant 2
    let foundAsst2 = null;
    if (asst2Name) {
      foundAsst2 = staff.find(s => s.name.trim().toLowerCase() === asst2Name.toLowerCase());
      if (!foundAsst2) {
        console.error(`Assistant 2 NOT found: "${asst2Name}"`);
        errorCount++;
        continue;
      }
    }

    // 6. Check conflicts & auto-assign machine
    // Passing undefined for assignedMachineId so checkConflict will auto-assign a suitable free machine for Điện châm!
    const conflictRes = checkConflict(
      startTimeString,
      endTimeString,
      dateToImport,
      foundMainStaff ? foundMainStaff.id : "",
      foundPatient.id,
      [...appointmentsHistory, ...processedAppointments],
      staff,
      procedures,
      attendanceRecords,
      patients,
      foundProc.id,
      undefined,
      foundAsst1 ? foundAsst1.id : null,
      foundAsst2 ? foundAsst2.id : null,
      { assignedMachineId: undefined }
    );

    const assignedMachineId = conflictRes.assignedMachineId || null;

    if (foundProc.requireMachine && !assignedMachineId) {
      console.warn(`WARNING: No machine assigned for "${procedureName}" for patient "${patientName}" even though it requires one!`);
    }

    const apptId = `appt_${Math.random().toString(36).substr(2, 9)}`;

    // Create appointment object
    const newAppt: any = {
      id: apptId,
      patientId: foundPatient.id,
      staffId: foundMainStaff ? foundMainStaff.id : "",
      assistant1Id: foundAsst1 ? foundAsst1.id : null,
      assistant2Id: foundAsst2 ? foundAsst2.id : null,
      procedureId: foundProc.id,
      deptId: "dept_lao",
      date: dateToImport,
      startTime: startTimeString,
      endTime: endTimeString,
      status: conflictRes.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING,
      assignedMachineId: assignedMachineId,
      machineShiftId: null,
      conflictDetails: conflictRes.conflictDetails,
      mainBusyStart: foundProc.mainBusyStart ?? 0,
      mainBusyEnd: foundProc.mainBusyEnd ?? foundProc.busyMinutes ?? 0,
      asst1BusyStart: foundProc.asst1BusyStart ?? 0,
      asst1BusyEnd: foundProc.asst1BusyEnd ?? foundProc.assistant1BusyMinutes ?? 0,
      asst2BusyStart: foundProc.asst2BusyStart ?? 0,
      asst2BusyEnd: foundProc.asst2BusyEnd ?? foundProc.assistant2BusyMinutes ?? 0,
      restMinutes: foundProc.restMinutes ?? 0
    };

    // Remove any undefined fields to prevent Firebase exceptions
    Object.keys(newAppt).forEach(key => {
      if (newAppt[key] === undefined) {
        delete newAppt[key];
      }
    });

    // Write to Firestore
    await setDoc(doc(db, "appointments", apptId), newAppt as Appointment);
    processedAppointments.push(newAppt as Appointment);
    successCount++;

    console.log(`Success ${successCount}: Appt for "${patientName}" - "${procedureName}" (${startTimeString} - ${endTimeString}) has conflict: ${conflictRes.hasConflict}. Assigned Machine: ${assignedMachineId}.`);
  }

  console.log(`\n=== IMPORT JOB COMPLETED ===`);
  console.log(`Successfully imported: ${successCount} entries.`);
  console.log(`Errors encountered: ${errorCount} entries.`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Critical run error:", err);
  process.exit(1);
});
