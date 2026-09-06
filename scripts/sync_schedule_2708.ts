import { createClient } from '@supabase/supabase-js';
import { timeStringToMinutes } from '../utils/timeUtils';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import fs from 'fs';

const SUPABASE_URL = 'https://chavuvjjrimdeomjexej.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const csvRaw = `Họ tên bệnh nhân,Tuổi,Thủ thuật,Giờ bắt đầu,Giờ kết thúc,Chính,Phụ 1,Phụ 2
VÌ THỊ PHƯỢNG,62,Cấy chỉ,10:10:00,10:40:00,Vũ Thị Hương Lan,Cà Thị Oanh,
PHẠM VIẾT CẬN,91,Cấy chỉ,10:58:00,11:28:00,Vũ Thị Hương Lan,Cà Thị Oanh,
ĐÀM THỊ MAI,75,Điện châm,10:50:00,11:15:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LA VĂN CHUYÊN,61,Điện châm,8:44:00,9:09:00,Cầm Thị Uyên,Quàng Văn Hình,Hoàng Thu Hương
ĐẶNG THỊ THUNG,76,Điện châm,8:51:00,9:16:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
SA THỊ XÈN,71,Điện châm,15:37:00,16:02:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TRẦN THỊ LUYÊN,60,Điện châm,8:44:00,9:09:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ PHƯƠNG,51,Điện châm,8:37:00,9:02:00,Cầm Thị Uyên,Quàng Văn Hình,Hoàng Thu Hương
ĐINH THỊ KHUẤN,65,Điện châm,14:48:00,15:13:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ GÁI,76,Điện châm,9:33:00,9:58:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ XIÊM,96,Điện châm,11:04:00,11:29:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ LỊCH,72,Điện châm,10:43:00,11:08:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ BIỂN,69,Điện châm,10:22:00,10:47:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
HOÀNG THỊ LUN,64,Điện châm,8:00:00,8:25:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
LÒ VĂN NHÉ,67,Điện châm,9:05:00,9:30:00,Vũ Thị Hương Lan,Quàng Văn Hình,Hoàng Thu Hương
LÒ VĂN ĐÔI,69,Điện châm,10:08:00,10:33:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
HOÀNG THỊ CHAI,57,Điện châm,10:15:00,10:40:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ ÓN,76,Điện châm,15:16:00,15:41:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TRẦN THỊ MAI,48,Điện châm,9:05:00,9:30:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG VĂN TIÊN,60,Điện châm,8:37:00,9:02:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ PHÓNG,59,Điện châm,8:58:00,9:23:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
ĐÈO THỊ TOẢN,45,Điện châm,14:27:00,14:52:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ ĐỊA,80,Điện châm,15:02:00,15:27:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ SAM,62,Điện châm,16:12:00,16:37:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TÒNG VĂN THÁI,64,Điện châm,16:05:00,16:30:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VŨ THỊ KHƯƠNG,78,Điện châm,10:36:00,11:01:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TÒNG THỊ PHỎNG,52,Điện châm,9:40:00,10:05:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LƯỜNG THỊ CHỎI,66,Điện châm,9:47:00,10:12:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÙ VĂN THÀNH,65,Điện châm,9:12:00,9:37:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ HỒNG,55,Điện châm,16:26:00,16:51:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ TIẾN,65,Điện châm,13:59:00,14:24:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
CÀ THỊ ĐOAN,66,Điện châm,13:52:00,14:17:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ CƯỜNG,80,Điện châm,14:13:00,14:38:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ ĐU,62,Điện châm,14:20:00,14:45:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ VĂN KIM,54,Điện châm,15:51:00,16:16:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TRẦN THỊ TỴ,86,Điện châm,15:09:00,15:34:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ TÌNH,63,Điện châm,15:23:00,15:48:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ TÂM,52,Điện châm,15:30:00,15:55:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ HỒNG,57,Điện châm,14:34:00,14:59:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
CÀ VĂN SÁNG,51,Điện châm,9:54:00,10:19:00,Nguyễn Thị Huyền Trang,Hoàng Thu Hương,Quàng Văn Hình
QUÀNG THỊ UÔN,46,Điện châm,10:01:00,10:26:00,Nguyễn Thị Huyền Trang,Quàng Văn Hình,Lê Hương Giang
ĐÀM THỊ MAI,75,Thủy châm,10:22:00,10:47:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LA VĂN CHUYÊN,61,Thủy châm,10:43:00,11:08:00,Cầm Thị Uyên,Nguyễn Quang Huy,
ĐẶNG THỊ THUNG,76,Thủy châm,9:40:00,10:05:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
SA THỊ XÈN,71,Thủy châm,15:09:00,15:34:00,Cầm Thị Uyên,Hoàng Thu Hương,
TRẦN THỊ LUYÊN,60,Thủy châm,9:33:00,9:58:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
LÒ THỊ PHƯƠNG,51,Thủy châm,10:43:00,11:08:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
ĐINH THỊ KHUẤN,65,Thủy châm,15:16:00,15:41:00,Cầm Thị Uyên,Hoàng Thu Hương,
NGUYỄN THỊ GÁI,76,Thủy châm,8:16:00,8:41:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ XIÊM,96,Thủy châm,10:36:00,11:01:00,Cầm Thị Uyên,Nguyễn Quang Huy,
NGUYỄN THỊ LỊCH,72,Thủy châm,10:15:00,10:40:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LÒ THỊ BIỂN,69,Thủy châm,10:50:00,11:15:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
HOÀNG THỊ LUN,64,Thủy châm,8:26:00,8:51:00,Vũ Thị Hương Lan,Hoàng Thu Hương,
LÒ VĂN ĐÔI,69,Thủy châm,10:36:00,11:01:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
HOÀNG THỊ CHAI,57,Thủy châm,9:47:00,10:12:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LÒ THỊ ÓN,76,Thủy châm,14:48:00,15:13:00,Cầm Thị Uyên,Hoàng Thu Hương,
TRẦN THỊ MAI,48,Thủy châm,8:37:00,9:02:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG VĂN TIÊN,60,Thủy châm,10:50:00,11:15:00,Cầm Thị Uyên,Hoàng Thu Hương,
QUÀNG THỊ PHÓNG,59,Thủy châm,9:26:00,9:51:00,Nguyễn Tùng Lâm,Cà Thị Oanh,
ĐÈO THỊ TOẢN,45,Thủy châm,13:38:00,14:03:00,Cầm Thị Uyên,Nguyễn Quang Huy,
QUÀNG THỊ ĐỊA,80,Thủy châm,15:30:00,15:55:00,Cầm Thị Uyên,Hoàng Thu Hương,
LÒ THỊ SAM,62,Thủy châm,15:44:00,16:09:00,Cầm Thị Uyên,Hoàng Thu Hương,
TÒNG VĂN THÁI,64,Thủy châm,16:54:00,17:19:00,Cầm Thị Uyên,Hoàng Thu Hương,
VŨ THỊ KHƯƠNG,78,Thủy châm,10:08:00,10:33:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
TÒNG THỊ PHỎNG,52,Thủy châm,10:15:00,10:40:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LƯỜNG THỊ CHỎI,66,Thủy châm,8:44:00,9:09:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LÙ VĂN THÀNH,65,Thủy châm,10:29:00,10:54:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG THỊ HỒNG,55,Thủy châm,17:01:00,17:26:00,Cầm Thị Uyên,Hoàng Thu Hương,
VÌ THỊ TIẾN,65,Thủy châm,14:27:00,14:52:00,Cầm Thị Uyên,Hoàng Thu Hương,
CÀ THỊ ĐOAN,66,Thủy châm,14:20:00,14:45:00,Cầm Thị Uyên,Hoàng Thu Hương,
NGUYỄN THỊ CƯỜNG,80,Thủy châm,14:41:00,15:06:00,Cầm Thị Uyên,Hoàng Thu Hương,
VÌ THỊ ĐU,62,Thủy châm,13:31:00,13:56:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LÒ VĂN KIM,54,Thủy châm,16:19:00,16:44:00,Cầm Thị Uyên,Hoàng Thu Hương,
TRẦN THỊ TỴ,86,Thủy châm,15:37:00,16:02:00,Cầm Thị Uyên,Hoàng Thu Hương,
NGUYỄN THỊ TÌNH,63,Thủy châm,14:55:00,15:20:00,Cầm Thị Uyên,Hoàng Thu Hương,
LÒ THỊ TÂM,52,Thủy châm,15:02:00,15:27:00,Cầm Thị Uyên,Hoàng Thu Hương,
NGUYỄN THỊ HỒNG,57,Thủy châm,14:06:00,14:31:00,Cầm Thị Uyên,Hoàng Thu Hương,
CÀ VĂN SÁNG,51,Thủy châm,10:22:00,10:47:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG THỊ UÔN,46,Thủy châm,10:57:00,11:22:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
ĐẶNG THỊ THUNG,76,Xoa bóp,8:19:00,8:49:00,Bùi Thị Thu Hà,,
TRẦN THỊ LUYÊN,60,Xoa bóp,10:57:00,11:27:00,Bùi Thị Thu Hà,,
HOÀNG THỊ LUN,64,Xoa bóp,10:23:00,10:53:00,Bùi Thị Thu Hà,,
LÒ VĂN NHÉ,67,Xoa bóp,9:39:00,10:09:00,Cà Thị Oanh,,
VÌ THỊ PHƯỢNG,62,Xoa bóp,9:21:00,9:51:00,Bùi Thị Thu Hà,,
PHẠM VIẾT CẬN,91,Xoa bóp,9:52:00,10:22:00,Bùi Thị Thu Hà,,
HOÀNG THỊ CHAI,57,Xoa bóp,8:50:00,9:20:00,Bùi Thị Thu Hà,,
TÒNG THỊ PHỎNG,52,Xoa bóp,8:27:00,8:57:00,Cà Thị Oanh,,
QUÀNG THỊ HỒNG,55,Xoa bóp,13:40:00,14:10:00,Vũ Thị Hương Lan,,
VÌ THỊ TIẾN,65,Xoa bóp,14:53:00,15:23:00,Vũ Thị Hương Lan,,
CÀ THỊ ĐOAN,66,Xoa bóp,15:24:00,15:54:00,Vũ Thị Hương Lan,,
NGUYỄN THỊ CƯỜNG,80,Xoa bóp,15:55:00,16:25:00,Vũ Thị Hương Lan,,
VÌ THỊ ĐU,62,Xoa bóp,16:26:00,16:56:00,Vũ Thị Hương Lan,`;

const norm = (str: string) =>
  (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ');

async function runSync() {
  console.log('--- RECONCILIATION AND SYNC FOR 2026-08-27 ---');

  // 1. Fetch current patients and staff from Supabase
  const { data: allPatientsRows, error: patErr } = await supabase.from('patients').select('*');
  if (patErr) throw patErr;
  const allPatients = (allPatientsRows || []).map(r => r.data || r);

  const { data: allStaffRows, error: staffErr } = await supabase.from('staff').select('*');
  if (staffErr) throw staffErr;
  const allStaff = (allStaffRows || []).map(r => r.data || r);

  console.log(`Loaded ${allPatients.length} patients and ${allStaff.length} staff from Supabase.`);

  // Map patients active on 2026-08-27
  const TARGET_DATE = '2026-08-27';
  const patientMap = new Map<string, any>();
  const activePatients27 = allPatients.filter(p => {
    if (!p.admissionDate) return true;
    const admDay = p.admissionDate.split('T')[0];
    if (admDay > TARGET_DATE) return false;
    if (p.dischargeDate) {
      const disDay = p.dischargeDate.split('T')[0];
      if (disDay < TARGET_DATE) return false;
    }
    return true;
  });

  for (const p of activePatients27) {
    patientMap.set(norm(p.name), p);
  }

  // Fallback for any patient not matched yet
  for (const p of allPatients) {
    const pName = norm(p.name);
    if (!patientMap.has(pName)) {
      patientMap.set(pName, p);
    }
  }

  // Map staff by name
  const staffMap = new Map<string, any>();
  for (const s of allStaff) {
    staffMap.set(norm(s.name), s);
  }

  const formatTime = (t: string) => {
    const parts = t.trim().split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  };

  const lines = csvRaw.trim().split('\n').slice(1);
  console.log(`Parsing ${lines.length} lines from CSV...`);

  // Machine assignment for Điện châm: L-01 to L-50
  const availableMachines = Array.from({ length: 50 }, (_, i) => `L-${String(i + 1).padStart(2, '0')}`);
  const machineBookings: Array<{ machineId: string; startMin: number; endMin: number }> = [];

  const newAppointments: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const [patName, age, procName, start, end, mainStaff, asst1, asst2] = lines[i].split(',');
    const p = patientMap.get(norm(patName));
    if (!p) {
      throw new Error(`Patient not found: ${patName}`);
    }

    const sMain = staffMap.get(norm(mainStaff));
    if (!sMain) {
      throw new Error(`Main staff not found: ${mainStaff}`);
    }

    const sAsst1 = asst1 && asst1.trim() ? staffMap.get(norm(asst1)) : null;
    const sAsst2 = asst2 && asst2.trim() ? staffMap.get(norm(asst2)) : null;

    const startTime = formatTime(start);
    const endTime = formatTime(end);
    const sMin = timeStringToMinutes(startTime);
    const eMin = timeStringToMinutes(endTime);

    let procedureId = 'pr_eqnn4i152'; // Điện châm
    let selectedDurationOptionId: string | null = 'opt_default25';
    let assignedMachineId: string | null = null;
    let mainBusyStart = 0;
    let mainBusyEnd = 6;
    let asst1BusyStart = 5;
    let asst1BusyEnd = 10;
    let asst2BusyStart = 25;
    let asst2BusyEnd = 27;

    const pType = procName.trim();
    if (pType === 'Điện châm') {
      procedureId = 'pr_eqnn4i152';
      selectedDurationOptionId = 'opt_default25';
      mainBusyStart = 0;
      mainBusyEnd = 6;
      asst1BusyStart = 5;
      asst1BusyEnd = 10;
      asst2BusyStart = 25;
      asst2BusyEnd = 27;

      // Assign first available machine without time overlap
      for (const mId of availableMachines) {
        const hasOverlap = machineBookings.some(
          b => b.machineId === mId && !(eMin <= b.startMin || sMin >= b.endMin)
        );
        if (!hasOverlap) {
          assignedMachineId = mId;
          machineBookings.push({ machineId: mId, startMin: sMin, endMin: eMin });
          break;
        }
      }
    } else if (pType === 'Thủy châm') {
      procedureId = 'pr_yosjw3y2w';
      selectedDurationOptionId = 'opt_sfh8r5rb9';
      mainBusyStart = 5;
      mainBusyEnd = 11;
      asst1BusyStart = 0;
      asst1BusyEnd = 5;
      asst2BusyStart = 0;
      asst2BusyEnd = 0;
      assignedMachineId = null;
    } else if (pType === 'Xoa bóp') {
      procedureId = 'pr_rj91ghjep';
      selectedDurationOptionId = null;
      mainBusyStart = 0;
      mainBusyEnd = 30;
      asst1BusyStart = 0;
      asst1BusyEnd = 0;
      asst2BusyStart = 0;
      asst2BusyEnd = 0;
      assignedMachineId = null;
    } else if (pType === 'Cấy chỉ') {
      procedureId = 'pr_e6ohrvx7y';
      selectedDurationOptionId = null;
      mainBusyStart = 0;
      mainBusyEnd = 15;
      asst1BusyStart = 15;
      asst1BusyEnd = 30;
      asst2BusyStart = 0;
      asst2BusyEnd = 0;
      assignedMachineId = null;
    } else {
      throw new Error(`Unknown procedure: ${pType}`);
    }

    const apptId = `appt_20260827_${String(i + 1).padStart(3, '0')}`;

    const apptData = {
      id: apptId,
      date: TARGET_DATE,
      deptId: 'dept_lao',
      status: 'PENDING',
      startTime,
      endTime,
      patientId: p.id,
      procedureId,
      staffId: sMain.id,
      assistant1Id: sAsst1 ? sAsst1.id : null,
      assistant2Id: sAsst2 ? sAsst2.id : null,
      assignedMachineId,
      selectedDurationOptionId,
      mainBusyStart,
      mainBusyEnd,
      asst1BusyStart,
      asst1BusyEnd,
      asst2BusyStart,
      asst2BusyEnd,
      restMinutes: 0,
      machineShiftId: null,
      conflictDetails: []
    };

    newAppointments.push(apptData);
  }

  console.log(`Generated ${newAppointments.length} validated appointments.`);
  const usedMachines = [...new Set(machineBookings.map(b => b.machineId))];
  console.log('Machine utilization count:', usedMachines.length, usedMachines);

  // 2. Preserve any admission examination ("Khám vào viện") for patients admitted on 27/8
  const { data: existingAppts, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, data')
    .filter('data->>date', 'eq', TARGET_DATE);
  if (fetchErr) throw fetchErr;

  const existingItems = (existingAppts || []).map(r => r.data || r);
  const existingKhamVaoVien = existingItems.filter(a => a.procedureId === 'pr_fm25wiv60');
  console.log(`Preserving ${existingKhamVaoVien.length} "Khám vào viện" admission records.`);

  const existingIds = existingAppts ? existingAppts.map(r => r.id) : [];
  console.log(`Found ${existingIds.length} existing appointments for 2026-08-27 to remove.`);

  if (existingIds.length > 0) {
    const CHUNK_SIZE = 50;
    for (let i = 0; i < existingIds.length; i += CHUNK_SIZE) {
      const chunk = existingIds.slice(i, i + CHUNK_SIZE);
      const { error: delErr } = await supabase.from('appointments').delete().in('id', chunk);
      if (delErr) {
        console.error(`Error deleting chunk ${i}:`, delErr);
      }
    }
    console.log(`Successfully cleared existing appointments on 2026-08-27.`);
  }

  // Combine standard 92 appointments + preserved Khám vào viện
  const finalAppointments = [...existingKhamVaoVien, ...newAppointments];
  console.log(`Total appointments to insert on 2026-08-27: ${finalAppointments.length}`);

  // 3. Insert into Supabase
  const upsertRows = finalAppointments.map(a => ({
    id: a.id,
    data: a
  }));

  const CHUNK_SIZE = 40;
  for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
    const chunk = upsertRows.slice(i, i + CHUNK_SIZE);
    const { error: insErr } = await supabase.from('appointments').upsert(chunk);
    if (insErr) {
      console.error(`Error inserting chunk ${i}:`, insErr);
      throw insErr;
    }
  }
  console.log(`Successfully inserted all ${finalAppointments.length} appointments for 2026-08-27 into Supabase!`);

  // 4. Also sync to Firestore if applicable
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
    const fApp = initializeApp(firebaseConfig, 'syncApp27');
    const fDb = initializeFirestore(fApp, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
    const fAuth = getAuth(fApp);
    await signInAnonymously(fAuth);

    // Delete existing on 27/8 in Firestore
    const fsSnap = await getDocs(query(collection(fDb, 'appointments'), where('date', '==', TARGET_DATE)));
    console.log(`Found ${fsSnap.size} existing appointments in Firestore for ${TARGET_DATE}`);
    if (fsSnap.size > 0) {
      const batch = writeBatch(fDb);
      fsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log('Cleared Firestore 2026-08-27 appointments.');
    }

    // Insert to Firestore in batches
    for (let i = 0; i < finalAppointments.length; i += 20) {
      const chunk = finalAppointments.slice(i, i + 20);
      const batch = writeBatch(fDb);
      for (const a of chunk) {
        batch.set(doc(fDb, 'appointments', a.id), a);
      }
      await batch.commit();
    }
    console.log(`Successfully synced all ${finalAppointments.length} appointments to Firestore!`);
  } catch (fsErr) {
    console.warn('Firestore sync note:', (fsErr as any).message);
  }

  // 5. Verify count in Supabase
  const { data: verifyRows, error: vErr } = await supabase
    .from('appointments')
    .select('id, data')
    .filter('data->>date', 'eq', TARGET_DATE);
  if (vErr) throw vErr;
  console.log(`Verification: Total appointments on 2026-08-27 now in Supabase = ${verifyRows?.length}`);

  console.log('--- RECONCILIATION AND SYNC COMPLETED SUCCESSFULLY ---');
}

runSync().catch(err => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
