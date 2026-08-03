import React, { useState, useMemo } from 'react';
import { X, Clock, Zap, Check, ChevronDown, Sparkles, AlertCircle, RefreshCw, User, HelpCircle, CheckCircle2, Plus } from 'lucide-react';
import { Button } from './Button';
import { Patient, Appointment, Procedure, Staff, AttendanceRecord, AppointmentStatus, Department, AttendanceStatus } from '../types';
import { timeStringToMinutes, minutesToTimeString, checkConflict } from '../utils/timeUtils';
import { doc } from 'firebase/firestore';
import { setDoc } from '../utils/dbService';
import { db } from '../firebase';

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
  // 1. Time config
  const [fromTime, setFromTime] = useState('08:30');
  const [toTime, setToTime] = useState('11:30');

  // Scheduling options: free (sắp xếp tự do) vs group (ưu tiên sắp xếp theo kíp)
  const [scheduleMode, setScheduleMode] = useState<'free' | 'group'>('free');
  const [groups, setGroups] = useState<KipConfig[]>([]);

  // Attending department staff (present on current day)
  const attendingStaff = useMemo(() => {
    return staff.filter(s => {
      if (s.deptId !== currentDept.id) return false;
      
      const isHoliday = attendanceRecords.some(r => r.staffId === `holiday_dept_${currentDept.id}` && r.date === currentDate && r.status === AttendanceStatus.OFF_FULL);
      
      const isWeekendDay = (() => {
        if (!currentDate) return false;
        const parts = currentDate.split('-');
        if (parts.length !== 3) return false;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        const dOfWeek = d.getDay();
        return dOfWeek === 0 || dOfWeek === 6;
      })();

      const rec = attendanceRecords.find(r => r.staffId === s.id && r.date === currentDate);

      if (isHoliday || isWeekendDay) {
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

  // 2. Filter patients who are TREATING and belong to or are referred to this department
  const departmentPatients = useMemo(() => {
    return patients.filter(p => {
      // Must be treating (not discharged yet or discharged in the future)
      if (p.status !== 'TREATING') return false;

      // Filter based on department
      if (p.admittedByDeptId === currentDept.id) return true;

      // If support department, verify active referral
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

  // 3. Filter procedures of this department
  const departmentProcedures = useMemo(() => {
    return procedures.filter(p => p.deptId === currentDept.id);
  }, [procedures, currentDept]);

  // Helper to fetch custom duration options for a procedure
  const getProcDurationOptions = (proc: Procedure) => {
    if (proc.durationOptions && proc.durationOptions.length > 0) {
      return proc.durationOptions;
    }
    // Fallback for "Điện châm" to provide 25m and 30m as requested in instructions
    if (proc.id === 'pr_diencham' || proc.name.toLowerCase().includes('điện châm')) {
      return [
        { id: 'opt_25', name: 'Điện châm 25 phút', durationMinutes: 25 },
        { id: 'opt_30', name: 'Điện châm 30 phút', durationMinutes: 30 }
      ];
    }
    return [];
  };

  // State: cell-level selections: selections[patientId][procedureId] = SelectionState
  const [selection, setSelection] = useState<Record<string, Record<string, SelectionState>>>({});

  // States for scheduling progress
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [failedDetails, setFailedDetails] = useState<{ patientName: string; procedureName: string; reason: string }[]>([]);

  if (!isOpen) return null;

  // Toggle cell selection (0 -> 1 -> 2 -> 0)
  const handleCellClick = (patientId: string, proc: Procedure) => {
    setSelection(prev => {
      const patientSel = prev[patientId] || {};
      const currentCell = patientSel[proc.id] || { level: 0, durationMinutes: proc.durationMinutes };
      
      let nextLevel: 0 | 1 | 2 = 0;
      if (currentCell.level === 0) nextLevel = 1;
      else if (currentCell.level === 1) nextLevel = 2;
      else nextLevel = 0;

      const updatedCell: SelectionState = {
        ...currentCell,
        level: nextLevel,
      };

      return {
        ...prev,
        [patientId]: {
          ...patientSel,
          [proc.id]: updatedCell
        }
      };
    });
  };

  // Select/Deselect ALL patients for a procedure column
  const handleColumnClick = (proc: Procedure) => {
    // Check if any patient is not selected for this procedure
    const anyUnselected = departmentPatients.some(p => {
      const cell = selection[p.id]?.[proc.id];
      return !cell || cell.level === 0;
    });

    // Check if any is level 1
    const anyLevel1 = departmentPatients.some(p => {
      const cell = selection[p.id]?.[proc.id];
      return cell && cell.level === 1;
    });

    let targetLevel: 0 | 1 | 2 = 1;
    if (!anyUnselected && anyLevel1) {
      targetLevel = 2; // All are level 1, elevate to level 2
    } else if (!anyUnselected && !anyLevel1) {
      targetLevel = 0; // All are level 2, turn off
    }

    setSelection(prev => {
      const next = { ...prev };
      departmentPatients.forEach(p => {
        const patientSel = next[p.id] || {};
        next[p.id] = {
          ...patientSel,
          [proc.id]: {
            level: targetLevel,
            durationMinutes: patientSel[proc.id]?.durationMinutes || proc.durationMinutes,
            durationOptionId: patientSel[proc.id]?.durationOptionId || null
          }
        };
      });
      return next;
    });
  };

  // Change duration for a specific cell
  const handleCellDurationChange = (patientId: string, procId: string, optionId: string, minutes: number) => {
    setSelection(prev => {
      const patientSel = prev[patientId] || {};
      const currentCell = patientSel[procId] || { level: 1, durationMinutes: minutes };
      return {
        ...prev,
        [patientId]: {
          ...patientSel,
          [procId]: {
            ...currentCell,
            durationMinutes: minutes,
            durationOptionId: optionId === 'default' ? null : optionId
          }
        }
      };
    });
  };

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
    dedicatedAsst2Id?: string | null
  ) => {
    // Find staff with main capability for this procedure
    let eligibleMain = staffList.filter(s => s.mainCapabilityIds?.includes(procedure.id));
    if (dedicatedMainId) {
      const idx = eligibleMain.findIndex(s => s.id === dedicatedMainId);
      if (idx > -1) {
        const [match] = eligibleMain.splice(idx, 1);
        eligibleMain = [match, ...eligibleMain];
      }
    }

    // Check if assistant is required
    const hasAsst1 = (procedure.asst1BusyEnd !== undefined && procedure.asst1BusyEnd > 0) ||
                     (procedure.assistant1BusyMinutes !== undefined && procedure.assistant1BusyMinutes > 0);
    const hasAsst2 = (procedure.asst2BusyEnd !== undefined && procedure.asst2BusyEnd > 0) ||
                     (procedure.assistant2BusyMinutes !== undefined && procedure.assistant2BusyMinutes > 0);

    let eligibleAsst1 = hasAsst1 ? staffList.filter(s => s.assistantCapabilityIds?.includes(procedure.id)) : [null];
    if (hasAsst1 && dedicatedAsst1Id) {
      const idx = eligibleAsst1.findIndex(s => s && s.id === dedicatedAsst1Id);
      if (idx > -1) {
        const match = eligibleAsst1[idx];
        eligibleAsst1.splice(idx, 1);
        eligibleAsst1 = [match, ...eligibleAsst1];
      }
    }

    let eligibleAsst2 = hasAsst2 ? staffList.filter(s => s.assistantCapabilityIds?.includes(procedure.id)) : [null];
    if (hasAsst2 && dedicatedAsst2Id) {
      const idx = eligibleAsst2.findIndex(s => s && s.id === dedicatedAsst2Id);
      if (idx > -1) {
        const match = eligibleAsst2[idx];
        eligibleAsst2.splice(idx, 1);
        eligibleAsst2 = [match, ...eligibleAsst2];
      }
    }

    // Slide search from userStartMin to userEndMin - durationMins
    // Optimization: step by 5 minutes for extreme scheduling speed and clean visual slots
    for (let currentMin = userStartMin; currentMin + durationMins <= userEndMin; currentMin += 5) {
      const startStr = minutesToTimeString(currentMin);
      const endStr = minutesToTimeString(currentMin + durationMins);

      for (const mainStaff of eligibleMain) {
        for (const asst1 of eligibleAsst1) {
          if (asst1 && asst1.id === mainStaff.id) continue;

          for (const asst2 of eligibleAsst2) {
            if (asst2 && (asst2.id === mainStaff.id || (asst1 && asst2.id === asst1.id))) continue;

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
      level: 1 | 2;
      durationMinutes: number;
      durationOptionId?: string | null;
    }[] = [];

    for (const patient of departmentPatients) {
      for (const proc of departmentProcedures) {
        const cellState = selection[patient.id]?.[proc.id];
        if (cellState && cellState.level > 0) {
          // Skip if already scheduled on this date
          const hasExisting = appointments.some(
            a => a.patientId === patient.id && a.procedureId === proc.id && a.date === currentDate
          );
          if (hasExisting) {
            continue;
          }

          tasks.push({
            patient,
            procedure: proc,
            level: cellState.level as 1 | 2,
            durationMinutes: cellState.durationMinutes || proc.durationMinutes,
            durationOptionId: cellState.durationOptionId || null
          });
        }
      }
    }

    if (tasks.length === 0) {
      alert("Vui lòng chọn ít nhất một thủ thuật cần sắp xếp.");
      setIsProcessing(false);
      return;
    }

    // Sort Level 2 (Priority) first, then Level 1 (Xếp giờ)
    tasks.sort((a, b) => b.level - a.level);

    let successCount = 0;
    let failCount = 0;
    const fails: typeof failedDetails = [];
    let tempAppointments = [...appointments];

    const totalTasks = tasks.length;
    const userStartMin = timeStringToMinutes(fromTime);
    const userEndMin = timeStringToMinutes(toTime);

    // Track next available start minutes per procedure to support consecutive ("gối tiếp") scheduling starting from userStartMin.
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

      const searchStartMin = Math.max(userStartMin, nextProcStartMin[task.procedure.id] || userStartMin);

      let slot: any = null;

      if (scheduleMode === 'group') {
        const matchingKips = groups.filter(g => g.procedureId === task.procedure.id);
        if (matchingKips.length > 0) {
          // Find the earliest slot across all matching kips
          let bestSlot: any = null;
          let bestStartMin = Infinity;
          
          for (const kip of matchingKips) {
            const tempSlot = findValidSlotAndStaff(
              task.patient.id,
              task.procedure,
              task.durationMinutes,
              searchStartMin,
              userEndMin,
              tempAppointments,
              staff,
              procedures,
              attendanceRecords,
              patients,
              kip.mainStaffId || null,
              kip.assistant1Id || null,
              kip.assistant2Id || null
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
        } else {
          // No custom kip defined, use general search
          slot = findValidSlotAndStaff(
            task.patient.id,
            task.procedure,
            task.durationMinutes,
            searchStartMin,
            userEndMin,
            tempAppointments,
            staff,
            procedures,
            attendanceRecords,
            patients,
            null,
            null,
            null
          );
        }
      } else {
        // Free scheduling mode ('free'): can use the default pre-calculated dedicated teams for Dien cham & Thuy cham
        let dedicatedMain: string | null = null;
        let dedicatedAsst1: string | null = null;
        let dedicatedAsst2: string | null = null;

        if (isDc) {
          dedicatedMain = dcMainId;
          dedicatedAsst1 = dcAsst1Id;
          dedicatedAsst2 = dcAsst2Id;
        } else if (isTc) {
          dedicatedMain = tcMainId;
          dedicatedAsst1 = tcAsstId;
        }

        slot = findValidSlotAndStaff(
          task.patient.id,
          task.procedure,
          task.durationMinutes,
          searchStartMin,
          userEndMin,
          tempAppointments,
          staff,
          procedures,
          attendanceRecords,
          patients,
          dedicatedMain,
          dedicatedAsst1,
          dedicatedAsst2
        );
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
    setSelection({});
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
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
            <div className="p-6 bg-slate-50/40 border-b border-slate-100 flex flex-col gap-6 shrink-0">
              <div className="flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-violet-500 shrink-0" />
                  <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Khoảng thời gian xếp lịch:</span>
                </div>
                <div className="flex items-center gap-4">
                  {/* Custom Time Picker 1 (Từ) */}
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pr-2 border-r border-slate-100 select-none">Từ</span>
                    <div className="flex items-center gap-1">
                      <select
                        value={fromTime.split(':')[0]}
                        onChange={e => {
                          const [, m] = fromTime.split(':');
                          setFromTime(`${e.target.value}:${m}`);
                        }}
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer appearance-none px-1"
                      >
                        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(hour => (
                          <option key={hour} value={hour}>{hour}</option>
                        ))}
                      </select>
                      <span className="text-slate-400 font-extrabold text-xs select-none">:</span>
                      <select
                        value={fromTime.split(':')[1]}
                        onChange={e => {
                          const [h] = fromTime.split(':');
                          setFromTime(`${h}:${e.target.value}`);
                        }}
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer appearance-none px-1"
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(minute => (
                          <option key={minute} value={minute}>{minute}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Custom Time Picker 2 (Đến) */}
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pr-2 border-r border-slate-100 select-none">Đến</span>
                    <div className="flex items-center gap-1">
                      <select
                        value={toTime.split(':')[0]}
                        onChange={e => {
                          const [, m] = toTime.split(':');
                          setToTime(`${e.target.value}:${m}`);
                        }}
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer appearance-none px-1"
                      >
                        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(hour => (
                          <option key={hour} value={hour}>{hour}</option>
                        ))}
                      </select>
                      <span className="text-slate-400 font-extrabold text-xs select-none">:</span>
                      <select
                        value={toTime.split(':')[1]}
                        onChange={e => {
                          const [h] = toTime.split(':');
                          setToTime(`${h}:${e.target.value}`);
                        }}
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer appearance-none px-1"
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(minute => (
                          <option key={minute} value={minute}>{minute}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Mode selector */}
                <div className="flex items-center gap-3 border-l border-slate-250 pl-6">
                  <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Chế độ sắp xếp:</span>
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setScheduleMode('free')}
                      className={`px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all ${
                        scheduleMode === 'free'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Sắp xếp tự do
                    </button>
                    <button
                      onClick={() => setScheduleMode('group')}
                      className={`px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all ${
                        scheduleMode === 'group'
                          ? 'bg-white text-violet-700 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Ưu tiên kíp
                    </button>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-6">
                  <div className="flex gap-4 text-xs font-bold text-slate-500 select-none">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-emerald-50 border border-emerald-300"></span>
                      <span>Mức 1 (Xếp giờ)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-violet-50 border border-violet-300"></span>
                      <span>Mức 2 (Ưu tiên)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kíp Configuration box */}
              {scheduleMode === 'group' && (
                <div className="p-4 bg-violet-50/20 border border-violet-100 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-violet-600 fill-violet-200" />
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Cấu hình kíp thủ thuật chuyên biệt</span>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">Khi sắp xếp, kíp này sẽ được ưu tiên phân công trước cho thủ thuật tương ứng</p>
                    </div>
                    <button
                      onClick={handleAddGroup}
                      className="text-xs font-black text-white bg-violet-600 hover:bg-violet-700 transition-colors px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-violet-500/10"
                    >
                      <span>+ Thêm kíp</span>
                    </button>
                  </div>
                  
                  {groups.length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-white/50">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chưa thiết lập kíp nào</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">Bấm nút "+ Thêm kíp" để bắt đầu cấu hình nhân lực cố định cho từng thủ thuật</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[160px] overflow-y-auto pr-1">
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
                                    onChange={e => handleUpdateGroup(group.id, 'assistant1Id', e.target.value)}
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
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Người phụ 2</label>
                                  <select
                                    disabled={!needsAsst2}
                                    value={needsAsst2 ? group.assistant2Id : ''}
                                    onChange={e => handleUpdateGroup(group.id, 'assistant2Id', e.target.value)}
                                    className={`w-full text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-1.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all ${!needsAsst2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {!needsAsst2 ? (
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
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Không tìm thấy bệnh nhân nào đang điều trị tại khoa này</p>
                </div>
              ) : (
                <div className="w-full flex-1 overflow-auto border border-slate-150 rounded-2xl shadow-sm bg-white">
                  <table className="min-w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 select-none">
                        <th className="p-4 text-xs font-black text-slate-600 uppercase tracking-wider sticky top-0 left-0 bg-slate-50 border-r border-slate-200 z-40 min-w-[320px] w-[320px] md:min-w-[360px] md:w-[360px] shadow-[4px_0_8px_rgba(0,0,0,0.03)]">
                          Danh sách bệnh nhân
                        </th>
                        {departmentProcedures.map(proc => (
                          <th key={proc.id} className="p-4 text-xs font-black text-slate-600 uppercase tracking-wider text-center border-r border-slate-200 min-w-[180px] w-[180px] sticky top-0 bg-slate-50 z-20">
                            <button
                              onClick={() => handleColumnClick(proc)}
                              className="w-full flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-150/50 transition-colors text-center"
                              title="Bấm để chọn hàng loạt thủ thuật này cho tất cả bệnh nhân"
                            >
                              <span className="text-slate-800 text-xs font-black line-clamp-1">{proc.name}</span>
                              <span className="text-[9px] text-indigo-500 font-black font-mono tracking-normal bg-indigo-50 px-1.5 py-0.5 rounded-md">{proc.durationMinutes}p</span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {departmentPatients.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-4 sticky left-0 bg-white border-r border-slate-200 font-bold text-slate-700 text-sm z-20 shadow-[6px_0_12px_-3px_rgba(0,0,0,0.08)] min-w-[320px] w-[320px] md:min-w-[360px] md:w-[360px]">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {p.insuranceLevel && (
                                  <div className={`shrink-0 w-2.5 h-3.5 rounded-[2px] border shadow-sm ${
                                    p.insuranceLevel === '0%' ? 'bg-rose-500 border-rose-600' :
                                    p.insuranceLevel === '80%' ? 'bg-orange-500 border-orange-600' :
                                    p.insuranceLevel === '95%' ? 'bg-lime-400 border-lime-500' :
                                    'bg-emerald-500 border-emerald-600'
                                  }`} title={`BHYT: ${p.insuranceLevel}`} />
                                )}
                                <span className="text-slate-800 text-sm font-extrabold whitespace-nowrap overflow-hidden text-ellipsis" title={p.name}>{p.name}</span>
                                {p.note && (
                                  <div className="group/note relative shrink-0">
                                    <Plus size={10} className="text-amber-500 bg-amber-50 rounded-full border border-amber-200 cursor-help" />
                                    <div className="absolute left-full ml-1 top-0 hidden group-hover/note:block z-[100] w-48 p-2 bg-slate-800 text-white text-[10px] font-medium rounded-lg shadow-xl backdrop-blur-sm bg-opacity-90 normal-case leading-normal tracking-normal">
                                      {p.note}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">
                                Buồng: {p.roomNumber || '?'}, Giường: {p.bedNumber || '?'}
                              </span>
                            </div>
                          </td>
                          {departmentProcedures.map(proc => {
                            const cellState = selection[p.id]?.[proc.id] || { level: 0, durationMinutes: proc.durationMinutes };
                            const options = getProcDurationOptions(proc);
                            
                            return (
                              <td key={proc.id} className="p-4 border-r border-slate-200 text-center align-middle min-w-[180px] w-[180px]">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleCellClick(p.id, proc)}
                                    className={`w-full py-2.5 px-3 rounded-xl border font-black text-[11px] uppercase tracking-wider transition-all duration-250 flex items-center justify-center gap-1.5 ${
                                      cellState.level === 1
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm shadow-emerald-500/5'
                                        : cellState.level === 2
                                        ? 'bg-violet-50 text-violet-700 border-violet-300 shadow-sm shadow-violet-500/5'
                                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
                                    }`}
                                  >
                                    {cellState.level === 1 && <Check size={12} strokeWidth={3} />}
                                    {cellState.level === 2 && <Sparkles size={12} className="fill-violet-300" />}
                                    {cellState.level === 1 ? 'Xếp giờ' : cellState.level === 2 ? 'Ưu tiên' : 'Chọn xếp'}
                                  </button>

                                  {cellState.level > 0 && options.length > 0 && (
                                    <div className="relative group/sel w-full">
                                      <select
                                        value={cellState.durationOptionId || 'default'}
                                        onChange={e => {
                                          if (e.target.value === 'default') {
                                            handleCellDurationChange(p.id, proc.id, 'default', proc.durationMinutes);
                                          } else {
                                            const opt = options.find(o => o.id === e.target.value);
                                            if (opt) {
                                              handleCellDurationChange(p.id, proc.id, opt.id, opt.durationMinutes);
                                            }
                                          }
                                        }}
                                        className="w-full text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg py-1 px-1.5 outline-none focus:border-violet-400 focus:bg-white appearance-none cursor-pointer transition-colors text-center font-mono"
                                      >
                                        <option value="default">Mặc định ({proc.durationMinutes}p)</option>
                                        {options.map(opt => (
                                          <option key={opt.id} value={opt.id}>{opt.durationMinutes} phút</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
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
      </div>
    </div>
  );
};
