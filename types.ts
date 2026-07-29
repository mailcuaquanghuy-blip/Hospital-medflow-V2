
export enum AppointmentStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CONFLICT = 'CONFLICT'
}

export enum DepartmentType {
  CLINICAL = 'CLINICAL', // Khoa lâm sàng - Có quyền thêm BN
  SUPPORT = 'SUPPORT'    // Cận lâm sàng/Chuyên khoa - Chỉ nhận BN
}

export type TimelineViewMode = 'STAFF' | 'PROCEDURE' | 'PATIENT' | 'GENERAL';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  OFF_FULL = 'OFF_FULL',
  OFF_MORNING = 'OFF_MORNING',
  OFF_AFTERNOON = 'OFF_AFTERNOON',
  DUTY = 'DUTY'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF'
}

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  viewableDeptIds: string[]; // Danh sách ID các khoa được phép xem
  editableDeptIds: string[]; // Danh sách ID các khoa được phép sửa dữ liệu
}

export interface Department {
  id: string;
  name: string;
  type: DepartmentType;
}

export interface Staff {
  id: string;
  name: string;
  role: 'Doctor' | 'Technician' | 'Nurse' | 'PhysicianAssistant' | 'Pharmacist';
  deptId: string;
  avatar?: string;
  capabilityIds: string[]; // Legacy field for backward compatibility if needed
  mainCapabilityIds: string[]; // Danh sách ID các thủ thuật có thể làm chính
  assistantCapabilityIds: string[]; // Danh sách ID các thủ thuật có thể làm phụ
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  date: string;
  status: AttendanceStatus;
}

export enum PatientStatus {
  TREATING = 'TREATING',
  DISCHARGED = 'DISCHARGED'
}
export type BedType = 'Nội trú' | 'Nội trú ban ngày' | 'Ngoại trú' | 'Khác';
export type InsuranceLevel = '0%' | '80%' | '95%' | '100%';

export interface PatientReferral {
  specialty: string;
  timestamp: string; // Giờ gửi
  fromDeptId: string;
  referralDate: string; // Ngày gửi
  status?: 'ACTIVE' | 'FINISHED';
  finishedDate?: string | null;
  finishedTime?: string | null;
  procedureIds?: string[]; // Các thủ thuật được khoa lâm sàng chỉ định
}

export interface Patient {
  id: string;
  name: string;
  dob: string; // ISO Date YYYY-MM-DD
  gender: 'Nam' | 'Nữ';
  code: string;
  bedNumber: string;
  roomNumber?: string | null; // Số buồng
  admissionDate: string; // ISO DateTime
  dischargeDate?: string | null; // ISO DateTime
  status: PatientStatus;
  admittedByDeptId: string; // Khoa lâm sàng tiếp nhận
  bedType?: BedType | null; 
  referrals?: PatientReferral[];
  insuranceLevel?: InsuranceLevel | null;
  note?: string | null;
}

export interface ProcedureDurationOption {
  id: string;
  name: string; // Tên cấu hình, ví dụ: "Điều trị chuẩn (20p)", "Điều trị kéo dài (30p)"
  durationMinutes: number;
  mainBusyStart?: number;
  mainBusyEnd?: number;
  asst1BusyStart?: number;
  asst1BusyEnd?: number;
  asst2BusyStart?: number;
  asst2BusyEnd?: number;
  restMinutes?: number;
  isDefault?: boolean;
}

export interface Procedure {
  id: string;
  name: string;
  durationMinutes: number;
  durationOptions?: ProcedureDurationOption[];
  // New flexible busy times
  mainBusyStart?: number; // offset from start
  mainBusyEnd?: number;   // offset from start
  asst1BusyStart?: number;
  asst1BusyEnd?: number;
  asst2BusyStart?: number;
  asst2BusyEnd?: number;
  
  // Deprecated but kept for compatibility during transition
  busyMinutes?: number; 
  assistant1BusyMinutes?: number; 
  assistant2BusyMinutes?: number; 
  
  restMinutes?: number; // Thời gian nghỉ sau thủ thuật
  deptId?: string; 
  requireMachine?: boolean;
  machineCapacity?: number; 
  availableMachines?: string[]; 
  isPreRequisite?: boolean; 
  isPostRequisite?: boolean;
  isIndependent?: boolean;
}

export interface ConflictDetail {
  message: string;
  level: 1 | 2 | 3;
}

export interface TemplateProcedure {
  procedureId: string;
  staffId?: string | null;
  assistant1Id?: string | null;
  assistant2Id?: string | null;
  startTime: string;
  endTime: string;
  notes?: string | null;
  assignedMachineId?: string | null;
  mainBusyStart?: number;
  mainBusyEnd?: number;
  asst1BusyStart?: number;
  asst1BusyEnd?: number;
  asst2BusyStart?: number;
  asst2BusyEnd?: number;
  restMinutes?: number;
}

export interface AppointmentTemplate {
  id: string;
  name: string;
  group?: string;
  deptId: string;
  procedures: TemplateProcedure[];
  isFolder?: boolean;
  order?: number;
}

export interface MachineShift {
  id: string;
  machineId: string;
  procedureId: string;
  deptId: string;
  date: string;
  startTime: string;
  endTime: string;
  staffId: string;
  assistant1Id?: string | null;
  assistant2Id?: string | null;
}

export interface Appointment {

  id: string;
  patientId: string;
  templateId?: string;
  staffId: string;
  assistant1Id?: string | null;
  assistant2Id?: string | null;
  procedureId: string;
  deptId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string | null;
  assignedMachineId?: string | null;
  machineShiftId?: string | null;
  overlapLevel?: number;
  conflictDetails?: ConflictDetail[]; // Chi tiết các lỗi xung đột

  // Custom busy times per appointment
  mainBusyStart?: number;
  mainBusyEnd?: number;
  asst1BusyStart?: number;
  asst1BusyEnd?: number;
  asst2BusyStart?: number;
  asst2BusyEnd?: number;
  restMinutes?: number;
  selectedDurationOptionId?: string | null;
}

export interface Backup {
  id: string;
  deptId: string;
  backupDate: string; // YYYY-MM-DD
  versionName: string; // e.g., "Backup_KHOA_PHCN_2026-03-27"
  createdAt: string; // ISO Timestamp
  snapshot: string; // JSON string of the data
  note?: string;
  createdBy: string; // User ID
}

