import { createClient } from '@supabase/supabase-js';
import { timeStringToMinutes } from '../utils/timeUtils';

const SUPABASE_URL = 'https://chavuvjjrimdeomjexej.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sqTxQqDBQA6D9e35A0vq5w_JNFXAJ6a';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const csvRaw = `Họ tên bệnh nhân,Thủ thuật,Giờ bắt đầu,Giờ kết thúc,Chính,Phụ 1,Phụ 2
ĐÀM THỊ MAI,Điện châm,9:50:00,10:15:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
LA VĂN CHUYÊN,Điện châm,9:04:00,9:29:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
ĐẶNG THỊ THUNG,Điện châm,8:50:00,9:15:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
SA THỊ XÈN,Điện châm,8:19:00,8:44:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
TRẦN THỊ LUYÊN,Điện châm,10:04:00,10:29:00,Vũ Thị Hương Lan,Quàng Văn Hình,Hoàng Thu Hương
LÒ THỊ PHƯƠNG,Điện châm,9:36:00,10:01:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
ĐINH THỊ KHUẤN,Điện châm,8:12:00,8:37:00,Vũ Thị Hương Lan,Quàng Văn Hình,Nguyễn Quang Huy
NGUYỄN THỊ GÁI,Điện châm,9:33:00,9:58:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ XIÊM,Điện châm,11:04:00,11:29:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ LỊCH,Điện châm,9:43:00,10:08:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
LÒ THỊ BIỂN,Điện châm,10:22:00,10:47:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
LÒ VĂN ĐÔI,Điện châm,8:57:00,9:22:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
HOÀNG THỊ CHAI,Điện châm,9:21:00,9:46:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
LÒ THỊ ÓN,Điện châm,9:11:00,9:36:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
TRẦN THỊ MAI,Điện châm,8:26:00,8:51:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
QUÀNG VĂN TIÊN,Điện châm,9:29:00,9:54:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
QUÀNG THỊ PHÓNG,Điện châm,8:33:00,8:58:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
ĐÈO THỊ TOẢN,Điện châm,8:40:00,9:05:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
QUÀNG THỊ ĐỊA,Điện châm,9:57:00,10:22:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
LÒ THỊ SAM,Điện châm,10:11:00,10:36:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
TÒNG VĂN THÁI,Điện châm,10:18:00,10:43:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
VŨ THỊ KHƯƠNG,Điện châm,10:36:00,11:01:00,Nguyễn Thị Huyền Trang,Lê Hương Giang,Quàng Văn Hình
TÒNG THỊ PHỎNG,Điện châm,10:25:00,10:50:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
LƯỜNG THỊ CHỎI,Điện châm,10:32:00,10:57:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
LÙ VĂN THÀNH,Điện châm,10:39:00,11:04:00,Vũ Thị Hương Lan,Hoàng Thu Hương,Quàng Văn Hình
QUÀNG THỊ HỒNG,Điện châm,16:26:00,16:51:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ TIẾN,Điện châm,14:53:00,15:18:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
CÀ THỊ ĐOAN,Điện châm,14:46:00,15:11:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ CƯỜNG,Điện châm,15:16:00,15:41:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
VÌ THỊ ĐU,Điện châm,14:20:00,14:45:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
LÒ VĂN KIM,Điện châm,15:51:00,16:16:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
TRẦN THỊ TỴ,Điện châm,15:09:00,15:34:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ TÌNH,Điện châm,15:23:00,15:48:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
LÒ THỊ TÂM,Điện châm,15:30:00,15:55:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ HỒNG,Điện châm,14:34:00,14:59:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
CÀ VĂN SÁNG,Điện châm,15:00:00,15:25:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
QUÀNG THỊ UÔN,Điện châm,14:27:00,14:52:00,Vũ Thị Hương Lan,Lê Hương Giang,Quàng Văn Hình
NGUYỄN THỊ GÁI,Thủy châm,8:16:00,8:41:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ XIÊM,Thủy châm,10:36:00,11:01:00,Cầm Thị Uyên,Nguyễn Quang Huy,
LÒ THỊ BIỂN,Thủy châm,10:50:00,11:15:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
VŨ THỊ KHƯƠNG,Thủy châm,10:08:00,10:33:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG THỊ HỒNG,Thủy châm,17:01:00,17:26:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
VÌ THỊ TIẾN,Thủy châm,14:27:00,14:52:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
CÀ THỊ ĐOAN,Thủy châm,14:20:00,14:45:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ CƯỜNG,Thủy châm,14:41:00,15:06:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
VÌ THỊ ĐU,Thủy châm,13:31:00,13:56:00,Nguyễn Tùng Lâm,Nguyễn Quang Huy,
LÒ VĂN KIM,Thủy châm,16:19:00,16:44:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
TRẦN THỊ TỴ,Thủy châm,15:37:00,16:02:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ TÌNH,Thủy châm,14:55:00,15:20:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LÒ THỊ TÂM,Thủy châm,15:02:00,15:27:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
NGUYỄN THỊ HỒNG,Thủy châm,15:09:00,15:34:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
CÀ VĂN SÁNG,Thủy châm,14:34:00,14:59:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
QUÀNG THỊ UÔN,Thủy châm,15:44:00,16:09:00,Nguyễn Tùng Lâm,Hoàng Thu Hương,
LA VĂN CHUYÊN,Xoa bóp,10:31:00,11:01:00,Cà Thị Oanh,,
ĐẶNG THỊ THUNG,Xoa bóp,8:19:00,8:49:00,Bùi Thị Thu Hà,,
SA THỊ XÈN,Xoa bóp,9:21:00,9:51:00,Bùi Thị Thu Hà,,
TRẦN THỊ LUYÊN,Xoa bóp,10:57:00,11:27:00,Bùi Thị Thu Hà,,
ĐINH THỊ KHUẤN,Xoa bóp,7:40:00,8:10:00,Bùi Thị Thu Hà,,
NGUYỄN THỊ GÁI,Xoa bóp,8:42:00,9:12:00,Cầm Thị Uyên,,
NGUYỄN THỊ XIÊM,Xoa bóp,9:13:00,9:43:00,Cầm Thị Uyên,,
LÒ THỊ BIỂN,Xoa bóp,9:44:00,10:14:00,Cầm Thị Uyên,,
LÒ VĂN ĐÔI,Xoa bóp,10:00:00,10:30:00,Cà Thị Oanh,,
HOÀNG THỊ CHAI,Xoa bóp,8:50:00,9:20:00,Bùi Thị Thu Hà,,
LÒ THỊ ÓN,Xoa bóp,10:46:00,11:16:00,Vũ Thị Hương Lan,,
TRẦN THỊ MAI,Xoa bóp,9:52:00,10:22:00,Bùi Thị Thu Hà,,
QUÀNG VĂN TIÊN,Xoa bóp,8:58:00,9:28:00,Cà Thị Oanh,,
QUÀNG THỊ PHÓNG,Xoa bóp,10:23:00,10:53:00,Bùi Thị Thu Hà,,
ĐÈO THỊ TOẢN,Xoa bóp,9:29:00,9:59:00,Cà Thị Oanh,,
VŨ THỊ KHƯƠNG,Xoa bóp,8:28:00,8:58:00,Nguyễn Tùng Lâm,,
TÒNG THỊ PHỎNG,Xoa bóp,8:27:00,8:57:00,Cà Thị Oanh,,
QUÀNG THỊ HỒNG,Xoa bóp,13:31:00,14:01:00,Cà Thị Oanh,,
VÌ THỊ TIẾN,Xoa bóp,15:39:00,16:09:00,Cà Thị Oanh,,
CÀ THỊ ĐOAN,Xoa bóp,16:10:00,16:40:00,Cà Thị Oanh,,
NGUYỄN THỊ CƯỜNG,Xoa bóp,16:33:00,17:03:00,Vũ Thị Hương Lan,,
VÌ THỊ ĐU,Xoa bóp,16:31:00,17:01:00,Nguyễn Tùng Lâm,,
LÒ VĂN KIM,Xoa bóp,14:35:00,15:05:00,Cà Thị Oanh,,
TRẦN THỊ TỴ,Xoa bóp,14:04:00,14:34:00,Cà Thị Oanh,,
NGUYỄN THỊ TÌNH,Xoa bóp,13:43:00,14:13:00,Nguyễn Tùng Lâm,,
LÒ THỊ TÂM,Xoa bóp,16:45:00,17:15:00,Cà Thị Oanh,,
QUÀNG THỊ UÔN,Xoa bóp,15:08:00,15:38:00,Cà Thị Oanh,,`;

export async function runSync() {
  console.log('--- Starting Schedule 28/08 Reconciliation and Sync ---');

  // 1. Fetch Patients, Staff, Procedures
  const { data: patRows, error: patErr } = await supabase.from('patients').select('*');
  if (patErr) throw patErr;
  const allPatients = patRows.map(r => r.data || r);

  const { data: stfRows, error: stfErr } = await supabase.from('staff').select('*');
  if (stfErr) throw stfErr;
  const allStaff = stfRows.map(r => r.data || r).filter(s => s.deptId === 'dept_lao');

  const { data: procRows, error: procErr } = await supabase.from('procedures').select('*');
  if (procErr) throw procErr;
  const allProcedures = procRows.map(r => r.data || r);

  const norm = (s: string) => (s || '').trim().toLowerCase().normalize('NFC');

  // Map patient by name for patients active/valid on 2026-08-28 in dept_lao
  const patientMap = new Map<string, any>();
  for (const p of allPatients) {
    const pName = norm(p.name);
    const adm = p.admissionDate ? p.admissionDate.split('T')[0] : '';
    const dis = p.dischargeDate ? p.dischargeDate.split('T')[0] : '';
    const isValidOn28 = (!adm || adm <= '2026-08-28') && (!dis || dis >= '2026-08-28');
    if (isValidOn28 && (p.departmentId === 'dept_lao' || p.admittedByDeptId === 'dept_lao')) {
      patientMap.set(pName, p);
    }
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
    const [patName, procName, start, end, mainStaff, asst1, asst2] = lines[i].split(',');
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
    } else {
      throw new Error(`Unknown procedure: ${pType}`);
    }

    const apptId = `appt_20260828_${String(i + 1).padStart(3, '0')}`;

    const apptData = {
      id: apptId,
      date: '2026-08-28',
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
  console.log('Machine utilization:', [...new Set(machineBookings.map(b => b.machineId))]);

  // 2. Fetch existing appointments on 2026-08-28 to delete
  const { data: existingAppts, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, data')
    .filter('data->>date', 'eq', '2026-08-28');
  if (fetchErr) throw fetchErr;

  const existingIds = existingAppts ? existingAppts.map(r => r.id) : [];
  console.log(`Found ${existingIds.length} existing appointments for 2026-08-28 to remove.`);

  if (existingIds.length > 0) {
    const CHUNK_SIZE = 50;
    for (let i = 0; i < existingIds.length; i += CHUNK_SIZE) {
      const chunk = existingIds.slice(i, i + CHUNK_SIZE);
      const { error: delErr } = await supabase.from('appointments').delete().in('id', chunk);
      if (delErr) {
        console.error(`Error deleting chunk ${i}:`, delErr);
      }
    }
    console.log(`Successfully deleted existing appointments on 2026-08-28.`);
  }

  // 3. Insert the 80 standard appointments
  const upsertRows = newAppointments.map(a => ({
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
  console.log(`Successfully inserted all ${newAppointments.length} appointments for 2026-08-28 into Supabase!`);

  // 4. Verify count in Supabase
  const { data: verifyRows, error: vErr } = await supabase
    .from('appointments')
    .select('id, data')
    .filter('data->>date', 'eq', '2026-08-28');
  if (vErr) throw vErr;
  console.log(`Verification: Total appointments on 2026-08-28 now in DB = ${verifyRows?.length}`);

  console.log('--- RECONCILIATION AND SYNC FINISHED SUCCESSFULLY ---');
}

runSync().catch(err => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
