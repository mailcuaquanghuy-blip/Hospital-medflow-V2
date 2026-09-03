
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Patient, Appointment, Procedure, Staff, AppointmentStatus, Department, DepartmentType, UserAccount, UserRole, AttendanceRecord, ConflictDetail, AppointmentTemplate, TemplateProcedure, AttendanceStatus, MachineShift, ScheduleSnapshot } from '../types';
import { Button } from './Button';
import { Search, Plus, Calendar, Clock, User, FileText, Bed, Zap, Monitor, GripVertical, AlertTriangle, Cpu, Info, Copy, Building2, Filter, CheckCircle2, Trash2, Lock, Save, FolderOpen, X, ChevronDown, RefreshCw, Check, Link, AlertCircle, RotateCcw, Shield, ZoomIn, ZoomOut, History } from 'lucide-react';

import { calculateAge, timeStringToMinutes, minutesToPixels, minutesToTimeString, addMinutesToTime, isInsideOfficeHours, checkConflict, getRoleLabel, formatDate, getAbbreviation } from '../utils/timeUtils';
import { CopyRangeModal } from './CopyRangeModal';
import { BatchLoadModal, BatchLoadOptions } from './BatchLoadModal';
import { MachineShiftManager } from './MachineShiftManager';
import { TemplateManager } from './TemplateManager';
import { QuickScheduleModal } from './QuickScheduleModal';
import { DateInput } from './DateInput';
import { DEPARTMENTS, OFFICE_SHIFTS } from '../constants';
import { db } from '../firebase';
import { doc, collection } from 'firebase/firestore';
import { setDoc, deleteDoc } from '../utils/dbService';


const getLocalDateString = (isoStr: string | null | undefined): string => {
  if (!isoStr) return '';
  if (!isoStr.includes('T')) {
    return isoStr.split(' ')[0] || '';
  }
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) {
    return isoStr.split('T')[0] || '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type SortField = 'NAME' | 'ROOM_BED' | 'ADMISSION';
type SortDirection = 'ASC' | 'DESC';
interface SortConfig { field: SortField; direction: SortDirection }

interface PatientSchedulingProps {
  patients: Patient[];
  currentDept: Department;
  appointments: Appointment[];
  templates: AppointmentTemplate[];
  procedures: Procedure[];
  staff: Staff[];
  attendanceRecords: AttendanceRecord[];
  machineShifts: MachineShift[];
  currentDate: string;
  currentUser: UserAccount;
  onBookAppointment: (patientId: string, appointment?: Appointment) => void;
  onUpdateAppointment: (appointment: Appointment) => void;
  onDeleteAppointment: (apptId: string) => void;
  onCopyToDateRange: (patientId: string, sourceDate: string, startDate: string, endDate: string, selectedApptIds?: string[]) => void;
  onBatchLoadPreviousDay: (options: BatchLoadOptions) => void;
  onUndoBatchLoad: () => void;
  hasUndoData: boolean;
  onRecheckConflicts?: () => void;
  onAddShift: (shift: Omit<MachineShift, 'id'>) => void;
  onUpdateShift: (id: string, shift: Partial<MachineShift>, updateLinkedAppointments: boolean) => void;
  onDeleteShift: (id: string) => void;
  onCleanupShifts: () => void;
  onVerifyAction?: (patientId: string, action: () => void, description?: string) => void;
  scheduleSnapshots?: ScheduleSnapshot[];
  onSaveScheduleSnapshot?: (deptId: string, date: string) => void;
  onUndoAppointmentChange?: (apptId: string, type: 'NEW' | 'MODIFIED' | 'DELETED', originalAppt?: Appointment) => void;
}

const PIXELS_PER_MINUTE = 5.0; 
const START_HOUR = 0; 
const END_HOUR = 24;  

export const PatientScheduling: React.FC<PatientSchedulingProps> = ({
  patients,
  currentDept,
  appointments,
  templates,
  procedures,
  staff,
  attendanceRecords,
  machineShifts,
  currentDate,
  currentUser,
  onBookAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  onCopyToDateRange,
  onBatchLoadPreviousDay,
  onUndoBatchLoad,
  hasUndoData,
  onRecheckConflicts,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  onCleanupShifts,
  onVerifyAction,
  scheduleSnapshots = [],
  onSaveScheduleSnapshot,
  onUndoAppointmentChange
}) => {
  const [activeTab, setActiveTab] = useState<'SCHEDULING' | 'TEMPLATES'>('SCHEDULING');
  const [pixelsPerMinute, setPixelsPerMinute] = useState(6.5);
  const deptKey = currentDept?.id || 'default';

  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem(`medflow_sched_search_${deptKey}`) || '');
  const [referringDeptFilter, setReferringDeptFilter] = useState<string>(() => sessionStorage.getItem(`medflow_sched_refDept_${deptKey}`) || 'ALL');
  const [procedureFilter, setProcedureFilter] = useState<string>(() => sessionStorage.getItem(`medflow_sched_proc_${deptKey}`) || 'ALL');
  const [showNoProcedureOnly, setShowNoProcedureOnly] = useState<boolean>(() => sessionStorage.getItem(`medflow_sched_noProc_${deptKey}`) === 'true');
  const [staffFilter, setStaffFilter] = useState<string>(() => sessionStorage.getItem(`medflow_sched_staff_${deptKey}`) || 'ALL');
  const [bedTypeFilter, setBedTypeFilter] = useState<string>(() => sessionStorage.getItem(`medflow_sched_bedType_${deptKey}`) || 'ALL');
  const [showConflictedOnly, setShowConflictedOnly] = useState<boolean>(() => sessionStorage.getItem(`medflow_sched_conflict_${deptKey}`) === 'true');
  const [filterAdmissionDate, setFilterAdmissionDate] = useState<string>(() => sessionStorage.getItem(`medflow_sched_admDate_${deptKey}`) || '');
  const [showDischarged, setShowDischarged] = useState<string>(() => sessionStorage.getItem(`medflow_sched_discharged_${deptKey}`) || 'ALL');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([{ field: 'ADMISSION', direction: 'ASC' }]);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(() => sessionStorage.getItem(`medflow_sched_selPat_${deptKey}`) || null);

  useEffect(() => {
    sessionStorage.setItem(`medflow_sched_search_${deptKey}`, searchTerm);
    sessionStorage.setItem(`medflow_sched_refDept_${deptKey}`, referringDeptFilter);
    sessionStorage.setItem(`medflow_sched_proc_${deptKey}`, procedureFilter);
    sessionStorage.setItem(`medflow_sched_noProc_${deptKey}`, String(showNoProcedureOnly));
    sessionStorage.setItem(`medflow_sched_staff_${deptKey}`, staffFilter);
    sessionStorage.setItem(`medflow_sched_bedType_${deptKey}`, bedTypeFilter);
    sessionStorage.setItem(`medflow_sched_conflict_${deptKey}`, String(showConflictedOnly));
    sessionStorage.setItem(`medflow_sched_admDate_${deptKey}`, filterAdmissionDate);
    sessionStorage.setItem(`medflow_sched_discharged_${deptKey}`, showDischarged);
    if (selectedPatientId) {
      sessionStorage.setItem(`medflow_sched_selPat_${deptKey}`, selectedPatientId);
    }
  }, [
    deptKey, searchTerm, referringDeptFilter, procedureFilter, showNoProcedureOnly,
    staffFilter, bedTypeFilter, showConflictedOnly, filterAdmissionDate, showDischarged, selectedPatientId
  ]);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isBatchLoadModalOpen, setIsBatchLoadModalOpen] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isQuickScheduleModalOpen, setIsQuickScheduleModalOpen] = useState(false);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const deviations = useMemo(() => {
    const deptAppts = appointments.filter(a => a.deptId === currentDept.id && a.date === currentDate);
    const snapshot = (scheduleSnapshots || []).find(s => s.deptId === currentDept.id && s.date === currentDate);
    
    if (!snapshot) {
      return [];
    }
    
    const baselineAppts = snapshot.appointments || [];
    const baselineMap = new Map<string, Appointment>();
    baselineAppts.forEach(a => baselineMap.set(a.id, a));
    
    const currentMap = new Map<string, Appointment>();
    deptAppts.forEach(a => currentMap.set(a.id, a));
    
    const list: {
      id: string;
      patientId: string;
      patientName: string;
      procedureName: string;
      type: 'NEW' | 'MODIFIED' | 'DELETED';
      changeDetails: string;
      currentAppt?: Appointment;
      originalAppt?: Appointment;
    }[] = [];
    
    // Check for NEW or MODIFIED
    deptAppts.forEach(appt => {
      const patient = patients.find(p => p.id === appt.patientId);
      const patientName = patient?.name || 'Bệnh nhân không rõ';
      const proc = procedures.find(p => p.id === appt.procedureId);
      const procedureName = proc?.name || 'Thủ thuật không rõ';
      
      const baseline = baselineMap.get(appt.id);
      if (!baseline) {
        list.push({
          id: appt.id,
          patientId: appt.patientId,
          patientName,
          procedureName,
          type: 'NEW',
          changeDetails: 'Thủ thuật mới được thêm vào lịch trình',
          currentAppt: appt
        });
      } else {
        const norm = (val: any) => (val === null || val === undefined) ? '' : String(val).trim();
        const diffs: string[] = [];
        
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
        
        if (diffs.length > 0) {
          list.push({
            id: appt.id,
            patientId: appt.patientId,
            patientName,
            procedureName,
            type: 'MODIFIED',
            changeDetails: diffs.join(', '),
            currentAppt: appt,
            originalAppt: baseline
          });
        }
      }
    });
    
    // Check for DELETED
    baselineAppts.forEach(baseline => {
      if (!currentMap.has(baseline.id)) {
        const patient = patients.find(p => p.id === baseline.patientId);
        const patientName = patient?.name || 'Bệnh nhân không rõ';
        const proc = procedures.find(p => p.id === baseline.procedureId);
        const procedureName = proc?.name || 'Thủ thuật không rõ';
        
        list.push({
          id: baseline.id,
          patientId: baseline.patientId,
          patientName,
          procedureName,
          type: 'DELETED',
          changeDetails: `Đã xóa lịch trình (${baseline.startTime} - BS: ${staff.find(s => s.id === baseline.staffId)?.name || 'Không rõ'})`,
          originalAppt: baseline
        });
      }
    });
    
    return list;
  }, [appointments, scheduleSnapshots, currentDept.id, currentDate, patients, procedures, staff]);
  


  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateGroup, setTemplateGroup] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  
  const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [isTemplateSortDesc, setIsTemplateSortDesc] = useState(false);
  const [collapsedTemplateGroups, setCollapsedTemplateGroups] = useState<Record<string, boolean>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<AppointmentTemplate | null>(null);
  const [includeStaffInTemplate, setIncludeStaffInTemplate] = useState(true);
  const [loadMode, setLoadMode] = useState<'REPLACE' | 'APPEND'>('APPEND');

  const hasMachineProcedures = useMemo(() => {
    return procedures.some(p => p.deptId === currentDept.id && p.requireMachine && (p.machineCapacity || 1) > 1 && p.availableMachines && p.availableMachines.length > 0);
  }, [procedures, currentDept.id]);

  // Derived helper lists for actual existing day data filters (no virtual filter data)
  const activeApptsToday = useMemo(() => {
    return appointments.filter(a => a.date === currentDate);
  }, [appointments, currentDate]);

  const activeProcedures = useMemo(() => {
    const todayProcIds = new Set(activeApptsToday.map(a => a.procedureId));
    return procedures.filter(p => todayProcIds.has(p.id));
  }, [activeApptsToday, procedures]);

  const activeStaff = useMemo(() => {
    const todayStaffIds = new Set();
    activeApptsToday.forEach(a => {
      if (a.staffId) todayStaffIds.add(a.staffId);
      if (a.assistant1Id) todayStaffIds.add(a.assistant1Id);
      if (a.assistant2Id) todayStaffIds.add(a.assistant2Id);
    });
    return staff.filter(s => todayStaffIds.has(s.id));
  }, [activeApptsToday, staff]);

  const allDeptMachines = useMemo(() => {
    const machines = new Set<string>();
    procedures.filter(p => p.deptId === currentDept.id).forEach(p => {
      p.availableMachines?.forEach(m => machines.add(m));
    });
    return Array.from(machines).sort();
  }, [procedures, currentDept.id]);

  const existingFolders = useMemo(() => {
    const groups = new Set<string>();
    templates.filter(t => t.deptId === currentDept.id).forEach(t => {
      if (t.group) groups.add(t.group);
      if (t.isFolder) groups.add(t.name);
    });
    
    const allPaths = new Set<string>();
    groups.forEach(g => {
        const parts = g.split('/').filter(Boolean);
        let current = '';
        parts.forEach(p => {
            current = current ? `${current}/${p.trim()}` : p.trim();
            allPaths.add(current);
        });
    });
    
    return Array.from(allPaths).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [templates, currentDept.id]);


  useEffect(() => {
    if (selectedTemplateId) {
      const tpl = templates.find(t => t.id === selectedTemplateId);
      if (tpl) {
        setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
      }
    } else {
      setEditingTemplate(null);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!isLoadTemplateModalOpen) {
      setTemplateSearchQuery('');
    }
  }, [isLoadTemplateModalOpen]);

  const [dragState, setDragState] = useState<{
    id: string;
    startX: number;
    originalStartMin: number;
    currentStartMin: number;
    duration: number;
  } | null>(null);

  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const isSupportDept = currentDept.type === DepartmentType.SUPPORT;
  const clinicalDepartments = DEPARTMENTS.filter(d => d.type === DepartmentType.CLINICAL);
  
  const visiblePatients = useMemo(() => {
    const list = patients.filter(p => {
      // Bệnh nhân chưa vào viện vào thời điểm currentDate
      const admissionDateStr = getLocalDateString(p.admissionDate);
      if (currentDate < admissionDateStr) return false;

      // Logic lọc theo trạng thái điều trị (Tab Đang điều trị / Ra viện / Tất cả)
      const isDischarged = p.status === 'DISCHARGED';
      const dischargeDateStr = getLocalDateString(p.dischargeDate);

      // Loại bỏ hoàn toàn bệnh nhân đã ra viện từ ngày trước ngày hiện tại (currentDate)
      if (isDischarged && dischargeDateStr && dischargeDateStr < currentDate) {
        return false;
      }

      if (showDischarged === 'DISCHARGED') {
        // Tab "Ra viện": Chỉ giữ BN ra viện trong ngày hiện tại (currentDate)
        if (!isDischarged) return false;
        if (dischargeDateStr && dischargeDateStr !== currentDate) return false;
      } else if (showDischarged === 'TREATING') {
        // Tab "Đang điều trị": Loại bỏ nếu đã ra viện hôm nay hoặc quá khứ
        if (isDischarged && (!dischargeDateStr || dischargeDateStr <= currentDate)) return false;
      }

      if (currentDept.type === DepartmentType.CLINICAL) {
        return p.admittedByDeptId === currentDept.id;
      } else {
        // Logic chuyên khoa: Hiển thị nếu đã được referral HOẶC được admit trực tiếp
        if (p.admittedByDeptId === currentDept.id) return true;
        
        return p.referrals?.some(r => {
            const s = (r.specialty || '').toLowerCase().trim();
            const dId = currentDept.id.toLowerCase().trim();
            const dName = currentDept.name.toLowerCase().trim();
            
            // Unify matching logic
            const isMatch = s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                           (s.includes('phcn') && dId.includes('phcn')) ||
                           (s.includes('cdha') && dId.includes('cdha')) ||
                           (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                           (s.includes('duoc') && dId.includes('duoc')) ||
                           (dId === 'dept_phcn' && s === 'dept_phcn') ||
                           (dId === 'dept_cdha' && s === 'dept_cdha') ||
                           (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
                           
            if (!isMatch) return false;

            const refDate = r.referralDate || getLocalDateString(p.admissionDate);
            // patients referred on the same day OR in the past should be visible
            if (currentDate < refDate) return false;

            // Logic lọc theo trạng thái kết thúc tại chuyên khoa (Tab Đang điều trị / Ra viện)
            const isFinished = r.status === 'FINISHED';
            const finishedDateStr = r.finishedDate || '';

            // Loại bỏ hoàn toàn nếu đã hoàn thành chỉ định chuyên khoa từ các ngày trước
            if (isFinished && finishedDateStr && finishedDateStr < currentDate) {
              return false;
            }

            if (showDischarged === 'DISCHARGED') {
              // Tab "Ra viện": Chỉ giữ BN hoàn thành trong ngày làm việc hiện tại
              if (!isFinished) return false;
              if (finishedDateStr && finishedDateStr !== currentDate) return false;
            } else if (showDischarged === 'TREATING') {
              // Tab "Đang điều trị": Loại bỏ nếu đã hoàn thành hôm nay hoặc quá khứ
              if (isFinished && (!finishedDateStr || finishedDateStr <= currentDate)) return false;
            }

            return true;
        }) ?? false;
      }
    });

    return list;
  }, [patients, currentDept, currentDate, showDischarged]);

  const filteredPatients = visiblePatients.filter(p => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || 
                         (p.name || '').toLowerCase().includes(term) || 
                         (p.code || '').toLowerCase().includes(term) ||
                         (p.bedNumber || '').toLowerCase().includes(term) ||
                         (p.roomNumber && p.roomNumber.toLowerCase().includes(term));
    
    const matchesDept = referringDeptFilter === 'ALL' || p.admittedByDeptId === referringDeptFilter;
    const matchesAdmissionDate = !filterAdmissionDate || p.admissionDate.startsWith(filterAdmissionDate);
    
    const patientAppts = appointments.filter(a => a.patientId === p.id && a.date === currentDate);
    const matchesProcedure = procedureFilter === 'ALL' || patientAppts.some(a => a.procedureId === procedureFilter);
    const matchesNoProcedure = !showNoProcedureOnly || patientAppts.length === 0;
    const matchesStaff = staffFilter === 'ALL' || patientAppts.some(a => a.staffId === staffFilter || a.assistant1Id === staffFilter || a.assistant2Id === staffFilter);
    const matchesBedType = bedTypeFilter === 'ALL' || (p.bedType || 'Nội trú') === bedTypeFilter;
    
    const hasConflictAppt = patientAppts.some(a => {
        const conflicts = checkConflict(a.startTime, a.endTime, a.date, a.staffId, a.patientId, appointments, staff, procedures, attendanceRecords, patients, a.procedureId, a.id, a.assistant1Id, a.assistant2Id, a);
        return conflicts.hasConflict && conflicts.conflictDetails.some(c => c.level === 1);
    });
    const matchesConflict = !showConflictedOnly || hasConflictAppt;
    
    // Fix: Discharged patients should be visible if showDischarged is true, even if they are "scheduled"
    const isDischarged = p.status === 'DISCHARGED';
    
    return matchesSearch && matchesDept && matchesAdmissionDate && matchesProcedure && matchesNoProcedure && matchesStaff && matchesBedType && matchesConflict;
  }).sort((a, b) => {
    // Prioritize patients admitted by current department
    const aIsCurrent = a.admittedByDeptId === currentDept.id;
    const bIsCurrent = b.admittedByDeptId === currentDept.id;
    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return 1;

    for (const config of sortConfigs) {
      let cmp = 0;
      if (config.field === 'NAME') {
        const getFirstName = (fullName: string) => {
          const parts = fullName.trim().split(/\s+/);
          return parts.length > 0 ? parts[parts.length - 1] : fullName;
        };
        const firstNameA = getFirstName(a.name);
        const firstNameB = getFirstName(b.name);
        cmp = firstNameA.localeCompare(firstNameB, 'vi');
        if (cmp === 0) {
          cmp = a.name.localeCompare(b.name, 'vi');
        }
      } else if (config.field === 'ROOM_BED') {
        const roomA = a.roomNumber || '';
        const roomB = b.roomNumber || '';
        cmp = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp === 0) {
          cmp = (a.bedNumber || '').localeCompare(b.bedNumber || '', undefined, { numeric: true, sensitivity: 'base' });
        }
      } else if (config.field === 'ADMISSION') {
        cmp = new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime();
      }
      if (cmp !== 0) {
        return config.direction === 'ASC' ? cmp : -cmp;
      }
    }
    return 0;
  });

  const allDynamicConflicts = useMemo(() => {
    const conflicts = new Map<string, ConflictDetail[]>();
    appointments.forEach(a => {
      if (a.date === currentDate) {
        const res = checkConflict(
          a.startTime,
          a.endTime,
          a.date,
          a.staffId,
          a.patientId,
          appointments,
          staff,
          procedures,
          attendanceRecords,
          patients,
          a.procedureId,
          a.id,
          a.assistant1Id,
          a.assistant2Id,
          a
        );
        if (res.conflictDetails.length > 0) {
          conflicts.set(a.id, res.conflictDetails);
        }
      }
    });
    return conflicts;
  }, [appointments, currentDate, staff, procedures, attendanceRecords, patients]);

  const patientIdsWithIssues = useMemo(() => {
    const issuePatients = new Set<string>();
    appointments.forEach(a => {
      if (a.date === currentDate) {
        const startMin = timeStringToMinutes(a.startTime);
        const endMin = timeStringToMinutes(a.endTime);
        const hasConflict = allDynamicConflicts.has(a.id) && allDynamicConflicts.get(a.id)!.some(c => c.level === 1);
        const hasWarning = allDynamicConflicts.has(a.id) && allDynamicConflicts.get(a.id)!.some(c => c.level === 2);

        if (hasConflict || hasWarning) {
          issuePatients.add(a.patientId);
        }
      }
    });
    return issuePatients;
  }, [appointments, currentDate, staff, allDynamicConflicts]);

  const noProcedureCount = useMemo(() => {
    return visiblePatients.filter(p => !appointments.some(a => a.patientId === p.id && a.date === currentDate)).length;
  }, [visiblePatients, appointments, currentDate]);

  const issueCount = useMemo(() => {
    return visiblePatients.filter(p => patientIdsWithIssues.has(p.id)).length;
  }, [visiblePatients, patientIdsWithIssues]);

  const getPatientAppointmentsForDate = (patientId: string) => {
    return appointments
      .filter(a => a.patientId === patientId && a.date === currentDate)
      .sort((a, b) => {
        const aIsCurrent = a.deptId === currentDept.id;
        const bIsCurrent = b.deptId === currentDept.id;
        
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;
        
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const patientAppointments = selectedPatient ? getPatientAppointmentsForDate(selectedPatient.id) : [];

  const patientTimeRange = useMemo(() => {
    return { start: START_HOUR, end: END_HOUR };
  }, []);

  const patientAppointmentsWithRow = useMemo(() => {
    const sorted = [...patientAppointments].sort((a, b) => {
      return timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime);
    });
    return sorted.map((appt, rowIndex) => {
      return { ...appt, rowIndex };
    });
  }, [patientAppointments]);

  // Track earliest appointment start time to trigger automatic scrolling on changes
  const earliestApptStartTime = useMemo(() => {
    if (patientAppointments.length === 0) return '';
    const earliest = patientAppointments.reduce((earliest, current) => {
      return timeStringToMinutes(current.startTime) < timeStringToMinutes(earliest.startTime) ? current : earliest;
    });
    return earliest.startTime;
  }, [patientAppointments]);

  useEffect(() => {
    if (selectedPatientId && timelineContainerRef.current) {
      if (patientAppointments.length > 0) {
        // Find the earliest appointment
        const earliestAppt = patientAppointments.reduce((earliest, current) => {
          return timeStringToMinutes(current.startTime) < timeStringToMinutes(earliest.startTime) ? current : earliest;
        });
        
        const startMin = timeStringToMinutes(earliestAppt.startTime);
        const leftPosition = (startMin - patientTimeRange.start * 60) * pixelsPerMinute;
        
        // Scroll to the position with a slight offset padding (e.g., 100px) so it's not cut off on the left
        timelineContainerRef.current.scrollTo({
          left: Math.max(0, leftPosition - 100),
          behavior: 'smooth'
        });
      } else {
        // If no appointments, scroll to 8:00 AM (8 * 60 = 480 mins)
        const leftPosition = (8 * 60) * pixelsPerMinute;
        timelineContainerRef.current.scrollTo({
          left: Math.max(0, leftPosition - 100),
          behavior: 'smooth'
        });
      }
    }
  }, [selectedPatientId, currentDate, earliestApptStartTime, patientTimeRange.start, pixelsPerMinute]);

  const templateDifferences = useMemo(() => {
    const differences: { templateId: string; templateName: string, appointments: Appointment[], mismatch: boolean }[] = [];
    const groupedByTemplate = new Map<string, Appointment[]>();
    for (const appt of patientAppointments) {
         if (appt.templateId && appt.deptId === currentDept.id) {
             if (!groupedByTemplate.has(appt.templateId)) groupedByTemplate.set(appt.templateId, []);
             groupedByTemplate.get(appt.templateId)!.push(appt);
         }
    }
    groupedByTemplate.forEach((appts, tid) => {
         const tmpl = templates.find(t => t.id === tid);
         if (!tmpl) return;
         
         const sortedAppts = [...appts].sort((a,b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));
         const sortedTmplProcs = [...(tmpl.procedures || [])].sort((a,b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));
         
         let isMismatch = false;
         if (sortedAppts.length !== sortedTmplProcs.length) {
            isMismatch = true;
         } else {
             for (let i = 0; i < sortedAppts.length; i++) {
                 const a = sortedAppts[i];
                 const t = sortedTmplProcs[i];
                 if (a.procedureId !== t.procedureId || a.startTime !== t.startTime || a.endTime !== t.endTime) {
                     isMismatch = true;
                     break;
                 }
                 if (t.staffId && t.staffId !== a.staffId) { isMismatch = true; break; }
                 if (t.assistant1Id && t.assistant1Id !== a.assistant1Id) { isMismatch = true; break; }
                 if (t.assistant2Id && t.assistant2Id !== a.assistant2Id) { isMismatch = true; break; }
                 if (t.assignedMachineId && t.assignedMachineId !== a.assignedMachineId) { isMismatch = true; break; }
             }
         }
         
         if (isMismatch) {
             differences.push({ templateId: tid, templateName: tmpl.name, appointments: sortedAppts, mismatch: true });
         }
    });
    return differences;
  }, [patientAppointments, templates, currentDept.id]);

  // Kiểm tra xem bệnh nhân đã kết thúc khám tại chuyên khoa này chưa
  const isReferralFinished = useMemo(() => {
    if (!selectedPatient || !isSupportDept) return false;
    const ref = selectedPatient.referrals?.find(r => {
      const s = (r.specialty || '').toLowerCase();
      const dId = currentDept.id.toLowerCase();
      const dName = currentDept.name.toLowerCase();
      return s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
             (s.includes('phcn') && dId.includes('phcn')) ||
             (s.includes('cdha') && dId.includes('cdha')) ||
             (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
             (s.includes('duoc') && dId.includes('duoc')) ||
             (dId === 'dept_phcn' && s === 'dept_phcn') ||
             (dId === 'dept_cdha' && s === 'dept_cdha') ||
             (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
    });
    return ref?.status === 'FINISHED' && ref.finishedDate && currentDate >= ref.finishedDate;
  }, [selectedPatient, currentDept, currentDate, isSupportDept]);

  const handleSaveTemplate = async () => {
    if (!selectedPatientId || !templateName.trim() || !db) return;
    
    const finalGroup = templateGroup === 'NEW' ? newGroupName.trim() : templateGroup;
    
    const patientAppointments = appointments.filter(
      a => a.patientId === selectedPatientId && a.date === currentDate && a.deptId === currentDept.id
    );
    
    if (patientAppointments.length === 0) {
      alert('Bệnh nhân chưa có thủ thuật nào trong ngày này để lưu mẫu.');
      return;
    }

    const templateProcedures: TemplateProcedure[] = patientAppointments.map(a => {
      const proc: any = {
        procedureId: a.procedureId,
        staffId: a.staffId || null,
        startTime: a.startTime,
        endTime: a.endTime,
      };
      if (a.assistant1Id !== undefined) proc.assistant1Id = a.assistant1Id;
      if (a.assistant2Id !== undefined) proc.assistant2Id = a.assistant2Id;
      if (a.notes !== undefined) proc.notes = a.notes;
      if (a.assignedMachineId !== undefined) proc.assignedMachineId = a.assignedMachineId;
      if (a.mainBusyStart !== undefined) proc.mainBusyStart = a.mainBusyStart;
      if (a.mainBusyEnd !== undefined) proc.mainBusyEnd = a.mainBusyEnd;
      if (a.asst1BusyStart !== undefined) proc.asst1BusyStart = a.asst1BusyStart;
      if (a.asst1BusyEnd !== undefined) proc.asst1BusyEnd = a.asst1BusyEnd;
      if (a.asst2BusyStart !== undefined) proc.asst2BusyStart = a.asst2BusyStart;
      if (a.asst2BusyEnd !== undefined) proc.asst2BusyEnd = a.asst2BusyEnd;
      if (a.restMinutes !== undefined) proc.restMinutes = a.restMinutes;
      return proc as TemplateProcedure;
    });

    const newTemplate: AppointmentTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: templateName.trim(),
      group: finalGroup || undefined,
      deptId: currentDept.id,
      procedures: templateProcedures
    };

    // Deep clean undefined values
    const cleanTemplate = JSON.parse(JSON.stringify(newTemplate));

    try {
      await setDoc(doc(db, "templates", cleanTemplate.id), cleanTemplate);
      setIsSaveTemplateModalOpen(false);
      setTemplateName('');
      setTemplateGroup('');
      setNewGroupName('');
      alert('Lưu mẫu thành công!');
    } catch (error) {
      console.error("Error saving template:", error);
      alert(`Có lỗi xảy ra khi lưu mẫu: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!db) return;
    
    // Check if any patient is using this template today
    const inUseByAppts = appointments.filter(a => a.date === currentDate && a.templateId === templateId);
    if (inUseByAppts.length > 0) {
      const patientNames = Array.from(new Set(inUseByAppts.map(a => patients.find(p => p.id === a.patientId)?.name))).filter(Boolean);
      alert(`Không thể xóa mẫu này vì đang có ${patientNames.length} bệnh nhân sử dụng hôm nay: ${patientNames.join(', ')}. Vui lòng gỡ mẫu khỏi lịch bệnh nhân trước khi xóa.`);
      return;
    }

    if (confirm('Bạn có chắc chắn muốn xóa mẫu này?')) {
      try {
        await deleteDoc(doc(db, "templates", templateId));
        if (selectedTemplateId === templateId) {
          setSelectedTemplateId(null);
        }
      } catch (error) {
        console.error("Error deleting template:", error);
      }
    }
  };

  /** Recursive component for nested template groups */
  const renderTemplateItems = (path: string, items: any[], level: number = 0) => {
    const groupName = path.split('/').pop()?.trim() || 'Khác';
    const isCollapsed = templateSearchQuery ? false : (collapsedTemplateGroups[path] || false);
    const indent = level * 10;

    return (
      <div key={path} className="space-y-1">
        <div 
          onClick={() => setCollapsedTemplateGroups(prev => ({ ...prev, [path]: !prev[path] }))}
          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-100/50 rounded-lg group/header transition-colors"
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          <FolderOpen size={16} className={`${isCollapsed ? 'text-slate-300' : 'text-blue-400'} transition-colors`} />
          <h4 className={`text-[11px] font-black uppercase tracking-wider ${isCollapsed ? 'text-slate-400' : 'text-slate-600'}`}>{groupName}</h4>
          <span className="text-[10px] text-slate-400 font-medium ml-auto bg-slate-100 px-1.5 py-0.5 rounded-full">
            {items.filter(i => !i.isGroup).length + items.filter(i => i.isGroup).length}
          </span>
        </div>

        {!isCollapsed && (
          <div className="space-y-1">
            {items.map((item) => {
              if (item.isGroup) {
                return renderTemplateItems(item.path, item.items, level + 1);
              }
              
              const template = item.template;
              const templateProcIds = (template.procedures || []).map((p: TemplateProcedure) => `${p.procedureId}_${p.startTime}_${p.endTime}`).sort();
              const templateKey = templateProcIds.join('|');
              const allApptsForTemplate = appointments.filter(a => a.date === currentDate && a.deptId === currentDept.id && a.templateId === template.id);
              
              const patientApptsMap = new Map<string, Appointment[]>();
              allApptsForTemplate.forEach(a => {
                if (!patientApptsMap.has(a.patientId)) patientApptsMap.set(a.patientId, []);
                patientApptsMap.get(a.patientId)!.push(a);
              });

              const usedPatients: {id: string, name: string, age: string | number, bed: string, isModified: boolean, appts: Appointment[]}[] = [];
              patientApptsMap.forEach((appts, pId) => {
                const p = patients.find(pat => pat.id === pId);
                if (p) {
                  const patientProcIds = appts.map(a => `${a.procedureId}_${a.startTime}_${a.endTime}`).sort();
                  const isModified = patientProcIds.join('|') !== templateKey;
                  usedPatients.push({ id: pId, name: p.name, age: calculateAge(p.dob), bed: p.bedNumber, isModified, appts });
                }
              });

              const hasModified = usedPatients.some(up => up.isModified);
              const isUsedGlobal = usedPatients.length > 0;
              const isUsedByCurrent = usedPatients.some(up => up.id === selectedPatientId && !up.isModified);
              const isModifiedByCurrent = usedPatients.some(up => up.id === selectedPatientId && up.isModified);

              return (
                <div 
                  key={template.id} 
                  className={`p-2.5 rounded-xl border transition-all space-y-2 cursor-pointer ${
                    selectedTemplateId === template.id 
                      ? 'bg-blue-50/50 border-blue-200' 
                      : (hasModified || isModifiedByCurrent)
                        ? 'bg-amber-50/50 border-amber-100 hover:bg-amber-50'
                        : isUsedGlobal
                          ? 'bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/50'
                          : 'bg-white border-slate-100 hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                  style={{ marginLeft: `${indent + 20}px` }}
                >
                  <div className="flex justify-between items-start group/item">
                    <div className="flex flex-col overflow-hidden max-w-[85%] gap-0.5">
                      <div className="flex items-center gap-2">
                        {isUsedByCurrent ? (
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        ) : isModifiedByCurrent ? (
                          <AlertCircle size={14} className="text-amber-500 shrink-0" />
                        ) : isUsedGlobal ? (
                          <CheckCircle2 size={14} className={`shrink-0 ${hasModified ? 'text-amber-400' : 'text-emerald-300'}`} />
                        ) : null}
                        <span className={`font-bold text-sm truncate ${
                          (isUsedByCurrent || (isUsedGlobal && !hasModified)) ? 'text-emerald-700' : hasModified ? 'text-amber-700' : 'text-slate-700'
                        }`}>
                          {template.name}
                        </span>
                      </div>
                      
                      {isUsedGlobal && (
                        <div className="ml-[22px] space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">BN Đang Sử Dụng:</p>
                          {usedPatients.map(up => (
                            <div key={up.id} className="flex flex-col gap-0.5">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-medium truncate ${up.isModified ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  • {up.name} ({up.age}t - G:{up.bed})
                                  {up.isModified && <span className="ml-1 text-[9px] italic font-black text-amber-500">(Sửa)</span>}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                      className="text-slate-300 hover:text-rose-500 transition-colors mt-0.5"
                      title="Xóa mẫu"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {selectedTemplateId === template.id && (
                    <div className="pt-2 border-t border-slate-100 flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const up = usedPatients.find(u => u.id === selectedPatientId);
                          if (up) handleSyncFromTemplate(template.id, up.appts);
                          else handleApplyTemplate();
                        }}
                        className="flex-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <RefreshCw size={10} /> Cập nhật BN
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const up = usedPatients.find(u => u.id === selectedPatientId);
                          if (up) handleSyncToTemplate(template.id, up.appts);
                          else {
                            const patAppts = appointments.filter(a => a.patientId === selectedPatientId && a.date === currentDate && a.deptId === currentDept.id);
                            if (patAppts.length > 0) handleSyncToTemplate(template.id, patAppts);
                          }
                        }}
                        className="flex-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black hover:bg-amber-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        disabled={!appointments.some(a => a.patientId === selectedPatientId && a.date === currentDate && a.deptId === currentDept.id)}
                      >
                        <Save size={10} /> Cập nhật mẫu
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const handleSaveTemplateData = async (template: AppointmentTemplate, silent?: boolean) => {
    if (!db) return;
    try {
      const cleanTemplate = JSON.parse(JSON.stringify(template, (key, value) => value === undefined ? null : value));
      await setDoc(doc(db, "templates", cleanTemplate.id), cleanTemplate);
      if (!silent) alert('Lưu mẫu thành công!');
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi lưu mẫu: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleSaveEditedTemplate = async () => {
    if (!editingTemplate || !db) return;
    try {
      const cleanTemplate = JSON.parse(JSON.stringify(editingTemplate));
      await setDoc(doc(db, "templates", cleanTemplate.id), cleanTemplate);
      alert('Đã lưu thay đổi mẫu!');
    } catch (error) {
      console.error("Error updating template:", error);
      alert(`Có lỗi xảy ra khi lưu mẫu: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedPatientId || !editingTemplate || !db) return;

    if (onVerifyAction) {
      onVerifyAction(selectedPatientId, executeApplyTemplate);
    } else {
      executeApplyTemplate();
    }
  };

  const executeApplyTemplate = async () => {
    try {
      // If REPLACE mode, delete existing appointments for this patient on this date in this dept
      if (loadMode === 'REPLACE') {
        const existingAppts = appointments.filter(
          a => a.patientId === selectedPatientId && a.date === currentDate && a.deptId === currentDept.id
        );
        await Promise.all(existingAppts.map(appt => deleteDoc(doc(db, "appointments", appt.id))));
      }

      const createPromises = (editingTemplate.procedures || []).map(async (tProc) => {
        let staffId: string | null = null;
        let assistant1Id: string | null = null;
        let assistant2Id: string | null = null;

        if (includeStaffInTemplate) {
          staffId = tProc.staffId || '';
          assistant1Id = tProc.assistant1Id || null;
          assistant2Id = tProc.assistant2Id || null;
        }

        const apptId = `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newAppt: Appointment = {
          id: apptId,
          patientId: selectedPatientId,
          templateId: editingTemplate.id,
          procedureId: tProc.procedureId,
          staffId: staffId || '',
          assistant1Id: assistant1Id || null,
          assistant2Id: assistant2Id || null,
          date: currentDate,
          startTime: tProc.startTime,
          endTime: tProc.endTime,
          deptId: currentDept.id,
          status: AppointmentStatus.PENDING,
          notes: tProc.notes,
          assignedMachineId: tProc.assignedMachineId,
          mainBusyStart: tProc.mainBusyStart,
          mainBusyEnd: tProc.mainBusyEnd,
          asst1BusyStart: tProc.asst1BusyStart,
          asst1BusyEnd: tProc.asst1BusyEnd,
          asst2BusyStart: tProc.asst2BusyStart,
          asst2BusyEnd: tProc.asst2BusyEnd,
          restMinutes: tProc.restMinutes
        };
        const cleanAppt = JSON.parse(JSON.stringify(newAppt, (key, value) => value === undefined ? null : value));
        await setDoc(doc(db, "appointments", apptId), cleanAppt);
      });

      await Promise.all(createPromises);
      
      setIsLoadTemplateModalOpen(false);
      setSelectedTemplateId(null);
      setEditingTemplate(null);
      onRecheckConflicts?.();
      alert('Đã tải mẫu thủ thuật thành công!');
    } catch (error) {
      console.error("Error applying template:", error);
      alert("Lỗi khi áp dụng mẫu thủ thuật.");
    }
  };

  const handleSyncFromTemplate = async (templateId: string, associatedAppts: Appointment[]) => {
    if (!db || !selectedPatientId) return;

    if (onVerifyAction) {
      onVerifyAction(selectedPatientId, () => executeSyncFromTemplate(templateId, associatedAppts));
    } else {
      executeSyncFromTemplate(templateId, associatedAppts);
    }
  };

  const executeSyncFromTemplate = async (templateId: string, associatedAppts: Appointment[]) => {
    try {
      const tmpl = templates.find(t => t.id === templateId);
      if (!tmpl) return;
      
      // Delete associated appointments in parallel
      await Promise.all(associatedAppts.map(appt => deleteDoc(doc(db, "appointments", appt.id))));

      // Re-create from template in parallel
      const createPromises = (tmpl.procedures || []).map(async (tProc) => {
        let staffId = tProc.staffId;
        let assistant1Id = tProc.assistant1Id;
        let assistant2Id = tProc.assistant2Id;

        const apptId = `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newAppt: Appointment = {
          id: apptId,
          patientId: selectedPatientId,
          templateId: tmpl.id,
          procedureId: tProc.procedureId,
          staffId: staffId || '',
          assistant1Id: assistant1Id || null,
          assistant2Id: assistant2Id || null,
          date: currentDate,
          startTime: tProc.startTime,
          endTime: tProc.endTime,
          deptId: currentDept.id,
          status: AppointmentStatus.PENDING,
          notes: tProc.notes,
          assignedMachineId: tProc.assignedMachineId,
          mainBusyStart: tProc.mainBusyStart,
          mainBusyEnd: tProc.mainBusyEnd,
          asst1BusyStart: tProc.asst1BusyStart,
          asst1BusyEnd: tProc.asst1BusyEnd,
          asst2BusyStart: tProc.asst2BusyStart,
          asst2BusyEnd: tProc.asst2BusyEnd,
          restMinutes: tProc.restMinutes
        };
        const cleanAppt = JSON.parse(JSON.stringify(newAppt, (key, value) => value === undefined ? null : value));
        await setDoc(doc(db, "appointments", apptId), cleanAppt);
      });

      await Promise.all(createPromises);
      alert('Đã cập nhật lại lịch bệnh nhân từ mẫu!');
    } catch (error) {
      console.error("Error syncing from template:", error);
      alert(`Có lỗi xảy ra: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleApplyTemplateToPatient = async (targetPatientId: string, templateId: string) => {
    if (!db) return;

    if (onVerifyAction) {
      onVerifyAction(targetPatientId, () => executeApplyTemplateToPatient(targetPatientId, templateId));
    } else {
      executeApplyTemplateToPatient(targetPatientId, templateId);
    }
  };

  const executeApplyTemplateToPatient = async (targetPatientId: string, templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    try {
      const createPromises = (template.procedures || []).map(async (tProc) => {
        const apptId = `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newAppt: Appointment = {
          id: apptId,
          patientId: targetPatientId,
          templateId: template.id,
          procedureId: tProc.procedureId,
          staffId: tProc.staffId || '',
          assistant1Id: tProc.assistant1Id || null,
          assistant2Id: tProc.assistant2Id || null,
          date: currentDate,
          startTime: tProc.startTime,
          endTime: tProc.endTime,
          deptId: currentDept.id,
          status: AppointmentStatus.PENDING,
          notes: tProc.notes,
          assignedMachineId: tProc.assignedMachineId,
          mainBusyStart: tProc.mainBusyStart,
          mainBusyEnd: tProc.mainBusyEnd,
          asst1BusyStart: tProc.asst1BusyStart,
          asst1BusyEnd: tProc.asst1BusyEnd,
          asst2BusyStart: tProc.asst2BusyStart,
          asst2BusyEnd: tProc.asst2BusyEnd,
          restMinutes: tProc.restMinutes
        };
        const cleanAppt = JSON.parse(JSON.stringify(newAppt, (key, value) => value === undefined ? null : value));
        await setDoc(doc(db, "appointments", apptId), cleanAppt);
      });

      await Promise.all(createPromises);
      
      onRecheckConflicts?.();
      const patient = patients.find(p => p.id === targetPatientId);
      alert(`Đã áp dụng mẫu "${template.name}" cho bệnh nhân ${patient?.name || 'này'} thành công!`);
    } catch (error) {
      console.error("Error applying template:", error);
      alert("Lỗi khi áp dụng mẫu thủ thuật.");
    }
  };



  const handleSyncToTemplate = async (templateId: string, sortedAppts: Appointment[]) => {
    if (!db) return;
    try {
      const tmpl = templates.find(t => t.id === templateId);
      if (!tmpl) return;

      const templateProcedures: TemplateProcedure[] = sortedAppts.map(a => {
        const proc: any = {
          procedureId: a.procedureId,
          staffId: a.staffId || null,
          startTime: a.startTime,
          endTime: a.endTime,
        };
        if (a.assistant1Id !== undefined) proc.assistant1Id = a.assistant1Id;
        if (a.assistant2Id !== undefined) proc.assistant2Id = a.assistant2Id;
        if (a.notes !== undefined) proc.notes = a.notes;
        if (a.assignedMachineId !== undefined) proc.assignedMachineId = a.assignedMachineId;
        if (a.mainBusyStart !== undefined) proc.mainBusyStart = a.mainBusyStart;
        if (a.mainBusyEnd !== undefined) proc.mainBusyEnd = a.mainBusyEnd;
        if (a.asst1BusyStart !== undefined) proc.asst1BusyStart = a.asst1BusyStart;
        if (a.asst1BusyEnd !== undefined) proc.asst1BusyEnd = a.asst1BusyEnd;
        if (a.asst2BusyStart !== undefined) proc.asst2BusyStart = a.asst2BusyStart;
        if (a.asst2BusyEnd !== undefined) proc.asst2BusyEnd = a.asst2BusyEnd;
        if (a.restMinutes !== undefined) proc.restMinutes = a.restMinutes;
        return proc as TemplateProcedure;
      });

      const updatedTemplate = {
        ...tmpl,
        procedures: templateProcedures
      };

      const cleanTemplate = JSON.parse(JSON.stringify(updatedTemplate, (key, value) => value === undefined ? null : value));
      await setDoc(doc(db, "templates", cleanTemplate.id), cleanTemplate);
      alert('Đã lưu các thay đổi vào mẫu!');
    } catch (error) {
       console.error("Error syncing to template:", error);
       alert(`Có lỗi xảy ra: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDragStart = (e: React.MouseEvent, appt: Appointment) => {
      if (appt.status === 'COMPLETED') return; 
      const isAuthorizedToEdit = appt.deptId === currentDept.id || currentUser.role === UserRole.ADMIN || (currentUser.editableDeptIds && currentUser.editableDeptIds.includes(appt.deptId));
      if (!isAuthorizedToEdit) return;
      e.preventDefault(); e.stopPropagation();
      const startMin = timeStringToMinutes(appt.startTime);
      const endMin = timeStringToMinutes(appt.endTime);
      setDragState({
          id: appt.id,
          startX: e.clientX,
          originalStartMin: startMin,
          currentStartMin: startMin,
          duration: endMin - startMin
      });
  };

  useEffect(() => {
      if (!dragState) return;
      const handleMouseMove = (e: MouseEvent) => {
          const deltaPixels = e.clientX - dragState.startX;
          const deltaMinutes = deltaPixels / pixelsPerMinute;
          let newStart = dragState.originalStartMin + deltaMinutes;
          const minTime = START_HOUR * 60;
          const maxTime = END_HOUR * 60 - dragState.duration;
          if (newStart < minTime) newStart = minTime;
          if (newStart > maxTime) newStart = maxTime;
          setDragState(prev => prev ? ({ ...prev, currentStartMin: newStart }) : null);
      };
      const handleMouseUp = (e: MouseEvent) => {
          if (dragState) {
              const deltaX = Math.abs(e.clientX - dragState.startX);
              // Chỉ cập nhật khi người dùng kéo thực sự (di chuyển chuột > 5px)
              if (deltaX > 5) {
                  const snappedStart = Math.round(dragState.currentStartMin / 5) * 5;
                  const newStartTime = minutesToTimeString(snappedStart);
                  const newEndTime = minutesToTimeString(snappedStart + dragState.duration);
                  const original = appointments.find(a => a.id === dragState.id);
                  if (original && original.startTime !== newStartTime) {
                      onUpdateAppointment({ ...original, startTime: newStartTime, endTime: newEndTime });
                  }
              }
          }
          setDragState(null);
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [dragState, appointments, onUpdateAppointment, pixelsPerMinute]);

  const renderTimeLabels = (start = START_HOUR, end = END_HOUR) => {
    const labels = [];
    for (let i = start; i <= end; i++) {
        const left = (i - start) * 60 * pixelsPerMinute;
        labels.push(<div key={i} className="absolute top-0 h-full flex items-center text-[11px] font-extrabold text-slate-500 pl-2 select-none border-l border-slate-200/80" style={{ left }}>{i}:00</div>);
    }
    return labels;
  };

  const getBarColor = (index: number, status: string, hasWarning: boolean, hasConflict: boolean, isIndependent: boolean = false, isCurrentDept: boolean = true) => {
      if (!isCurrentDept) return 'bg-slate-50 border-slate-250 text-slate-400 opacity-40 grayscale-[0.5]';
      const opacity = isIndependent ? 'opacity-60' : '';
      if (status === 'COMPLETED') return `bg-emerald-500 border-emerald-600 text-white font-extrabold shadow-sm shadow-emerald-100/50 ${opacity}`;
      if (hasConflict) return `bg-rose-500 border-rose-600 text-white animate-blink shadow-[0_0_15px_rgba(244,63,94,0.55)] font-extrabold ${isIndependent ? 'opacity-70' : ''}`;
      if (hasWarning) return `bg-amber-500 border-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.55)] font-extrabold ${opacity}`;
      const colors = [
        `bg-sky-50 border-sky-400/80 text-sky-950 font-extrabold shadow-sm shadow-sky-100/30 ${opacity}`, 
        `bg-amber-50 border-amber-400/80 text-amber-950 font-extrabold shadow-sm shadow-amber-100/30 ${opacity}`, 
        `bg-cyan-50 border-cyan-400/80 text-cyan-950 font-extrabold shadow-sm shadow-cyan-100/30 ${opacity}`
      ];
      return colors[index % colors.length];
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 gap-4">
      <div className="flex items-center gap-2.5 shrink-0">
        <button 
          onClick={() => setActiveTab('SCHEDULING')} 
          className={`px-6 py-2.5 rounded-2xl text-xs font-extrabold uppercase tracking-widest transition-all duration-300 ${activeTab === 'SCHEDULING' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 cursor-default' : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80 shadow-sm'}`}
        >
          Chỉ định & Lịch trình
        </button>
        <button 
          onClick={() => setActiveTab('TEMPLATES')} 
          className={`px-6 py-2.5 rounded-2xl text-xs font-extrabold uppercase tracking-widest transition-all duration-300 ${activeTab === 'TEMPLATES' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 cursor-default' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80 shadow-sm'}`}
        >
          Quản lý mẫu
        </button>

        {activeTab === 'SCHEDULING' && (
          <button 
            onClick={() => setIsQuickScheduleModalOpen(true)} 
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 rounded-2xl text-xs font-extrabold uppercase tracking-widest transition-all duration-300 shadow-sm"
            title="Tự động sắp xếp lịch thông minh cho khoa"
          >
            <Zap size={14} className="fill-violet-500 text-violet-500" />
            Sắp xếp lịch nhanh
          </button>
        )}

        {onRecheckConflicts && (
          <button 
            onClick={onRecheckConflicts} 
            className="flex items-center gap-2 px-6 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-2xl text-xs font-extrabold uppercase tracking-widest transition-all duration-300 shadow-sm"
            title="Kiểm tra lại toàn bộ xung đột lịch"
          >
            <AlertTriangle size={14} className="text-rose-500" />
            Kiểm tra lỗi
          </button>
        )}

        {/* Nút Lịch sử chỉnh sửa */}
        <button 
          onClick={() => setIsHistoryModalOpen(true)} 
          className="flex items-center gap-2 px-6 py-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-2xl text-xs font-extrabold uppercase tracking-widest transition-all duration-300 shadow-sm relative"
          title="Xem danh sách các thủ thuật biến động trong phiên hôm nay"
        >
          <History size={14} className="text-amber-600" />
          Lịch sử chỉnh sửa
          {deviations.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
              {deviations.length}
            </span>
          )}
        </button>

        {hasUndoData && (
          <button 
            onClick={onUndoBatchLoad} 
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border-2 border-rose-100 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm animate-in fade-in slide-in-from-right-2"
            title="Hoàn tác thao tác load hàng loạt vừa xong"
          >
            <RotateCcw size={14} />
            Hoàn tác Load
          </button>
        )}
      </div>

      {activeTab === 'SCHEDULING' && (
        <div className="flex flex-1 gap-6 overflow-hidden">
          <div className="w-[420px] flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
            <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3 shrink-0">
               <div className="flex items-center justify-between px-1">
                   <h3 className="font-black text-slate-800 text-[13.5px] uppercase tracking-widest flex items-center gap-2">
                      <User size={17} className="text-primary" /> Danh sách bệnh nhân ({filteredPatients.length})
                   </h3>
                   <div className="flex gap-1">

                   </div>
               </div>
            
               <div className="flex flex-col gap-2">
                  {/* Unified Search & Filter Bar */}
                  <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm focus-within:border-primary/50 transition-all relative">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={17} />
                      <input 
                        className="w-full pl-10 pr-3 py-2.5 bg-transparent outline-none text-[14.5px] font-bold text-slate-700 placeholder:text-slate-400" 
                        placeholder="Tìm tên, phòng, mã..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                      />
                    </div>
                    


                    <div className="relative">
                      <button 
                        onClick={() => { setIsSortMenuOpen(!isSortMenuOpen); setIsFilterMenuOpen(false); }} 
                        className={`p-2 rounded-xl transition-all flex items-center justify-center ${isSortMenuOpen || sortConfigs.length > 0 ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:bg-slate-50'}`}
                        title="Sắp xếp"
                      >
                        <ChevronDown size={19} className={isSortMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                      </button>

                      {isSortMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-[240px] bg-white rounded-2xl shadow-xl border border-slate-100 p-3.5 z-50 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">SẮP XẾP NHANH</span>
                            <button onClick={() => setIsSortMenuOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={14}/></button>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            {[
                              { id: 'ROOM_BED', label: 'Số phòng / Giường' },
                              { id: 'ADMISSION', label: 'Thời gian vào viện' },
                              { id: 'NAME', label: 'Họ và tên bệnh nhân' }
                            ].map(item => {
                              const activeConfig = sortConfigs.find(c => c.field === item.id);
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    if (activeConfig) {
                                      const newConfigs = sortConfigs.map(c => 
                                        c.field === item.id ? { ...c, direction: c.direction === 'ASC' ? 'DESC' : 'ASC' } : c
                                      );
                                      setSortConfigs(newConfigs as any);
                                    } else {
                                      setSortConfigs([{ field: item.id as any, direction: 'ASC' }]);
                                    }
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                                    activeConfig ? 'bg-primary/5 text-primary animate-in fade-in duration-200' : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>{item.label}</span>
                                  {activeConfig && (
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 px-1.5 py-0.5 rounded text-primary">
                                      {activeConfig.direction === 'ASC' ? 'Tăng ↗' : 'Giảm ↘'}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Filters: Admission Date & Bed Type */}
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm focus-within:border-primary/40 transition-all">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider shrink-0">Ngày vào:</span>
                      <div className="flex-1 min-w-0">
                        <DateInput 
                          className="w-full bg-transparent text-[13.5px] font-bold text-slate-700 outline-none p-0 border-none focus:ring-0 focus:outline-none"
                          value={filterAdmissionDate}
                          onChange={val => setFilterAdmissionDate(val)}
                        />
                      </div>
                      {filterAdmissionDate && (
                        <button 
                          onClick={() => setFilterAdmissionDate('')} 
                          className="text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                          title="Xóa lọc ngày vào"
                        >
                          <X size={14} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm focus-within:border-primary/40 transition-all relative">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider shrink-0">Giường:</span>
                      <div className="relative flex-1 min-w-0 flex items-center">
                        <select 
                          className="w-full bg-transparent text-[13.5px] font-bold text-slate-700 outline-none p-0 pr-4 border-none cursor-pointer appearance-none"
                          value={bedTypeFilter}
                          onChange={e => setBedTypeFilter(e.target.value)}
                        >
                          <option value="ALL">Tất cả loại giường</option>
                          <option value="Nội trú">Nội trú</option>
                          <option value="Nội trú ban ngày">NT ban ngày</option>
                          <option value="Ngoại trú">Ngoại trú</option>
                          <option value="Khác">Khác</option>
                        </select>
                        <ChevronDown size={13} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
               </div>

                  {/* Tab-like Toggle for Treatment Status */}
                  <div className="flex flex-col gap-2 px-1 py-1">
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                      <button 
                        onClick={() => setShowDischarged('ALL')}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${showDischarged === 'ALL' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Tất cả
                      </button>
                      <button 
                        onClick={() => setShowDischarged('TREATING')}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${showDischarged === 'TREATING' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Đang điều trị
                      </button>
                      <button 
                        onClick={() => setShowDischarged('DISCHARGED')}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${showDischarged === 'DISCHARGED' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Ra viện
                      </button>
                    </div>
                  </div>

                  {/* Quick Filters for Rapid Sorting and Toggling */}
                  <div className="flex gap-2 py-1.5 shrink-0 border-b border-slate-100 mb-1">
                    <button
                      onClick={() => {
                        setShowNoProcedureOnly(!showNoProcedureOnly);
                        setShowConflictedOnly(false);
                      }}
                      className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 ${
                        showNoProcedureOnly
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100'
                          : 'bg-indigo-50/50 text-indigo-600 border-indigo-100 hover:bg-indigo-50'
                      }`}
                    >
                      Chưa chỉ định ({noProcedureCount})
                    </button>
                    <button
                      onClick={() => {
                        setShowConflictedOnly(!showConflictedOnly);
                        setShowNoProcedureOnly(false);
                      }}
                      className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 ${
                        showConflictedOnly
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-100'
                          : 'bg-rose-50/50 text-rose-600 border-rose-100 hover:bg-rose-50'
                      }`}
                    >
                      Bị trùng/Lỗi ({issueCount})
                    </button>
                  </div>

                  {isSupportDept && (
                    <div className="relative group">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={12} />
                      <select 
                        className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-tight outline-none focus:border-primary/50 transition-all appearance-none shadow-sm"
                        value={referringDeptFilter}
                        onChange={e => setReferringDeptFilter(e.target.value)}
                      >
                        <option value="ALL">Tất cả khoa lâm sàng</option>
                        {clinicalDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                    </div>
                  )}
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 scrollbar-thin">
            {filteredPatients.map(p => {
                const hasIssue = patientIdsWithIssues.has(p.id);
                const isFinOnDate = p.referrals?.find(r => {
                  const s = (r.specialty || '').toLowerCase();
                  const dId = currentDept.id.toLowerCase();
                  const dName = currentDept.name.toLowerCase();
                  return s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                         (s.includes('phcn') && dId.includes('phcn')) ||
                         (s.includes('cdha') && dId.includes('cdha')) ||
                         (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                         (s.includes('duoc') && dId.includes('duoc')) ||
                         (dId === 'dept_phcn' && s === 'dept_phcn') ||
                         (dId === 'dept_cdha' && s === 'dept_cdha') ||
                         (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
                })?.status === 'FINISHED';
                
                return (
                  <button key={p.id} onClick={() => setSelectedPatientId(p.id)} className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 border ${selectedPatientId === p.id ? 'bg-sky-50/50 border-sky-400 shadow-sm shadow-sky-100/50' : 'border-slate-100 hover:bg-slate-50 hover:border-slate-200'} ${hasIssue && selectedPatientId !== p.id ? 'bg-rose-50/40 border-rose-200' : ''}`}>
                      <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                  {p.insuranceLevel && (
                                    <div className={`shrink-0 w-3 h-4 rounded-[2px] border shadow-sm ${
                                      p.insuranceLevel === '0%' ? 'bg-rose-500 border-rose-600' :
                                      p.insuranceLevel === '80%' ? 'bg-orange-500 border-orange-600' :
                                      p.insuranceLevel === '95%' ? 'bg-lime-400 border-lime-500' :
                                      'bg-emerald-500 border-emerald-600'
                                    }`} title={`BHYT: ${p.insuranceLevel}`} />
                                  )}
                                  <span className={`font-extrabold text-lg uppercase truncate tracking-tight transition-colors ${selectedPatientId === p.id ? 'text-sky-600' : 'text-slate-800'}`}>
                                      {p.name}
                                  </span>
                                  {p.note && (
                                    <div className="group/note relative">
                                      <Plus size={12} className="text-amber-500 bg-amber-50 rounded-full border border-amber-200 cursor-help" />
                                      <div className="absolute left-full ml-1 top-0 hidden group-hover/note:block z-[100] w-48 p-2 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl backdrop-blur-sm bg-opacity-90">
                                        {p.note}
                                      </div>
                                    </div>
                                  )}
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                                  <div className="flex items-center gap-1.5 text-sm text-slate-500 font-bold shrink-0">
                                      <span>{p.gender}</span>
                                      <span>•</span>
                                      <span>{calculateAge(p.dob)} tuổi</span>
                                  </div>
                                  <span className="text-[13px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap text-sky-700 bg-sky-50 border border-sky-100/80">G: {p.bedNumber || 'N/A'}</span>
                                  {p.bedType && (
                                    <span className={`text-[12px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                                      p.bedType === 'Nội trú ban ngày' 
                                        ? 'bg-amber-100 text-amber-800' 
                                        : p.bedType === 'Ngoại trú'
                                        ? 'bg-blue-100 text-blue-800'
                                        : p.bedType === 'Khác'
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {p.bedType}
                                    </span>
                                  )}
                                  {p.insuranceLevel && (
                                    <span className="text-[12px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200/50">
                                      BH: {p.insuranceLevel}
                                    </span>
                                  )}
                              </div>

                              <div className="flex flex-col gap-1">
                                  <div className="text-sm text-slate-600 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                                    <Clock size={14} className="text-slate-400" />
                                    <span>Vào: {new Date(p.admissionDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })}</span>
                                  </div>
                                  {p.dischargeDate && (
                                    <div className="text-sm text-rose-600 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                                      <Clock size={14} className="text-rose-400" />
                                      <span>Ra: {new Date(p.dischargeDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })}</span>
                                    </div>
                                  )}
                              </div>
                              
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {isFinOnDate && isSupportDept && (
                                  <div className="text-[11px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded-lg flex items-center gap-1">
                                    <CheckCircle2 size={13} /> Đã kết thúc
                                  </div>
                                )}
                                {p.status === 'DISCHARGED' && (
                                  <div className="text-[11px] font-black text-rose-600 uppercase tracking-widest bg-rose-50 px-2 py-0.5 border border-rose-100 rounded-lg">Đã ra viện</div>
                                )}
                              </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                              {hasIssue && <AlertTriangle size={19} className="text-rose-500 animate-blink shrink-0 mb-1" />}
                              <div className="grid grid-cols-3 gap-1">
                                  {appointments
                                      .filter(a => a.patientId === p.id && a.date === currentDate)
                                  .map(a => {
                                      const proc = procedures.find(pr => pr.id === a.procedureId);
                                      const procedureDeptId = proc?.deptId || a.deptId;
                                      const isCurrentDeptProc = procedureDeptId === currentDept.id;
                                      return (proc) ? (
                                          <div key={a.id} className={`p-1 rounded-lg shadow-sm border relative flex items-center justify-center ${isCurrentDeptProc ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-40 grayscale'}`} title={proc?.name || 'Thủ thuật đã xóa'}>
                                              <div className={`w-6 h-6 rounded flex items-center justify-center text-[12px] font-black ${isCurrentDeptProc ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>{getAbbreviation(proc?.name || '??')}</div>
                                              {a.machineShiftId && (
                                                  <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 shadow-[0_0_5px_rgba(59,130,246,0.5)] border border-white">
                                                      <Link size={8} strokeWidth={3} />
                                                  </div>
                                              )}
                                          </div>
                                      ) : null;
                                  })
                              }
                          </div>
                      </div>
                      </div>
                  </button>
                );
            })}
            {filteredPatients.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    Không có bệnh nhân
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
        {selectedPatient ? (
          <>
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-slate-50/30 shrink-0">
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Điều trị ngày {new Date(currentDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            {selectedPatient.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200/80 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                            <Bed size={13} className="text-sky-500 shrink-0" /> 
                            Giường: {selectedPatient.bedNumber} - Buồng: {selectedPatient.roomNumber || '?'}
                          </span>
                          
                          {selectedPatient.bedType && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-xl uppercase tracking-wider shadow-sm whitespace-nowrap border ${
                              selectedPatient.bedType === 'Nội trú ban ngày' 
                                ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                : selectedPatient.bedType === 'Ngoại trú'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : selectedPatient.bedType === 'Khác'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {selectedPatient.bedType}
                            </span>
                          )}

                          {selectedPatient.insuranceLevel && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-xl shadow-sm whitespace-nowrap border flex items-center gap-1.5 ${
                              selectedPatient.insuranceLevel === '0%' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              selectedPatient.insuranceLevel === '80%' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              selectedPatient.insuranceLevel === '95%' ? 'bg-lime-50 text-lime-700 border-lime-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              <Shield size={13} className={
                                selectedPatient.insuranceLevel === '0%' ? 'text-rose-500' :
                                selectedPatient.insuranceLevel === '80%' ? 'text-orange-500' :
                                selectedPatient.insuranceLevel === '95%' ? 'text-lime-500' :
                                'text-emerald-500'
                              } />
                              BHYT: {selectedPatient.insuranceLevel}
                            </span>
                          )}

                          {isReferralFinished && (
                            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl border border-emerald-200 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-sm">
                               <CheckCircle2 size={13} className="shrink-0 text-emerald-500" /> Đã hoàn thành khám chuyên khoa
                            </span>
                          )}
                        </div>
                    </div>
                    {selectedPatient.note && (
                      <div className="mt-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5 max-w-3xl shadow-sm">
                        <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Ghi chú lâm sàng / Chỉ định đặc biệt</span>
                          <p className="text-xs font-semibold text-slate-700 leading-relaxed">{selectedPatient.note}</p>
                        </div>
                      </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {isSupportDept && (
                      <Button onClick={() => onBookAppointment(selectedPatient.id)} disabled={isReferralFinished} className={isReferralFinished ? "" : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"}>
                        {isReferralFinished ? <Lock size={18} /> : <Plus size={18} />}
                        {isReferralFinished ? 'Đã khóa chỉ định' : 'Xếp lịch thủ thuật'}
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setIsCopyModalOpen(true)} className="bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100" disabled={isReferralFinished}>
                        <Copy size={18} /> Sao chép thủ thuật
                    </Button>

                    
                    <Button variant="secondary" onClick={() => setIsSaveTemplateModalOpen(true)} className="bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100" disabled={isReferralFinished || patientAppointments.length === 0}>
                        <Save size={18} /> Lưu thành mẫu
                    </Button>

                    {!isSupportDept && (
                      <div className="flex">
                        <Button onClick={() => onBookAppointment(selectedPatient.id)} className="rounded-r-none border-r border-white/20">
                            <Plus size={18} /> Thêm chỉ định
                        </Button>
                        <Button onClick={() => setIsLoadTemplateModalOpen(true)} className="rounded-l-none px-2" title="Tải mẫu thủ thuật">
                            <ChevronDown size={18} />
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded-xl border border-slate-200 text-slate-700 h-9 shrink-0 select-none transition-all">
                        <button 
                          onClick={() => setPixelsPerMinute(prev => Math.max(3.0, prev - 0.5))}
                          className="p-1 hover:bg-white rounded-lg transition-colors text-slate-600 cursor-pointer flex items-center justify-center"
                          title="Thu hẹp khung thời gian (Zoom out)"
                          id="zoom-out-btn"
                        >
                          <ZoomOut size={15} />
                        </button>
                        <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest px-1.5 whitespace-nowrap">Thời gian {Math.round(pixelsPerMinute * 16.67)}%</span>
                        <button 
                          onClick={() => setPixelsPerMinute(prev => Math.min(12.0, prev + 0.5))}
                          className="p-1 hover:bg-white rounded-lg transition-colors text-slate-600 cursor-pointer flex items-center justify-center"
                          title="Kéo rộng khung thời gian (Zoom in)"
                          id="zoom-in-btn"
                        >
                          <ZoomIn size={15} />
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/20">
                {/* Unified Timeline & Detail View */}
                <div className="flex-1 relative overflow-hidden flex flex-col">
                    <div ref={timelineContainerRef} className="flex-1 overflow-auto relative scrollbar-thin">
                        <div className="relative min-h-full" style={{ width: Math.max((patientTimeRange.end - patientTimeRange.start) * 60 * pixelsPerMinute + 80, 800) }}>
                            <div className="h-10 sticky top-0 bg-white/95 backdrop-blur z-30 border-b border-slate-200/80 shadow-sm">
                              {renderTimeLabels(patientTimeRange.start, patientTimeRange.end)}
                            </div>
                            
                            <div 
                                className="py-8 relative z-10 px-4" 
                                style={{ height: Math.max(480, (Math.max(-1, ...patientAppointmentsWithRow.map(a => a.rowIndex)) + 1) * 210 + 100) }}
                            >
                                {patientAppointmentsWithRow.map((appt, idx) => {
                                    const proc = procedures.find(pr => pr.id === appt.procedureId);
                                    const staffMember = staff.find(s => s.id === appt.staffId);
                                    const isDragging = dragState?.id === appt.id;
                                    const startMin = isDragging ? dragState.currentStartMin : timeStringToMinutes(appt.startTime);
                                    const endMin = isDragging ? (dragState.currentStartMin + dragState.duration) : timeStringToMinutes(appt.endTime);
                                    const duration = endMin - startMin;
                                    const left = (startMin - patientTimeRange.start * 60) * pixelsPerMinute;
                                    const durationWidth = duration * pixelsPerMinute;
                                    const cardWidth = 460;
                                    const cardHeight = 190;
                                    const containerWidth = Math.max(durationWidth, cardWidth);
                                    const dynamicConflictDetails = allDynamicConflicts.get(appt.id) || [];
                                    const hasConflict = dynamicConflictDetails.some(c => c.level === 1);
                                    const hasWarning = dynamicConflictDetails.some(c => c.level === 2);
                                    const restMinutes = proc?.restMinutes || 0;
                                    const restWidth = restMinutes * pixelsPerMinute;
                                    const top = appt.rowIndex * 210 + 20;
                                    const canEdit = appt.deptId === currentDept.id || currentUser.role === UserRole.ADMIN || (currentUser.editableDeptIds && currentUser.editableDeptIds.includes(appt.deptId));
                                    const isAuthorizedCard = appt.deptId === currentDept.id || canEdit;
                                    
                                    return (
                                        <div key={appt.id} className="absolute" style={{ top, left, width: containerWidth + restWidth, zIndex: isDragging ? 50 : 20 }}>
                                            <div 
                                                className={`rounded-2xl border-2 shadow-lg flex flex-col overflow-hidden transition-all bg-white ${isDragging ? 'cursor-grabbing scale-105 shadow-2xl ring-4 ring-primary/20' : 'cursor-pointer hover:shadow-xl hover:-translate-y-0.5'} ${hasConflict ? 'border-rose-500 ring-rose-500/10' : hasWarning ? 'border-amber-500 ring-amber-500/10' : (appt.deptId === currentDept.id ? 'border-sky-500 shadow-sky-100/50' : (isAuthorizedCard ? 'border-sky-300 opacity-95' : 'border-slate-200 opacity-40 grayscale blur-[0.7px] pointer-events-none'))}`} 
                                                style={{ width: cardWidth, height: cardHeight }} 
                                                onClick={() => !isReferralFinished && isAuthorizedCard && onBookAppointment(selectedPatient.id, appt)} 
                                                onMouseDown={(e) => !isReferralFinished && isAuthorizedCard && handleDragStart(e, appt)}
                                            >
                                                <div className={`px-3 py-1.5 flex items-center justify-between border-b ${getBarColor(idx, appt.status, hasWarning, hasConflict, proc?.isIndependent, appt.deptId === currentDept.id)}`}>
                                                   <div className="flex items-center gap-2 overflow-hidden mr-1">
                                                      <span className="font-black text-sm uppercase tracking-tighter shrink-0">{appt.startTime} - {appt.endTime}</span>
                                                      <div className="w-px h-3.5 bg-white/30" />
                                                      <span className="font-extrabold text-base truncate uppercase tracking-tight">{proc?.name || 'Thủ thuật đã xóa'}</span>
                                                   </div>
                                                   <div className="flex items-center gap-1 shrink-0">
                                                      {appt.status === 'COMPLETED' && <CheckCircle2 size={15} className="shrink-0 text-white" />}
                                                      {!isReferralFinished && canEdit && (
                                                         <button
                                                            id={`delete-btn-${appt.id}`}
                                                            onClick={(e) => {
                                                               e.stopPropagation();
                                                               if (window.confirm(`Bạn có chắc chắn muốn xóa thủ thuật "${proc?.name || 'không tên'}" này không?`)) {
                                                                  onDeleteAppointment(appt.id);
                                                               }
                                                            }}
                                                            onMouseDown={(e) => {
                                                               e.stopPropagation();
                                                            }}
                                                            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-black/15 transition-all cursor-pointer"
                                                            title="Xóa nhanh thủ thuật"
                                                         >
                                                            <Trash2 size={15} />
                                                         </button>
                                                      )}
                                                   </div>
                                                </div>

                                                {/* Content Details */}
                                                <div className="p-2.5 flex flex-col gap-1.5 flex-1 justify-between overflow-hidden">
                                                   <div className="flex flex-col gap-1 overflow-hidden">
                                                      <div className="flex items-center gap-2 text-[16.5px] font-black text-slate-800 truncate">
                                                         <User size={19} className="text-slate-400 shrink-0" />
                                                         {staffMember?.name || 'Chưa phân công'}
                                                      </div>
                                                      {(appt.assistant1Id || appt.assistant2Id) && (
                                                        <div className="flex flex-wrap gap-x-2.5 gap-y-1 ml-5">
                                                          {appt.assistant1Id && <span className="text-[14.5px] font-extrabold text-slate-650 bg-slate-100/80 px-2 py-0.5 rounded-lg truncate max-w-[220px]" title={"Phụ 1: " + (staff.find(s => s.id === appt.assistant1Id)?.name || "")}>Phụ 1: {staff.find(s => s.id === appt.assistant1Id)?.name}</span>}
                                                          {appt.assistant2Id && <span className="text-[14.5px] font-extrabold text-slate-650 bg-slate-100/80 px-2 py-0.5 rounded-lg truncate max-w-[220px]" title={"Phụ 2: " + (staff.find(s => s.id === appt.assistant2Id)?.name || "")}>Phụ 2: {staff.find(s => s.id === appt.assistant2Id)?.name}</span>}
                                                        </div>
                                                      )}
                                                   </div>

                                                   <div className="flex flex-wrap gap-1.5 mt-auto">
                                                      {appt.assignedMachineId && (
                                                         <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 text-[14px] font-black uppercase tracking-wider shadow-sm">
                                                            <Cpu size={16} className="text-indigo-500" /> {appt.assignedMachineId}
                                                         </div>
                                                      )}
                                                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-50 text-slate-700 border border-slate-100 text-[14px] font-black uppercase tracking-wider truncate max-w-[320px] shadow-sm">
                                                         <Building2 size={16} className="text-slate-500" /> {DEPARTMENTS.find(d => d.id === (proc?.deptId || appt.deptId))?.name}
                                                      </div>
                                                      {appt.status === 'COMPLETED' && (appt.deptId === 'dept_cdha' || appt.deptId === 'dept_xetnghiem') && (
                                                         <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[14px] font-black uppercase tracking-wider shadow-sm">
                                                            <Clock size={16} className="text-emerald-500" /> Thực hiện lúc: {appt.endTime}
                                                         </div>
                                                      )}
                                                   </div>
                                                </div>

                                                {/* Conflict Alerts Area - Inside the timeline block as requested */}
                                                {dynamicConflictDetails.length > 0 && (
                                                  <div className={`px-3 py-1 border-t overflow-y-auto max-h-[50px] scrollbar-thin ${hasConflict ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                                                     {dynamicConflictDetails.map((c, mIdx) => (
                                                        <p key={mIdx} className={`text-[11px] font-bold leading-tight flex items-start gap-1 mb-0.5 last:mb-0 ${c.level === 1 ? 'text-rose-600' : 'text-amber-600'}`}>
                                                           <AlertCircle size={12} className="shrink-0 mt-0.5" /> {c.message}
                                                        </p>
                                                     ))}
                                                  </div>
                                                )}
                                            </div>

                                            {/* Rest Time Visualizer */}
                                            {restMinutes > 0 && (
                                                <div 
                                                    className="absolute rounded-r-xl border-y border-r border-dashed border-slate-300 bg-slate-100/30 flex items-center justify-center overflow-hidden -z-10 pointer-events-none"
                                                    style={{ left: durationWidth - 2, width: restWidth + 2, height: cardHeight }}
                                                >
                                                    <div className="whitespace-nowrap text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                                                       Nghỉ {restMinutes}p
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Templates & Synchronization Warnings Area */}
                {templateDifferences.length > 0 && (
                  <div className="shrink-0 bg-white border-t border-slate-200 p-4 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-40">
                    {templateDifferences.map(diff => (
                       <div key={diff.templateId} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                         <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                               <AlertTriangle className="text-amber-500" size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-amber-800 text-sm">Khác biệt so với mẫu "{diff.templateName}"</h4>
                              <p className="text-xs text-amber-700 mt-0.5 font-medium">Lịch hiện tại của bệnh nhân đã thay đổi so với cấu hình mẫu gốc.</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 shrink-0">
                            <button 
                              onClick={() => handleSyncFromTemplate(diff.templateId, diff.appointments)}
                              className="px-4 py-2 bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                              Cập nhật từ mẫu
                            </button>
                            <button 
                              onClick={() => handleSyncToTemplate(diff.templateId, diff.appointments)}
                              className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-xs font-bold shadow-lg shadow-amber-200 transition-all"
                            >
                              Lưu vào mẫu
                            </button>
                         </div>
                       </div>
                    ))}
                  </div>
                )}
            </div>

            <CopyRangeModal 
              isOpen={isCopyModalOpen} 
              onClose={() => setIsCopyModalOpen(false)} 
              onConfirm={(start, end, selectedIds) => {
                onCopyToDateRange(selectedPatient.id, currentDate, start, end, selectedIds);
                setIsCopyModalOpen(false);
              }}
              sourceDate={currentDate}
              patientName={selectedPatient.name}
              procedureCount={patientAppointments.length}
              appointmentsToCopy={patientAppointments}
              procedures={procedures}
            />



            {/* Save Template Modal */}
            {isSaveTemplateModalOpen && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Save size={20} className="text-emerald-500" />
                      Lưu mẫu thủ thuật
                    </h3>
                    <button onClick={() => setIsSaveTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 font-medium">
                      Lưu các thủ thuật hiện tại của bệnh nhân thành một mẫu để sử dụng lại sau này.
                    </p>
                    
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tên mẫu</label>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                        placeholder="VD: Mẫu nội soi dạ dày..."
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Thư mục / Nhóm</label>
                      <div className="relative">
                        <select
                          value={templateGroup}
                          onChange={(e) => setTemplateGroup(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none pr-10"
                        >
                          <option value="">-- Chọn thư mục --</option>
                          {existingFolders.map(folder => (
                            <option key={folder} value={folder}>{folder}</option>
                          ))}
                          <option value="NEW">+ Thêm thư mục mới...</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown size={18} />
                        </div>
                      </div>
                    </div>

                    {templateGroup === 'NEW' && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tên thư mục mới</label>
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          placeholder="VD: Nhóm A / Tổ 1..."
                        />
                      </div>
                    )}
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setIsSaveTemplateModalOpen(false)}>Hủy</Button>
                    <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || (templateGroup === 'NEW' && !newGroupName.trim())} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200">
                      Lưu mẫu
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Load Template Modal */}
            {isLoadTemplateModalOpen && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <FolderOpen size={20} className="text-blue-500" />
                      Kho mẫu thủ thuật ({currentDept.name})
                    </h3>
                    <button onClick={() => setIsLoadTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Template List */}
                    <div className="w-full md:w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/50">
                      <div className="p-4 border-b border-slate-100 font-medium text-slate-700 flex justify-between items-center bg-white shadow-sm z-10 sticky top-0">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Các Mẫu Trong Nhóm</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setIsTemplateSortDesc(!isTemplateSortDesc)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-black uppercase"
                            title="Sắp xếp"
                          >
                            Sắp xếp
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isTemplateSortDesc ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>
                      <div className="p-2.5 border-b border-slate-100 bg-white sticky top-[53px] z-10 shrink-0">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Tìm kiếm mẫu, nhóm, thủ thuật..."
                            value={templateSearchQuery}
                            onChange={(e) => setTemplateSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                          />
                          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                          {templateSearchQuery && (
                            <button
                              onClick={() => setTemplateSearchQuery('')}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                              title="Xóa tìm kiếm"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {templates.filter(t => t.deptId === currentDept.id).length === 0 ? (
                          <div className="p-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic flex flex-col items-center gap-3">
                            <FolderOpen size={32} className="opacity-20" />
                            Chưa có mẫu nào được lưu.
                          </div>
                        ) : (
                          (() => {
                            const currentDeptTemplates = templates.filter(t => {
                              if (t.deptId !== currentDept.id) return false;
                              if (!templateSearchQuery.trim()) return true;
                              const q = templateSearchQuery.toLowerCase();
                              const matchesProcedures = (t.procedures || []).some(tp => {
                                const proc = procedures.find(p => p.id === tp.procedureId);
                                return proc?.name.toLowerCase().includes(q);
                              });
                              return t.name.toLowerCase().includes(q) || (t.group && t.group.toLowerCase().includes(q)) || matchesProcedures;
                            });

                            if (currentDeptTemplates.length === 0) {
                              return (
                                <div className="p-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic flex flex-col items-center gap-3">
                                  <FolderOpen size={32} className="opacity-20" />
                                  Không tìm thấy mẫu phù hợp.
                                </div>
                              );
                            }
                            
                            const buildTree = (tmpls: AppointmentTemplate[]) => {
                              const root: any = { isGroup: true, path: '', items: [] };
                              tmpls.forEach(t => {
                                const groupPath = t.group || 'Khác';
                                const parts = groupPath.split('/').filter(Boolean);
                                let current = root;
                                let currentPath = '';
                                
                                parts.forEach((part, idx) => {
                                  currentPath = currentPath ? `${currentPath}/${part}` : part;
                                  let group = current.items.find((i: any) => i.isGroup && i.path === currentPath);
                                  if (!group) {
                                    group = { isGroup: true, path: currentPath, name: part, items: [] };
                                    current.items.push(group);
                                  }
                                  current = group;
                                });
                                
                                current.items.push({ isGroup: false, template: t });
                              });
                              return root.items;
                            };

                            const treeData = buildTree(currentDeptTemplates);
                            const sortItems = (items: any[]) => {
                                items.sort((a, b) => {
                                  if (a.isGroup && !b.isGroup) return -1;
                                  if (!a.isGroup && b.isGroup) return 1;
                                  const nameA = a.isGroup ? a.name : a.template.name;
                                  const nameB = b.isGroup ? b.name : b.template.name;
                                  if (nameA === 'Khác') return 1;
                                  if (nameB === 'Khác') return -1;
                                  const cmp = nameA.localeCompare(nameB, 'vi');
                                  return isTemplateSortDesc ? -cmp : cmp;
                                });
                                items.forEach(i => { if (i.isGroup) sortItems(i.items); });
                            };
                            sortItems(treeData);

                            return treeData.map((item: any) => {
                              if (item.isGroup) {
                                return renderTemplateItems(item.path, item.items, 0);
                              }
                              return null;
                            });
                          })()
                        )}
                      </div>
                    </div>

                    {/* Template Preview */}
                    <div className="w-full md:w-2/3 flex flex-col bg-white">
                      <div className="p-4 border-b border-slate-100 font-medium text-slate-700 flex justify-between items-center bg-slate-50/10">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">Chi tiết mẫu</span>
                          {selectedTemplateId && (
                            <span className="text-[10px] text-slate-400 font-medium italic">Thay đổi công đoạn trong mẫu tại đây</span>
                          )}
                        </div>
                        {selectedTemplateId && (
                           <div className="flex items-center gap-3">
                             <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                               <button 
                                 onClick={() => {
                                   const patAppts = appointments.filter(a => a.patientId === selectedPatientId && a.date === currentDate && a.deptId === currentDept.id);
                                   if (patAppts.length > 0) handleSyncFromTemplate(selectedTemplateId, patAppts);
                                   else handleApplyTemplate();
                                 }}
                                 className="px-2 py-1 hover:bg-blue-50 text-blue-600 rounded flex items-center gap-1.5 transition-colors"
                                 title="Cập nhật BN hiện tại từ mẫu này"
                               >
                                 <RefreshCw size={14} />
                                 <span className="text-[9px] font-black uppercase">Cập nhật BN</span>
                               </button>
                               <div className="w-px h-3 bg-slate-200 mx-0.5" />
                               <button 
                                 onClick={() => {
                                   const patAppts = appointments.filter(a => a.patientId === selectedPatientId && a.date === currentDate && a.deptId === currentDept.id);
                                   if (patAppts.length > 0) handleSyncToTemplate(selectedTemplateId, patAppts);
                                   else alert("Chưa có chỉ định nào để cập nhật.");
                                 }}
                                 className="px-2 py-1 hover:bg-amber-50 text-amber-600 rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                 disabled={!appointments.some(a => a.patientId === selectedPatientId && a.date === currentDate && a.deptId === currentDept.id)}
                                 title="Cập nhật mẫu từ BN"
                               >
                                 <Save size={14} />
                                 <span className="text-[9px] font-black uppercase">Cập nhật mẫu</span>
                               </button>
                             </div>

                             <div className="h-6 w-px bg-slate-200 mx-1" />

                             <div className="flex items-center gap-2">
                               <input 
                                 type="checkbox" 
                                 id="includeStaff" 
                                 checked={includeStaffInTemplate} 
                                 onChange={(e) => setIncludeStaffInTemplate(e.target.checked)}
                                 className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                               />
                               <label htmlFor="includeStaff" className="text-[11px] font-black text-slate-500 cursor-pointer select-none uppercase tracking-tighter">Nhân sự</label>
                             </div>
                           </div>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        {!editingTemplate ? (
                          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                            Chọn một mẫu bên trái để xem chi tiết
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Tên mẫu</label>
                              <input
                                type="text"
                                value={editingTemplate.name}
                                onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                            </div>
                            <div className="space-y-3">
                              {(editingTemplate.procedures || []).map((tProc, idx) => {
                                const proc = procedures.find(p => p.id === tProc.procedureId);
                                return (
                                  <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
                                    <div className="flex justify-between items-center">
                                      <div className="font-medium text-slate-800 flex items-center gap-2">
                                        <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">{getAbbreviation(proc?.name || '??')}</div>
                                        {proc?.name || 'Thủ thuật đã xóa'}
                                      </div>
                                      <button 
                                        onClick={() => {
                                          const newProcs = [...editingTemplate.procedures];
                                          newProcs.splice(idx, 1);
                                          setEditingTemplate({...editingTemplate, procedures: newProcs});
                                        }}
                                        className="text-slate-400 hover:text-rose-500 transition-colors"
                                        title="Xóa thủ thuật khỏi mẫu"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Thời gian (HH:mm)</label>
                                        <div className="flex items-center gap-2">
                                          <input 
                                            type="text" 
                                            placeholder="HH:mm"
                                            maxLength={5}
                                            value={tProc.startTime}
                                            onChange={(e) => {
                                              let val = e.target.value.replace(/[^0-9:]/g, '');
                                              if (val.length === 2 && !val.includes(':') && e.target.selectionStart === 2) val += ':';
                                              const newProcs = [...editingTemplate.procedures];
                                              newProcs[idx] = {...tProc, startTime: val};
                                              setEditingTemplate({...editingTemplate, procedures: newProcs});
                                            }}
                                            onBlur={(e) => {
                                              const val = e.target.value;
                                              if (val && !val.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
                                                // If invalid, we could reset or just let it be, but HH:mm is preferred
                                              }
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                          />
                                          <span className="text-slate-400">-</span>
                                          <input 
                                            type="text" 
                                            placeholder="HH:mm"
                                            maxLength={5}
                                            value={tProc.endTime}
                                            onChange={(e) => {
                                              let val = e.target.value.replace(/[^0-9:]/g, '');
                                              if (val.length === 2 && !val.includes(':') && e.target.selectionStart === 2) val += ':';
                                              const newProcs = [...editingTemplate.procedures];
                                              newProcs[idx] = {...tProc, endTime: val};
                                              setEditingTemplate({...editingTemplate, procedures: newProcs});
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Nhân sự chính</label>
                                        <select
                                          value={tProc.staffId || ''}
                                          onChange={(e) => {
                                            const newProcs = [...editingTemplate.procedures];
                                            newProcs[idx] = {...tProc, staffId: e.target.value};
                                            setEditingTemplate({...editingTemplate, procedures: newProcs});
                                          }}
                                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                          <option value="">-- Chọn nhân sự --</option>
                                          {(() => {
                                            const filtered = staff.filter(s => s.deptId === currentDept.id && (s.mainCapabilityIds?.includes(tProc.procedureId)));
                                            const list = filtered;
                                            return list.map(s => (
                                              <option key={s.id} value={s.id}>{s.name}</option>
                                            ));
                                          })()}
                                        </select>
                                      </div>
                                      {((proc?.asst1BusyEnd && proc.asst1BusyEnd > 0) || (proc?.assistant1BusyMinutes && proc.assistant1BusyMinutes > 0)) && (
                                        <div>
                                          <label className="block text-xs font-medium text-slate-500 mb-1">Người phụ 1</label>
                                          <select
                                            value={tProc.assistant1Id || ''}
                                            onChange={(e) => {
                                              const newProcs = [...editingTemplate.procedures];
                                              newProcs[idx] = {...tProc, assistant1Id: e.target.value || null};
                                              setEditingTemplate({...editingTemplate, procedures: newProcs});
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                          >
                                            <option value="">-- Chọn người phụ --</option>
                                            {(() => {
                                              const filtered = staff.filter(s => s.deptId === currentDept.id && s.assistantCapabilityIds?.includes(tProc.procedureId) && s.id !== tProc.staffId);
                                              const list = filtered;
                                              return list.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                              ));
                                            })()}
                                          </select>
                                        </div>
                                      )}
                                      {(proc?.requireMachine) && (
                                        <div>
                                          <label className="block text-xs font-medium text-slate-500 mb-1">Máy thực hiện</label>
                                          <select
                                            value={tProc.assignedMachineId || ''}
                                            onChange={(e) => {
                                              const newProcs = [...editingTemplate.procedures];
                                              newProcs[idx] = {...tProc, assignedMachineId: e.target.value || null};
                                              setEditingTemplate({...editingTemplate, procedures: newProcs});
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                          >
                                            <option value="">-- Chọn máy --</option>
                                            {(() => {
                                              const mProc = proc;
                                              const machines = mProc?.availableMachines || [];
                                              return machines.length > 0 ? (
                                                machines.map(mCode => (
                                                  <option key={mCode} value={mCode}>{mCode}</option>
                                                ))
                                              ) : (
                                                <option value="" disabled>Không có máy</option>
                                              );
                                            })()}
                                          </select>
                                        </div>
                                      )}
                                      {((proc?.asst2BusyEnd && proc.asst2BusyEnd > 0) || (proc?.assistant2BusyMinutes && proc.assistant2BusyMinutes > 0)) && (
                                        <div>
                                          <label className="block text-xs font-medium text-slate-500 mb-1">Người phụ 2</label>
                                          <select
                                            value={tProc.assistant2Id || ''}
                                            onChange={(e) => {
                                              const newProcs = [...editingTemplate.procedures];
                                              newProcs[idx] = {...tProc, assistant2Id: e.target.value || null};
                                              setEditingTemplate({...editingTemplate, procedures: newProcs});
                                            }}
                                            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                          >
                                            <option value="">-- Chọn người phụ 2 --</option>
                                            {(() => {
                                              const filtered = staff.filter(s => s.deptId === currentDept.id && (s.assistantCapabilityIds?.includes(tProc.procedureId) || s.capabilityIds?.includes(tProc.procedureId)) && s.id !== tProc.staffId && s.id !== tProc.assistant1Id);
                                              const list = filtered.length > 0 ? filtered : staff.filter(s => s.deptId === currentDept.id && s.id !== tProc.staffId && s.id !== tProc.assistant1Id);
                                              return list.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                              ));
                                            })()}
                                          </select>
                                        </div>
                                      )}
                                      <div className="col-span-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Ghi chú</label>
                                        <input 
                                          type="text" 
                                          value={tProc.notes || ''}
                                          onChange={(e) => {
                                            const newProcs = [...editingTemplate.procedures];
                                            newProcs[idx] = {...tProc, notes: e.target.value};
                                            setEditingTemplate({...editingTemplate, procedures: newProcs});
                                          }}
                                          placeholder="Ghi chú..."
                                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                        {editingTemplate && JSON.stringify(editingTemplate) !== JSON.stringify(templates.find(t => t.id === selectedTemplateId)) && (
                          <Button variant="secondary" onClick={handleSaveEditedTemplate} className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 mr-auto">
                            <Save size={18} /> Lưu thay đổi
                          </Button>
                        )}
                        <Button variant="secondary" onClick={() => setIsLoadTemplateModalOpen(false)}>Đóng</Button>
                        <Button 
                          onClick={handleApplyTemplate} 
                          disabled={!selectedTemplateId || !editingTemplate || (editingTemplate.procedures || []).length === 0 || (editingTemplate.procedures || []).some(tp => procedures.find(p => p.id === tp.procedureId)?.requireMachine && !tp.assignedMachineId)} 
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <CheckCircle2 size={18} /> Áp dụng mẫu
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 text-center bg-slate-50/50">
             <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl border border-slate-100 mb-6 rotate-3"><User size={40} className="text-slate-200" /></div>
             <p className="font-black text-xl text-slate-400 tracking-tight uppercase">Chọn bệnh nhân để lập lịch</p>
          </div>
        )}
      </div>
        </div>
      )}


      {activeTab === 'TEMPLATES' && (
        <TemplateManager
          templates={templates}
          procedures={procedures}
          staff={staff}
          currentDept={currentDept}
          onSaveTemplate={handleSaveTemplateData}
          onDeleteTemplate={handleDeleteTemplate}
          appointments={appointments}
          patients={patients}
          activeDate={currentDate}
          onApplyTemplateToPatient={handleApplyTemplateToPatient}
        />
      )}

      <BatchLoadModal 
        isOpen={isBatchLoadModalOpen}
        onClose={() => setIsBatchLoadModalOpen(false)}
        onConfirm={async (options) => {
          setIsProcessingBatch(true);
          setIsBatchLoadModalOpen(false);
          try {
            await onBatchLoadPreviousDay(options);
          } finally {
            setIsProcessingBatch(false);
          }
        }}
        currentDate={currentDate}
        patients={patients}
        staff={staff}
        procedures={procedures}
        attendanceRecords={attendanceRecords}
        machineShifts={machineShifts}
      />

      <QuickScheduleModal
        isOpen={isQuickScheduleModalOpen}
        onClose={() => setIsQuickScheduleModalOpen(false)}
        currentDate={currentDate}
        currentDept={currentDept}
        patients={patients}
        procedures={procedures}
        staff={staff}
        appointments={appointments}
        attendanceRecords={attendanceRecords}
      />

      {/* Modal Lịch sử biến động và hoàn tác chỉnh sửa */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">Nhật ký biến động lịch trình</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">Ngày {currentDate} - {currentDept.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {deviations.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-4">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-800">Không có biến động nào!</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Lịch trình ngày này đang hoàn toàn khớp với phiên bản chốt mẫu</p>
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Mọi sửa đổi, đổi giờ, đổi kíp bác sĩ chính, người phụ hoặc xóa/thêm mới thủ thuật sau khi đã bấm "Lưu phiên bản" sẽ xuất hiện tại đây để hoàn tác khi cần.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                    <span>Thủ thuật bị biến động ({deviations.length})</span>
                    <span>Hành động khôi phục</span>
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-200/60 rounded-3xl overflow-hidden bg-slate-50/20 shadow-sm">
                    {deviations.map((dev) => {
                      let badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
                      let badgeText = "✎ Chỉnh sửa";
                      if (dev.type === 'NEW') {
                        badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        badgeText = "+ Thêm mới";
                      } else if (dev.type === 'DELETED') {
                        badgeBg = "bg-rose-50 text-rose-700 border-rose-200";
                        badgeText = "✗ Đã xóa";
                      }

                      return (
                        <div key={dev.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                          <div className="space-y-1.5 flex-1 pr-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-extrabold text-slate-800">{dev.patientName}</span>
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeBg}`}>
                                {badgeText}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-slate-500">
                              Thủ thuật: <span className="font-extrabold text-slate-700">{dev.procedureName}</span>
                            </div>
                            <div className="text-xs font-bold text-amber-600 bg-amber-50/30 px-2.5 py-1 rounded-xl inline-block">
                              {dev.changeDetails}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {
                              if (onUndoAppointmentChange) {
                                onUndoAppointmentChange(dev.id, dev.type, dev.originalAppt);
                              }
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-slate-700 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 shadow-sm border border-slate-200/40"
                          >
                            <RotateCcw size={12} />
                            Hoàn tác
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Chốt phiên bản tại "Timeline Khoa" để làm sạch nhật ký
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-6 py-2.5 bg-slate-800 text-white hover:bg-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Đóng nhật ký
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessingBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6 text-center">
          <div className="bg-white p-10 rounded-[32px] shadow-2xl space-y-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Đang xử lý dữ liệu</h3>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 animate-pulse">Vui lòng đợi trong giây lát...</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed tracking-tight">
                Hệ thống đang tự động phân lịch, khớp nhân sự và tính toán máy thực hiện cho toàn bộ khoa.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
