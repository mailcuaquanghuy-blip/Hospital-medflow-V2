import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, query, where, deleteDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus, Patient, Staff, Procedure, AttendanceRecord, AttendanceStatus } from "../types";
import { checkConflict } from "../utils/timeUtils";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

// CSV data for morning session (25 procedures)
const morningCsv = `434,VÌ VĂN MAY,Điện châm,7:44,8:09,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
435,HOÀNG ĐỨC VƯỢT,Điện châm,7:50,8:15,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
409,LƯỜNG THỊ VÉT,Điện châm,7:56,8:21,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
470,BẠC THANH MINH,Điện châm,8:02,8:27,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
439,LÙ THỊ BINH,Điện châm,8:08,8:33,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
441,LÒ THỊ ĐOAN,Điện châm,8:14,8:39,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
471,NGUYỄN THỊ THUÝ,Điện châm,8:20,8:45,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
410,TRƯƠNG THỊ KHÁNH,Điện châm,8:26,8:51,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
472,LÒ THỊ THƯƠNG,Điện châm,8:32,8:57,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
412,PHẠM THỊ HẢI YẾN,Điện châm,8:38,9:03,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
414,BẠC THỊ KEM,Điện châm,8:44,9:09,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
415,HOÀNG THỊ È,Điện châm,8:50,9:15,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
416,LÒ THỊ CHOM,Điện châm,8:56,9:21,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
449,TRỊNH THỊ LƯU,Điện châm,9:02,9:27,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
417,LÒ VĂN DIÊU,Điện châm,9:08,9:33,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
418,LÒ THỊ NGOAN,Điện châm,9:14,9:39,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
419,HOÀNG THỊ BÓNG,Điện châm,9:20,9:45,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
451,LÒ VĂN CHƠN,Điện châm,9:26,9:51,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
452,VÌ VĂN NE,Điện châm,9:32,9:57,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
420,HÀ THỊ HƯƠNG,Điện châm,9:38,10:03,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
453,TÒNG THỊ NGHỊCH,Điện châm,9:44,10:09,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
421,PHẠM THỊ HUÊ,Điện châm,9:50,10:15,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
467,ĐÀO VĂN PHÚ,Điện châm,9:56,10:21,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
469,NGUYỄN HỮU VỆ,Điện châm,10:02,10:27,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
462,Lò Văn Nọi,Điện châm,10:08,10:33,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang`;

// CSV data for afternoon session (34 procedures)
const afternoonCsv = `431,QUÀNG THỊ HƯƠI,Điện châm,13:31,13:56,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
401,LÒ THỊ XIN,Điện châm,13:37,14:02,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
402,TÒNG THỊ XƯƠNG,Điện châm,13:43,14:08,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
429,HOÀNG VĂN TƯƠI,Điện châm,13:49,14:14,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
403,LÒ THỊ PỎM,Điện châm,13:55,14:20,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
404,LÒ THỊ LÍCH,Điện châm,14:01,14:26,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
432,QUÀNG THỊ ĐẠI,Điện châm,14:07,14:32,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
433,VÌ THỊ CUA,Điện châm,14:13,14:38,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
405,HOÀNG THỊ LIÊN,Điện châm,14:19,14:44,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
406,BẠC THỊ DỌN,Điện châm,14:25,14:50,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
407,LÒ THỊ NGOAI,Điện châm,14:31,14:56,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
408,QUÀNG THỊ MAI,Điện châm,14:37,15:02,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
454,LÒ THỊ HƯỞNG,Điện châm,14:43,15:08,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
443,QUÀNG THỊ XUÂN,Điện châm,14:49,15:14,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
444,LÒ THỊ HỎA,Điện châm,14:55,15:20,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
446,VÌ THỊ SAN,Điện châm,15:01,15:26,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
447,HÀ THỊ ÓNG,Điện châm,15:07,15:32,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
422,LƯỜNG VĂN TIM,Điện châm,15:13,15:38,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
423,ĐÀO THANH TRÀ,Điện châm,15:19,15:44,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
424,LƯỜNG VĂN HỢP,Điện châm,15:25,15:50,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
459,LÒ VĂN SOAN,Điện châm,15:31,15:56,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
461,TRẦN THỊ TÝ,Điện châm,15:37,16:02,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
460,LÒ THỊ KHỔ,Điện châm,15:43,16:08,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
466,NGUYỄN VĂN HỘI,Điện châm,15:49,16:14,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
430,LÈO VĂN TIẾN,Điện châm,15:55,16:20,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
465,AN THỊ LỊCH,Điện châm,16:01,16:26,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
474,PHẠM VĂN TRỊNH,Điện châm,16:07,16:32,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
475,NGUYỄN VĂN VẼ,Điện châm,16:13,16:38,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
479,ĐÀO THỊ LAN,Điện châm,16:19,16:44,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
478,LÊ THỊ HOÀNG,Điện châm,16:25,16:50,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
479B,LÊ THỊ LAN,Điện châm,16:31,16:56,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
477,PHAN THỊ HẰNG,Điện châm,16:37,17:02,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
480,PHẠM THỊ MÂY,Điện châm,16:43,17:08,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang
476,NGUYỄN THỊ GIẢO,Điện châm,16:49,17:14,Nguyễn Thị Huyền Trang,Lò Hồng Hạnh,Lê Hương Giang`;

async function run() {
  await signInAnonymously(auth);

  console.log("=== STEP 1: CLEANING UP PREVIOUS GERIATRIC WARD APPOINTMENTS ON 2026-07-18 ===");
  const qDel = query(
    collection(db, "appointments"),
    where("date", "==", "2026-07-18"),
    where("deptId", "==", "dept_lao")
  );
  const delSnap = await getDocs(qDel);
  console.log(`Found ${delSnap.size} existing geriatric appointments to clear.`);
  for (const d of delSnap.docs) {
    await deleteDoc(doc(db, "appointments", d.id));
    console.log(`Deleted stale appointment: ${d.id}`);
  }

  // Set attendance to DUTY for the three working staff
  console.log("=== STEP 2: SETTING UP ATTENDANCE TO DUTY ON 2026-07-18 ===");
  const staffIds = ["s_j70mhmvcl", "s_jjuifzlke", "s_tppw9td1m"];
  for (const sId of staffIds) {
    const attId = `att_july18_${sId}`;
    await setDoc(doc(db, "attendance", attId), {
      id: attId,
      staffId: sId,
      date: "2026-07-18",
      status: AttendanceStatus.DUTY
    });
    console.log(`Set DUTY attendance for ${sId}`);
  }

  // Fetch reference collections
  console.log("=== STEP 3: FETCHING DATA FROM FIRESTORE ===");
  const patientsSnap = await getDocs(collection(db, "patients"));
  const patients = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Patient[];

  const staffSnap = await getDocs(collection(db, "staff"));
  const staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Staff[];

  const proceduresSnap = await getDocs(collection(db, "procedures"));
  const procedures = proceduresSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Procedure[];

  const attendanceSnap = await getDocs(query(collection(db, "attendance"), where("date", "==", "2026-07-18")));
  const attendanceRecords = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];

  const targetProc = procedures.find(p => p.name === "Điện châm" && p.deptId === "dept_lao");
  if (!targetProc) {
    console.error("Target procedure 'Điện châm' for 'dept_lao' not found!");
    process.exit(1);
  }

  const processedAppointments: Appointment[] = [];
  let totalSaved = 0;

  // Function to process CSV lines
  async function processCsv(csv: string, isAfternoon: boolean) {
    const lines = csv.trim().split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",");
      if (parts.length < 8) {
        console.warn(`Skipping invalid line: ${line}`);
        continue;
      }

      const bedNumber = parts[0].trim();
      const patientName = parts[1].trim();
      const procedureName = parts[2].trim();
      const startTimeStr = parts[3].trim();
      const endTimeStr = parts[4].trim();
      const mainStaffName = parts[5].trim();
      const asst1Name = parts[6].trim();
      const asst2Name = parts[7].trim();

      const padTime = (t: string) => {
        const p = t.split(":");
        if (p.length !== 2) return t;
        return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
      };

      const startTime = padTime(startTimeStr);
      const endTime = padTime(endTimeStr);

      // Find treating patient first, or any matched patient
      const foundPatients = patients.filter(p => p.name.toLowerCase().trim() === patientName.toLowerCase().trim());
      const foundPatient = foundPatients.find(p => p.status === "TREATING") || foundPatients[0];

      if (!foundPatient) {
        console.error(`ERROR: Patient not found: "${patientName}"`);
        continue;
      }

      // Find staff
      const foundMainStaff = staff.find(s => s.name.toLowerCase().trim() === mainStaffName.toLowerCase().trim());
      const foundAsst1 = staff.find(s => s.name.toLowerCase().trim() === asst1Name.toLowerCase().trim());
      const foundAsst2 = staff.find(s => s.name.toLowerCase().trim() === asst2Name.toLowerCase().trim());

      if (!foundMainStaff || !foundAsst1 || !foundAsst2) {
        console.error(`ERROR: Staff mapping failed for: ${mainStaffName}, ${asst1Name}, ${asst2Name}`);
        continue;
      }

      // Reset cached dayMap to force checkConflict/getDayAppointmentsFromCache to rebuild it from the updated processedAppointments array
      (processedAppointments as any).__dayMap = undefined;

      // Check conflict and auto-assign machine
      const conflictRes = checkConflict(
        startTime,
        endTime,
        "2026-07-18",
        foundMainStaff.id,
        foundPatient.id,
        processedAppointments,
        staff,
        procedures,
        attendanceRecords,
        patients,
        targetProc.id,
        undefined,
        foundAsst1.id,
        foundAsst2.id,
        { assignedMachineId: undefined } // Let it auto-assign!
      );

      const sessionLabel = isAfternoon ? "pm" : "am";
      const apptId = `appt_july18_${sessionLabel}_${i.toString().padStart(2, '0')}_${Math.random().toString(36).substr(2, 5)}`;

      const newAppt: any = {
        id: apptId,
        patientId: foundPatient.id,
        staffId: foundMainStaff.id,
        assistant1Id: foundAsst1.id,
        assistant2Id: foundAsst2.id,
        procedureId: targetProc.id,
        deptId: "dept_lao",
        date: "2026-07-18",
        startTime: startTime,
        endTime: endTime,
        status: conflictRes.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING,
        assignedMachineId: conflictRes.assignedMachineId || null,
        machineShiftId: null,
        conflictDetails: conflictRes.conflictDetails || [],
        mainBusyStart: targetProc.mainBusyStart ?? 0,
        mainBusyEnd: targetProc.mainBusyEnd ?? targetProc.busyMinutes ?? 0,
        asst1BusyStart: targetProc.asst1BusyStart ?? 0,
        asst1BusyEnd: targetProc.asst1BusyEnd ?? targetProc.assistant1BusyMinutes ?? 0,
        asst2BusyStart: targetProc.asst2BusyStart ?? 0,
        asst2BusyEnd: targetProc.asst2BusyEnd ?? targetProc.assistant2BusyMinutes ?? 0,
        restMinutes: targetProc.restMinutes ?? 0
      };

      // Strip any undefined
      Object.keys(newAppt).forEach(key => {
        if (newAppt[key] === undefined) {
          delete newAppt[key];
        }
      });

      await setDoc(doc(db, "appointments", apptId), newAppt as Appointment);
      processedAppointments.push(newAppt as Appointment);
      totalSaved++;

      console.log(`[Imported] [${sessionLabel.toUpperCase()}] BN: ${foundPatient.name} | Bed: ${bedNumber} | Giờ: ${startTime}-${endTime} | Máy: ${conflictRes.assignedMachineId} | Status: ${newAppt.status}`);
    }
  }

  console.log("=== STEP 4: PROCESSING MORNING SESSION ===");
  await processCsv(morningCsv, false);

  console.log("=== STEP 5: PROCESSING AFTERNOON SESSION ===");
  await processCsv(afternoonCsv, true);

  console.log(`=== RE-IMPORT SUCCESSFUL: TOTAL ${totalSaved} PROCEDURES SAVED! ===`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Critical execution error:", err);
  process.exit(1);
});
