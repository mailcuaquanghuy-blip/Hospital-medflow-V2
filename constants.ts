
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
  { id: 'pr_lao_diencham', name: 'Điện châm (Khoa Lão)', durationMinutes: 30, mainBusyStart: 0, mainBusyEnd: 6, asst1BusyStart: 0, asst1BusyEnd: 5, asst2BusyStart: 0, asst2BusyEnd: 5, requireMachine: true, availableMachines: ['DC-L01', 'DC-L02', 'DC-L03', 'DC-L04', 'DC-L05'], deptId: 'dept_lao' },
  { id: 'pr_lao_thuycham', name: 'Thủy châm (Khoa Lão)', durationMinutes: 15, mainBusyStart: 5, mainBusyEnd: 11, asst1BusyStart: 0, asst1BusyEnd: 5, deptId: 'dept_lao' },
  { id: 'pr_lao_cuu', name: 'Cứu ngải (Khoa Lão)', durationMinutes: 20, mainBusyStart: 0, mainBusyEnd: 5, deptId: 'dept_lao' },
  { id: 'pr_lao_xoa_bop', name: 'Xoa bóp bấm huyệt (Khoa Lão)', durationMinutes: 30, mainBusyStart: 0, mainBusyEnd: 30, deptId: 'dept_lao' }
];

export const MOCK_STAFF: Staff[] = [
  { id: 's_uyen', name: 'Cầm Thị Uyên', role: 'Technician', deptId: 'dept_phcn', capabilityIds: [], mainCapabilityIds: ['pr_kham', 'pr_diencham', 'pr_thuycham', 'pr_cuu', 'pr_hongngoai', 'pr_dienxung', 'pr_xoa_bop', 'pr_keo_gian', 'pr_sieu_am_tt', 'pr_song_ngan', 'pr_tap_vd', 'pr_paraffin', 'pr_laser'], assistantCapabilityIds: [] },
  { id: 's1', name: 'BS. Nguyễn Văn A', role: 'Doctor', deptId: 'dept_ngoai', capabilityIds: [], mainCapabilityIds: [], assistantCapabilityIds: [] },
  { id: 's2', name: 'BS. Trần Thị B', role: 'Doctor', deptId: 'dept_noi', capabilityIds: [], mainCapabilityIds: [], assistantCapabilityIds: [] },
  { id: 's3', name: 'KTV. Lê Văn C', role: 'Technician', deptId: 'dept_phcn', capabilityIds: [], mainCapabilityIds: ['pr_kham', 'pr_diencham', 'pr_thuycham', 'pr_cuu', 'pr_hongngoai', 'pr_dienxung', 'pr_xoa_bop', 'pr_keo_gian', 'pr_sieu_am_tt', 'pr_song_ngan', 'pr_tap_vd', 'pr_paraffin', 'pr_laser'], assistantCapabilityIds: [] },
  { id: 's4', name: 'BS. Phạm Văn D', role: 'Doctor', deptId: 'dept_cdha', capabilityIds: ['pr4'], mainCapabilityIds: ['pr4'], assistantCapabilityIds: ['pr4'] },
  { id: 's5', name: 'KTV. Hoàng Thị E', role: 'Technician', deptId: 'dept_xetnghiem', capabilityIds: ['pr5'], mainCapabilityIds: ['pr5'], assistantCapabilityIds: ['pr5'] },
  { id: 's6', name: 'DS. Trần Văn F', role: 'Technician', deptId: 'dept_duoc', capabilityIds: ['pr6'], mainCapabilityIds: ['pr6'], assistantCapabilityIds: ['pr6'] },
  { id: 's_lao1', name: 'BS. Phạm Hoàng Anh', role: 'Doctor', deptId: 'dept_lao', capabilityIds: [], mainCapabilityIds: ['pr_lao_diencham', 'pr_lao_thuycham', 'pr_lao_cuu', 'pr_lao_xoa_bop'], assistantCapabilityIds: [] },
  { id: 's_lao2', name: 'KTV. Vũ Thị Mai', role: 'Technician', deptId: 'dept_lao', capabilityIds: [], mainCapabilityIds: ['pr_lao_diencham', 'pr_lao_thuycham', 'pr_lao_cuu', 'pr_lao_xoa_bop'], assistantCapabilityIds: [] },
  { id: 's_lao3', name: 'BS. Nguyễn Tùng Lâm', role: 'Doctor', deptId: 'dept_lao', capabilityIds: [], mainCapabilityIds: ['pr_lao_diencham', 'pr_lao_thuycham', 'pr_lao_cuu', 'pr_lao_xoa_bop'], assistantCapabilityIds: [] },
  { id: 's_lao4', name: 'KTV. Hoàng Thu Hương', role: 'Technician', deptId: 'dept_lao', capabilityIds: [], mainCapabilityIds: ['pr_lao_diencham', 'pr_lao_thuycham', 'pr_lao_cuu', 'pr_lao_xoa_bop'], assistantCapabilityIds: [] },
  { id: 's_lao5', name: 'KTV. Cà Thị Oanh', role: 'Technician', deptId: 'dept_lao', capabilityIds: [], mainCapabilityIds: ['pr_lao_diencham', 'pr_lao_thuycham', 'pr_lao_cuu', 'pr_lao_xoa_bop'], assistantCapabilityIds: [] },
  { id: 's_lao6', name: 'KTV. Vũ Thúy Hà', role: 'Technician', deptId: 'dept_lao', capabilityIds: [], mainCapabilityIds: ['pr_lao_diencham', 'pr_lao_thuycham', 'pr_lao_cuu', 'pr_lao_xoa_bop'], assistantCapabilityIds: [] },
];

export const MOCK_PATIENTS: Patient[] = [
  // Khoa Lão (dept_lao)
  { id: 'p_lao1', name: 'Phan Thị Lộc', dob: '1952-03-15', gender: 'Nữ', code: 'BN-LAO-001', bedNumber: '420', roomNumber: 'P.402', admissionDate: '2024-02-01T08:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '100%' },
  { id: 'p_lao2', name: 'Quách Đình Thiều', dob: '1948-07-22', gender: 'Nam', code: 'BN-LAO-002', bedNumber: '409', roomNumber: 'P.401', admissionDate: '2024-02-02T08:30', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '100%' },
  { id: 'p_lao3', name: 'Vũ Thị Cúc', dob: '1950-11-05', gender: 'Nữ', code: 'BN-LAO-003', bedNumber: '410', roomNumber: 'P.401', admissionDate: '2024-02-03T09:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '95%' },
  { id: 'p_lao4', name: 'Lò Thị Nọi', dob: '1945-02-18', gender: 'Nữ', code: 'BN-LAO-004', bedNumber: '415', roomNumber: 'P.403', admissionDate: '2024-02-04T07:45', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '100%' },
  { id: 'p_lao5', name: 'Cà Thị Đôi', dob: '1955-09-30', gender: 'Nữ', code: 'BN-LAO-005', bedNumber: '416', roomNumber: 'P.403', admissionDate: '2024-02-05T08:15', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '80%' },
  { id: 'p_lao6', name: 'Cà Thị Ýnh', dob: '1951-04-12', gender: 'Nữ', code: 'BN-LAO-006', bedNumber: '421', roomNumber: 'P.402', admissionDate: '2024-02-06T10:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '100%' },
  { id: 'p_lao7', name: 'Quàng Thị Xum', dob: '1949-08-14', gender: 'Nữ', code: 'BN-LAO-007', bedNumber: '439', roomNumber: 'P.405', admissionDate: '2024-02-07T08:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '95%' },
  { id: 'p_lao8', name: 'Nguyễn Hữu Vệ', dob: '1946-12-01', gender: 'Nam', code: 'BN-LAO-008', bedNumber: '467', roomNumber: 'P.408', admissionDate: '2024-02-08T09:15', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '100%' },
  { id: 'p_lao9', name: 'Trương Thị Minh Thư', dob: '1953-06-25', gender: 'Nữ', code: 'BN-LAO-009', bedNumber: '452', roomNumber: 'P.406', admissionDate: '2024-02-09T08:45', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '80%' },
  { id: 'p_lao10', name: 'Đỗ Kim Bằng', dob: '1947-10-10', gender: 'Nam', code: 'BN-LAO-010', bedNumber: '453', roomNumber: 'P.406', admissionDate: '2024-02-10T10:30', status: PatientStatus.TREATING, admittedByDeptId: 'dept_lao', bedType: 'Nội trú', insuranceLevel: '100%' },

  // Khoa Ngoại (dept_ngoai)
  { id: 'p1', name: 'Nguyễn Thị Lan', dob: '1965-05-12', gender: 'Nữ', code: 'BN001', bedNumber: '101', roomNumber: 'P.101', admissionDate: '2024-02-01T08:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_ngoai', bedType: 'Nội trú', insuranceLevel: '80%' },
  { id: 'p_ngoai2', name: 'Hoàng Minh Tuấn', dob: '1985-09-18', gender: 'Nam', code: 'BN-NGOAI-002', bedNumber: '102', roomNumber: 'P.101', admissionDate: '2024-02-03T09:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_ngoai', bedType: 'Nội trú', insuranceLevel: '100%' },

  // Khoa Nội (dept_noi)
  { id: 'p2', name: 'Trần Văn Hùng', dob: '1978-08-20', gender: 'Nam', code: 'BN002', bedNumber: '205', roomNumber: 'P.202', admissionDate: '2024-02-05T09:30', status: PatientStatus.TREATING, admittedByDeptId: 'dept_noi', bedType: 'Nội trú', insuranceLevel: '80%' },
  { id: 'p_noi2', name: 'Phạm Thu Trang', dob: '1982-04-11', gender: 'Nữ', code: 'BN-NOI-002', bedNumber: '206', roomNumber: 'P.202', admissionDate: '2024-02-06T10:15', status: PatientStatus.TREATING, admittedByDeptId: 'dept_noi', bedType: 'Nội trú', insuranceLevel: '95%' },

  // PHCN (dept_phcn)
  { id: 'p_phcn1', name: 'Nguyễn Thị Mai', dob: '1968-01-15', gender: 'Nữ', code: 'BN-PHCN-001', bedNumber: '301', roomNumber: 'P.301', admissionDate: '2024-02-01T08:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_phcn', bedType: 'Nội trú', insuranceLevel: '100%' },
  { id: 'p_phcn2', name: 'Lê Hoài Nam', dob: '1972-06-20', gender: 'Nam', code: 'BN-PHCN-002', bedNumber: '302', roomNumber: 'P.301', admissionDate: '2024-02-02T09:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_phcn', bedType: 'Nội trú', insuranceLevel: '80%' },

  // Khoa Ung bướu (dept_ungbuou)
  { id: 'p_ub1', name: 'Đỗ Thị Hoa', dob: '1960-03-22', gender: 'Nữ', code: 'BN-UB-001', bedNumber: '501', roomNumber: 'P.501', admissionDate: '2024-02-01T08:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_ungbuou', bedType: 'Nội trú', insuranceLevel: '100%' },

  // Khoa Châm cứu (dept_chamcuu)
  { id: 'p_cc1', name: 'Vũ Văn Khiêm', dob: '1958-12-05', gender: 'Nam', code: 'BN-CC-001', bedNumber: '601', roomNumber: 'P.601', admissionDate: '2024-02-01T08:00', status: PatientStatus.TREATING, admittedByDeptId: 'dept_chamcuu', bedType: 'Nội trú', insuranceLevel: '100%' }
];

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
