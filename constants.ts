
import { Staff, Patient, Procedure, Appointment, AppointmentStatus, Department, DepartmentType, AttendanceRecord, UserAccount, UserRole, PatientStatus } from './types';

export const BUSINESS_HOURS = {
  start: 7,
  end: 18,
};

// Giờ hành chính: 7:30 - 11:30 và 13:30 - 17:30
export const OFFICE_SHIFTS = [
  { start: '07:30', end: '11:30' },
  { start: '13:30', end: '17:30' }
];

export const DEPARTMENTS: Department[] = [
  { id: 'dept_noi', name: 'Khoa Nội', type: DepartmentType.CLINICAL },
  { id: 'dept_ngoai', name: 'Khoa Ngoại', type: DepartmentType.CLINICAL },
  { id: 'dept_lao', name: 'Khoa Lão', type: DepartmentType.CLINICAL },
  { id: 'dept_ungbuou', name: 'Khoa Ung Bướu', type: DepartmentType.CLINICAL },
  { id: 'dept_chamcuu', name: 'Khoa Châm Cứu', type: DepartmentType.CLINICAL },
  { id: 'dept_phcn', name: 'Phục hồi chức năng', type: DepartmentType.SUPPORT },
  { id: 'dept_xetnghiem', name: 'Xét nghiệm', type: DepartmentType.SUPPORT },
  { id: 'dept_cdha', name: 'Chẩn đoán hình ảnh', type: DepartmentType.SUPPORT },
  { id: 'dept_duoc', name: 'Khoa Dược', type: DepartmentType.SUPPORT },
];

export const DEFAULT_ADMIN: UserAccount = {
  id: 'u_admin',
  username: 'admin',
  password: 'Huyhuyhuy2@',
  fullName: 'Hệ thống Quản trị',
  role: UserRole.ADMIN,
  viewableDeptIds: DEPARTMENTS.map(d => d.id),
  editableDeptIds: DEPARTMENTS.map(d => d.id)
};

export const MOCK_PROCEDURES: Procedure[] = [
  { id: 'pr_kham', name: 'Khám bệnh', durationMinutes: 10, mainBusyStart: 0, mainBusyEnd: 10, isPreRequisite: true, deptId: 'dept_phcn' },
  { id: 'pr_diencham', name: 'Điện châm', durationMinutes: 30, mainBusyStart: 0, mainBusyEnd: 5, asst1BusyStart: 0, asst1BusyEnd: 5, asst2BusyStart: 0, asst2BusyEnd: 5, requireMachine: true, availableMachines: ['DC-01', 'DC-02', 'DC-03', 'DC-04', 'DC-05'], deptId: 'dept_phcn' },
  { id: 'pr_thuycham', name: 'Thủy châm', durationMinutes: 15, mainBusyStart: 0, mainBusyEnd: 5, asst1BusyStart: 0, asst1BusyEnd: 5, deptId: 'dept_phcn' },
  { id: 'pr_cuu', name: 'Cứu ngải', durationMinutes: 20, mainBusyStart: 0, mainBusyEnd: 5, deptId: 'dept_phcn' },
  { id: 'pr_hongngoai', name: 'Hồng ngoại', durationMinutes: 20, mainBusyStart: 0, mainBusyEnd: 5, requireMachine: true, availableMachines: ['HN-01', 'HN-02', 'HN-03'], deptId: 'dept_phcn' },
  { id: 'pr_dienxung', name: 'Điện xung', durationMinutes: 20, mainBusyStart: 0, mainBusyEnd: 5, requireMachine: true, availableMachines: ['DX-01', 'DX-02'], deptId: 'dept_phcn' },
  { id: 'pr_xoa_bop', name: 'Xoa bóp bấm huyệt', durationMinutes: 30, mainBusyStart: 0, mainBusyEnd: 30, deptId: 'dept_phcn' },
  { id: 'pr_keo_gian', name: 'Kéo giãn cột sống', durationMinutes: 20, mainBusyStart: 0, mainBusyEnd: 5, requireMachine: true, availableMachines: ['KG-01', 'KG-02'], deptId: 'dept_phcn' },
  { id: 'pr_sieu_am_tt', name: 'Siêu âm trị liệu', durationMinutes: 15, mainBusyStart: 0, mainBusyEnd: 15, requireMachine: true, availableMachines: ['SA-TT-01', 'SA-TT-02'], deptId: 'dept_phcn' },
  { id: 'pr_song_ngan', name: 'Sóng ngắn', durationMinutes: 20, mainBusyStart: 0, mainBusyEnd: 5, requireMachine: true, availableMachines: ['SN-01', 'SN-02'], deptId: 'dept_phcn' },
  { id: 'pr_tap_vd', name: 'Tập vận động', durationMinutes: 30, mainBusyStart: 0, mainBusyEnd: 30, deptId: 'dept_phcn' },
  { id: 'pr_paraffin', name: 'Paraffin', durationMinutes: 20, mainBusyStart: 0, mainBusyEnd: 5, deptId: 'dept_phcn' },
  { id: 'pr_laser', name: 'Laser trị liệu', durationMinutes: 15, mainBusyStart: 0, mainBusyEnd: 5, requireMachine: true, availableMachines: ['LS-01'], deptId: 'dept_phcn' },
  { id: 'pr4', name: 'Siêu âm', durationMinutes: 20, mainBusyStart: 0, mainBusyEnd: 20, requireMachine: true, availableMachines: ['SA-01', 'SA-02'], deptId: 'dept_cdha' },
  { id: 'pr5', name: 'Xét nghiệm máu', durationMinutes: 15, mainBusyStart: 0, mainBusyEnd: 15, deptId: 'dept_xetnghiem' },
  { id: 'pr6', name: 'Sắc thuốc', durationMinutes: 120, mainBusyStart: 0, mainBusyEnd: 0, isIndependent: true, deptId: 'dept_duoc' },
  
  // Các thủ thuật của Khoa Lão (dept_lao)
  { id: 'pr_lao_diencham', name: 'Điện châm', durationMinutes: 30, mainBusyStart: 0, mainBusyEnd: 6, asst1BusyStart: 0, asst1BusyEnd: 5, asst2BusyStart: 0, asst2BusyEnd: 5, requireMachine: true, availableMachines: ['DC-L01', 'DC-L02', 'DC-L03', 'DC-L04', 'DC-L05'], deptId: 'dept_lao' },
  { id: 'pr_lao_thuycham', name: 'Thủy châm', durationMinutes: 15, mainBusyStart: 5, mainBusyEnd: 11, asst1BusyStart: 0, asst1BusyEnd: 5, deptId: 'dept_lao' },
  { id: 'pr_lao_cuu', name: 'Cứu ngải', durationMinutes: 20, mainBusyStart: 0, mainBusyEnd: 5, deptId: 'dept_lao' },
  { id: 'pr_lao_xoa_bop', name: 'Xoa bóp bấm huyệt', durationMinutes: 30, mainBusyStart: 0, mainBusyEnd: 30, deptId: 'dept_lao' }
];

export const MOCK_STAFF: Staff[] = [];

export const MOCK_PATIENTS: Patient[] = [];

export const MOCK_TEMPLATES: any[] = [
  {
    id: 'tmpl_lao_01',
    name: 'Combo YHCT Khoa Lão (Điện châm + Thủy châm)',
    group: 'Khoa Lão/Y học cổ truyền',
    deptId: 'dept_lao',
    procedures: [
      { procedureId: 'pr_lao_diencham', startTime: '08:00', endTime: '08:30' },
      { procedureId: 'pr_lao_thuycham', startTime: '08:35', endTime: '08:50' }
    ]
  },
  {
    id: 'tmpl_phcn_01',
    name: 'Combo PHCN Cơ Bản',
    group: 'PHCN/Cơ bản',
    deptId: 'dept_phcn',
    procedures: [
      { procedureId: 'pr_kham', startTime: '08:00', endTime: '08:15' },
      { procedureId: 'pr1', startTime: '08:20', endTime: '08:50' },
      { procedureId: 'pr_hongngoai', startTime: '08:55', endTime: '09:15' }
    ]
  },
  {
    id: 'tmpl_phcn_02',
    name: 'Combo PHCN Chuyên Sâu',
    group: 'PHCN/Chuyên sâu',
    deptId: 'dept_phcn',
    procedures: [
      { procedureId: 'pr_kham', startTime: '08:00', endTime: '08:15' },
      { procedureId: 'pr2', startTime: '08:20', endTime: '09:05' },
      { procedureId: 'pr3', startTime: '09:10', endTime: '10:10' }
    ]
  },
  {
    id: 'tmpl_cdha_01',
    name: 'Siêu âm ổ bụng',
    group: 'CDHA/Siêu âm',
    deptId: 'dept_cdha',
    procedures: [
      { procedureId: 'pr4', startTime: '08:00', endTime: '08:20' }
    ]
  }
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_APPOINTMENTS: Appointment[] = [];
