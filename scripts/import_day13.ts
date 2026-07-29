import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus, Patient, Staff, Procedure, AttendanceRecord, AttendanceStatus } from "../types";
import { checkConflict } from "../utils/timeUtils";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const csvData = `Số giường,Họ và tên,Thủ thuật,Giờ bắt đầu,Giờ kết thúc,Chính,Phụ 1,Phụ 2
411,Vũ Thị Vân,Điện châm,08:30,08:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
411,Vũ Thị Vân,Thủy châm,09:01,09:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
409,Nguyễn Thị Gái,Điện châm,08:36,09:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
409,Nguyễn Thị Gái,Thủy châm,09:07,09:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
410,Phạm Thị Hải Yến,Điện châm,08:42,09:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
410,Phạm Thị Hải Yến,Thủy châm,09:13,09:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
471,Cầm Thị Thuyết,Điện châm,08:48,09:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
471,Cầm Thị Thuyết,Thủy châm,09:19,09:44,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
449,Hà Thị Thái,Điện châm,08:54,09:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
449,Hà Thị Thái,Thủy châm,09:25,09:50,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
421,Lò Thị Hinh,Điện châm,09:00,09:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
421,Lò Thị Hinh,Thủy châm,08:31,08:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
420,Tòng Thị Sương,Điện châm,09:06,09:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
420,Tòng Thị Sương,Thủy châm,08:37,09:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
418,Lò Thị Hiến,Điện châm,09:12,09:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
418,Lò Thị Hiến,Thủy châm,08:43,09:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
415,Lò Thị Liến,Điện châm,09:18,09:43,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
415,Lò Thị Liến,Thủy châm,08:49,09:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
419,Lò Thị Xem,Điện châm,09:24,09:49,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
419,Lò Thị Xem,Thủy châm,08:55,09:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
416,Lò Thị Chơm,Điện châm,09:30,09:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
416,Lò Thị Chơm,Thủy châm,10:01,10:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
439,Nguyễn Thị Huệ,Điện châm,09:36,10:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
439,Nguyễn Thị Huệ,Thủy châm,10:07,10:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
434,Vì Văn May,Điện châm,09:42,10:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
434,Vì Văn May,Thủy châm,10:13,10:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
469,Đỗ Văn Dổ,Điện châm,09:48,10:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
469,Đỗ Văn Dổ,Thủy châm,10:19,10:44,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
467,Nguyễn Văn Dần,Điện châm,09:54,10:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
467,Nguyễn Văn Dần,Thủy châm,10:25,10:50,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
452,Lò Thị May,Điện châm,10:00,10:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
452,Lò Thị May,Thủy châm,09:31,09:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
451,Tòng Văn Đoàn,Điện châm,10:06,10:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
451,Tòng Văn Đoàn,Thủy châm,09:37,10:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
453,Nguyễn Thị Nhung,Điện châm,10:12,10:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
453,Nguyễn Thị Nhung,Thủy châm,09:43,10:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
402,Cà Thị Tỏi,Điện châm,10:18,10:43,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
402,Cà Thị Tỏi,Thủy châm,09:49,10:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
435,Quàng Thị Đại,Điện châm,10:24,10:49,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
435,Quàng Thị Đại,Thủy châm,09:55,10:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
480,Trần Thị Điều,Điện châm,13:30,13:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
480,Trần Thị Điều,Thủy châm,14:01,14:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
403,Đèo Văn Tuyên,Điện châm,13:36,14:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
403,Đèo Văn Tuyên,Thủy châm,14:07,14:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
455,Quàng Thị Miên,Điện châm,13:42,14:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
455,Quàng Thị Miên,Thủy châm,14:13,14:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
457,Lò Văn Xương,Điện châm,13:48,14:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
457,Lò Văn Xương,Thủy châm,14:19,14:44,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
404,Lèo Thị Thơi,Điện châm,13:54,14:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
404,Lèo Thị Thơi,Thủy châm,14:25,14:50,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
431,Hoàng Văn Thương,Điện châm,14:00,14:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
431,Hoàng Văn Thương,Thủy châm,13:31,13:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
454,Lường Thị Tun,Điện châm,14:06,14:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
454,Lường Thị Tun,Thủy châm,13:37,14:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
423,Lò Thị Xin,Điện châm,14:12,14:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
423,Lò Thị Xin,Thủy châm,14:43,15:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
447,Phạm Thị Huê,Điện châm,14:18,14:43,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
447,Phạm Thị Huê,Thủy châm,14:49,15:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
429,Lù Văn Ương,Điện châm,14:24,14:49,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
429,Lù Văn Ương,Thủy châm,14:55,15:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
405,Tòng Thị Pè,Điện châm,14:30,14:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
405,Tòng Thị Pè,Thủy châm,15:01,15:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
408,Lò Thị Hịa,Điện châm,14:36,15:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
408,Lò Thị Hịa,Thủy châm,15:07,15:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
401,Quàng Thị Lả,Điện châm,14:42,15:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
401,Quàng Thị Lả,Thủy châm,15:13,15:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
406,Quàng Thị Số,Điện châm,14:48,15:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
406,Quàng Thị Số,Thủy châm,13:43,14:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
407,Quàng Thị Hoa,Điện châm,14:54,15:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
407,Quàng Thị Hoa,Thủy châm,13:49,14:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
422,Nguyễn Thị Thúy,Điện châm,15:00,15:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
422,Nguyễn Thị Thúy,Thủy châm,13:55,14:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
424,Bạc Thanh Minh,Điện châm,15:06,15:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
424,Bạc Thanh Minh,Thủy châm,14:37,15:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
460,Lò Thị Biêng,Điện châm,15:12,15:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
460,Lò Thị Biêng,Thủy châm,14:31,14:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
432,Lò Thị Khổ,Điện châm,15:18,15:43,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
432,Lò Thị Khổ,Thủy châm,15:49,16:14,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
433,Lò Văn Soan,Điện châm,15:24,15:49,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
433,Lò Văn Soan,Thủy châm,15:55,16:20,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
477,Nguyễn Thị Là,Điện châm,15:30,15:55,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
477,Nguyễn Thị Là,Thủy châm,16:01,16:26,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
478,Bùi Thị Kim Ngân,Điện châm,15:36,16:01,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
478,Bùi Thị Kim Ngân,Thủy châm,16:07,16:32,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
473,Nguyễn Thị Thu Hà,Điện châm,15:42,16:07,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
473,Nguyễn Thị Thu Hà,Thủy châm,16:13,16:38,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
443,Quàng Thị Lả,Điện châm,15:48,16:13,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
443,Quàng Thị Lả,Thủy châm,15:19,15:44,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
446,Đàm Thị Mai,Điện châm,15:54,16:19,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
446,Đàm Thị Mai,Thủy châm,15:25,15:50,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
444,Nguyễn Thị Lịch,Điện châm,16:00,16:25,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
444,Nguyễn Thị Lịch,Thủy châm,15:31,15:56,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
458,Quàng Thị Vinh,Điện châm,16:06,16:31,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
458,Quàng Thị Vinh,Thủy châm,15:37,16:02,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,
430,Quàng Văn Quang,Điện châm,16:12,16:37,Vũ Thị Hương Lan,Hoàng Thu Hương,Bùi Thị Thu Hà
430,Quàng Văn Quang,Thủy châm,15:43,16:08,Nguyễn Thị Huyền Trang,Vũ Thúy Hà,`;

function cleanVN(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

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

  const dateToImport = "2026-06-13"; // June 13, 2026

  console.log(`Loaded: ${patients.length} patients, ${staff.length} staff, ${procedures.length} procedures, ${attendanceRecords.length} attendance, ${appointmentsHistory.length} existing appointments.`);

  // 1.5 Delete existing appointments on 2026-06-13 for a clean sync
  const apptsToDelete = appointmentsHistory.filter(d => d.date === dateToImport);
  console.log(`\nDeleting ${apptsToDelete.length} existing appointments on ${dateToImport} for a clean import...`);
  const deletePromises = apptsToDelete.map(d => deleteDoc(doc(db, "appointments", d.id)));
  await Promise.all(deletePromises);
  console.log("Cleanup completed.\n");

  const filteredAppointmentsHistory = appointmentsHistory.filter(d => d.date !== dateToImport);

  // 2. Prepare fuzzy mappings for maximum accuracy
  const staffCleanMap = new Map<string, Staff>();
  staff.forEach(s => {
    staffCleanMap.set(cleanVN(s.name), s);
  });

  const procCleanMap = new Map<string, Procedure>();
  procedures.forEach(p => {
    if (p.deptId === "dept_lao") {
      procCleanMap.set(cleanVN(p.name), p);
    }
  });

  const lines = csvData.trim().split("\n");
  const processedAppointments: Appointment[] = [];
  let successCount = 0;
  let errorCount = 0;

  console.log(`\nStarting mapping and conflict check...`);

  // To keep track of staff we need to make sure are present in the attendance system
  const staffToSetDuty = new Set<string>();

  const appointmentDataToImport: Array<{
    patient: Patient;
    proc: Procedure;
    mainStaff: Staff | null;
    asst1: Staff | null;
    asst2: Staff | null;
    startTime: string;
    endTime: string;
    bedNumber: string;
  }> = [];

  // Parse lines first to see what staff we need on duty!
  for (let i = 1; i < lines.length; i++) {
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

    // 1. Match patient by BOTH name and bed number to support patients with identical names but different beds
    const cleanedPatientName = cleanVN(patientName);
    let foundPatient = patients.find(p => {
      const nameMatch = cleanVN(p.name) === cleanedPatientName;
      if (nameMatch) {
        if (p.bedNumber && bedNumber) {
          return p.bedNumber.trim() === bedNumber.trim();
        }
        return true;
      }
      return false;
    });

    if (!foundPatient) {
      // Fallback to matching by name only
      foundPatient = patients.find(p => cleanVN(p.name) === cleanedPatientName);
    }

    if (!foundPatient) {
      console.error(`Patient NOT found: "${patientName}" (bed ${bedNumber}). Skip.`);
      errorCount++;
      continue;
    }

    // 2. Match procedure in Geriatrics ("dept_lao")
    const cleanedProcName = cleanVN(procedureName);
    const foundProc = procCleanMap.get(cleanedProcName);
    if (!foundProc) {
      console.error(`Procedure NOT found in Geriatrics department ("dept_lao"): "${procedureName}". Skip.`);
      errorCount++;
      continue;
    }

    // 3. Match main staff member
    let foundMainStaff: Staff | null = null;
    if (mainStaffName) {
      foundMainStaff = staffCleanMap.get(cleanVN(mainStaffName)) || null;
      if (!foundMainStaff) {
        console.error(`Main staff member NOT found: "${mainStaffName}". Skip.`);
        errorCount++;
        continue;
      } else {
        staffToSetDuty.add(foundMainStaff.id);
      }
    }

    // 4. Match assistant 1
    let foundAsst1: Staff | null = null;
    if (asst1Name) {
      foundAsst1 = staffCleanMap.get(cleanVN(asst1Name)) || null;
      if (!foundAsst1) {
        console.error(`Assistant 1 NOT found: "${asst1Name}". Skip.`);
        errorCount++;
        continue;
      } else {
        staffToSetDuty.add(foundAsst1.id);
      }
    }

    // 5. Match assistant 2
    let foundAsst2: Staff | null = null;
    if (asst2Name) {
      foundAsst2 = staffCleanMap.get(cleanVN(asst2Name)) || null;
      if (!foundAsst2) {
        console.error(`Assistant 2 NOT found: "${asst2Name}". Skip.`);
        errorCount++;
        continue;
      } else {
        staffToSetDuty.add(foundAsst2.id);
      }
    }

    appointmentDataToImport.push({
      patient: foundPatient,
      proc: foundProc,
      mainStaff: foundMainStaff,
      asst1: foundAsst1,
      asst2: foundAsst2,
      startTime: startTimeString,
      endTime: endTimeString,
      bedNumber
    });
  }

  // Ensure these staff member's attendance status is set to DUTY for 2026-06-13 to prevent weekend day conflict
  console.log(`\nSetting up DUTY attendance for ${staffToSetDuty.size} staff members...`);
  const attendanceWritePromises = Array.from(staffToSetDuty).map(async (staffId) => {
    const existingRec = attendanceRecords.find(r => r.staffId === staffId && r.date === dateToImport);
    if (!existingRec || existingRec.status !== AttendanceStatus.DUTY) {
      const recId = existingRec?.id || `att_${staffId}_${dateToImport}`;
      const rec: AttendanceRecord = {
        id: recId,
        staffId,
        date: dateToImport,
        status: AttendanceStatus.DUTY
      };
      await setDoc(doc(db, "attendance", recId), rec);
      // Update local array used for conflict checks
      if (existingRec) {
        existingRec.status = AttendanceStatus.DUTY;
      } else {
        attendanceRecords.push(rec);
      }
    }
  });
  await Promise.all(attendanceWritePromises);
  console.log(`Attendance configuration completed.`);

  // Now, we make the actual import with conflict checking!
  for (const item of appointmentDataToImport) {
    const { patient, proc, mainStaff, asst1, asst2, startTime, endTime } = item;

    // Call checkConflict with current running list of appointments to ensure auto-assign machines don't overlap!
    const conflictRes = checkConflict(
      startTime,
      endTime,
      dateToImport,
      mainStaff ? mainStaff.id : "",
      patient.id,
      [...filteredAppointmentsHistory, ...processedAppointments],
      staff,
      procedures,
      attendanceRecords,
      patients,
      proc.id,
      undefined,
      asst1 ? asst1.id : null,
      asst2 ? asst2.id : null,
      { assignedMachineId: undefined }
    );

    const assignedMachineId = conflictRes.assignedMachineId || null;

    if (proc.requireMachine && !assignedMachineId) {
      console.warn(`WARNING: High demand or no free machine for "${proc.name}" for patient "${patient.name}" (${startTime} - ${endTime})!`);
    }

    const apptId = `appt_${dateToImport.replace(/-/g, "")}_${patient.id.substring(0, 5)}_${proc.id.substring(0, 5)}_${startTime.replace(/:/g, "")}`;

    const newAppt: any = {
      id: apptId,
      patientId: patient.id,
      staffId: mainStaff ? mainStaff.id : "",
      assistant1Id: asst1 ? asst1.id : null,
      assistant2Id: asst2 ? asst2.id : null,
      procedureId: proc.id,
      deptId: "dept_lao",
      date: dateToImport,
      startTime: startTime,
      endTime: endTime,
      status: conflictRes.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING,
      assignedMachineId: assignedMachineId,
      machineShiftId: null,
      conflictDetails: conflictRes.conflictDetails,
      mainBusyStart: proc.mainBusyStart ?? 0,
      mainBusyEnd: proc.mainBusyEnd ?? proc.busyMinutes ?? 0,
      asst1BusyStart: proc.asst1BusyStart ?? 0,
      asst1BusyEnd: proc.asst1BusyEnd ?? proc.assistant1BusyMinutes ?? 0,
      asst2BusyStart: proc.asst2BusyStart ?? 0,
      asst2BusyEnd: proc.asst2BusyEnd ?? proc.assistant2BusyMinutes ?? 0,
      restMinutes: proc.restMinutes ?? 0
    };

    // Remove any undefined fields to prevent Firebase exceptions
    Object.keys(newAppt).forEach(key => {
      if (newAppt[key] === undefined) {
        delete newAppt[key];
      }
    });

    // Write to Firestore
    await setDoc(doc(db, "appointments", apptId), newAppt);
    processedAppointments.push(newAppt as Appointment);
    successCount++;

    console.log(`Saved Appt - BN: "${patient.name}" (Bed: ${patient.bedNumber}), TT: "${proc.name}" (${startTime} - ${endTime}). Máy: ${assignedMachineId || "-"}. Xung đột: ${conflictRes.hasConflict}`);
  }

  console.log(`\n=== IMPORT JOB COMPLETED ===`);
  console.log(`Successfully mapped and saved: ${successCount} entries.`);
  console.log(`Errors encountered (skips): ${errorCount} entries.`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Critical run error:", err);
  process.exit(1);
});
