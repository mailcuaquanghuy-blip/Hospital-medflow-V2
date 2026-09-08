import { Appointment, Patient, Procedure, Staff, ScheduleSnapshot } from '../types';

export interface DeviationItem {
  id: string;
  patientId: string;
  patientName: string;
  procedureName: string;
  type: 'NEW' | 'MODIFIED' | 'DELETED';
  changeDetails: string;
  currentAppt?: Appointment;
  originalAppt?: Appointment;
  date: string; // YYYY-MM-DD - Ngày của lịch trình
}

export const formatDateVi = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export const getBaselineAppointments = (
  deptId: string,
  date: string,
  currentAppointments: Appointment[],
  scheduleSnapshots?: ScheduleSnapshot[]
): {
  baselineAppts: Appointment[];
  isExplicitSnapshot: boolean;
  snapshotInfo?: ScheduleSnapshot;
} => {
  if (!deptId || !date) {
    return { baselineAppts: [], isExplicitSnapshot: false };
  }

  // 1. Kiểm tra phiên bản chốt mẫu chính thức từ cơ sở dữ liệu / state
  const explicit = (scheduleSnapshots || []).find(s => s.deptId === deptId && s.date === date);
  if (explicit && Array.isArray(explicit.appointments)) {
    return {
      baselineAppts: explicit.appointments,
      isExplicitSnapshot: true,
      snapshotInfo: explicit
    };
  }

  const currentDeptDateAppts = currentAppointments.filter(a => a.deptId === deptId && a.date === date);

  // 2. Kiểm tra mốc phiên làm việc đã lưu trong sessionStorage
  const sessionKey = `medflow_baseline_${deptId}_${date}`;
  if (typeof window !== 'undefined') {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Nếu parsed rỗng nhưng thực tế currentDeptDateAppts đang có lịch trình,
          // thì giá trị rỗng trước đó là do render ban đầu trước khi dữ liệu kịp tải.
          // Ta loại bỏ giá trị rỗng lỗi này và cập nhật lại mốc phiên chuẩn.
          if (parsed.length > 0 || currentDeptDateAppts.length === 0) {
            return {
              baselineAppts: parsed,
              isExplicitSnapshot: false
            };
          }
        }
      }
    } catch (e) {
      console.warn('Error reading session baseline:', e);
    }
  }

  // 3. Nếu chưa có mốc nào:
  // Nếu appointments đã tải dữ liệu xong (hoặc có dữ liệu trong hệ thống), thiết lập mốc ban đầu
  if (currentAppointments.length > 0) {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(currentDeptDateAppts));
      } catch (e) {
        console.warn('Error saving session baseline:', e);
      }
    }
    return {
      baselineAppts: currentDeptDateAppts,
      isExplicitSnapshot: false
    };
  }

  // Nếu dữ liệu appointments chưa kịp tải (mảng rỗng), không lưu mốc rỗng tạm thời vào sessionStorage
  return {
    baselineAppts: [],
    isExplicitSnapshot: false
  };
};

export const clearAllSessionBaselines = (deptId: string) => {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith(`medflow_baseline_${deptId}_`) || key.startsWith(`medflow_deleted_${deptId}_`))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch (e) {
    console.warn('Error clearing session baselines:', e);
  }
};

export const getAllBaselineAppointments = (
  deptId: string,
  currentAppointments: Appointment[],
  scheduleSnapshots?: ScheduleSnapshot[]
): {
  baselineAppts: Appointment[];
  isExplicitSnapshot: boolean;
  snapshotInfo?: ScheduleSnapshot;
} => {
  const deptSnapshots = (scheduleSnapshots || []).filter(s => s.deptId === deptId);
  const baselineApptsMap = new Map<string, Appointment>();
  let isExplicit = false;
  let latestSnapshot: ScheduleSnapshot | undefined;

  const currentDeptAppts = currentAppointments.filter(a => a.deptId === deptId);
  const activeDatesSet = new Set<string>();
  
  // Collect active dates: present in current appointments
  currentDeptAppts.forEach(a => activeDatesSet.add(a.date));

  // Collect active dates from explicit snapshots
  deptSnapshots.forEach(s => activeDatesSet.add(s.date));

  // Collect active dates from session modifications
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith(`medflow_baseline_${deptId}_`) || key.startsWith(`medflow_deleted_${deptId}_`))) {
          const dStr = key.replace(`medflow_baseline_${deptId}_`, '').replace(`medflow_deleted_${deptId}_`, '');
          if (dStr) activeDatesSet.add(dStr);
        }
      }
    } catch (e) {}
  }

  // 1. Get baseline snapshots for active dates
  deptSnapshots.forEach(s => {
    if (activeDatesSet.has(s.date)) {
      isExplicit = true;
      if (Array.isArray(s.appointments)) {
        s.appointments.forEach(a => baselineApptsMap.set(a.id, a));
      }
      if (!latestSnapshot || (s.createdAt && s.createdAt > (latestSnapshot.createdAt || ''))) {
        latestSnapshot = s;
      }
    }
  });

  // 2. For active dates without explicit snapshots, check session baseline
  activeDatesSet.forEach(dStr => {
    const hasExplicit = deptSnapshots.some(s => s.date === dStr);
    if (!hasExplicit && typeof window !== 'undefined') {
      const sessionKey = `medflow_baseline_${deptId}_${dStr}`;
      try {
        const saved = sessionStorage.getItem(sessionKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((a: Appointment) => {
              if (!baselineApptsMap.has(a.id)) {
                baselineApptsMap.set(a.id, a);
              }
            });
            return;
          }
        }
      } catch (e) {}

      const initialDateAppts = currentDeptAppts.filter(a => a.date === dStr);
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(initialDateAppts));
      } catch (e) {}
      initialDateAppts.forEach(a => baselineApptsMap.set(a.id, a));
    }
  });

  return {
    baselineAppts: Array.from(baselineApptsMap.values()),
    isExplicitSnapshot: isExplicit,
    snapshotInfo: latestSnapshot
  };
};

export const setSessionBaseline = (deptId: string, date: string, appts: Appointment[]) => {
  if (typeof window === 'undefined') return;
  const sessionKey = `medflow_baseline_${deptId}_${date}`;
  try {
    const deptAppts = appts.filter(a => a.deptId === deptId && a.date === date);
    sessionStorage.setItem(sessionKey, JSON.stringify(deptAppts));
  } catch (e) {
    console.warn('Error setting session baseline:', e);
  }
};

export const getDeletedSessionAppointments = (deptId: string, date: string): Appointment[] => {
  if (typeof window === 'undefined') return [];
  const sessionKey = `medflow_deleted_${deptId}_${date}`;
  try {
    const saved = sessionStorage.getItem(sessionKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading deleted session appointments:', e);
  }
  return [];
};

export const getAllDeletedSessionAppointments = (deptId: string): Appointment[] => {
  if (typeof window === 'undefined') return [];
  const result: Appointment[] = [];
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(`medflow_deleted_${deptId}_`)) {
        const saved = sessionStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            result.push(...parsed);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error reading all deleted session appointments:', e);
  }
  return result;
};

export const saveDeletedSessionAppointment = (appt: Appointment) => {
  if (typeof window === 'undefined' || !appt?.deptId || !appt?.date) return;
  const sessionKey = `medflow_deleted_${appt.deptId}_${appt.date}`;
  try {
    const existing = getDeletedSessionAppointments(appt.deptId, appt.date);
    const updated = [...existing.filter(a => a.id !== appt.id), appt];
    sessionStorage.setItem(sessionKey, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error saving deleted session appointment:', e);
  }
};

export const removeDeletedSessionAppointment = (deptId: string, date: string, apptId: string) => {
  if (typeof window === 'undefined') return;
  const sessionKey = `medflow_deleted_${deptId}_${date}`;
  try {
    const existing = getDeletedSessionAppointments(deptId, date);
    const updated = existing.filter(a => a.id !== apptId);
    sessionStorage.setItem(sessionKey, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error removing deleted session appointment:', e);
  }
};

export const clearDeletedSessionAppointments = (deptId: string, date: string) => {
  if (typeof window === 'undefined') return;
  const sessionKey = `medflow_deleted_${deptId}_${date}`;
  try {
    sessionStorage.removeItem(sessionKey);
  } catch (e) {
    console.warn('Error clearing deleted session appointments:', e);
  }
};

export const calculateDeviations = (
  currentDeptAppts: Appointment[],
  baselineAppts: Appointment[],
  patients: Patient[],
  procedures: Procedure[],
  staff: Staff[],
  deptId?: string,
  date?: string,
  isExplicitSnapshot: boolean = false
): DeviationItem[] => {
  const baselineMap = new Map<string, Appointment>();
  baselineAppts.forEach(a => baselineMap.set(a.id, a));

  const currentMap = new Map<string, Appointment>();
  currentDeptAppts.forEach(a => currentMap.set(a.id, a));

  const list: DeviationItem[] = [];

  // 1. Kiểm tra thêm mới hoặc sửa đổi
  currentDeptAppts.forEach(appt => {
    const patient = patients.find(p => p.id === appt.patientId);
    const patientName = patient?.name || 'Bệnh nhân không rõ';
    const proc = procedures.find(p => p.id === appt.procedureId);
    const procedureName = proc?.name || 'Lịch trình không rõ';

    const baseline = baselineMap.get(appt.id);
    if (!baseline) {
      list.push({
        id: appt.id,
        patientId: appt.patientId,
        patientName,
        procedureName,
        type: 'NEW',
        changeDetails: `Lịch trình mới được thêm/copy sang ngày ${formatDateVi(appt.date)}`,
        currentAppt: appt,
        date: appt.date
      });
    } else {
      const norm = (val: any) => (val === null || val === undefined) ? '' : String(val).trim();
      const diffs: string[] = [];

      if (norm(appt.date) !== norm(baseline.date)) {
        diffs.push(`Dời sang ngày ${formatDateVi(appt.date)} (từ ${formatDateVi(baseline.date)})`);
      }
      if (norm(appt.startTime) !== norm(baseline.startTime) || norm(appt.endTime) !== norm(baseline.endTime)) {
        diffs.push(`Dời giờ (${baseline.startTime} ➔ ${appt.startTime})`);
      }
      if (norm(appt.staffId) !== norm(baseline.staffId)) {
        const oldStaff = staff.find(s => s.id === baseline.staffId)?.name || 'Chưa phân công';
        const newStaff = staff.find(s => s.id === appt.staffId)?.name || 'Chưa phân công';
        diffs.push(`Đổi Bác sĩ chính (${oldStaff} ➔ ${newStaff})`);
      }
      if (norm(appt.assistant1Id) !== norm(baseline.assistant1Id)) {
        const oldAsst1 = staff.find(s => s.id === baseline.assistant1Id)?.name || 'Không có';
        const newAsst1 = staff.find(s => s.id === appt.assistant1Id)?.name || 'Không có';
        diffs.push(`Đổi Phụ 1 (${oldAsst1} ➔ ${newAsst1})`);
      }
      if (norm(appt.assistant2Id) !== norm(baseline.assistant2Id)) {
        const oldAsst2 = staff.find(s => s.id === baseline.assistant2Id)?.name || 'Không có';
        const newAsst2 = staff.find(s => s.id === appt.assistant2Id)?.name || 'Không có';
        diffs.push(`Đổi Phụ 2 (${oldAsst2} ➔ ${newAsst2})`);
      }
      if (norm(appt.assignedMachineId) !== norm(baseline.assignedMachineId)) {
        const oldMachine = baseline.assignedMachineId ? `Thiết bị ${baseline.assignedMachineId}` : 'Chưa phân ca';
        const newMachine = appt.assignedMachineId ? `Thiết bị ${appt.assignedMachineId}` : 'Chưa phân ca';
        diffs.push(`Thay đổi thiết bị/phòng (${oldMachine} ➔ ${newMachine})`);
      }
      if (norm(appt.procedureId) !== norm(baseline.procedureId)) {
        const oldP = procedures.find(p => p.id === baseline.procedureId)?.name || 'Lịch trình cũ';
        const newP = proc?.name || 'Lịch trình mới';
        diffs.push(`Đổi lịch trình (${oldP} ➔ ${newP})`);
      }

      if (diffs.length > 0) {
        list.push({
          id: appt.id,
          patientId: appt.patientId,
          patientName,
          procedureName,
          type: 'MODIFIED',
          changeDetails: diffs.join(', '),
          currentAppt: appt,
          originalAppt: baseline,
          date: appt.date
        });
      }
    }
  });

  // 2. Kiểm tra các lịch trình đã bị xóa từ mốc chốt baseline
  baselineAppts.forEach(baseline => {
    if (!currentMap.has(baseline.id)) {
      const patient = patients.find(p => p.id === baseline.patientId);
      const patientName = patient?.name || 'Bệnh nhân không rõ';
      const proc = procedures.find(p => p.id === baseline.procedureId);
      const procedureName = proc?.name || 'Lịch trình không rõ';

      list.push({
        id: baseline.id,
        patientId: baseline.patientId,
        patientName,
        procedureName,
        type: 'DELETED',
        changeDetails: `Đã xóa lịch trình ngày ${formatDateVi(baseline.date)} (${baseline.startTime} - BS: ${staff.find(s => s.id === baseline.staffId)?.name || 'Không rõ'})`,
        originalAppt: baseline,
        date: baseline.date
      });
    }
  });

  // 3. Kiểm tra các lịch trình xóa thêm trong phiên (chỉ áp dụng khi không có bản chốt chuẩn explicit snapshot)
  // Khi đã có bản chốt chuẩn (explicit snapshot), baselineAppts là nguồn chuẩn xác duy nhất
  if (!isExplicitSnapshot) {
    const targetDeptId = deptId || currentDeptAppts[0]?.deptId || baselineAppts[0]?.deptId;
    if (targetDeptId) {
      const deletedSession = date ? getDeletedSessionAppointments(targetDeptId, date) : getAllDeletedSessionAppointments(targetDeptId);
      deletedSession.forEach(delAppt => {
        if ((!date || delAppt.date === date) && !currentMap.has(delAppt.id) && !list.some(item => item.id === delAppt.id)) {
          const patient = patients.find(p => p.id === delAppt.patientId);
          const patientName = patient?.name || 'Bệnh nhân không rõ';
          const proc = procedures.find(p => p.id === delAppt.procedureId);
          const procedureName = proc?.name || 'Lịch trình không rõ';

          list.push({
            id: delAppt.id,
            patientId: delAppt.patientId,
            patientName,
            procedureName,
            type: 'DELETED',
            changeDetails: `Đã xóa lịch trình ngày ${formatDateVi(delAppt.date)} (${delAppt.startTime} - BS: ${staff.find(s => s.id === delAppt.staffId)?.name || 'Không rõ'})`,
            originalAppt: delAppt,
            date: delAppt.date
          });
        }
      });
    }
  }

  return list;
};

