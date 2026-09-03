
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Staff, Appointment, AppointmentStatus, Procedure, Patient, TimelineViewMode, Department, UserAccount, UserRole, ScheduleSnapshot } from '../types';
import { BUSINESS_HOURS, DEPARTMENTS } from '../constants';
import { timeStringToMinutes, minutesToPixels, calculateAge, isInsideOfficeHours, getRoleLabel, minutesToTimeString } from '../utils/timeUtils';
import { Zap, User, UserCog, Monitor, Filter, FilterX, Calendar, Bed, Clock, Search, Check, ChevronDown, ChevronUp, Printer, Building2, AlertTriangle, Info, Plus, RefreshCw, FileText, ArrowUpDown } from 'lucide-react';
import { downloadCSV } from '../utils/csvUtils';


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

const compareNamesByFirstName = (aName: string, bName: string) => {
  const partsA = aName.trim().split(/\s+/);
  const firstNameA = partsA.length > 0 ? partsA[partsA.length - 1] : aName;
  const partsB = bName.trim().split(/\s+/);
  const firstNameB = partsB.length > 0 ? partsB[partsB.length - 1] : bName;
  const cmp = firstNameA.localeCompare(firstNameB, 'vi');
  if (cmp !== 0) return cmp;
  return aName.localeCompare(bName, 'vi');
};

const getProcedureColor = (procedureId: string) => {
  const colors = [
    { text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100/50' },
    { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50' },
    { text: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100/50' },
    { text: 'text-violet-700', bg: 'bg-violet-50 border-violet-200 hover:bg-violet-100/50' },
    { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100/50' },
    { text: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100/50' },
    { text: 'text-rose-700', bg: 'bg-rose-50 border-rose-200 hover:bg-rose-100/50' },
    { text: 'text-purple-700', bg: 'bg-purple-50 border-purple-200 hover:bg-purple-100/50' },
    { text: 'text-teal-700', bg: 'bg-teal-50 border-teal-200 hover:bg-teal-100/50' },
    { text: 'text-sky-700', bg: 'bg-sky-50 border-sky-200 hover:bg-sky-100/50' },
    { text: 'text-lime-700', bg: 'bg-lime-50 border-lime-200 hover:bg-lime-100/50' },
    { text: 'text-pink-700', bg: 'bg-pink-50 border-pink-200 hover:bg-pink-100/50' },
  ];
  
  if (!procedureId) return colors[0];
  let hash = 0;
  for (let i = 0; i < procedureId.length; i++) {
    hash = procedureId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

interface HeaderMultiSelectProps {
  id?: string;
  placeholder: string;
  options: { id: string; label: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
  showSearch?: boolean;
  openFilterId?: string | null;
  setOpenFilterId?: React.Dispatch<React.SetStateAction<string | null>>;
  align?: 'left' | 'right';
}

const HeaderMultiSelect: React.FC<HeaderMultiSelectProps> = ({ 
  id = '',
  placeholder, 
  options, 
  selectedIds, 
  onChange, 
  className = "",
  showSearch = false,
  openFilterId,
  setOpenFilterId,
  align = 'left'
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = (openFilterId !== undefined && setOpenFilterId) ? openFilterId === id : internalIsOpen;
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (openFilterId !== undefined && setOpenFilterId) {
          setOpenFilterId(null);
        } else {
          setInternalIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, openFilterId, setOpenFilterId]);

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(prev => prev !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div 
      className={`relative w-full ${className}`} 
      ref={wrapperRef}
      onClick={(e) => e.stopPropagation()}
    >
       <div 
         className={`w-full px-2 py-1 bg-white text-slate-700 border border-slate-200 rounded text-[11px] font-bold cursor-pointer flex items-center justify-between shadow-sm transition-all h-7.5 ${isOpen ? 'ring-2 ring-primary/20 border-primary' : 'hover:border-primary/50'}`}
         onClick={() => {
           if (setOpenFilterId) {
             setOpenFilterId(prev => prev === id ? null : id);
           } else {
             setInternalIsOpen(prev => !prev);
           }
         }}
       >
          <div className="flex-1 truncate select-none text-left">
              <span className={`${selectedIds.length === 0 ? 'text-slate-500' : 'text-primary font-black'}`}>
                  {selectedIds.length === 0 
                     ? placeholder 
                     : `Đã chọn (${selectedIds.length})`}
              </span>
          </div>
          <ChevronDown size={12} className={`text-slate-400 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
       </div>

       {isOpen && (
         <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1 min-w-[220px] w-full max-w-[290px] bg-white border border-slate-200 rounded-xl shadow-2xl z-[300] max-h-[280px] flex flex-col p-2 animate-in fade-in duration-75`}>
             {showSearch && (
               <div className="relative mb-1.5 shrink-0">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                      className="w-full border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-[11px] focus:ring-1 focus:ring-primary/20 outline-none font-sans"
                      placeholder="Tìm kiếm..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      autoFocus
                  />
               </div>
             )}
             <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-slate-200 max-h-[170px] pr-1">
                 {filteredOptions.length === 0 ? (
                     <div className="text-center text-[11px] text-slate-400 py-2">Không tìm thấy dữ liệu</div>
                 ) : (
                     filteredOptions.map(opt => (
                         <div 
                            key={opt.id} 
                            className={`flex items-center gap-2 p-1 py-1.5 rounded-lg cursor-pointer transition-colors ${selectedIds.includes(opt.id) ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                            onClick={() => toggleOption(opt.id)}
                         >
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all shrink-0 ${selectedIds.includes(opt.id) ? 'bg-primary border-primary shadow-sm' : 'border-slate-300 bg-white'}`}>
                                {selectedIds.includes(opt.id) && <Check size={9} className="text-white" />}
                            </div>
                            <span className={`text-[11px] leading-tight select-none normal-case truncate ${selectedIds.includes(opt.id) ? 'text-slate-900 font-bold' : 'text-slate-600'}`} title={opt.label}>{opt.label}</span>
                         </div>
                     ))
                 )}
             </div>
             {selectedIds.length > 0 && (
                 <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex justify-end shrink-0">
                     <button 
                        className="text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-0.5 rounded cursor-pointer"
                        onClick={() => onChange([])}
                     >
                         Xóa bộ lọc
                     </button>
                 </div>
             )}
         </div>
       )}
    </div>
  );
};

interface TimelineProps {
  date: string;
  staff: Staff[];
  appointments: Appointment[];
  procedures: Procedure[];
  patients: Patient[];
  viewMode: TimelineViewMode;
  filterText: string;
  currentDept?: Department;
  currentUser?: UserAccount;
  onAppointmentClick: (appt: Appointment) => void;
  onEmptySlotClick: (rowId: string, time: string, mode: TimelineViewMode) => void;
  onRecheckConflicts?: () => void;
  initialFilters?: {
    procedureIds?: string[];
    staffIds?: string[];
    deptIds?: string[];
  };
  scheduleSnapshots?: ScheduleSnapshot[];
  onSaveScheduleSnapshot?: (deptId: string, date: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  date,
  staff,
  appointments,
  procedures,
  patients,
  viewMode,
  filterText,
  currentDept,
  currentUser,
  onAppointmentClick,
  onEmptySlotClick,
  onRecheckConflicts,
  initialFilters,
  scheduleSnapshots = [],
  onSaveScheduleSnapshot,
}) => {
  const pixelsPerMinute = 1.8;
  const startHour = 0;       
  const endHour = 24;        
  const totalMinutes = (endHour - startHour) * 60;
  const timelineWidth = minutesToPixels(totalMinutes, pixelsPerMinute);

  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  const deptKey = currentDept?.id || 'default';

  const [sortBy, setSortBy] = useState<string>(() => {
    return sessionStorage.getItem(`medflow_tl_sortBy_${deptKey}`) || 'PATIENT_GROUP';
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    return (sessionStorage.getItem(`medflow_tl_sortDir_${deptKey}`) as 'asc' | 'desc') || 'asc';
  });

  const getSavedArray = (key: string, fallback: string[]) => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const [headerPatientStatusFilters, setHeaderPatientStatusFilters] = useState<string[]>(() =>
    getSavedArray(`medflow_tl_pStatus_${deptKey}`, [])
  );
  const [headerPatientFilters, setHeaderPatientFilters] = useState<string[]>(() =>
    getSavedArray(`medflow_tl_pFilter_${deptKey}`, [])
  );
  const [headerBedTypeFilters, setHeaderBedTypeFilters] = useState<string[]>(() =>
    getSavedArray(`medflow_tl_bedType_${deptKey}`, [])
  );
  const [headerDeptFilters, setHeaderDeptFilters] = useState<string[]>(() => {
    const defaultVal = (initialFilters?.deptIds && initialFilters.deptIds.length > 0)
      ? initialFilters.deptIds
      : (currentDept ? [currentDept.id] : []);
    return getSavedArray(`medflow_tl_dept_${deptKey}`, defaultVal);
  });
  const [headerProcedureStatusFilters, setHeaderProcedureStatusFilters] = useState<string[]>(() =>
    getSavedArray(`medflow_tl_procStatus_${deptKey}`, [])
  );
  const [headerProcedureFilters, setHeaderProcedureFilters] = useState<string[]>(() => {
    const defaultVal = (initialFilters?.procedureIds && initialFilters.procedureIds.length > 0)
      ? initialFilters.procedureIds
      : [];
    return getSavedArray(`medflow_tl_proc_${deptKey}`, defaultVal);
  });
  const [headerStaffRoleFilters, setHeaderStaffRoleFilters] = useState<string[]>(() =>
    getSavedArray(`medflow_tl_staffRole_${deptKey}`, [])
  );
  const [headerStaffIdFilters, setHeaderStaffIdFilters] = useState<string[]>(() => {
    const defaultVal = (initialFilters?.staffIds && initialFilters.staffIds.length > 0)
      ? initialFilters.staffIds
      : [];
    return getSavedArray(`medflow_tl_staffId_${deptKey}`, defaultVal);
  });
  const [headerTimeShiftFilters, setHeaderTimeShiftFilters] = useState<string[]>(() =>
    getSavedArray(`medflow_tl_timeShift_${deptKey}`, [])
  );
  const [headerMachineFilters, setHeaderMachineFilters] = useState<string[]>(() =>
    getSavedArray(`medflow_tl_machine_${deptKey}`, [])
  );

  const [filterModifiedOnly, setFilterModifiedOnly] = useState<boolean>(false);

  const deviations = useMemo(() => {
    if (!currentDept) return [];
    const deptAppts = appointments.filter(a => a.deptId === currentDept.id && a.date === date);
    const snapshot = (scheduleSnapshots || []).find(s => s.deptId === currentDept.id && s.date === date);
    
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
      type: 'NEW' | 'MODIFIED' | 'DELETED';
    }[] = [];
    
    // Check for NEW or MODIFIED
    deptAppts.forEach(appt => {
      const baseline = baselineMap.get(appt.id);
      if (!baseline) {
        list.push({ id: appt.id, type: 'NEW' });
      } else {
        const norm = (val: any) => (val === null || val === undefined) ? '' : String(val).trim();
        const isModified = 
          norm(appt.startTime) !== norm(baseline.startTime) || 
          norm(appt.endTime) !== norm(baseline.endTime) ||
          norm(appt.staffId) !== norm(baseline.staffId) ||
          norm(appt.assistant1Id) !== norm(baseline.assistant1Id) ||
          norm(appt.assistant2Id) !== norm(baseline.assistant2Id) ||
          norm(appt.assignedMachineId) !== norm(baseline.assignedMachineId);
        
        if (isModified) {
          list.push({ id: appt.id, type: 'MODIFIED' });
        }
      }
    });
    
    // Check for DELETED
    baselineAppts.forEach(baseline => {
      if (!currentMap.has(baseline.id)) {
        list.push({ id: baseline.id, type: 'DELETED' });
      }
    });
    
    return list;
  }, [appointments, scheduleSnapshots, currentDept, date]);

  useEffect(() => {
    sessionStorage.setItem(`medflow_tl_sortBy_${deptKey}`, sortBy);
    sessionStorage.setItem(`medflow_tl_sortDir_${deptKey}`, sortDir);
    sessionStorage.setItem(`medflow_tl_pStatus_${deptKey}`, JSON.stringify(headerPatientStatusFilters));
    sessionStorage.setItem(`medflow_tl_pFilter_${deptKey}`, JSON.stringify(headerPatientFilters));
    sessionStorage.setItem(`medflow_tl_bedType_${deptKey}`, JSON.stringify(headerBedTypeFilters));
    sessionStorage.setItem(`medflow_tl_dept_${deptKey}`, JSON.stringify(headerDeptFilters));
    sessionStorage.setItem(`medflow_tl_procStatus_${deptKey}`, JSON.stringify(headerProcedureStatusFilters));
    sessionStorage.setItem(`medflow_tl_proc_${deptKey}`, JSON.stringify(headerProcedureFilters));
    sessionStorage.setItem(`medflow_tl_staffRole_${deptKey}`, JSON.stringify(headerStaffRoleFilters));
    sessionStorage.setItem(`medflow_tl_staffId_${deptKey}`, JSON.stringify(headerStaffIdFilters));
    sessionStorage.setItem(`medflow_tl_timeShift_${deptKey}`, JSON.stringify(headerTimeShiftFilters));
    sessionStorage.setItem(`medflow_tl_machine_${deptKey}`, JSON.stringify(headerMachineFilters));
  }, [
    deptKey, sortBy, sortDir, headerPatientStatusFilters, headerPatientFilters, headerBedTypeFilters,
    headerDeptFilters, headerProcedureStatusFilters, headerProcedureFilters, headerStaffRoleFilters,
    headerStaffIdFilters, headerTimeShiftFilters, headerMachineFilters
  ]);

  const activeFiltersCount = useMemo(() => {
    return (
      headerPatientStatusFilters.length +
      headerPatientFilters.length +
      headerBedTypeFilters.length +
      headerDeptFilters.length +
      headerProcedureStatusFilters.length +
      headerProcedureFilters.length +
      headerStaffRoleFilters.length +
      headerStaffIdFilters.length +
      headerTimeShiftFilters.length +
      headerMachineFilters.length
    );
  }, [
    headerPatientStatusFilters,
    headerPatientFilters,
    headerBedTypeFilters,
    headerDeptFilters,
    headerProcedureStatusFilters,
    headerProcedureFilters,
    headerStaffRoleFilters,
    headerStaffIdFilters,
    headerTimeShiftFilters,
    headerMachineFilters
  ]);

  const handleClearAllFilters = () => {
    setHeaderPatientStatusFilters([]);
    setHeaderPatientFilters([]);
    setHeaderBedTypeFilters([]);
    setHeaderDeptFilters([]);
    setHeaderProcedureStatusFilters([]);
    setHeaderProcedureFilters([]);
    setHeaderStaffRoleFilters([]);
    setHeaderStaffIdFilters([]);
    setHeaderTimeShiftFilters([]);
    setHeaderMachineFilters([]);
    setOpenFilterId(null);

    // Clear session storage for this department
    sessionStorage.removeItem(`medflow_tl_pStatus_${deptKey}`);
    sessionStorage.removeItem(`medflow_tl_pFilter_${deptKey}`);
    sessionStorage.removeItem(`medflow_tl_bedType_${deptKey}`);
    sessionStorage.removeItem(`medflow_tl_dept_${deptKey}`);
    sessionStorage.removeItem(`medflow_tl_procStatus_${deptKey}`);
    sessionStorage.removeItem(`medflow_tl_proc_${deptKey}`);
    sessionStorage.removeItem(`medflow_tl_staffRole_${deptKey}`);
    sessionStorage.removeItem(`medflow_tl_staffId_${deptKey}`);
    sessionStorage.removeItem(`medflow_tl_timeShift_${deptKey}`);
    sessionStorage.removeItem(`medflow_tl_machine_${deptKey}`);
  };

  // Derived helper lists to prevent virtual filtering data
  const dayAppointments = useMemo(() => {
    return appointments.filter(a => a.date === date);
  }, [appointments, date]);

  // Patients actually having appointments today
  const activePatients = useMemo(() => {
    const activePatientIds = new Set(dayAppointments.map(a => a.patientId));
    return patients
      .filter(p => activePatientIds.has(p.id))
      .sort((a, b) => compareNamesByFirstName(a.name, b.name));
  }, [dayAppointments, patients]);

  // Departments actually operating today
  const activeDepartments = useMemo(() => {
    const todayDeptIds = new Set();
    dayAppointments.forEach(a => {
      const proc = procedures.find(p => p.id === a.procedureId);
      const procedureDeptId = proc?.deptId || a.deptId;
      if (procedureDeptId) todayDeptIds.add(procedureDeptId);
    });
    return DEPARTMENTS.filter(d => todayDeptIds.has(d.id));
  }, [dayAppointments, procedures]);

  // Procedures actually performed today
  const activeProcedures = useMemo(() => {
    const todayProcIds = new Set(dayAppointments.map(a => a.procedureId));
    return procedures
      .filter(p => todayProcIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [dayAppointments, procedures]);

  // Staff actually working today
  const activeStaff = useMemo(() => {
    const todayStaffIds = new Set();
    dayAppointments.forEach(a => {
      if (a.staffId) todayStaffIds.add(a.staffId);
      if (a.assistant1Id) todayStaffIds.add(a.assistant1Id);
      if (a.assistant2Id) todayStaffIds.add(a.assistant2Id);
    });
    return staff
      .filter(s => todayStaffIds.has(s.id))
      .sort((a, b) => compareNamesByFirstName(a.name, b.name));
  }, [dayAppointments, staff]);

  // Machines actually active today
  const activeMachines = useMemo(() => {
    const todayMachineIds = new Set<string>();
    dayAppointments.forEach(a => {
      if (a.assignedMachineId) todayMachineIds.add(a.assignedMachineId);
    });
    return Array.from(todayMachineIds).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [dayAppointments]);

  const rows = useMemo(() => {
    switch (viewMode) {
      case 'PROCEDURE':
        return [...procedures]
          .sort((a, b) => {
            const aIsCurrent = !currentDept || a.deptId === currentDept.id;
            const bIsCurrent = !currentDept || b.deptId === currentDept.id;
            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            return a.name.localeCompare(b.name);
          })
          .flatMap(p => {
             const procs = [
               {
                 id: `${p.id}_ALL`,
                 originalId: p.id,
                 role: 'ALL',
                 title: p.name,
                 subtitle: `Tổng (${p.durationMinutes}p)`,
                 color: 'bg-amber-500',
                 icon: <Zap size={14} />
               },
               {
                 id: `${p.id}_MAIN`,
                 originalId: p.id,
                 role: 'MAIN',
                 title: `↳ ${p.name}`,
                 subtitle: 'Chính',
                 color: 'bg-amber-100',
                 icon: <span className="opacity-0 w-3.5"></span>
               }
             ];
             if ((p.asst1BusyEnd ?? p.assistant1BusyMinutes ?? 0) > 0) {
               procs.push({
                 id: `${p.id}_ASST1`,
                 originalId: p.id,
                 role: 'ASST1',
                 title: `↳ ${p.name}`,
                 subtitle: 'Phụ 1',
                 color: 'bg-amber-50',
                 icon: <span className="opacity-0 w-3.5"></span>
               });
             }
             if ((p.asst2BusyEnd ?? p.assistant2BusyMinutes ?? 0) > 0) {
               procs.push({
                 id: `${p.id}_ASST2`,
                 originalId: p.id,
                 role: 'ASST2',
                 title: `↳ ${p.name}`,
                 subtitle: 'Phụ 2',
                 color: 'bg-amber-50',
                 icon: <span className="opacity-0 w-3.5"></span>
               });
             }
             return procs;
          });
      case 'PATIENT': 
        return patients.filter(p => {
          if (p.status !== 'TREATING' && p.status !== 'DISCHARGED') return false;
          const admissionDateStr = getLocalDateString(p.admissionDate);
          return date >= admissionDateStr;
        }).map(p => ({
          id: p.id,
          originalId: p.id,
          role: 'ALL',
          title: p.name + (p.status === 'DISCHARGED' ? ' (Ra viện)' : ''),
          subtitle: `G: ${p.bedNumber} | ${p.bedType || 'Nội trú'} | ${calculateAge(p.dob)}t | BH: ${p.insuranceLevel || '100%'}${p.note ? ` | ${p.note}` : ''}`,
          color: p.status === 'DISCHARGED' ? 'bg-slate-400' : 'bg-emerald-500',
          icon: <User size={14} />
        }));
      case 'STAFF':
        return staff.filter(s => !currentDept || s.deptId === currentDept.id).map(s => ({
          id: s.id,
          originalId: s.id,
          role: 'ALL',
          title: s.name,
          subtitle: s.role === 'Doctor' ? 'Bác sĩ' : 
                    s.role === 'Technician' ? 'KTV' : 
                    s.role === 'Nurse' ? 'Điều dưỡng' : 
                    s.role === 'PhysicianAssistant' ? 'Y sĩ' : 
                    s.role === 'Pharmacist' ? 'Dược sĩ' : s.role,
          color: s.role === 'Doctor' ? 'bg-indigo-500' : 
                 s.role === 'Pharmacist' ? 'bg-emerald-500' : 
                 s.role === 'PhysicianAssistant' ? 'bg-purple-500' : 'bg-sky-500',
          icon: <UserCog size={14} />
        }));
      default:
        return [];
    }
  }, [viewMode, staff, procedures, patients]);

  const filteredAppointments = useMemo(() => {
    let result = appointments;
    
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(a => {
        const p = patients.find(pat => pat.id === a.patientId);
        const s = staff.find(st => st.id === a.staffId);
        const pr = procedures.find(proc => proc.id === a.procedureId);
        return (
          (p?.name?.toLowerCase().includes(lower)) ||
          (s?.name?.toLowerCase().includes(lower)) ||
          (pr?.name?.toLowerCase().includes(lower))
        );
      });
    }

    if (viewMode === 'GENERAL') {
        // Patient status filter (headerPatientStatusFilters)
        if (headerPatientStatusFilters.length > 0) {
            result = result.filter(a => {
                const p = patients.find(pat => pat.id === a.patientId);
                return headerPatientStatusFilters.some(filter => {
                    if (filter === 'TREATING') {
                        return p?.status !== 'DISCHARGED';
                    }
                    if (filter === 'DISCHARGED') {
                        return p?.status === 'DISCHARGED';
                    }
                    return false;
                });
            });
        }

        // Patient ID filter (headerPatientFilters)
        if (headerPatientFilters.length > 0) {
            result = result.filter(a => {
                return headerPatientFilters.includes(a.patientId);
            });
        }

        // Bed type filter (headerBedTypeFilters)
        if (headerBedTypeFilters.length > 0) {
            result = result.filter(a => {
                const p = patients.find(pat => pat.id === a.patientId);
                const bedType = p?.bedType || 'Nội trú';
                return headerBedTypeFilters.some(filter => {
                    if (filter === 'Nội trú') return bedType === 'Nội trú';
                    if (filter === 'Nội trú ban ngày') return bedType === 'Nội trú ban ngày';
                    if (filter === 'Khác') return bedType !== 'Nội trú' && bedType !== 'Nội trú ban ngày';
                    return false;
                });
            });
        }

        // Department filter (headerDeptFilters)
        if (headerDeptFilters.length > 0) {
            result = result.filter(a => {
                const proc = procedures.find(p => p.id === a.procedureId);
                const procedureDeptId = proc?.deptId || a.deptId;
                return headerDeptFilters.includes(procedureDeptId);
            });
        }

        // Procedure status filter (headerProcedureStatusFilters)
        if (headerProcedureStatusFilters.length > 0) {
            result = result.filter(a => {
                return headerProcedureStatusFilters.some(filter => {
                    if (filter === 'ERROR') {
                        return a.status === AppointmentStatus.CONFLICT;
                    }
                    if (filter === 'NO_ERROR') {
                        return a.status !== AppointmentStatus.CONFLICT;
                    }
                    return false;
                });
            });
        }

        // Procedure ID filter (headerProcedureFilters)
        if (headerProcedureFilters.length > 0) {
            result = result.filter(a => {
                return headerProcedureFilters.includes(a.procedureId);
            });
        }

        // Staff filter (headerStaffIdFilters & headerStaffRoleFilters)
        if (headerStaffIdFilters.length > 0 || headerStaffRoleFilters.length > 0) {
            result = result.filter(a => {
                if (headerStaffIdFilters.length > 0) {
                    const rolesToCheck = headerStaffRoleFilters.length > 0 ? headerStaffRoleFilters : ['MAIN', 'ASST1', 'ASST2'];
                    return headerStaffIdFilters.some(staffId => {
                        const isMain = rolesToCheck.includes('MAIN') && a.staffId === staffId;
                        const isAsst1 = rolesToCheck.includes('ASST1') && a.assistant1Id === staffId;
                        const isAsst2 = rolesToCheck.includes('ASST2') && a.assistant2Id === staffId;
                        return isMain || isAsst1 || isAsst2;
                    });
                } else {
                    return headerStaffRoleFilters.some(role => {
                        if (role === 'MAIN') return !!a.staffId;
                        if (role === 'ASST1') return !!a.assistant1Id;
                        if (role === 'ASST2') return !!a.assistant2Id;
                        return false;
                    });
                }
            });
        }

        // Time shift filter (headerTimeShiftFilters)
        if (headerTimeShiftFilters.length > 0) {
            result = result.filter(a => {
                const parts = a.startTime.split(':');
                const startHour = parseInt(parts[0], 10) || 0;
                return headerTimeShiftFilters.some(filter => {
                    if (filter === 'MORNING') return startHour < 12;
                    if (filter === 'AFTERNOON') return startHour >= 12;
                    return false;
                });
            });
        }

        // Machine filter (headerMachineFilters)
        if (headerMachineFilters.length > 0) {
            result = result.filter(a => {
                return headerMachineFilters.some(filter => {
                    if (filter === 'NoMachine') return !a.assignedMachineId;
                    return a.assignedMachineId === filter;
                });
            });
        }

        // Lọc các thủ thuật mới được chỉnh sửa trong phiên
        if (filterModifiedOnly) {
            const changedIds = new Set(deviations.map(d => d.id));
            result = result.filter(a => changedIds.has(a.id));
        }
    }

    const enriched = result.map(appt => {
        const start = timeStringToMinutes(appt.startTime);
        const end = timeStringToMinutes(appt.endTime);
        const overlaps = result.filter(other => {
            if (appt.id === other.id) return false;
            const oStart = timeStringToMinutes(other.startTime);
            const oEnd = timeStringToMinutes(other.endTime);
            return Math.max(start, oStart) < Math.min(end, oEnd);
        }).length;
        return { ...appt, overlapLevel: overlaps };
    });

    if (viewMode === 'GENERAL') {
        return [...enriched].sort((a, b) => {
            const aIsCurrent = !currentDept || a.deptId === currentDept.id;
            const bIsCurrent = !currentDept || b.deptId === currentDept.id;
            
            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            
            const isAsc = sortDir === 'asc';
            
            if (sortBy === 'PATIENT_GROUP') {
                const patA = patients.find(p => p.id === a.patientId);
                const patB = patients.find(p => p.id === b.patientId);
                const pNameA = patA?.name || '';
                const pNameB = patB?.name || '';
                
                const nameCompare = compareNamesByFirstName(pNameA, pNameB);
                if (nameCompare !== 0) return isAsc ? nameCompare : -nameCompare;
                
                if (a.patientId !== b.patientId) {
                    return isAsc 
                        ? a.patientId.localeCompare(b.patientId) 
                        : b.patientId.localeCompare(a.patientId);
                }
                
                const diffTime = timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime);
                return isAsc ? diffTime : -diffTime;
            }
            
            if (sortBy === 'PATIENT_NAME') {
                const patA = patients.find(p => p.id === a.patientId);
                const patB = patients.find(p => p.id === b.patientId);
                const valA = patA?.name || '';
                const valB = patB?.name || '';
                const comp = compareNamesByFirstName(valA, valB);
                return isAsc ? comp : -comp;
            }
            
            if (sortBy === 'BED') {
                const patA = patients.find(p => p.id === a.patientId);
                const patB = patients.find(p => p.id === b.patientId);
                const bedA = patA?.bedNumber || '';
                const bedB = patB?.bedNumber || '';
                const numA = parseInt(bedA.replace(/\D/g, ''), 10) || 0;
                const numB = parseInt(bedB.replace(/\D/g, ''), 10) || 0;
                
                if (numA !== numB) {
                    return isAsc ? numA - numB : numB - numA;
                }
                const comp = bedA.localeCompare(bedB, 'vi');
                return isAsc ? comp : -comp;
            }
            
            if (sortBy === 'DEPT') {
                const procA = procedures.find(p => p.id === a.procedureId);
                const procB = procedures.find(p => p.id === b.procedureId);
                const procDeptId_A = procA?.deptId || a.deptId;
                const procDeptId_B = procB?.deptId || b.deptId;
                const deptA = DEPARTMENTS.find(d => d.id === procDeptId_A)?.name || '';
                const deptB = DEPARTMENTS.find(d => d.id === procDeptId_B)?.name || '';
                const comp = deptA.localeCompare(deptB, 'vi');
                return isAsc ? comp : -comp;
            }
            
            if (sortBy === 'PROCEDURE') {
                const procA = procedures.find(p => p.id === a.procedureId);
                const procB = procedures.find(p => p.id === b.procedureId);
                const valA = procA?.name || '';
                const valB = procB?.name || '';
                const comp = valA.localeCompare(valB, 'vi');
                return isAsc ? comp : -comp;
            }
            
            if (sortBy === 'STAFF') {
                const staffA = staff.find(s => s.id === a.staffId);
                const staffB = staff.find(s => s.id === b.staffId);
                const valA = staffA?.name || '';
                const valB = staffB?.name || '';
                const comp = compareNamesByFirstName(valA, valB);
                return isAsc ? comp : -comp;
            }
            
            if (sortBy === 'TIME') {
                const valA = timeStringToMinutes(a.startTime);
                const valB = timeStringToMinutes(b.startTime);
                return isAsc ? valA - valB : valB - valA;
            }
            
            if (sortBy === 'MACHINE') {
                const valA = a.assignedMachineId || '';
                const valB = b.assignedMachineId || '';
                const comp = valA.localeCompare(valB);
                return isAsc ? comp : -comp;
            }
            
            return timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime);
        });
    }
    return enriched;
  }, [appointments, filterText, patients, staff, procedures, viewMode, sortBy, sortDir, headerPatientStatusFilters, headerPatientFilters, headerBedTypeFilters, headerDeptFilters, headerProcedureStatusFilters, headerProcedureFilters, headerStaffRoleFilters, headerStaffIdFilters, headerTimeShiftFilters, headerMachineFilters, currentDept]);

  const getStatusColor = (status: AppointmentStatus, isOutside: boolean, isIndependent: boolean = false, isCurrentDept: boolean = true) => {
    if (!isCurrentDept) return 'bg-slate-50 border-slate-200 text-slate-400 opacity-40 grayscale-[0.5]';
    if (status === AppointmentStatus.COMPLETED) return `bg-emerald-100 border-emerald-300 text-emerald-800 ${isIndependent ? 'opacity-60' : ''}`;
    if (status === AppointmentStatus.IN_PROGRESS) return `bg-sky-100 border-sky-300 text-sky-800 ${isIndependent ? 'opacity-60' : ''}`;
    if (status === AppointmentStatus.CONFLICT || isOutside) return `bg-rose-500 border-rose-700 text-white animate-blink shadow-[0_0_15px_rgba(244,63,94,0.5)] ${isIndependent ? 'opacity-70' : ''}`;
    return `bg-white border-blue-500 text-slate-700 shadow-sm shadow-blue-100 ${isIndependent ? 'opacity-60' : ''}`;
  };

  const getBarColor = (procedureId: string, status: string, isOutside: boolean, isIndependent: boolean = false, isCurrentDept: boolean = true) => {
      if (!isCurrentDept) return 'bg-slate-50 border-slate-200 text-slate-400 opacity-40 grayscale-[0.5]';
      if (status === 'COMPLETED') return `bg-emerald-50 border-emerald-400 text-emerald-900 ${isIndependent ? 'opacity-60' : ''}`;
      if (status === 'CONFLICT' || isOutside) return `bg-rose-500 border-rose-700 text-white animate-blink shadow-[0_0_20px_rgba(244,63,94,0.6)] ${isIndependent ? 'opacity-70' : ''}`;
      
      const procColor = getProcedureColor(procedureId);
      return `${procColor.bg} ${procColor.text} shadow-sm ${isIndependent ? 'opacity-60' : ''}`;
  };

  const renderTimeRuler = (showLabels: boolean = true) => {
    const hours = [];
    for (let i = startHour; i <= endHour; i++) {
      hours.push(
        <div 
          key={i} 
          className={`absolute top-0 bottom-0 border-l ${showLabels ? 'border-slate-300' : 'border-slate-100'} text-[10px] text-slate-400 pl-1 select-none pointer-events-none flex items-end pb-1`}
          style={{ left: minutesToPixels((i - startHour) * 60, pixelsPerMinute) }}
        >
          {showLabels ? `${i}h` : ''}
        </div>
      );
    }
    return hours;
  };

  const handlePrintTimeline = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedDate = new Date(date).toLocaleDateString('vi-VN');
    const deptName = currentDept?.name || 'YHCT';

    const getFirstName = (fullName: string) => {
        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1] || '';
    };

    // Sort by patient first name then full name for printing as requested
    const sortedAppts = [...filteredAppointments].sort((a, b) => {
        const patientA = patients.find(p => p.id === a.patientId);
        const patientB = patients.find(p => p.id === b.patientId);
        
        const pA = patientA?.name || '';
        const pB = patientB?.name || '';
        
        const fnA = getFirstName(pA);
        const fnB = getFirstName(pB);
        
        const nameCmp = fnA.localeCompare(fnB);
        if (nameCmp !== 0) return nameCmp;
        
        const fullCmp = pA.localeCompare(pB);
        if (fullCmp !== 0) return fullCmp;

        return timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime);
    });

    const tableRows = sortedAppts.map((appt, idx) => {
      const patient = patients.find(p => p.id === appt.patientId);
      const staffMember = staff.find(s => s.id === appt.staffId);
      const procedure = procedures.find(p => p.id === appt.procedureId);
      const procedureDeptId = procedure?.deptId || appt.deptId;
      const performingDept = DEPARTMENTS.find(d => d.id === procedureDeptId);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><b>${patient?.name || 'Không yêu cầu BN'}</b><br/><small>${patient ? `${patient.gender} • ${calculateAge(patient.dob)}t • ${patient.bedType || 'Nội trú'}` : '-'}</small></td>
          <td style="text-align:center">${patient ? `${patient.bedNumber} - P:${patient.roomNumber || '?'}` : '-'}</td>
          <td>${performingDept?.name || '-'}</td>
          <td>${procedure?.name || 'Thủ thuật đã xóa'}</td>
          <td style="text-align:center">${timeStringToMinutes(appt.endTime) - timeStringToMinutes(appt.startTime)}p</td>
          <td>
            ${staffMember?.name || '-'}
            ${appt.assistant1Id ? `<br/><small>Phụ 1: ${staff.find(s => s.id === appt.assistant1Id)?.name}</small>` : ''}
            ${appt.assistant2Id ? `<br/><small>Phụ 2: ${staff.find(s => s.id === appt.assistant2Id)?.name}</small>` : ''}
          </td>
          <td style="text-align:center">${appt.startTime} - ${appt.endTime}</td>
          <td style="text-align:center">${appt.assignedMachineId ? appt.assignedMachineId.replace(/-/g, '') : ''}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Timeline Tổng - ${formattedDate}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0ea5e9; padding-bottom: 20px; }
            .header h1 { margin: 0; color: #0ea5e9; text-transform: uppercase; letter-spacing: 2px; }
            .header p { margin: 5px 0 0; font-weight: bold; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; font-size: 13px; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 30px; text-align: right; font-style: italic; font-size: 12px; color: #94a3b8; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Lịch Trình Thủ Thuật Tổng Quát</h1>
            <p>Khoa: ${deptName} | Ngày: ${formattedDate}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Bệnh nhân</th>
                <th>Giường/Phòng</th>
                <th>Khoa thực hiện</th>
                <th>Thủ thuật</th>
                <th>Thời lượng</th>
                <th>Nhân viên</th>
                <th>Thời gian</th>
                <th>Máy</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            Xuất lúc: ${new Date().toLocaleString('vi-VN', { hour12: false })} - Hospital medflow Systems
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportCSVTimeline = () => {
    const formattedDate = new Date(date).toLocaleDateString('vi-VN');
    
    const getFirstName = (fullName: string) => {
        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1] || '';
    };

    // Sort by patient first name then full name for consistency
    const sortedAppts = [...filteredAppointments].sort((a, b) => {
        const patientA = patients.find(p => p.id === a.patientId);
        const patientB = patients.find(p => p.id === b.patientId);
        
        const pA = patientA?.name || '';
        const pB = patientB?.name || '';
        
        const fnA = getFirstName(pA);
        const fnB = getFirstName(pB);
        
        const nameCmp = fnA.localeCompare(fnB);
        if (nameCmp !== 0) return nameCmp;
        
        const fullCmp = pA.localeCompare(pB);
        if (fullCmp !== 0) return fullCmp;

        return timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime);
    });

    const csvData = sortedAppts.map((appt, idx) => {
      const patient = patients.find(p => p.id === appt.patientId);
      const staffMember = staff.find(s => s.id === appt.staffId);
      const procedure = procedures.find(p => p.id === appt.procedureId);
      const procedureDeptId = procedure?.deptId || appt.deptId;
      const performingDept = DEPARTMENTS.find(d => d.id === procedureDeptId);

      return {
        stt: idx + 1,
        patientName: patient?.name || 'Không yêu cầu BN',
        patientInfo: patient ? `${patient.gender} • ${calculateAge(patient.dob)}t • ${patient.bedType || 'Nội trú'}` : '-',
        bedRoom: patient ? `${patient.bedNumber} - P:${patient.roomNumber || '?'}` : '-',
        dept: performingDept?.name || '-',
        procedure: procedure?.name || 'Thủ thuật đã xóa',
        duration: `${timeStringToMinutes(appt.endTime) - timeStringToMinutes(appt.startTime)}p`,
        staff: staffMember?.name || '-',
        assistant1: appt.assistant1Id ? staff.find(s => s.id === appt.assistant1Id)?.name : '',
        assistant2: appt.assistant2Id ? staff.find(s => s.id === appt.assistant2Id)?.name : '',
        time: `${appt.startTime} - ${appt.endTime}`,
        machine: appt.assignedMachineId ? appt.assignedMachineId.replace(/-/g, '') : ''
      };
    });

    const headers = [
      { label: 'STT', key: 'stt' },
      { label: 'Bệnh nhân', key: 'patientName' },
      { label: 'Thông tin BN', key: 'patientInfo' },
      { label: 'Giường/Phòng', key: 'bedRoom' },
      { label: 'Khoa thực hiện', key: 'dept' },
      { label: 'Thủ thuật', key: 'procedure' },
      { label: 'Thời lượng', key: 'duration' },
      { label: 'Nhân viên', key: 'staff' },
      { label: 'Phụ 1', key: 'assistant1' },
      { label: 'Phụ 2', key: 'assistant2' },
      { label: 'Thời gian', key: 'time' },
      { label: 'Máy', key: 'machine' }
    ];

    downloadCSV(csvData, `Timeline_Tong_${date}.csv`, headers);
  };

  if (viewMode === 'GENERAL') {
    return (
      <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row items-start md:items-center gap-6">
           <div className="shrink-0 flex items-center justify-between w-full md:w-auto gap-4">
               <div>
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng hợp hoạt động</div>
                   <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                       Timeline Khoa
                   </h2>
               </div>
               <div className="flex items-center gap-2 md:hidden">
                 {activeFiltersCount > 0 && (
                   <button 
                     onClick={handleClearAllFilters} 
                     className="px-2.5 py-2 bg-amber-50 border border-amber-300 text-amber-700 rounded-xl flex items-center gap-1.5 text-xs font-bold shadow-sm active:scale-95"
                     title="Bỏ tất cả bộ lọc"
                   >
                     <FilterX size={16} />
                     <span>Bỏ lọc ({activeFiltersCount})</span>
                   </button>
                 )}
                 <button onClick={handlePrintTimeline} className="p-3 bg-white border border-slate-200 rounded-2xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                   <Printer size={20} />
                 </button>
                 <button onClick={handleExportCSVTimeline} className="p-3 bg-white border border-slate-200 rounded-2xl text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                   <FileText size={20} />
                 </button>
               </div>
           </div>

           <div className="flex-1 w-full flex items-center justify-end gap-3 flex-wrap">
               {activeFiltersCount > 0 && (
                 <button 
                   onClick={handleClearAllFilters} 
                   className="h-[40px] px-3.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-xl flex items-center gap-2 font-bold text-sm shrink-0 transition-all shadow-sm active:scale-95 cursor-pointer"
                   title="Bỏ tất cả các bộ lọc đang kích hoạt"
                 >
                   <FilterX size={16} className="text-amber-600" />
                   <span>Bỏ lọc tất cả</span>
                   <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-black bg-amber-200 text-amber-900 rounded-full min-w-[20px]">
                     {activeFiltersCount}
                   </span>
                 </button>
               )}

               {currentDept && (
                 <button 
                   onClick={() => setFilterModifiedOnly(prev => !prev)} 
                   className={`h-[40px] px-3.5 border rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-wider shrink-0 transition-all shadow-sm ${filterModifiedOnly ? 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700 animate-pulse' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                   title="Chỉ hiển thị các thủ thuật đã được chỉnh sửa hoặc thêm mới trong phiên làm việc hiện tại"
                 >
                   <Filter size={14} />
                   <span>Lọc biến động {deviations.length > 0 ? `(${deviations.length})` : ''}</span>
                 </button>
               )}

               {currentDept && onSaveScheduleSnapshot && (
                 <button 
                   onClick={() => onSaveScheduleSnapshot(currentDept.id, date)} 
                   className="h-[40px] px-3.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-xl flex items-center gap-2 font-black text-xs uppercase tracking-wider shrink-0 transition-all shadow-sm"
                   title="Lưu lại phiên bản chốt hiện tại làm mốc so sánh biến động"
                 >
                   <Check size={14} />
                   <span>Lưu phiên bản</span>
                 </button>
               )}

               <button onClick={handlePrintTimeline} className="hidden md:flex h-[40px] px-4 bg-white border border-slate-200 rounded-xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm items-center gap-2 font-bold text-sm shrink-0">
                 <Printer size={16} /> In báo cáo
               </button>
               <button onClick={handleExportCSVTimeline} className="hidden md:flex h-[40px] px-4 bg-white border border-slate-200 rounded-xl text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm items-center gap-2 font-bold text-sm shrink-0">
                 <FileText size={16} /> Xuất CSV
               </button>

               {onRecheckConflicts && (
                 <button 
                   onClick={onRecheckConflicts} 
                   className="hidden md:flex h-[40px] px-4 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl items-center gap-2 font-bold text-sm shrink-0 transition-all shadow-sm"
                   title="Kiểm tra lại toàn bộ xung đột lịch"
                 >
                   <AlertTriangle size={16} /> Kiểm tra lỗi
                 </button>
               )}
               
               <button onClick={() => onEmptySlotClick('', '08:00', 'GENERAL')} className="hidden md:flex h-[40px] px-4 bg-primary border border-primary rounded-xl text-white hover:bg-primary/90 transition-all shadow-sm items-center gap-2 font-bold text-sm shrink-0">
                 <Plus size={16} /> Thêm chỉ định
               </button>
           </div>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-300 relative">
          {(() => {
            const isPatientFilterOpen = openFilterId === 'pStatus' || openFilterId === 'patient';
            const isBedFilterOpen = openFilterId === 'bedType';
            const isDeptFilterOpen = openFilterId === 'dept';
            const isProcFilterOpen = openFilterId === 'procStatus' || openFilterId === 'procedure';
            const isStaffFilterOpen = openFilterId === 'staffRole' || openFilterId === 'staff';
            const isTimeFilterOpen = openFilterId === 'timeShift';
            const isMachineFilterOpen = openFilterId === 'machine';

            return (
              <table className="min-w-max w-full text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 z-50 shadow-sm border-b border-slate-200 uppercase text-xs tracking-wider">
                  <tr className="divide-x divide-slate-200 h-12 select-none">
                    <th 
                      onClick={() => {
                        if (sortBy === 'PATIENT_GROUP') {
                          setSortBy('PATIENT_NAME');
                          setSortDir('asc');
                        } else if (sortBy === 'PATIENT_NAME' && sortDir === 'asc') {
                          setSortBy('PATIENT_NAME');
                          setSortDir('desc');
                        } else if (sortBy === 'PATIENT_NAME' && sortDir === 'desc') {
                          setSortBy('PATIENT_GROUP');
                          setSortDir('asc');
                        } else {
                          setSortBy('PATIENT_NAME');
                          setSortDir('asc');
                        }
                      }}
                      className={`p-3 w-[220px] min-w-[220px] max-w-[220px] sticky left-0 bg-slate-50 ${isPatientFilterOpen ? 'z-[150]' : 'z-30'} text-left cursor-pointer hover:bg-slate-100 transition-colors group border-r border-slate-200`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2">
                          <span>Bệnh nhân</span>
                          <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
                            {sortBy === 'PATIENT_GROUP' ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded">
                                Nhóm
                              </span>
                            ) : sortBy === 'PATIENT_NAME' ? (
                              sortDir === 'asc' ? <ChevronUp size={14} className="text-primary font-bold inline-block" /> : <ChevronDown size={14} className="text-primary font-bold inline-block" />
                            ) : (
                              <ArrowUpDown size={12} className="opacity-45 group-hover:opacity-100 inline-block" />
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                          <HeaderMultiSelect
                            id="pStatus"
                            openFilterId={openFilterId}
                            setOpenFilterId={setOpenFilterId}
                            placeholder="Trạng thái..."
                            options={[
                              { id: 'TREATING', label: 'Đang điều trị' },
                              { id: 'DISCHARGED', label: 'Đã ra viện' }
                            ]}
                            selectedIds={headerPatientStatusFilters}
                            onChange={setHeaderPatientStatusFilters}
                          />
                          <HeaderMultiSelect
                            id="patient"
                            openFilterId={openFilterId}
                            setOpenFilterId={setOpenFilterId}
                            placeholder="Lọc bệnh nhân..."
                            options={activePatients.map(p => ({
                              id: p.id,
                              label: p.name
                            }))}
                            selectedIds={headerPatientFilters}
                            onChange={setHeaderPatientFilters}
                            showSearch={true}
                          />
                        </div>
                      </div>
                    </th>
                    <th 
                      onClick={() => {
                        if (sortBy === 'BED') {
                          setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('BED');
                          setSortDir('asc');
                        }
                      }}
                      className={`p-3 w-[140px] min-w-[140px] max-w-[140px] sticky left-[220px] bg-slate-50 ${isBedFilterOpen ? 'z-[150]' : 'z-30'} text-center cursor-pointer hover:bg-slate-100 transition-colors group border-r border-slate-200`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1">
                          <span>Giường/Phòng</span>
                          <span className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                            {sortBy === 'BED' ? (
                              sortDir === 'asc' ? <ChevronUp size={14} className="text-primary font-bold inline-block" /> : <ChevronDown size={14} className="text-primary font-bold inline-block" />
                            ) : (
                              <ArrowUpDown size={12} className="opacity-45 group-hover:opacity-100 inline-block" />
                            )}
                          </span>
                        </div>
                        <HeaderMultiSelect
                          id="bedType"
                          openFilterId={openFilterId}
                          setOpenFilterId={setOpenFilterId}
                          placeholder="Lọc giường..."
                          options={[
                            { id: 'Nội trú', label: 'Nội trú' },
                            { id: 'Nội trú ban ngày', label: 'Nội trú ban ngày' },
                            { id: 'Khác', label: 'Khác' }
                          ]}
                          selectedIds={headerBedTypeFilters}
                          onChange={setHeaderBedTypeFilters}
                        />
                      </div>
                    </th>
                    <th 
                      onClick={() => {
                        if (sortBy === 'DEPT') {
                          setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('DEPT');
                          setSortDir('asc');
                        }
                      }}
                      className={`p-3 w-[140px] min-w-[140px] max-w-[140px] sticky left-[360px] bg-slate-50 ${isDeptFilterOpen ? 'z-[150]' : 'z-30'} text-left cursor-pointer hover:bg-slate-100 transition-colors group border-r border-slate-200`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1">
                          <span>Khoa thực hiện</span>
                          <span className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                            {sortBy === 'DEPT' ? (
                              sortDir === 'asc' ? <ChevronUp size={14} className="text-primary font-bold inline-block" /> : <ChevronDown size={14} className="text-primary font-bold inline-block" />
                            ) : (
                              <ArrowUpDown size={12} className="opacity-45 group-hover:opacity-100 inline-block" />
                            )}
                          </span>
                        </div>
                        <HeaderMultiSelect
                          id="dept"
                          openFilterId={openFilterId}
                          setOpenFilterId={setOpenFilterId}
                          placeholder="Lọc khoa..."
                          options={activeDepartments.map(d => ({
                            id: d.id,
                            label: d.name
                          }))}
                          selectedIds={headerDeptFilters}
                          onChange={setHeaderDeptFilters}
                          showSearch={true}
                        />
                      </div>
                    </th>
                    <th 
                      onClick={() => {
                        if (sortBy === 'PROCEDURE') {
                          setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('PROCEDURE');
                          setSortDir('asc');
                        }
                      }}
                      className={`p-3 w-[220px] min-w-[220px] max-w-[220px] sticky left-[500px] bg-slate-50 ${isProcFilterOpen ? 'z-[150]' : 'z-30'} text-left cursor-pointer hover:bg-slate-100 transition-colors group border-r border-slate-200`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1">
                          <span>Thủ thuật & Cảnh báo</span>
                          <span className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                            {sortBy === 'PROCEDURE' ? (
                              sortDir === 'asc' ? <ChevronUp size={14} className="text-primary font-bold inline-block" /> : <ChevronDown size={14} className="text-primary font-bold inline-block" />
                            ) : (
                              <ArrowUpDown size={12} className="opacity-45 group-hover:opacity-100 inline-block" />
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                          <HeaderMultiSelect
                            id="procStatus"
                            openFilterId={openFilterId}
                            setOpenFilterId={setOpenFilterId}
                            placeholder="Cảnh báo..."
                            options={[
                              { id: 'ERROR', label: 'Thủ thuật lỗi ⚠️' },
                              { id: 'NO_ERROR', label: 'Thủ thuật an toàn ✅' }
                            ]}
                            selectedIds={headerProcedureStatusFilters}
                            onChange={setHeaderProcedureStatusFilters}
                          />
                          <HeaderMultiSelect
                            id="procedure"
                            openFilterId={openFilterId}
                            setOpenFilterId={setOpenFilterId}
                            placeholder="Lọc thủ thuật..."
                            options={activeProcedures.map(p => ({
                              id: p.id,
                              label: p.name
                            }))}
                            selectedIds={headerProcedureFilters}
                            onChange={setHeaderProcedureFilters}
                            showSearch={true}
                          />
                        </div>
                      </div>
                    </th>
                    <th 
                      onClick={() => {
                        if (sortBy === 'STAFF') {
                          setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('STAFF');
                          setSortDir('asc');
                        }
                      }}
                      className={`p-3 w-[200px] min-w-[200px] max-w-[200px] sticky left-[720px] bg-slate-50 ${isStaffFilterOpen ? 'z-[150]' : 'z-30'} text-left cursor-pointer hover:bg-slate-100 transition-colors group border-r border-slate-200`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1">
                          <span>Nhân viên</span>
                          <span className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                            {sortBy === 'STAFF' ? (
                              sortDir === 'asc' ? <ChevronUp size={14} className="text-primary font-bold inline-block" /> : <ChevronDown size={14} className="text-primary font-bold inline-block" />
                            ) : (
                              <ArrowUpDown size={12} className="opacity-45 group-hover:opacity-100 inline-block" />
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                          <HeaderMultiSelect
                            id="staffRole"
                            openFilterId={openFilterId}
                            setOpenFilterId={setOpenFilterId}
                            placeholder="Lọc vai trò..."
                            options={[
                              { id: 'MAIN', label: 'Người chính' },
                              { id: 'ASST1', label: 'Phụ 1' },
                              { id: 'ASST2', label: 'Phụ 2' }
                            ]}
                            selectedIds={headerStaffRoleFilters}
                            onChange={setHeaderStaffRoleFilters}
                          />
                          <HeaderMultiSelect
                            id="staff"
                            openFilterId={openFilterId}
                            setOpenFilterId={setOpenFilterId}
                            placeholder="Lọc nhân viên..."
                            options={activeStaff.map(s => ({
                              id: s.id,
                              label: s.name
                            }))}
                            selectedIds={headerStaffIdFilters}
                            onChange={setHeaderStaffIdFilters}
                            showSearch={true}
                          />
                        </div>
                      </div>
                    </th>
                    <th 
                      onClick={() => {
                        if (sortBy === 'TIME') {
                          setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('TIME');
                          setSortDir('asc');
                        }
                      }}
                      className={`p-3 w-[110px] min-w-[110px] max-w-[110px] sticky left-[920px] bg-slate-50 ${isTimeFilterOpen ? 'z-[150]' : 'z-30'} text-center cursor-pointer hover:bg-slate-100 transition-colors group border-r border-slate-200`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1">
                          <span>Thời gian</span>
                          <span className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                            {sortBy === 'TIME' ? (
                              sortDir === 'asc' ? <ChevronUp size={14} className="text-primary font-bold inline-block" /> : <ChevronDown size={14} className="text-primary font-bold inline-block" />
                            ) : (
                              <ArrowUpDown size={12} className="opacity-45 group-hover:opacity-100 inline-block" />
                            )}
                          </span>
                        </div>
                        <HeaderMultiSelect
                          id="timeShift"
                          openFilterId={openFilterId}
                          setOpenFilterId={setOpenFilterId}
                          placeholder="Lọc ca..."
                          align="right"
                          options={[
                            { id: 'MORNING', label: 'Sáng (0h-12h)' },
                            { id: 'AFTERNOON', label: 'Chiều (12h-24h)' }
                          ]}
                          selectedIds={headerTimeShiftFilters}
                          onChange={setHeaderTimeShiftFilters}
                        />
                      </div>
                    </th>
                    <th 
                      onClick={() => {
                        if (sortBy === 'MACHINE') {
                          setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('MACHINE');
                          setSortDir('asc');
                        }
                      }}
                      className={`p-3 w-[110px] min-w-[110px] max-w-[110px] sticky left-[1030px] bg-slate-50 ${isMachineFilterOpen ? 'z-[150]' : 'z-30'} text-center cursor-pointer hover:bg-slate-100 transition-colors group border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1">
                          <span>Máy</span>
                          <span className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                            {sortBy === 'MACHINE' ? (
                              sortDir === 'asc' ? <ChevronUp size={14} className="text-primary font-bold inline-block" /> : <ChevronDown size={14} className="text-primary font-bold inline-block" />
                            ) : (
                              <ArrowUpDown size={12} className="opacity-45 group-hover:opacity-100 inline-block" />
                            )}
                          </span>
                        </div>
                        <HeaderMultiSelect
                          id="machine"
                          openFilterId={openFilterId}
                          setOpenFilterId={setOpenFilterId}
                          placeholder="Lọc máy..."
                          align="right"
                          options={[
                            { id: 'NoMachine', label: 'Không dùng máy' },
                            ...activeMachines.map(m => ({
                              id: m,
                              label: m
                            }))
                          ]}
                          selectedIds={headerMachineFilters}
                          onChange={setHeaderMachineFilters}
                        />
                      </div>
                    </th>
                    <th className="p-0 min-w-[800px] relative bg-slate-100/50">
                       <div className="h-full w-full relative" style={{ width: timelineWidth }}>
                            {renderTimeRuler(true)}
                       </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
              {filteredAppointments.map((appt, idx) => {
                const patient = patients.find(p => p.id === appt.patientId);
                const staffMember = staff.find(s => s.id === appt.staffId);
                const procedure = procedures.find(p => p.id === appt.procedureId);
                const procedureDeptId = procedure?.deptId || appt.deptId;
                const performingDept = DEPARTMENTS.find(d => d.id === procedureDeptId);
                const startMin = timeStringToMinutes(appt.startTime);
                const endMin = timeStringToMinutes(appt.endTime);
                const duration = endMin - startMin;
                const width = minutesToPixels(duration, pixelsPerMinute);
                const left = minutesToPixels(startMin, pixelsPerMinute);
                const isOutside = !isInsideOfficeHours(startMin, endMin);
                const hasConflict = appt.status === AppointmentStatus.CONFLICT;
                const displayWidth = Math.max(width, 50);
                
                const isBgHighlight = hasConflict || isOutside;
                const stickyCellBg = isBgHighlight ? 'bg-[#fff5f5]' : 'bg-white';
                const stickyCellHover = isBgHighlight ? 'group-hover:bg-rose-100/60' : 'group-hover:bg-slate-50';
                
                const marqueeContent = `(${procedure?.name || 'Thủ thuật đã xóa'}) ${appt.startTime} - ${appt.endTime}, ${staffMember?.name}${appt.assistant1Id ? `, Phụ 1: ${staff.find(s => s.id === appt.assistant1Id)?.name}` : ''}${appt.assistant2Id ? `, Phụ 2: ${staff.find(s => s.id === appt.assistant2Id)?.name}` : ''}${appt.assignedMachineId ? `, Máy: ${appt.assignedMachineId.replace(/-/g, '')}` : ''}`;

                return (
                  <tr key={appt.id} className={`hover:bg-slate-50 transition-all group min-h-[5rem] ${hasConflict || isOutside ? 'bg-rose-50/20' : ''}`}>
                    <td className={`p-3 font-medium text-slate-800 sticky left-0 ${stickyCellBg} ${stickyCellHover} z-20 border-r border-slate-100 w-[220px] min-w-[220px] max-w-[220px]`}>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-primary">{patient?.name || 'Không yêu cầu BN'} {patient?.status === 'DISCHARGED' && <span className="text-slate-400 font-normal">(Ra viện)</span>}</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500 font-bold">{patient ? `${patient.gender} • ${calculateAge(patient.dob)} tuổi` : '-'}</span>
                                {patient?.bedType && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                                      patient.bedType === 'Nội trú ban ngày' 
                                        ? 'bg-amber-100 text-amber-700' 
                                        : patient.bedType === 'Ngoại trú'
                                        ? 'bg-blue-100 text-blue-700'
                                        : patient.bedType === 'Khác'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {patient.bedType}
                                    </span>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className={`p-3 text-center sticky left-[220px] ${stickyCellBg} ${stickyCellHover} z-20 border-r border-slate-100 w-[140px] min-w-[140px] max-w-[140px]`}>
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2 py-1.5 rounded text-xs font-bold">
                            <Bed size={14} /> {patient ? `${patient.bedNumber} - P:${patient.roomNumber || '?'}` : '-'}
                        </div>
                    </td>
                    <td className={`p-3 sticky left-[360px] ${stickyCellBg} ${stickyCellHover} z-20 border-r border-slate-100 w-[140px] min-w-[140px] max-w-[140px]`}>
                        <div className="flex flex-col">
                            <span className="font-black text-xs text-primary uppercase leading-tight">{performingDept?.name || '-'}</span>
                        </div>
                    </td>
                    <td 
                      onClick={() => onAppointmentClick(appt)}
                      className={`p-3 sticky left-[500px] ${stickyCellBg} ${stickyCellHover} z-20 border-r border-slate-100 w-[220px] min-w-[220px] max-w-[220px] cursor-pointer hover:opacity-85 transition-opacity`}
                    >
                        <div className={`flex flex-col gap-1 p-2 rounded-xl border ${getProcedureColor(appt.procedureId).bg}`}>
                            <span className={`font-bold text-xs ${hasConflict || isOutside ? 'text-rose-700 font-extrabold' : getProcedureColor(appt.procedureId).text}`}>{procedure?.name || 'Thủ thuật đã xóa'}</span>
                            {isOutside && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-600 font-black uppercase tracking-tight">
                                    <Clock size={11} /> Ngoài giờ HC
                                </div>
                            )}
                            {hasConflict && appt.conflictDetails && appt.conflictDetails.map((msg, mIdx) => {
                                const isStr = typeof msg === 'string';
                                const message = isStr ? msg : msg.message;
                                const level = isStr ? 1 : msg.level;
                                
                                let bgClass = 'bg-rose-50/90 border-rose-200 text-rose-700';
                                let iconColor = 'text-rose-500';
                                
                                if (level === 2) {
                                    bgClass = 'bg-amber-50/90 border-amber-200 text-amber-700';
                                    iconColor = 'text-amber-500';
                                } else if (level === 3) {
                                    bgClass = 'bg-blue-50/90 border-blue-200 text-blue-700';
                                    iconColor = 'text-blue-500';
                                }

                                return (
                                    <div key={mIdx} className={`flex items-start gap-1.5 text-[10px] font-semibold p-1.5 px-2 rounded-lg border shadow-[0_1px_2px_rgba(0,0,0,0.02)] mt-1 leading-normal ${bgClass}`}>
                                        <AlertTriangle size={11} className={`${iconColor} shrink-0 mt-0.5`} strokeWidth={2.5} />
                                        <span className="break-words">{message}</span>
                                    </div>
                                );
                            })}
                            {hasConflict && (!appt.conflictDetails || appt.conflictDetails.length === 0) && (
                                <div className="flex items-start gap-1.5 text-[10px] font-semibold p-1.5 px-2 rounded-lg border bg-rose-50/90 border-rose-200 text-rose-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)] mt-1 leading-normal">
                                    <AlertTriangle size={11} className="text-rose-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                                    <span>Có xung đột lịch trình</span>
                                </div>
                            )}
                        </div>
                    </td>
                    <td className={`p-3 sticky left-[720px] ${stickyCellBg} ${stickyCellHover} z-20 border-r border-slate-100 text-slate-600 w-[200px] min-w-[200px] max-w-[200px]`}>
                        <div className="flex flex-col gap-1.5">
                            <span className="font-bold text-sm text-slate-800">{staffMember?.name}</span>
                            {appt.assistant1Id && <span className="text-xs text-slate-500">Phụ 1: <span className="font-medium text-slate-700">{staff.find(s => s.id === appt.assistant1Id)?.name}</span></span>}
                            {appt.assistant2Id && <span className="text-xs text-slate-500">Phụ 2: <span className="font-medium text-slate-700">{staff.find(s => s.id === appt.assistant2Id)?.name}</span></span>}
                        </div>
                    </td>
                    <td className={`p-3 text-center font-mono sticky left-[920px] ${stickyCellBg} ${stickyCellHover} z-20 text-sm font-semibold border-r border-slate-100 w-[110px] min-w-[110px] max-w-[110px]`}>
                        {appt.startTime} - {appt.endTime}
                    </td>
                    <td className={`p-3 text-center sticky left-[1030px] ${stickyCellBg} ${stickyCellHover} z-20 border-r border-slate-100 w-[110px] min-w-[110px] max-w-[110px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]`}>
                       {appt.assignedMachineId ? (
                         <span className="px-2.5 py-1 rounded text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-100">
                            {appt.assignedMachineId.replace(/-/g, '')}
                         </span>
                       ) : null}
                    </td>
                    <td className="p-0 relative bg-slate-50/20">
                      <div className="relative h-full w-full" style={{ width: timelineWidth }}>
                        {renderTimeRuler(false)}
                        {procedure?.restMinutes ? (
                          <div 
                            className="absolute top-1/2 -translate-y-1/2 rounded-r-lg border-y-2 border-r-2 border-slate-200 bg-slate-200/50 flex items-center overflow-hidden z-0 pointer-events-none"
                            style={{ left: left + displayWidth - 4, width: minutesToPixels(procedure.restMinutes, pixelsPerMinute) + 4, height: 40 }}
                          >
                             <div className="px-2 pl-3 text-[9px] font-bold text-slate-500 whitespace-nowrap">Nghỉ {procedure.restMinutes}p</div>
                          </div>
                        ) : null}
                        <div 
                          onClick={() => onAppointmentClick(appt)} 
                          className={`absolute top-1/2 -translate-y-1/2 rounded-lg border shadow-sm flex flex-col justify-center px-2 cursor-pointer hover:z-30 hover:scale-[1.02] hover:shadow-md transition-all z-10 ${getBarColor(appt.procedureId, appt.status, isOutside, procedures.find(p => p.id === appt.procedureId)?.isIndependent, !currentDept || appt.deptId === currentDept.id)}`} 
                          style={{ left, width: displayWidth, height: 44 }}
                          title={`${appt.startTime} - ${appt.endTime}: ${procedure?.name || 'Thủ thuật đã xóa'}`}
                        >
                          <div className="font-black text-[9px] leading-tight truncate">
                            {appt.startTime} - {appt.endTime}
                          </div>
                          <div className="font-bold text-[9px] leading-tight truncate mt-0.5">
                            {procedure?.name || 'Thủ thuật đã xóa'}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          );
        })()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-300">
        <div className="min-w-max pb-10">
          <div className="flex border-b border-slate-200 sticky top-0 bg-slate-50 z-40 h-12 shadow-sm">
            <div className="w-72 px-6 flex items-center font-bold text-slate-500 bg-slate-50 border-r border-slate-200 sticky left-0 z-50 text-xs uppercase tracking-wider">
               {viewMode === 'STAFF' && 'Nhân sự'}
               {viewMode === 'PROCEDURE' && 'Thủ thuật'}
               {viewMode === 'PATIENT' && 'Bệnh nhân'}
            </div>
            <div className="relative h-full" style={{ width: timelineWidth }}>
              {renderTimeRuler(true)}
            </div>
          </div>

          {rows.map((row) => (
            <div key={row.id} className="flex border-b border-slate-100 hover:bg-slate-50/50 transition-all group min-h-[90px]">
              <div className="w-72 p-4 border-r border-slate-200 bg-white sticky left-0 z-10 flex items-center gap-4 group-hover:bg-slate-50/80 shadow-[2px_0_10px_-5px_rgba(0,0,0,0.05)]">
                <div className={`w-1.5 h-10 rounded-full shrink-0 ${row.color}`}></div>
                <div className="overflow-hidden">
                  <div className="text-sm font-bold text-slate-800 truncate" title={row.title}>{row.title}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 truncate mt-0.5">
                    {row.icon}
                    {row.subtitle}
                  </div>
                </div>
              </div>

              <div className="relative h-auto min-h-[90px] cursor-crosshair" style={{ width: timelineWidth }} onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
                  const minutesFromStart = x / pixelsPerMinute;
                  const clickedMinutes = startHour * 60 + minutesFromStart;
                  const roundedMinutes = Math.floor(clickedMinutes / 15) * 15;
                  const hours = Math.floor(roundedMinutes / 60);
                  const minutes = roundedMinutes % 60;
                  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                  onEmptySlotClick(row.id, timeString, viewMode);
                }}>
                {renderTimeRuler(false)}
                {filteredAppointments.filter(a => {
                    if (viewMode === 'STAFF') return a.staffId === row.originalId || a.assistant1Id === row.originalId || a.assistant2Id === row.originalId;
                    if (viewMode === 'PROCEDURE') return a.procedureId === row.originalId;
                    if (viewMode === 'PATIENT') return a.patientId === row.originalId;
                    return false;
                }).map(appt => {
                    const startMin = timeStringToMinutes(appt.startTime);
                    const endMin = timeStringToMinutes(appt.endTime);
                    const procedure = procedures.find(p => p.id === appt.procedureId);

                    let blockStartMin = startMin;
                    let blockEndMin = endMin;
                    
                    if (viewMode === 'PROCEDURE') {
                        if (row.role === 'MAIN') {
                           if (!appt.staffId) return null;
                           blockStartMin = startMin + (appt.mainBusyStart ?? procedure?.mainBusyStart ?? 0);
                           blockEndMin = startMin + (appt.mainBusyEnd ?? procedure?.mainBusyEnd ?? procedure?.busyMinutes ?? procedure?.durationMinutes ?? 0);
                        } else if (row.role === 'ASST1') {
                           if (!appt.assistant1Id) return null;
                           blockStartMin = startMin + (appt.asst1BusyStart ?? procedure?.asst1BusyStart ?? 0);
                           blockEndMin = startMin + (appt.asst1BusyEnd ?? procedure?.asst1BusyEnd ?? procedure?.assistant1BusyMinutes ?? 0);
                        } else if (row.role === 'ASST2') {
                           if (!appt.assistant2Id) return null;
                           blockStartMin = startMin + (appt.asst2BusyStart ?? procedure?.asst2BusyStart ?? 0);
                           blockEndMin = startMin + (appt.asst2BusyEnd ?? procedure?.asst2BusyEnd ?? procedure?.assistant2BusyMinutes ?? 0);
                        }
                    } else if (viewMode === 'STAFF') {
                        if (appt.staffId === row.originalId) {
                           blockStartMin = startMin + (appt.mainBusyStart ?? procedure?.mainBusyStart ?? 0);
                           blockEndMin = startMin + (appt.mainBusyEnd ?? procedure?.mainBusyEnd ?? procedure?.busyMinutes ?? procedure?.durationMinutes ?? 0);
                        } else if (appt.assistant1Id === row.originalId) {
                           blockStartMin = startMin + (appt.asst1BusyStart ?? procedure?.asst1BusyStart ?? 0);
                           blockEndMin = startMin + (appt.asst1BusyEnd ?? procedure?.asst1BusyEnd ?? procedure?.assistant1BusyMinutes ?? 0);
                        } else if (appt.assistant2Id === row.originalId) {
                           blockStartMin = startMin + (appt.asst2BusyStart ?? procedure?.asst2BusyStart ?? 0);
                           blockEndMin = startMin + (appt.asst2BusyEnd ?? procedure?.asst2BusyEnd ?? procedure?.assistant2BusyMinutes ?? 0);
                        }
                    }

                    if (blockEndMin <= blockStartMin) blockEndMin = blockStartMin + 5;

                    const width = minutesToPixels(blockEndMin - blockStartMin, pixelsPerMinute);
                    const left = minutesToPixels(blockStartMin, pixelsPerMinute);
                    const patient = patients.find(p => p.id === appt.patientId);
                    const staffMember = staff.find(s => s.id === appt.staffId);
                    const isOutside = !isInsideOfficeHours(startMin, endMin);
                    const hasConflict = appt.status === AppointmentStatus.CONFLICT;

                    const displayWidth = Math.max(width, 100);

                    return (
                      <React.Fragment key={appt.id}>
                        {procedure?.restMinutes && (!row.role || row.role === 'ALL') ? (
                          <div 
                            className="absolute top-4 bottom-4 rounded-r-lg border-y border-r border-slate-200 bg-slate-200/50 flex items-center overflow-hidden z-10 pointer-events-none"
                            style={{ left: minutesToPixels(endMin, pixelsPerMinute), width: minutesToPixels(procedure.restMinutes, pixelsPerMinute) + 4 }}
                          >
                             <div className="px-2 pl-3 text-[9px] font-bold text-slate-500 whitespace-nowrap truncate">Nghỉ {procedure.restMinutes}p</div>
                          </div>
                        ) : null}
                        <div onClick={(e) => { e.stopPropagation(); onAppointmentClick(appt); }} className={`absolute top-3 bottom-3 rounded-lg border px-3 py-2 cursor-pointer hover:shadow-lg hover:z-50 hover:scale-[1.02] transition-all z-20 flex flex-col justify-between overflow-hidden ${getStatusColor(appt.status, isOutside, procedure?.isIndependent, !currentDept || appt.deptId === currentDept.id)}`} style={{ left, width: displayWidth }}>
                         <div className={`font-bold text-xs truncate flex items-center gap-1.5 ${hasConflict || isOutside ? 'text-white' : 'text-slate-900'}`}>
                            {patient?.insuranceLevel && (
                              <div className={`shrink-0 w-2.5 h-3.5 rounded-[2px] border shadow-sm ${
                                patient.insuranceLevel === '0%' ? 'bg-rose-500 border-rose-600' :
                                patient.insuranceLevel === '80%' ? 'bg-orange-500 border-orange-600' :
                                patient.insuranceLevel === '95%' ? 'bg-lime-400 border-lime-500' :
                                'bg-emerald-500 border-emerald-600'
                              }`} title={`BHYT: ${patient.insuranceLevel}`} />
                            )}
                            {viewMode !== 'PATIENT' ? (patient?.name || 'Không yêu cầu BN') : staffMember?.name}
                            {patient?.note && (
                              <div className="group/note relative">
                                <Plus size={10} className="text-amber-500 bg-amber-50 rounded-full border border-amber-200 cursor-help shrink-0" />
                                <div className="absolute left-full ml-1 top-0 hidden group-hover/note:block z-[100] w-48 p-2 bg-slate-800 text-white text-[10px] font-medium rounded-lg shadow-xl backdrop-blur-sm bg-opacity-90 leading-normal normal-case tracking-normal">
                                  {patient.note}
                                </div>
                              </div>
                            )}
                            {viewMode === 'STAFF' && appt.assistant1Id === row.originalId && <span className="ml-1 text-[9px] bg-white/30 px-1 rounded">Phụ 1</span>}
                            {viewMode === 'STAFF' && appt.assistant2Id === row.originalId && <span className="ml-1 text-[9px] bg-white/30 px-1 rounded">Phụ 2</span>}
                         </div>
                         <div className={`text-[10px] font-medium truncate flex items-center gap-1 ${hasConflict || isOutside ? 'text-white/80' : 'text-slate-500'}`}>
                            <Zap size={10} />{viewMode !== 'PROCEDURE' ? (procedure?.name || 'Thủ thuật đã xóa') : staffMember?.name}
                            {viewMode !== 'STAFF' && (appt.assistant1Id || appt.assistant2Id) && row.role === 'ALL' && (
                                <span className="ml-1 text-[9px] opacity-70">
                                    (Phụ: {[
                                        staff.find(s => s.id === appt.assistant1Id)?.name,
                                        staff.find(s => s.id === appt.assistant2Id)?.name
                                    ].filter(Boolean).join(', ')})
                                </span>
                            )}
                         </div>
                         <div className="absolute top-2 right-2 text-[9px] font-mono font-bold opacity-50 bg-slate-100 px-1 rounded text-slate-800">{minutesToTimeString(blockStartMin)} - {minutesToTimeString(blockEndMin)}</div>
                      </div>
                      </React.Fragment>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
