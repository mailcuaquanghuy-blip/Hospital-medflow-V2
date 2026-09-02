import React, { useState, useMemo } from 'react';
import { X, Clock, Zap, Check, ChevronDown, Sparkles, AlertCircle, RefreshCw, User, HelpCircle, CheckCircle2, Plus } from 'lucide-react';
import { Button } from './Button';
import { Patient, Appointment, Procedure, Staff, AttendanceRecord, AppointmentStatus, Department, AttendanceStatus, ProcedureCategory } from '../types';
import { timeStringToMinutes, minutesToTimeString, checkConflict } from '../utils/timeUtils';
import { doc } from 'firebase/firestore';
import { setDoc } from '../utils/dbService';
import { db } from '../firebase';

const calculateAge = (dobString: string) => {
  if (!dobString) return 0;
  const birthYear = parseInt(dobString.split('-')[0]);
  if (isNaN(birthYear)) return 0;
  return new Date().getFullYear() - birthYear;
};

const formatAndValidateTime = (val: string, defaultVal: string): string => {
  const cleaned = val.trim();
  if (!cleaned) return defaultVal;
  const match = cleaned.match(/^([0-9]{1,2})[:.hH-]?([0-9]{0,2})$/);
  if (!match) return defaultVal;
  
  let hours = parseInt(match[1]);
  let mins = parseInt(match[2] || '0');
  
  if (isNaN(hours) || hours < 0 || hours > 23) return defaultVal;
  if (isNaN(mins) || mins < 0 || mins > 59) mins = 0;
  
  const hh = String(hours).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  return `${hh}:${mm}`;
};

const generateTimeOptions = (startHour: number, count: number) => {
  const options: string[] = [];
  for (let h = startHour; h < startHour + count; h++) {
    const hh = String(h).padStart(2, '0');
    options.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`);
  }
  return options;
};

interface QuickScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  currentDept: Department;
  patients: Patient[];
  procedures: Procedure[];
  staff: Staff[];
  appointments: Appointment[];
  attendanceRecords: AttendanceRecord[];
}

interface SelectionState {
  level: 0 | 1 | 2; // 0: No, 1: Possible, 2: Priority
  durationMinutes: number;
  durationOptionId?: string | null;
}

interface KipConfig {
  id: string;
  procedureId: string;
  mainStaffId: string;
  assistant1Id: string;
  assistant2Id: string;
}

export const QuickScheduleModal: React.FC<QuickScheduleModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  currentDept,
  patients,
  procedures,
  staff,
  appointments,
  attendanceRecords,
}) => {
  // 1. Patient Specific Time Configuration
  interface PatientTimeConfig {
    morningActive: boolean;
    morningStart: string;
    morningEnd: string;
    afternoonActive: boolean;
    afternoonStart: string;
    afternoonEnd: string;
  }

  const [patientTimeConfigs, setPatientTimeConfigs] = useState<Record<string, PatientTimeConfig>>({});

  const getPatientTimeConfig = (patientId: string): PatientTimeConfig => {
    return patientTimeConfigs[patientId] || {
      morningActive: true, // Default to true
      morningStart: '07:30',
      morningEnd: '11:30',
      afternoonActive: true, // Default to true
      afternoonStart: '13:30',
      afternoonEnd: '17:30'
    };
  };

  // 2. Warning Modal State for duplicate scheduling
  const [warningModal, setWarningModal] = useState<{
    isOpen: boolean;
    patientName: string;
    procedureName: string;
    existingTimes: string;
    onConfirm: () => void;
  } | null>(null);

  // Daily kíp configs
  const [groups, setGroups] = useState<KipConfig[]>([]);

  // Attending department staff (present on current day)
  const attendingStaff = useMemo(() => {
    return staff.filter(s => {
      if (s.deptId !== currentDept.id) return false;
      
      const isHoliday = attendanceRecords.some(r => (r.staffId === `holiday_dept_${currentDept.id}` || r.staffId === `holiday_${currentDept.id}`) && r.date === currentDate && r.status === AttendanceStatus.OFF_FULL);

      const rec = attendanceRecords.find(r => r.staffId === s.id && r.date === currentDate);

      if (isHoliday) {
        return rec ? rec.status === AttendanceStatus.DUTY : false;
      } else {
        return rec ? rec.status !== AttendanceStatus.OFF_FULL : true;
      }
    });
  }, [staff, currentDept, attendanceRecords, currentDate]);

  const handleAddGroup = () => {
    const defaultProcId = procedures.find(p => p.deptId === currentDept.id)?.id || '';
    const newGroup: KipConfig = {
      id: 'kip_' + Math.random().toString(36).substr(2, 9),
      procedureId: defaultProcId,
      mainStaffId: '',
      assistant1Id: '',
      assistant2Id: ''
    };
    setGroups(prev => [...prev, newGroup]);
  };

  const handleRemoveGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
  };

  const handleUpdateGroup = (id: string, field: keyof KipConfig, value: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  // Filter patients who are TREATING and belong to or are referred to this department
  const departmentPatients = useMemo(() => {
    return patients.filter(p => {
      if (p.status !== 'TREATING') return false;
      if (p.admittedByDeptId === currentDept.id) return true;

      return p.referrals?.some(r => {
        const s = (r.specialty || '').toLowerCase().trim();
        const dId = currentDept.id.toLowerCase().trim();
        const dName = currentDept.name.toLowerCase().trim();
        
        const isMatch = s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                       (s.includes('phcn') && dId.includes('phcn')) ||
                       (s.includes('cdha') && dId.includes('cdha')) ||
                       (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                       (s.includes('duoc') && dId.includes('duoc')) ||
                       (dId === 'dept_phcn' && s === 'dept_phcn') ||
                       (dId === 'dept_cdha' && s === 'dept_cdha') ||
                       (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');

        return isMatch && r.status !== 'FINISHED';
      }) ?? false;
    });
  }, [patients, currentDept, currentDate]);

  // Filter procedures of this department
  const departmentProcedures = useMemo(() => {
    return procedures.filter(p => p.deptId === currentDept.id);
  }, [procedures, currentDept]);

  // Unified quick schedule tasks record per patient
  interface QuickScheduleTask {
    id: string;
    procedureId: string;
    durationMinutes: number;
    durationOptionId?: string | null;
    mainStaffId?: string | null;
    assistant1Id?: string | null;
    assistant2Id?: string | null;
    deviceId?: string | null;
  }

  const [quickScheduleTasks, setQuickScheduleTasks] = useState<Record<string, QuickScheduleTask[]>>({});

  // Sub-dialog state for "+ Thêm thủ thuật"
  const [addProcState, setAddProcState] = useState<{
    isOpen: boolean;
    patientId: string;
    selectedCategory: string;
    selectedProcedureId: string;
    selectedDurationOptionId: string;
    mainStaffId: string;
    assistant1Id: string;
    assistant2Id: string;
    deviceId: string;
  } | null>(null);

  const [addProcDuplicateWarning, setAddProcDuplicateWarning] = useState<boolean>(false);

  const [showKipConfig, setShowKipConfig] = useState(false);

  // States for scheduling progress
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [failedDetails, setFailedDetails] = useState<{ patientName: string; procedureName: string; reason: string }[]>([]);

  if (!isOpen) return null;

  // Algorithm to find valid slots
  const findValidSlotAndStaff = (
    patientId: string,
    procedure: Procedure,
    durationMins: number,
    userStartMin: number,
    userEndMin: number,
    tempAppointments: Appointment[],
    staffList: Staff[],
    proceduresList: Procedure[],
    attendanceList: AttendanceRecord[],
    patientsList: Patient[],
    dedicatedMainId?: string | null,
    dedicatedAsst1Id?: string | null,
    dedicatedAsst2Id?: string | null,
    dedicatedDeviceId?: string | null
  ) => {
    // Find staff with main capability for this procedure
    let eligibleMain = staffList.filter(s => s.mainCapabilityIds?.includes(procedure.id));
    if (dedicatedMainId) {
      eligibleMain = eligibleMain.filter(s => s.id === dedicatedMainId);
    }

    // Check if assistant is required
    const hasAsst1 = (procedure.asst1BusyEnd !== undefined && procedure.asst1BusyEnd > 0) ||
                     (procedure.assistant1BusyMinutes !== undefined && procedure.assistant1BusyMinutes > 0);
    const hasAsst2 = (procedure.asst2BusyEnd !== undefined && procedure.asst2BusyEnd > 0) ||
                     (procedure.assistant2BusyMinutes !== undefined && procedure.assistant2BusyMinutes > 0);

    let eligibleAsst1 = hasAsst1 ? staffList.filter(s => s.assistantCapabilityIds?.includes(procedure.id)) : [null];
    if (hasAsst1 && dedicatedAsst1Id) {
      eligibleAsst1 = eligibleAsst1.filter(s => s && s.id === dedicatedAsst1Id);
    }

    let eligibleAsst2 = hasAsst2 ? staffList.filter(s => s.assistantCapabilityIds?.includes(procedure.id)) : [null];
    if (hasAsst2 && dedicatedAsst2Id) {
      eligibleAsst2 = eligibleAsst2.filter(s => s && s.id === dedicatedAsst2Id);
    }

    // Check if the current option allows same assistant
    const opt = procedure.durationOptions?.find(o => o.durationMinutes === durationMins) || 
                 procedure.durationOptions?.find(o => o.isDefault) || 
                 procedure.durationOptions?.[0];
    const allowSame = opt?.allowSameAssistant !== undefined 
      ? opt.allowSameAssistant 
      : (procedure.allowSameAssistant || false);

    // Slide search from userStartMin to userEndMin - durationMins
    // Optimization: step by 5 minutes for extreme scheduling speed and clean visual slots
    for (let currentMin = userStartMin; currentMin + durationMins <= userEndMin; currentMin += 5) {
      const startStr = minutesToTimeString(currentMin);
      const endStr = minutesToTimeString(currentMin + durationMins);

      for (const mainStaff of eligibleMain) {
        for (const asst1 of eligibleAsst1) {
          if (asst1 && asst1.id === mainStaff.id) continue;

          for (const asst2 of eligibleAsst2) {
            if (asst2 && (asst2.id === mainStaff.id || (!allowSame && asst1 && asst2.id === asst1.id))) continue;

            // Run conflict checks with detailed simulation
            const conflictRes = checkConflict(
              startStr,
              endStr,
              currentDate,
              mainStaff.id,
              patientId,
              tempAppointments,
              staffList,
              proceduresList,
              attendanceList,
              patientsList,
              procedure.id,
              undefined,
              asst1?.id || null,
              asst2?.id || null,
              {
                endTime: endStr,
                startTime: startStr,
                assignedMachineId: dedicatedDeviceId || undefined
              }
            );

            if (!conflictRes.hasConflict) {
              return {
                startTime: startStr,
                endTime: endStr,
                staffId: mainStaff.id,
                assistant1Id: asst1?.id || null,
                assistant2Id: asst2?.id || null,
                assignedMachineId: conflictRes.assignedMachineId || null
              };
            }
          }
        }
      }
    }

    return null;
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    setProgress(0);
    setScheduledCount(0);
    setFailedCount(0);
    setFailedDetails([]);

    const doctors = attendingStaff.filter(s => s.role === 'Doctor');
    const nonDoctors = attendingStaff.filter(s => s.role !== 'Doctor');

    // 1. Điện châm (Dedicated: 1 doctor, 2 nurses)
    const dcProc = procedures.find(p => p.id === 'pr_diencham' || p.name.toLowerCase().includes('điện châm') || p.name.toLowerCase().includes('dien cham'));
    let dcMainId: string | null = null;
    let dcAsst1Id: string | null = null;
    let dcAsst2Id: string | null = null;

    if (dcProc) {
      const dcDoctors = doctors.filter(s => s.mainCapabilityIds?.includes(dcProc.id));
      const dcNurses = nonDoctors.filter(s => s.assistantCapabilityIds?.includes(dcProc.id));
      if (dcDoctors.length > 0) dcMainId = dcDoctors[0].id;
      if (dcNurses.length > 0) dcAsst1Id = dcNurses[0].id;
      if (dcNurses.length > 1) dcAsst2Id = dcNurses[1].id;
    }

    // 2. Thủy châm (Dedicated: 1 doctor, 1 nurse, separate from Điện châm if possible)
    const tcProc = procedures.find(p => p.id === 'pr_thuycham' || p.name.toLowerCase().includes('thủy châm') || p.name.toLowerCase().includes('thuy cham'));
    let tcMainId: string | null = null;
    let tcAsstId: string | null = null;

    if (tcProc) {
      const tcDoctors = doctors.filter(s => s.mainCapabilityIds?.includes(tcProc.id));
      const tcNurses = nonDoctors.filter(s => s.assistantCapabilityIds?.includes(tcProc.id));
      
      const otherDoc = tcDoctors.find(d => d.id !== dcMainId);
      tcMainId = otherDoc ? otherDoc.id : (tcDoctors[0]?.id || null);

      const otherNurse = tcNurses.find(n => n.id !== dcAsst1Id && n.id !== dcAsst2Id);
      tcAsstId = otherNurse ? otherNurse.id : (tcNurses[0]?.id || null);
    }

    // Collect all tasks to schedule
    const tasks: {
      patient: Patient;
      procedure: Procedure;
      durationMinutes: number;
      durationOptionId?: string | null;
      mainStaffId?: string | null;
      assistant1Id?: string | null;
      assistant2Id?: string | null;
      deviceId?: string | null;
    }[] = [];

    for (const patient of departmentPatients) {
      const pTasks = quickScheduleTasks[patient.id] || [];
      for (const t of pTasks) {
        const proc = procedures.find(p => p.id === t.procedureId);
        if (proc) {
          tasks.push({
            patient,
            procedure: proc,
            durationMinutes: t.durationMinutes,
            durationOptionId: t.durationOptionId || null,
            mainStaffId: t.mainStaffId || null,
            assistant1Id: t.assistant1Id || null,
            assistant2Id: t.assistant2Id || null,
            deviceId: t.deviceId || null,
          });
        }
      }
    }

    if (tasks.length === 0) {
      alert("Vui lòng chọn ít nhất một thủ thuật cần sắp xếp.");
      setIsProcessing(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const fails: typeof failedDetails = [];
    let tempAppointments = [...appointments];

    const totalTasks = tasks.length;

    // Track next available start minutes per procedure to support consecutive ("gối tiếp") scheduling.
    const nextProcStartMin: Record<string, number> = {};

    for (let i = 0; i < totalTasks; i++) {
      const task = tasks[i];
      
      // Fast yet premium transition delay (15ms instead of 100ms)
      await new Promise(resolve => setTimeout(resolve, 15));

      const isDc = task.procedure.id === 'pr_diencham' || task.procedure.name.toLowerCase().includes('điện châm') || task.procedure.name.toLowerCase().includes('dien cham');
      const isTc = task.procedure.id === 'pr_thuycham' || task.procedure.name.toLowerCase().includes('thủy châm') || task.procedure.name.toLowerCase().includes('thuy cham');

      let stagger = 5; // Default 5 mins stagger
      if (isDc) stagger = 6;
      else if (isTc) stagger = 6;

      const config = getPatientTimeConfig(task.patient.id);
      const activeWindows: { startMin: number; endMin: number }[] = [];

      // If both are inactive (unchecked), default to "toàn bộ giờ hành chính trong ngày"
      const useMorning = config.morningActive || (!config.morningActive && !config.afternoonActive);
      const useAfternoon = config.afternoonActive || (!config.morningActive && !config.afternoonActive);

      if (useMorning) {
        activeWindows.push({
          startMin: timeStringToMinutes(config.morningStart),
          endMin: timeStringToMinutes(config.morningEnd)
        });
      }
      if (useAfternoon) {
        activeWindows.push({
          startMin: timeStringToMinutes(config.afternoonStart),
          endMin: timeStringToMinutes(config.afternoonEnd)
        });
      }

      let slot: any = null;

      for (const window of activeWindows) {
        const searchStartMin = Math.max(window.startMin, nextProcStartMin[task.procedure.id] || window.startMin);
        if (searchStartMin + task.durationMinutes > window.endMin) {
          continue; // Not enough time in this window, check next window
        }

        // Setup custom configurations/overrides
        let decMain = task.mainStaffId || null;
        let decAsst1 = task.assistant1Id || null;
        let decAsst2 = task.assistant2Id || null;
        const decDevice = task.deviceId || null;

        // If no custom staff overrides are specified, check if daily Kip (groups) is defined for this procedure
        if (!decMain && !decAsst1 && !decAsst2) {
          const matchingKips = groups.filter(g => g.procedureId === task.procedure.id);
          if (matchingKips.length > 0) {
            let bestSlot: any = null;
            let bestStartMin = Infinity;
            
            // Check if the current task duration/procedure allows same assistant
            let currentAllowSame = task.procedure.allowSameAssistant;
            if (task.durationOptionId) {
              const opt = task.procedure.durationOptions?.find(o => o.id === task.durationOptionId);
              if (opt && opt.allowSameAssistant !== undefined) {
                currentAllowSame = opt.allowSameAssistant;
              }
            }

            for (const kip of matchingKips) {
              let asst1Override = kip.assistant1Id || null;
              let asst2Override = kip.assistant2Id || null;

              if (currentAllowSame && asst1Override && asst2Override && asst1Override !== asst2Override) {
                asst2Override = asst1Override;
              }

              const tempSlot = findValidSlotAndStaff(
                task.patient.id,
                task.procedure,
                task.durationMinutes,
                searchStartMin,
                window.endMin,
                tempAppointments,
                staff,
                procedures,
                attendanceRecords,
                patients,
                kip.mainStaffId || null,
                asst1Override,
                asst2Override,
                decDevice
              );
              if (tempSlot) {
                const startMin = timeStringToMinutes(tempSlot.startTime);
                if (startMin < bestStartMin) {
                  bestStartMin = startMin;
                  bestSlot = tempSlot;
                }
              }
            }
            slot = bestSlot;
          }
        }

        // If still no slot, fallback to general free search or standard Điện châm/Thủy châm pre-calculated defaults
        if (!slot) {
          if (!decMain && !decAsst1 && !decAsst2) {
            if (isDc) {
              decMain = dcMainId;
              decAsst1 = dcAsst1Id;
              decAsst2 = dcAsst2Id;
            } else if (isTc) {
              decMain = tcMainId;
              decAsst1 = tcAsstId;
            }
          }

          slot = findValidSlotAndStaff(
            task.patient.id,
            task.procedure,
            task.durationMinutes,
            searchStartMin,
            window.endMin,
            tempAppointments,
            staff,
            procedures,
            attendanceRecords,
            patients,
            decMain,
            decAsst1,
            decAsst2,
            decDevice
          );
        }

        if (slot) {
          break; // Found slot, stop checking other windows
        }
      }

      if (slot) {
        const slotStartMin = timeStringToMinutes(slot.startTime);
        nextProcStartMin[task.procedure.id] = slotStartMin + stagger;

        const currentProc = task.procedure;
        const opt = currentProc.durationOptions?.find(o => o.id === task.durationOptionId) || currentProc.durationOptions?.find(o => o.isDefault);

        const mainBusyStart = opt ? (opt.mainBusyStart ?? 0) : (currentProc.mainBusyStart ?? 0);
        const mainBusyEnd = opt ? (opt.mainBusyEnd ?? opt.durationMinutes) : (currentProc.mainBusyEnd ?? currentProc.durationMinutes);
        const asst1BusyStart = opt ? opt.asst1BusyStart : currentProc.asst1BusyStart;
        const asst1BusyEnd = opt ? opt.asst1BusyEnd : currentProc.asst1BusyEnd;
        const asst2BusyStart = opt ? opt.asst2BusyStart : currentProc.asst2BusyStart;
        const asst2BusyEnd = opt ? opt.asst2BusyEnd : currentProc.asst2BusyEnd;
        const restMinutes = opt ? (opt.restMinutes ?? 0) : (currentProc.restMinutes ?? 0);

        const newAppt: Appointment = {
          id: 'quick_' + Math.random().toString(36).substr(2, 9),
          patientId: task.patient.id,
          procedureId: task.procedure.id,
          deptId: currentDept.id,
          date: currentDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          staffId: slot.staffId,
          assistant1Id: slot.assistant1Id,
          assistant2Id: slot.assistant2Id,
          assignedMachineId: slot.assignedMachineId,
          status: AppointmentStatus.PENDING,
          notes: "Sắp xếp tự động nhanh",
          selectedDurationOptionId: task.durationOptionId || null,
          mainBusyStart: mainBusyStart,
          mainBusyEnd: mainBusyEnd,
          asst1BusyStart: asst1BusyStart,
          asst1BusyEnd: asst1BusyEnd,
          asst2BusyStart: asst2BusyStart,
          asst2BusyEnd: asst2BusyEnd,
          restMinutes: restMinutes
        };

        if (db) {
          try {
            await setDoc(doc(db, "appointments", newAppt.id), newAppt);
            successCount++;
            tempAppointments.push(newAppt);
          } catch (err) {
            console.error(err);
            failCount++;
            fails.push({
              patientName: task.patient.name,
              procedureName: task.procedure.name,
              reason: "Lỗi lưu trữ dữ liệu"
            });
          }
        } else {
          successCount++;
          tempAppointments.push(newAppt);
        }
      } else {
        failCount++;
        fails.push({
          patientName: task.patient.name,
          procedureName: task.procedure.name,
          reason: "Không tìm thấy khung giờ hoặc nhân lực trống"
        });
      }

      setProgress(Math.round(((i + 1) / totalTasks) * 100));
      setScheduledCount(successCount);
      setFailedCount(failCount);
      setFailedDetails(fails);
    }

    setIsCompleted(true);
  };

  const handleResetModal = () => {
    setIsProcessing(false);
    setIsCompleted(false);
    setProgress(0);
    setScheduledCount(0);
    setFailedCount(0);
    setFailedDetails([]);
    setQuickScheduleTasks({});
    onClose();
  };

  const handleAddProcedureConfirm = () => {
    if (!addProcState || !addProcState.selectedProcedureId) {
      alert("Vui lòng chọn thủ thuật.");
      return;
    }

    const patientId = addProcState.patientId;
    const procedureId = addProcState.selectedProcedureId;
    const durationOptionId = addProcState.selectedDurationOptionId || null;
    const selectedProc = procedures.find(p => p.id === procedureId);

    // Get duration minutes and same assistant rule
    const selectedDurationOpt = selectedProc?.durationOptions?.find(o => o.id === durationOptionId);
    let durationMinutes = selectedProc?.durationMinutes || 20;
    if (selectedDurationOpt) {
      durationMinutes = selectedDurationOpt.durationMinutes;
    }

    const isSameAsst = selectedDurationOpt ? (
      selectedDurationOpt.allowSameAssistant ?? selectedProc?.allowSameAssistant
    ) : selectedProc?.allowSameAssistant;

    // Check for duplicate warning
    const hasExistingAppt = appointments.some(appt => appt.patientId === patientId && appt.date === currentDate && appt.procedureId === procedureId);
    const hasPendingTask = (quickScheduleTasks[patientId] || []).some(t => t.procedureId === procedureId);

    if ((hasExistingAppt || hasPendingTask) && !addProcDuplicateWarning) {
      setAddProcDuplicateWarning(true);
      return;
    }

    // Add task
    const newTask: QuickScheduleTask = {
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      procedureId: procedureId,
      durationMinutes: durationMinutes,
      durationOptionId: durationOptionId,
      mainStaffId: addProcState.mainStaffId || null,
      assistant1Id: addProcState.assistant1Id || null,
      assistant2Id: isSameAsst ? (addProcState.assistant1Id || null) : (addProcState.assistant2Id || null),
      deviceId: addProcState.deviceId || null
    };

    setQuickScheduleTasks(prev => ({
      ...prev,
      [patientId]: [...(prev[patientId] || []), newTask]
    }));

    setAddProcState(null);
    setAddProcDuplicateWarning(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[95vw] xl:max-w-7xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-150 text-violet-600 flex items-center justify-center bg-violet-50">
              <Zap size={22} className="fill-violet-500" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                Sắp xếp lịch nhanh
                <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full uppercase">Tự động</span>
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sắp xếp thông minh dựa trên lịch rảnh của nhân sự & thiết bị</p>
            </div>
          </div>
          <button 
            onClick={handleResetModal} 
            className="text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 rounded-xl"
            disabled={isProcessing && !isCompleted}
          >
            <X size={24} />
          </button>
        </div>

        {/* Dynamic Screens */}
        {!isProcessing ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Setting bar */}
            <div className="p-6 bg-slate-50/40 border-b border-slate-100 flex flex-col gap-4 shrink-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-violet-600 fill-violet-200 animate-pulse" />
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Cấu hình kíp thủ thuật chuyên biệt</span>
                  <button
                    onClick={() => setShowKipConfig(!showKipConfig)}
                    className="text-xs font-black text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl transition-colors ml-4"
                  >
                    {showKipConfig ? 'Thu gọn kíp' : 'Mở rộng cấu hình kíp'}
                  </button>
                </div>
                {showKipConfig && (
                  <button
                    onClick={handleAddGroup}
                    className="text-xs font-black text-white bg-violet-600 hover:bg-violet-700 transition-colors px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-violet-500/10"
                  >
                    <span>+ Thêm kíp</span>
                  </button>
                )}
              </div>

              {/* Kíp Configuration box */}
              {showKipConfig && (
                <div className="p-4 bg-violet-50/20 border border-violet-100 rounded-2xl space-y-3 max-h-[160px] overflow-y-auto">
                  {groups.length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-white/50">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chưa thiết lập kíp nào</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">Bấm nút "+ Thêm kíp" để cấu hình cố định nhân sự cho từng thủ thuật ngày hôm nay</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
                      {groups.map((group, index) => {
                        const proc = departmentProcedures.find(p => p.id === group.procedureId);
                        const needsAsst1 = proc ? ((proc.asst1BusyEnd !== undefined && proc.asst1BusyEnd > 0) || (proc.assistant1BusyMinutes !== undefined && proc.assistant1BusyMinutes > 0)) : false;
                        const needsAsst2 = proc ? ((proc.asst2BusyEnd !== undefined && proc.asst2BusyEnd > 0) || (proc.assistant2BusyMinutes !== undefined && proc.assistant2BusyMinutes > 0)) : false;

                        return (
                          <div key={group.id} className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm relative flex flex-col gap-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <span className="text-xs font-extrabold text-violet-700 uppercase tracking-wider">Kíp #{index + 1}</span>
                              <button
                                onClick={() => handleRemoveGroup(group.id)}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100"
                              >
                                Xóa kíp
                              </button>
                            </div>
                            
                            <div className="space-y-2">
                              {/* Procedure Selection */}
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Thủ thuật</label>
                                <select
                                  value={group.procedureId}
                                  onChange={e => {
                                    handleUpdateGroup(group.id, 'procedureId', e.target.value);
                                    handleUpdateGroup(group.id, 'mainStaffId', '');
                                    handleUpdateGroup(group.id, 'assistant1Id', '');
                                    handleUpdateGroup(group.id, 'assistant2Id', '');
                                  }}
                                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all"
                                >
                                  {departmentProcedures.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                {/* Main Doctor */}
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Bác sĩ chính</label>
                                  <select
                                    value={group.mainStaffId}
                                    onChange={e => handleUpdateGroup(group.id, 'mainStaffId', e.target.value)}
                                    className="w-full text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-1.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all"
                                  >
                                    <option value="">-- Tự động --</option>
                                    {attendingStaff.filter(s => s.mainCapabilityIds?.includes(group.procedureId)).map(s => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Asst 1 */}
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Người phụ 1</label>
                                  <select
                                    disabled={!needsAsst1}
                                    value={needsAsst1 ? group.assistant1Id : ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      handleUpdateGroup(group.id, 'assistant1Id', val);
                                      if (proc?.allowSameAssistant) {
                                        handleUpdateGroup(group.id, 'assistant2Id', val);
                                      }
                                    }}
                                    className={`w-full text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-1.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all ${!needsAsst1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {!needsAsst1 ? (
                                      <option value="">Không yêu cầu</option>
                                    ) : (
                                      <>
                                        <option value="">-- Tự động --</option>
                                        {attendingStaff.filter(s => s.assistantCapabilityIds?.includes(group.procedureId)).map(s => (
                                          <option key={s.id} value={s.id}>
                                            {s.name}
                                          </option>
                                        ))}
                                      </>
                                    )}
                                  </select>
                                </div>

                                {/* Asst 2 */}
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                                    Người phụ 2 {proc?.allowSameAssistant && <span className="text-amber-600 font-semibold lowercase">(Đồng bộ Phụ 1)</span>}
                                  </label>
                                  <select
                                    disabled={!needsAsst2 || !!proc?.allowSameAssistant}
                                    value={proc?.allowSameAssistant ? (group.assistant1Id || '') : (needsAsst2 ? group.assistant2Id : '')}
                                    onChange={e => handleUpdateGroup(group.id, 'assistant2Id', e.target.value)}
                                    className={`w-full text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-1.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all ${(!needsAsst2 || proc?.allowSameAssistant) ? 'opacity-70 bg-amber-50/50 cursor-not-allowed border-amber-200' : ''}`}
                                  >
                                    {!needsAsst2 ? (
                                      <option value="">Không yêu cầu</option>
                                    ) : proc?.allowSameAssistant ? (
                                      <option value="">-- Đồng bộ theo Phụ 1 --</option>
                                    ) : (
                                      <>
                                        <option value="">-- Tự động --</option>
                                        {attendingStaff.filter(s => s.assistantCapabilityIds?.includes(group.procedureId)).map(s => (
                                          <option key={s.id} value={s.id}>
                                            {s.name}
                                          </option>
                                        ))}
                                      </>
                                    )}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Matrix Table */}
            <div className="flex-1 flex flex-col min-h-0 p-6 md:p-8 relative">
              {departmentPatients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                  <User size={48} className="text-slate-300" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-wider animate-pulse">Không tìm thấy bệnh nhân nào đang điều trị tại khoa này</p>
                </div>
              ) : (
                <div className="w-full flex-1 overflow-auto border border-slate-150 rounded-2xl shadow-sm bg-white">
                  <table className="min-w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 select-none">
                        <th className="p-4 text-xs font-black text-slate-600 uppercase tracking-wider sticky top-0 left-0 bg-slate-50 border-r border-slate-200 z-40 min-w-[280px] w-[280px]">
                          Danh sách bệnh nhân
                        </th>
                        <th className="p-4 text-xs font-black text-slate-600 uppercase tracking-wider sticky top-0 bg-slate-50 border-r border-slate-200 min-w-[240px] w-[240px]">
                          Thủ thuật đã có
                        </th>
                        <th className="p-4 text-xs font-black text-slate-600 uppercase tracking-wider sticky top-0 bg-slate-50 border-r border-slate-200 min-w-[340px] w-[340px]">
                          Thủ thuật xếp lịch nhanh
                        </th>
                        <th className="p-4 text-xs font-black text-slate-600 uppercase tracking-wider sticky top-0 bg-slate-50 min-w-[300px] w-[300px]">
                          Chọn khung giờ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {departmentPatients.map(p => {
                        const config = getPatientTimeConfig(p.id);
                        const existingAppts = appointments.filter(
                          a => a.patientId === p.id && a.date === currentDate
                        );
                        const patientTasks = quickScheduleTasks[p.id] || [];

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                            {/* Column 1: Patient details */}
                            <td className="p-4 sticky left-0 bg-white border-r border-slate-200 font-bold text-slate-700 text-sm z-30 shadow-[6px_0_12px_-3px_rgba(0,0,0,0.08)]">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {p.insuranceLevel && (
                                    <span className={`shrink-0 w-2.5 h-3.5 rounded-[2px] border shadow-sm ${
                                      p.insuranceLevel === '0%' ? 'bg-rose-500 border-rose-600' :
                                      p.insuranceLevel === '80%' ? 'bg-orange-500 border-orange-600' :
                                      p.insuranceLevel === '95%' ? 'bg-lime-400 border-lime-500' :
                                      'bg-emerald-500 border-emerald-600'
                                    }`} title={`BHYT: ${p.insuranceLevel}`} />
                                  )}
                                  <span className="text-slate-800 text-[14px] font-black tracking-tight leading-none">{p.name}</span>
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md uppercase shrink-0">
                                    {p.gender}
                                  </span>
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0">
                                    {calculateAge(p.dob)} tuổi
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2 mt-1 text-[10px] font-black text-slate-500 uppercase tracking-wider flex-wrap">
                                  <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md border border-amber-200">
                                    Giường: {p.bedNumber || '?'}
                                  </span>
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                                    Loại: {p.bedType || 'Nội trú'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Column 2: Existing procedures */}
                            <td className="p-4 border-r border-slate-200 vertical-align-top">
                              {existingAppts.length === 0 ? (
                                <span className="text-xs text-slate-400 italic">Chưa có lịch trình nào</span>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {existingAppts.map(appt => {
                                    const proc = procedures.find(proc => proc.id === appt.procedureId);
                                    return (
                                      <div key={appt.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-bold text-slate-600">
                                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                                        <div className="flex flex-col">
                                          <span className="text-slate-800 font-extrabold">{proc?.name || 'Thủ thuật'}</span>
                                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">{appt.startTime} - {appt.endTime}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>

                            {/* Column 3: Quick schedule tasks */}
                            <td className="p-4 border-r border-slate-200 vertical-align-top">
                              <div className="flex flex-col gap-2">
                                {patientTasks.map(task => {
                                  const proc = procedures.find(proc => proc.id === task.procedureId);
                                  const mainS = staff.find(s => s.id === task.mainStaffId);
                                  
                                  return (
                                    <div key={task.id} className="flex items-center justify-between gap-3 bg-violet-50/50 border border-violet-100 rounded-xl p-2.5 text-xs text-slate-700 font-bold group">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-violet-950 font-black">{proc?.name || 'Thủ thuật'}</span>
                                        <div className="flex items-center gap-2 mt-0.5 text-[9px] font-bold text-violet-600 uppercase tracking-wide">
                                          <span>{task.durationMinutes}p</span>
                                          {mainS && (
                                            <span className="bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded">
                                              BS: {mainS.name}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => {
                                          setQuickScheduleTasks(prev => ({
                                            ...prev,
                                            [p.id]: (prev[p.id] || []).filter(t => t.id !== task.id)
                                          }));
                                        }}
                                        className="text-slate-400 hover:text-rose-500 transition-colors p-1 hover:bg-rose-50 rounded-lg"
                                        title="Xóa thủ thuật"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  );
                                })}
                                
                                <button
                                  onClick={() => {
                                    setAddProcState({
                                      isOpen: true,
                                      patientId: p.id,
                                      selectedCategory: 'Lâm sàng',
                                      selectedProcedureId: '',
                                      selectedDurationOptionId: '',
                                      mainStaffId: '',
                                      assistant1Id: '',
                                      assistant2Id: '',
                                      deviceId: ''
                                    });
                                  }}
                                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-200 hover:border-slate-300 rounded-xl text-xs font-black text-slate-500 hover:text-slate-800 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
                                >
                                  <Plus size={14} className="stroke-slate-500 hover:stroke-slate-800" />
                                  <span>+ Thêm thủ thuật</span>
                                </button>
                              </div>
                            </td>

                            {/* Column 4: Select time configuration */}
                            <td className="p-4 vertical-align-top">
                              <div className="space-y-3 p-1">
                                {/* Sáng row */}
                                <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-700">
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={config.morningActive}
                                      onChange={e => {
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: {
                                            ...config,
                                            morningActive: e.target.checked
                                          }
                                        }));
                                      }}
                                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span className={config.morningActive ? "text-slate-900 font-extrabold" : "text-slate-400 font-medium"}>Sáng</span>
                                  </label>

                                  <div className={`flex items-center gap-1 border border-slate-200 rounded-xl px-2 py-1 shadow-sm bg-white transition-all ${!config.morningActive ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <input
                                      type="text"
                                      maxLength={5}
                                      placeholder="07:30"
                                      value={config.morningStart}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: { ...config, morningStart: val }
                                        }));
                                      }}
                                      onBlur={e => {
                                        const formatted = formatAndValidateTime(e.target.value, '07:30');
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: { ...config, morningStart: formatted }
                                        }));
                                      }}
                                      className="w-10 text-[11px] font-black text-slate-700 outline-none bg-transparent font-mono text-center"
                                    />
                                    <span className="text-slate-400 text-[10px] font-normal px-0.5">-</span>
                                    <input
                                      type="text"
                                      maxLength={5}
                                      placeholder="11:30"
                                      value={config.morningEnd}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: { ...config, morningEnd: val }
                                        }));
                                      }}
                                      onBlur={e => {
                                        const formatted = formatAndValidateTime(e.target.value, '11:30');
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: { ...config, morningEnd: formatted }
                                        }));
                                      }}
                                      className="w-10 text-[11px] font-black text-slate-700 outline-none bg-transparent font-mono text-center"
                                    />
                                  </div>
                                </div>

                                {/* Chiều row */}
                                <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-700">
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={config.afternoonActive}
                                      onChange={e => {
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: {
                                            ...config,
                                            afternoonActive: e.target.checked
                                          }
                                        }));
                                      }}
                                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span className={config.afternoonActive ? "text-slate-900 font-extrabold" : "text-slate-400 font-medium"}>Chiều</span>
                                  </label>

                                  <div className={`flex items-center gap-1 border border-slate-200 rounded-xl px-2 py-1 shadow-sm bg-white transition-all ${!config.afternoonActive ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <input
                                      type="text"
                                      maxLength={5}
                                      placeholder="13:30"
                                      value={config.afternoonStart}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: { ...config, afternoonStart: val }
                                        }));
                                      }}
                                      onBlur={e => {
                                        const formatted = formatAndValidateTime(e.target.value, '13:30');
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: { ...config, afternoonStart: formatted }
                                        }));
                                      }}
                                      className="w-10 text-[11px] font-black text-slate-700 outline-none bg-transparent font-mono text-center"
                                    />
                                    <span className="text-slate-400 text-[10px] font-normal px-0.5">-</span>
                                    <input
                                      type="text"
                                      maxLength={5}
                                      placeholder="17:30"
                                      value={config.afternoonEnd}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: { ...config, afternoonEnd: val }
                                        }));
                                      }}
                                      onBlur={e => {
                                        const formatted = formatAndValidateTime(e.target.value, '17:30');
                                        setPatientTimeConfigs(prev => ({
                                          ...prev,
                                          [p.id]: { ...config, afternoonEnd: formatted }
                                        }));
                                      }}
                                      className="w-10 text-[11px] font-black text-slate-700 outline-none bg-transparent font-mono text-center"
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50/30">
              <Button variant="secondary" onClick={handleResetModal}>Hủy bỏ</Button>
              <Button 
                onClick={handleConfirm} 
                className="bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-500/15"
                disabled={departmentPatients.length === 0}
              >
                Xác nhận sắp xếp
              </Button>
            </div>
          </div>
        ) : (
          /* Process & Status Screen */
          <div className="flex-1 p-10 flex flex-col items-center justify-center space-y-8 overflow-y-auto">
            {!isCompleted ? (
              <div className="w-full max-w-md text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-violet-600 font-black text-lg">
                    {progress}%
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight animate-pulse">Hệ thống đang sắp xếp lịch</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    Đang tìm kiếm khoảng thời gian phù hợp cho các bệnh nhân & nhân sự, tránh xung đột lịch trình...
                  </p>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl flex justify-around text-center border border-slate-100 shadow-sm">
                  <div>
                    <p className="text-xl font-black text-emerald-600">{scheduledCount}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã xếp được</p>
                  </div>
                  <div className="border-l border-slate-200"></div>
                  <div>
                    <p className="text-xl font-black text-rose-500">{failedCount}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bỏ qua / Thất bại</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Completion Report */
              <div className="w-full max-w-2xl bg-white border border-slate-150 rounded-3xl p-8 shadow-xl space-y-6">
                <div className="flex items-center gap-4 text-left border-b border-slate-100 pb-5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={28} className="fill-emerald-100" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sắp xếp lịch hoàn tất!</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hệ thống đã hoàn tất phân chia thời gian thông minh</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <p className="text-2xl font-black text-emerald-600">{scheduledCount}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Xếp thành công</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-2xl font-black text-slate-700">{failedCount}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Không xếp được</p>
                  </div>
                </div>

                {failedDetails.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider text-left pl-1">Danh sách thủ thuật không xếp được:</h4>
                    <div className="max-h-[180px] overflow-y-auto border border-slate-150 rounded-2xl divide-y divide-slate-100 text-left">
                      {failedDetails.map((f, idx) => (
                        <div key={idx} className="p-3 text-xs font-bold text-slate-600 flex items-start justify-between gap-4 bg-slate-50/30">
                          <div>
                            <span className="text-slate-800 font-extrabold">{f.patientName}</span>
                            <span className="text-slate-400 mx-1.5">•</span>
                            <span className="text-violet-600">{f.procedureName}</span>
                          </div>
                          <span className="text-rose-500 text-[11px] font-bold italic text-right shrink-0">{f.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={handleResetModal}
                    className="bg-slate-800 text-white hover:bg-slate-900 shadow-md px-8"
                  >
                    Hoàn tất
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Warning Modal for duplicate scheduling confirmation */}
        {warningModal?.isOpen && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                  <AlertCircle size={24} className="stroke-amber-600" />
                </div>
                <div className="space-y-1.5 text-left">
                  <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">Cảnh báo trùng lịch</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Bệnh nhân <strong className="text-slate-800 font-extrabold">{warningModal.patientName}</strong> đã có lịch trình <strong className="text-violet-600 font-black">{warningModal.procedureName}</strong> vào ngày hôm nay.
                  </p>
                  <p className="text-[11px] text-amber-700 font-bold bg-amber-50/50 p-2 rounded-xl border border-amber-150 leading-normal">
                    Bạn có chắc chắn muốn tiếp tục xếp thêm lịch trình trùng này không?
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 border-t border-slate-50 pt-4">
                <button
                  onClick={() => setWarningModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Bỏ qua
                </button>
                <button
                  onClick={() => {
                    if (warningModal?.onConfirm) {
                      warningModal.onConfirm();
                    }
                  }}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-md shadow-violet-500/10 animate-pulse"
                >
                  Đồng ý xếp thêm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* "+ Thêm thủ thuật" Selection Dialog */}
        {addProcState?.isOpen && (() => {
          const selectedPatient = patients.find(p => p.id === addProcState.patientId);
          const selectedProc = procedures.find(p => p.id === addProcState.selectedProcedureId);
          const filteredProcs = procedures.filter(p => p.deptId === currentDept.id && (p.category || 'Khác') === addProcState.selectedCategory);
          
          // Get chosen duration option details
          const selectedDurationOpt = selectedProc?.durationOptions?.find(o => o.id === addProcState.selectedDurationOptionId);
          
          const needsAsst1 = selectedDurationOpt ? (
            (selectedDurationOpt.asst1BusyEnd !== undefined && selectedDurationOpt.asst1BusyEnd > 0)
          ) : (selectedProc ? (
            (selectedProc.asst1BusyEnd !== undefined && selectedProc.asst1BusyEnd > 0) ||
            (selectedProc.assistant1BusyMinutes !== undefined && selectedProc.assistant1BusyMinutes > 0)
          ) : false);

          const needsAsst2 = selectedDurationOpt ? (
            (selectedDurationOpt.asst2BusyEnd !== undefined && selectedDurationOpt.asst2BusyEnd > 0)
          ) : (selectedProc ? (
            (selectedProc.asst2BusyEnd !== undefined && selectedProc.asst2BusyEnd > 0) ||
            (selectedProc.assistant2BusyMinutes !== undefined && selectedProc.assistant2BusyMinutes > 0)
          ) : false);

          const isSameAsst = selectedDurationOpt ? (
            selectedDurationOpt.allowSameAssistant ?? selectedProc?.allowSameAssistant
          ) : selectedProc?.allowSameAssistant;

          const availableDevices = selectedProc?.availableMachines || [];
          const categories = ['Lâm sàng', 'Cận lâm sàng', 'Hành chính', 'Khác'];
          if (!selectedPatient) return null;

          return (
            <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
              <div className="bg-white rounded-[32px] p-6 shadow-2xl max-w-lg w-full animate-in fade-in zoom-in-95 duration-200 border border-slate-100 flex flex-col gap-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="space-y-0.5 text-left">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Thêm thủ thuật xếp lịch nhanh</h3>
                    <p className="text-xs font-bold text-slate-400">
                      Bệnh nhân: <span className="text-slate-800 font-extrabold">{selectedPatient.name}</span> ({selectedPatient.gender} • {calculateAge(selectedPatient.dob)} tuổi)
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAddProcState(null);
                      setAddProcDuplicateWarning(false);
                    }}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-2 rounded-2xl transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Warning Banner for Duplicate */}
                {addProcDuplicateWarning && (
                  <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-2xl flex items-start gap-3 text-left">
                    <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-black text-amber-800">CẢNH BÁO TRÙNG LỊCH TRÌNH</p>
                      <p className="text-[11px] text-amber-700 font-bold leading-normal">
                        Bệnh nhân này đã có lịch trình <strong className="text-amber-950 font-black">{selectedProc?.name}</strong> hôm nay. Bạn có chắc chắn muốn xếp thêm không?
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 1: Chọn Nhóm */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Bước 1: Chọn nhóm thủ thuật</label>
                  <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl">
                    {categories.map(cat => {
                      const active = addProcState.selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setAddProcState(prev => prev ? {
                              ...prev,
                              selectedCategory: cat,
                              selectedProcedureId: '',
                              selectedDurationOptionId: '',
                              mainStaffId: '',
                              assistant1Id: '',
                              assistant2Id: '',
                              deviceId: ''
                            } : null);
                            setAddProcDuplicateWarning(false);
                          }}
                          className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Chọn Thủ thuật */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Bước 2: Chọn thủ thuật trong nhóm</label>
                  <select
                    value={addProcState.selectedProcedureId}
                    onChange={e => {
                      const pId = e.target.value;
                      setAddProcState(prev => prev ? {
                        ...prev,
                        selectedProcedureId: pId,
                        selectedDurationOptionId: '',
                        mainStaffId: '',
                        assistant1Id: '',
                        assistant2Id: '',
                        deviceId: ''
                      } : null);
                      setAddProcDuplicateWarning(false);
                    }}
                    className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all cursor-pointer"
                  >
                    <option value="">-- Chọn thủ thuật --</option>
                    {filteredProcs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.durationMinutes} phút)
                      </option>
                    ))}
                  </select>
                  {filteredProcs.length === 0 && (
                    <p className="text-[11px] font-bold text-slate-400 italic">Không tìm thấy thủ thuật nào thuộc nhóm này trong khoa của bạn.</p>
                  )}
                </div>

                {/* Step 2.5: Chọn thời lượng (Thời lượng hiện có) */}
                {selectedProc && (
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Bước 2.5: Chọn thời lượng (Thời lượng hiện có)</label>
                    <select
                      value={addProcState.selectedDurationOptionId}
                      onChange={e => {
                        const optId = e.target.value;
                        const opt = selectedProc.durationOptions?.find(o => o.id === optId);
                        const currentAllowSame = opt ? (opt.allowSameAssistant ?? selectedProc.allowSameAssistant) : selectedProc.allowSameAssistant;
                        
                        setAddProcState(prev => {
                          if (!prev) return null;
                          let asst2 = prev.assistant2Id;
                          if (currentAllowSame && prev.assistant1Id) {
                            asst2 = prev.assistant1Id;
                          }
                          return {
                            ...prev,
                            selectedDurationOptionId: optId,
                            assistant2Id: asst2
                          };
                        });
                      }}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all cursor-pointer"
                    >
                      <option value="">Mặc định ({selectedProc.durationMinutes} phút)</option>
                      {selectedProc.durationOptions?.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name} ({opt.durationMinutes} phút)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Step 3: Chọn Nhân sự & Thiết bị nếu cần */}
                {selectedProc && (
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Bước 3: Tùy chỉnh nhân sự & máy (Nếu cần)</span>
                      <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">Hệ thống sẽ tự động phân công nếu bỏ trống</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Bác sĩ chính */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Bác sĩ / KTV chính</label>
                        <select
                          value={addProcState.mainStaffId}
                          onChange={e => setAddProcState(prev => prev ? { ...prev, mainStaffId: e.target.value } : null)}
                          className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all cursor-pointer"
                        >
                          <option value="">-- Tự động phân công --</option>
                          {attendingStaff.filter(s => s.mainCapabilityIds?.includes(selectedProc.id)).map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.role === 'Doctor' ? 'BS' : 'KTV'})</option>
                          ))}
                        </select>
                      </div>

                      {/* Thiết bị / Máy */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Thiết bị / Máy</label>
                        {availableDevices.length > 0 ? (
                          <select
                            value={addProcState.deviceId}
                            onChange={e => setAddProcState(prev => prev ? { ...prev, deviceId: e.target.value } : null)}
                            className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all cursor-pointer"
                          >
                            <option value="">-- Tự động phân công --</option>
                            {availableDevices.map(mId => (
                              <option key={mId} value={mId}>{mId}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="w-full text-xs font-bold text-slate-400 bg-slate-50/50 border border-slate-200 rounded-xl p-2.5 select-none">
                            Không yêu cầu thiết bị
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Assistants rows if required */}
                    {(needsAsst1 || needsAsst2) && (
                      <div className="grid grid-cols-2 gap-3">
                        {/* Assistant 1 */}
                        {needsAsst1 && (
                          <div className="space-y-1.5 text-left">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Người phụ 1</label>
                            <select
                              value={addProcState.assistant1Id}
                              onChange={e => {
                                const val = e.target.value;
                                setAddProcState(prev => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    assistant1Id: val,
                                    assistant2Id: isSameAsst ? val : prev.assistant2Id
                                  };
                                });
                              }}
                              className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all cursor-pointer"
                            >
                              <option value="">-- Tự động phân công --</option>
                              {attendingStaff.filter(s => s.assistantCapabilityIds?.includes(selectedProc.id)).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Assistant 2 */}
                        {needsAsst2 && (
                          <div className="space-y-1.5 text-left">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                              Người phụ 2 {isSameAsst && <span className="text-amber-600 font-semibold lowercase">(Đồng bộ Phụ 1)</span>}
                            </label>
                            <select
                              disabled={!!isSameAsst}
                              value={isSameAsst ? (addProcState.assistant1Id || '') : addProcState.assistant2Id}
                              onChange={e => setAddProcState(prev => prev ? { ...prev, assistant2Id: e.target.value } : null)}
                              className={`w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all cursor-pointer ${isSameAsst ? 'opacity-70 bg-amber-50/50 cursor-not-allowed border-amber-200 text-amber-900' : ''}`}
                            >
                              {isSameAsst ? (
                                <option value="">-- Đồng bộ theo Phụ 1 --</option>
                              ) : (
                                <>
                                  <option value="">-- Tự động phân công --</option>
                                  {attendingStaff.filter(s => s.assistantCapabilityIds?.includes(selectedProc.id)).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </>
                              )}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setAddProcState(null);
                      setAddProcDuplicateWarning(false);
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleAddProcedureConfirm}
                    disabled={!addProcState.selectedProcedureId}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-md ${
                      addProcDuplicateWarning 
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/10 animate-pulse'
                        : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/10'
                    } ${!addProcState.selectedProcedureId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {addProcDuplicateWarning ? 'Vẫn xếp thêm' : 'Xác nhận'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
