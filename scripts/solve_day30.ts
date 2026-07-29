import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json' assert { type: 'json' };
import { Appointment, AppointmentStatus, Patient, Staff, Procedure, AttendanceRecord } from "../types";
import { checkConflict, minutesToTimeString, timeStringToMinutes } from "../utils/timeUtils";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const targetPatients = [
  { name: "Phan Thị Lộc", minStart: 7 * 60 + 35 }, // 7h35 => 455
  { name: "Quách Đình Thiều", minStart: 7 * 60 + 49 }, // 7h49 => 469
  { name: "Quàng Thị Xum", minStart: 7 * 60 + 49 },
  { name: "Lù Thị Mông", minStart: 7 * 60 + 49 },
  { name: "Vũ Thị Cúc", minStart: 7 * 60 + 51 }, // 7h51
  { name: "Bùi Thị Xiêm", minStart: 7 * 60 + 53 }, // 7h53
  { name: "Hà Thị Hoa", minStart: 7 * 60 + 53 },
  { name: "Mã Nguyên Mục", minStart: 7 * 60 + 55 }, // 7h55
  { name: "Lù Thị Hiếng", minStart: 7 * 60 + 59 }, // 7h59
  { name: "Lò Thị Nọi", minStart: 8 * 60 + 1 }, // 8h01
  { name: "Cà Thị Đôi", minStart: 8 * 60 + 3 }, // 8h03
  { name: "Đinh Thị Mơ", minStart: 8 * 60 + 5 }, // 8h05
  { name: "Trương Thị Minh Thư", minStart: 8 * 60 + 11 }, // 8h11
  { name: "Cà Thị Ýnh", minStart: 8 * 60 + 13 }, // 8h13
  { name: "Đỗ Kim Bằng", minStart: 8 * 60 + 13 },
  { name: "Nguyễn Hữu Vệ", minStart: 8 * 60 + 17 }, // 8h17
  { name: "Lò Minh Phiệng", minStart: 8 * 60 + 19 }, // 8h19
];

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
  const allAppointments = existingApptsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[];

  const dateToImport = "2026-05-30";

  console.log(`Loaded: ${patients.length} patients, ${staff.length} staff, ${procedures.length} procedures, ${attendanceRecords.length} attendance, ${allAppointments.length} existing appointments.`);

  // 2. Clear block allocations on 2026-05-30
  const countToDeleted = allAppointments.filter(a => a.date === dateToImport);
  console.log(`Clearing ${countToDeleted.length} existing appointments on ${dateToImport}...`);
  for (const appt of countToDeleted) {
    await deleteDoc(doc(db, "appointments", appt.id));
  }
  console.log(`Cleared existing appointments on ${dateToImport}.`);

  // Clear from appointments list
  const baseAppointments = allAppointments.filter(a => a.date !== dateToImport);

  // Get staff details
  const mainStaff = staff.find(s => s.id === "s_z83w580hx"); // BS Nguyễn Tùng Lâm
  const asstElec1 = staff.find(s => s.id === "s_1xca9gdv3"); // DD Hoàng Thu Hương
  const asstElec2 = staff.find(s => s.id === "s_lbf6qsiya"); // DD Cà Thị Oanh
  const asstThuy1 = staff.find(s => s.id === "s_w8k2iebit"); // DD Vũ Thúy Hà

  if (!mainStaff || !asstElec1 || !asstElec2 || !asstThuy1) {
    console.error("Critical staff missing from DB!");
    process.exit(1);
  }

  // Find procedures
  const elecProc = procedures.find(p => p.id === "pr_eqnn4i152"); // Điện châm in Geriatrics
  const thuyProc = procedures.find(p => p.id === "pr_yosjw3y2w"); // Thủy châm in Geriatrics

  if (!elecProc || !thuyProc) {
    console.error("Critical procedures missing from DB!");
    process.exit(1);
  }

  // Match target patients with their DB profile
  const matchedPatients = targetPatients.map(tp => {
    const found = patients.find(p => p.name.trim().toLowerCase() === tp.name.toLowerCase());
    if (!found) {
      throw new Error(`Patient "${tp.name}" not found in DB!`);
    }
    return {
      ...tp,
      patientId: found.id,
      patientProfile: found
    };
  });

  const scheduledList: Appointment[] = [];

  function solveForOrder(patientsOrder: typeof matchedPatients): Appointment[] | null {
    const scheduledList: Appointment[] = [];
    
    for (let patientIndex = 0; patientIndex < patientsOrder.length; patientIndex++) {
      const currentTarget = patientsOrder[patientIndex];
      const pid = currentTarget.patientId;
      const minS = currentTarget.minStart;
      const maxS = 689 - 25; // 11:04

      const possibleStarts: number[] = [];
      for (let t = 450; t <= maxS; t += 5) { // 5-minute multiples are perfect and extensive!
        if (t >= minS) {
          possibleStarts.push(t);
        }
      }
      for (const tp of targetPatients) {
        if (tp.minStart >= minS && tp.minStart <= maxS && !possibleStarts.includes(tp.minStart)) {
          possibleStarts.push(tp.minStart);
        }
      }
      possibleStarts.sort((a, b) => a - b);

      const candidates: { elec: number; thuy: number }[] = [];
      for (const t of possibleStarts) {
        for (const gap of [1, 5]) {
          // Option A: Elec first
          const thuyA = t + 25 + gap;
          if (thuyA <= maxS) {
            candidates.push({ elec: t, thuy: thuyA });
          }
          // Option B: Thuy first
          const elecB = t + 25 + gap;
          if (elecB <= maxS) {
            candidates.push({ elec: elecB, thuy: t });
          }
        }
      }
      candidates.sort((a, b) => Math.max(a.elec, a.thuy) - Math.max(b.elec, b.thuy));

      let foundPair = false;
      for (const cand of candidates) {
        const elecStartStr = minutesToTimeString(cand.elec);
        const elecEndStr = minutesToTimeString(cand.elec + 25);
        const thuyStartStr = minutesToTimeString(cand.thuy);
        const thuyEndStr = minutesToTimeString(cand.thuy + 25);

        // Check Elec
        const elecRes = checkConflict(
          elecStartStr,
          elecEndStr,
          dateToImport,
          mainStaff.id,
          pid,
          scheduledList,
          staff,
          procedures,
          attendanceRecords,
          patients,
          elecProc.id,
          undefined,
          asstElec1.id,
          asstElec2.id,
          { assignedMachineId: undefined }
        );

        if (elecRes.hasConflict || !elecRes.assignedMachineId) {
          continue;
        }

        const assignedElecMachineId = elecRes.assignedMachineId;

        const tempElecAppt: any = {
          id: `temp_elec_${patientIndex}`,
          patientId: pid,
          staffId: mainStaff.id,
          assistant1Id: asstElec1.id,
          assistant2Id: asstElec2.id,
          procedureId: elecProc.id,
          deptId: "dept_lao",
          date: dateToImport,
          startTime: elecStartStr,
          endTime: elecEndStr,
          status: AppointmentStatus.PENDING,
          assignedMachineId: assignedElecMachineId,
          machineShiftId: null,
          mainBusyStart: elecProc.mainBusyStart ?? 0,
          mainBusyEnd: elecProc.mainBusyEnd ?? elecProc.busyMinutes ?? 0,
          asst1BusyStart: elecProc.asst1BusyStart ?? 0,
          asst1BusyEnd: elecProc.asst1BusyEnd ?? elecProc.assistant1BusyMinutes ?? 0,
          asst2BusyStart: elecProc.asst2BusyStart ?? 0,
          asst2BusyEnd: elecProc.asst2BusyEnd ?? elecProc.assistant2BusyMinutes ?? 0,
          restMinutes: elecProc.restMinutes ?? 0
        };

        scheduledList.push(tempElecAppt);

        // Check Thuy
        const thuyRes = checkConflict(
          thuyStartStr,
          thuyEndStr,
          dateToImport,
          mainStaff.id,
          pid,
          scheduledList,
          staff,
          procedures,
          attendanceRecords,
          patients,
          thuyProc.id,
          undefined,
          asstThuy1.id,
          null,
          { assignedMachineId: undefined }
        );

        if (thuyRes.hasConflict) {
          scheduledList.pop(); // Remove Elec
          continue;
        }

        const tempThuyAppt: any = {
          id: `temp_thuy_${patientIndex}`,
          patientId: pid,
          staffId: mainStaff.id,
          assistant1Id: asstThuy1.id,
          assistant2Id: null,
          procedureId: thuyProc.id,
          deptId: "dept_lao",
          date: dateToImport,
          startTime: thuyStartStr,
          endTime: thuyEndStr,
          status: AppointmentStatus.PENDING,
          assignedMachineId: null,
          machineShiftId: null,
          mainBusyStart: thuyProc.mainBusyStart ?? 0,
          mainBusyEnd: thuyProc.mainBusyEnd ?? thuyProc.busyMinutes ?? 0,
          asst1BusyStart: thuyProc.asst1BusyStart ?? 0,
          asst1BusyEnd: thuyProc.asst1BusyEnd ?? thuyProc.assistant1BusyMinutes ?? 0,
          asst2BusyStart: thuyProc.asst2BusyStart ?? 0,
          asst2BusyEnd: thuyProc.asst2BusyEnd ?? thuyProc.assistant2BusyMinutes ?? 0,
          restMinutes: thuyProc.restMinutes ?? 0
        };

        scheduledList.push(tempThuyAppt);
        foundPair = true;
        break;
      }

      if (!foundPair) {
        return null; // Failed for this ordering
      }
    }

    return scheduledList;
  }

  let finalSchedule: Appointment[] | null = null;

  console.log("Starting randomized multistart constructive search...");
  
  // Try the original minStart sorted order first!
  finalSchedule = solveForOrder(matchedPatients);
  if (finalSchedule) {
    console.log("Successfully solved using sorted ordering!");
  } else {
    // If not, shuffle!
    for (let attempt = 1; attempt <= 100; attempt++) {
      // Shuffle helper
      const shuffled = [...matchedPatients];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      finalSchedule = solveForOrder(shuffled);
      if (finalSchedule) {
        console.log(`Successfully solved using shuffle attempt ${attempt}!`);
        break;
      }
    }
  }

  if (finalSchedule) {
    console.log(`Successfully found a valid schedule with ${finalSchedule.length} appointments! Saving to Firestore...`);
    
    // Save to Firestore with real IDs
    for (let i = 0; i < finalSchedule.length; i++) {
       const appt = finalSchedule[i];
       const realId = `appt_day30_${i}`;
       appt.id = realId;
       await setDoc(doc(db, "appointments", realId), appt);
       const patName = patients.find(p => p.id === appt.patientId)?.name || appt.patientId;
       console.log(`Saved Appt: ${patName} ${appt.procedureId === elecProc.id ? "Elec" : "Thuy"} at ${appt.startTime} - ${appt.endTime}`);
    }
    
    console.log("All appointments saved perfectly!");
  } else {
    console.error("COULD NOT FIND A CONFLICT-FREE SCHEDULE!");
    process.exit(1);
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Critical run error:", err);
  process.exit(1);
});
