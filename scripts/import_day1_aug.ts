import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc as fbSetDoc, deleteDoc as fbDeleteDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { Appointment, AppointmentStatus, Patient, Staff, Procedure, AttendanceRecord, AttendanceStatus } from "../types";
import { checkConflict } from "../utils/timeUtils";

// Load Firebase configuration
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const SUPABASE_URL = "https://chavuvjjrimdeomjexej.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const csvData = `Họ tên bệnh nhân,Số giường,Thủ thuật,Giờ bắt đầu,Giờ kết thúc,Chính,Phụ 1,Phụ 2
Quàng Thị Binh,434,Điện châm,7:44,8:09,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Cà Văn Tính,435,Điện châm,7:51,8:16,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Thị Huấn,438,Điện châm,7:58,8:23,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Bùi Thị Nhật,439,Điện châm,8:05,8:30,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lưu Thị Di,470,Điện châm,8:12,8:37,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Bàn Thị Xinh,409,Điện châm,8:19,8:44,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Đinh Thị Sự,410,Điện châm,8:26,8:51,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Cà Thị Thoai,441,Điện châm,8:33,8:58,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Cà Thị Hiện,442,Điện châm,8:40,9:05,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Đinh Thị Chau,411,Điện châm,8:47,9:12,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Hoàng Thị Lưu,412,Điện châm,8:54,9:19,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Cà Thị Hiên,413,Điện châm,9:01,9:26,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Văn Khánh,414,Điện châm,9:08,9:33,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Văn Dâu,415,Điện châm,9:15,9:40,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Thị Hiền,448,Điện châm,9:22,9:47,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Cà Thị Đoàn,416,Điện châm,9:29,9:54,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Trần Thị Thành,449,Điện châm,9:36,10:01,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Hà Văn Huấn,417,Điện châm,9:43,10:08,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Vì Thị Phức,418,Điện châm,9:50,10:15,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Nguyễn Thị Sơn,450,Điện châm,9:57,10:22,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Văn Niên,451,Điện châm,10:04,10:29,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Cà Văn Pò,419,Điện châm,10:11,10:36,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Văn Loan,420,Điện châm,10:18,10:43,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lường Thị Thuận,452,Điện châm,10:25,10:50,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Thị Thoại,453,Điện châm,10:32,10:57,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Quàng Thị Sách,421,Điện châm,10:39,11:04,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Đào Văn Phú,467,Điện châm,10:46,11:11,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Chu Văn Vường,468,Điện châm,10:53,11:18,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Hà Văn Phát,469,Điện châm,11:00,11:25,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Đinh Thị Dành,401,Điện châm,13:31,13:56,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Văn Thân,430,Điện châm,13:38,14:03,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Cà Thị Cong,402,Điện châm,13:45,14:10,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Cà Văn È,429,Điện châm,13:52,14:17,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Sồng Thị Cha,431,Điện châm,13:59,14:24,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Nguyễn Thị Tầm,403,Điện châm,14:06,14:31,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Thị Chuyên,432,Điện châm,14:13,14:38,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Nguyễn Thị Tám,404,Điện châm,14:20,14:45,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Hà Thị Thiền,405,Điện châm,14:27,14:52,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Điêu Thị Phá,433,Điện châm,14:34,14:59,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Văn Nhượng,406,Điện châm,14:41,15:06,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Vì Thị Ấu,407,Điện châm,14:48,15:13,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Văn Pánh,466,Điện châm,14:55,15:20,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Văn Tiển,465,Điện châm,15:02,15:27,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Tòng Thị Thưởng,408,Điện châm,15:09,15:34,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Ngô Thị Vẻ,454,Điện châm,15:16,15:41,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Phạm Thị Phức,457,Điện châm,15:23,15:48,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Thị Liêu,443,Điện châm,15:30,15:55,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Văn Bóng,444,Điện châm,15:37,16:02,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Thị Muôn,446,Điện châm,15:44,16:09,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Bạc Cầm Na,422,Điện châm,15:51,16:16,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Tòng Thị Định,447,Điện châm,15:58,16:23,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Đoàn Ngọc Minh,460,Điện châm,16:05,16:30,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Đèo Văn Sinh,423,Điện châm,16:12,16:37,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Tòng Văn Tối,424,Điện châm,16:19,16:44,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lường Thị Lựa,461,Điện châm,16:26,16:51,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Vũ Thị Bích Nhượng,475,Điện châm,16:33,16:58,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Nguyễn Văn Chi,478,Điện châm,16:40,17:05,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Phạm Văn Dược,480,Điện châm,16:47,17:12,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang
Lò Thị Nghĩa,477,Điện châm,16:54,17:19,Nguyễn Thị Huyền Trang,Nguyễn Quang Huy,Lê Hương Giang`;

// Pad single digit hours (e.g. "7:44" -> "07:44")
function formatTime(t: string): string {
  const parts = t.trim().split(":");
  if (parts.length !== 2) return t;
  const h = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  return `${h}:${m}`;
}

async function run() {
  console.log("Signing in to Firebase...");
  await signInAnonymously(auth);

  const dateToImport = "2026-08-01";

  // 1. Fetch data from Supabase
  console.log("Fetching current data from Supabase...");
  const { data: pData } = await supabase.from('patients').select('*');
  const patients = pData?.map(d => ({ id: d.id, ...(d.data || d) })) as Patient[];

  const { data: sData } = await supabase.from('staff').select('*');
  const staff = sData?.map(d => ({ id: d.id, ...(d.data || d) })) as Staff[];

  const { data: procData } = await supabase.from('procedures').select('*');
  const procedures = procData?.map(d => ({ id: d.id, ...(d.data || d) })) as Procedure[];

  const { data: attData } = await supabase.from('attendance').select('*');
  const attendanceRecords = attData?.map(d => ({ id: d.id, ...(d.data || d) })) as AttendanceRecord[];

  // Load existing appointments with pagination to get all records
  let allAppts: any[] = [];
  let fromAppt = 0;
  const stepAppt = 1000;
  while (true) {
    const res = await supabase.from('appointments').select('*').range(fromAppt, fromAppt + stepAppt - 1);
    if (res.error) {
      console.warn(`Supabase fetch error for appointments:`, res.error.message);
      break;
    }
    if (!res.data || res.data.length === 0) break;
    allAppts = allAppts.concat(res.data);
    if (res.data.length < stepAppt) break;
    fromAppt += stepAppt;
  }
  const existingAppointments = allAppts.map(d => {
    if (d.data && typeof d.data === 'object') {
      return { ...d.data, id: d.id };
    }
    return d;
  }) as Appointment[];

  console.log(`Loaded from Supabase: ${patients.length} patients, ${staff.length} staff, ${procedures.length} procedures, ${attendanceRecords.length} attendance, ${existingAppointments.length} existing appointments.`);

  // 2. Clear any existing appointments on August 1st, 2026 for dept_lao to make this script idempotent
  const existingLaoAug1 = existingAppointments.filter(a => a.date === dateToImport && a.deptId === "dept_lao");
  if (existingLaoAug1.length > 0) {
    console.log(`Clearing ${existingLaoAug1.length} existing Geriatrics appointments on ${dateToImport}...`);
    for (const appt of existingLaoAug1) {
      // Delete from Firestore
      try {
        await fbDeleteDoc(doc(db, "appointments", appt.id));
      } catch (err) {
        console.warn(`Firestore delete failed for appointment ${appt.id}:`, err);
      }
      // Delete from Supabase
      const { error } = await supabase.from('appointments').delete().eq('id', appt.id);
      if (error) {
        console.warn(`Supabase delete failed for appointment ${appt.id}:`, error.message);
      }
    }
  }

  // 3. Upsert attendance records to DUTY for the three staff members on 2026-08-01
  const targetStaffNames = ["Nguyễn Thị Huyền Trang", "Nguyễn Quang Huy", "Lê Hương Giang"];
  const dutyStaffIds: string[] = [];

  for (const name of targetStaffNames) {
    const s = staff.find(x => x.name?.trim().toLowerCase() === name.toLowerCase());
    if (s) {
      dutyStaffIds.push(s.id);
      const attId = `att_${s.id}_${dateToImport}`;
      const attRecord: AttendanceRecord = {
        id: attId,
        staffId: s.id,
        date: dateToImport,
        status: AttendanceStatus.DUTY
      };

      console.log(`Setting attendance to DUTY for ${name} (${s.id}) on ${dateToImport}...`);
      
      // Upsert to Firestore
      try {
        await fbSetDoc(doc(db, "attendance", attId), attRecord);
      } catch (err) {
        console.warn(`Firestore attendance set failed for ${name}:`, err);
      }

      // Upsert to Supabase
      const { error } = await supabase.from('attendance').upsert({ id: attId, data: attRecord });
      if (error) {
        console.warn(`Supabase attendance upsert failed for ${name}:`, error.message);
      }

      // Add to our local list so checkConflict sees it updated
      const existingIdx = attendanceRecords.findIndex(r => r.id === attId);
      if (existingIdx >= 0) {
        attendanceRecords[existingIdx] = attRecord;
      } else {
        attendanceRecords.push(attRecord);
      }
    } else {
      console.error(`Staff ${name} not found!`);
    }
  }

  // 4. Parse CSV and perform matching & imports
  const lines = csvData.trim().split("\n");
  const processedAppointments: Appointment[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Filter out any deleted appointments from existingAppointments list
  const activeExistingAppts = existingAppointments.filter(a => !(a.date === dateToImport && a.deptId === "dept_lao"));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",");
    const patientName = parts[0].trim();
    const bedNumber = parts[1].trim();
    const procedureName = parts[2].trim();
    const rawStart = parts[3].trim();
    const rawEnd = parts[4].trim();
    const mainStaffName = parts[5].trim();
    const asst1Name = parts[6].trim();
    const asst2Name = parts[7].trim();

    const formattedStartTime = formatTime(rawStart);
    const formattedEndTime = formatTime(rawEnd);

    // Match patient by name, prioritizing active/treating ones and latest admissionDate
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
      console.error(`Row ${i}: Patient NOT found: "${patientName}"`);
      errorCount++;
      continue;
    }

    // Match procedure "Điện châm" (ID: pr_eqnn4i152) in dept_lao
    const foundProc = procedures.find(p => p.name?.trim().toLowerCase() === procedureName.toLowerCase() && p.deptId === "dept_lao");
    if (!foundProc) {
      console.error(`Row ${i}: Procedure NOT found in Geriatrics: "${procedureName}"`);
      errorCount++;
      continue;
    }

    // Match main staff
    const foundMainStaff = staff.find(s => s.name?.trim().toLowerCase() === mainStaffName.toLowerCase());
    if (!foundMainStaff) {
      console.error(`Row ${i}: Main staff NOT found: "${mainStaffName}"`);
      errorCount++;
      continue;
    }

    // Match assistant 1
    const foundAsst1 = staff.find(s => s.name?.trim().toLowerCase() === asst1Name.toLowerCase());
    if (!foundAsst1 && asst1Name) {
      console.error(`Row ${i}: Assistant 1 NOT found: "${asst1Name}"`);
      errorCount++;
      continue;
    }

    // Match assistant 2
    const foundAsst2 = staff.find(s => s.name?.trim().toLowerCase() === asst2Name.toLowerCase());
    if (!foundAsst2 && asst2Name) {
      console.error(`Row ${i}: Assistant 2 NOT found: "${asst2Name}"`);
      errorCount++;
      continue;
    }

    // Check conflicts and auto-allocate machine
    const conflictRes = checkConflict(
      formattedStartTime,
      formattedEndTime,
      dateToImport,
      foundMainStaff.id,
      foundPatient.id,
      [...activeExistingAppts, ...processedAppointments],
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

    const apptId = `appt_${Math.random().toString(36).substring(2, 11)}`;

    const newAppt: any = {
      id: apptId,
      patientId: foundPatient.id,
      staffId: foundMainStaff.id,
      assistant1Id: foundAsst1 ? foundAsst1.id : null,
      assistant2Id: foundAsst2 ? foundAsst2.id : null,
      procedureId: foundProc.id,
      deptId: "dept_lao",
      date: dateToImport,
      startTime: formattedStartTime,
      endTime: formattedEndTime,
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

    // Clean undefined properties
    Object.keys(newAppt).forEach(key => {
      if (newAppt[key] === undefined) {
        delete newAppt[key];
      }
    });

    // Write to Firestore
    try {
      await fbSetDoc(doc(db, "appointments", apptId), newAppt as Appointment);
    } catch (fbErr) {
      console.warn(`Firestore save failed for appointment ${apptId}:`, fbErr);
    }

    // Write to Supabase
    const { error: sbErr } = await supabase.from('appointments').upsert({ id: apptId, data: newAppt });
    if (sbErr) {
      console.error(`Supabase save failed for appointment ${apptId}:`, sbErr.message);
      errorCount++;
      continue;
    }

    processedAppointments.push(newAppt as Appointment);
    successCount++;

    console.log(`Success ${successCount}/${lines.length - 1}: "${patientName}" Bed ${bedNumber} - "${procedureName}" (${formattedStartTime} - ${formattedEndTime}). Conflicts: ${conflictRes.hasConflict}. Machine: ${assignedMachineId}.`);
  }

  console.log(`\n=== IMPORT JOB FINISHED ===`);
  console.log(`Successfully imported: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
