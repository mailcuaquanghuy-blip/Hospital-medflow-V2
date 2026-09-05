
import React, { useState, useMemo, useEffect } from 'react';
import { Staff, Patient, Procedure, Appointment, AppointmentStatus, Department, DepartmentType, TimelineViewMode, AttendanceRecord, AttendanceStatus, PatientStatus, PatientReferral, UserAccount, UserRole, AppointmentTemplate, MachineShift, Backup, ScheduleSnapshot } from './types';
import { MOCK_STAFF, MOCK_PATIENTS, MOCK_PROCEDURES, DEPARTMENTS, DEFAULT_ADMIN, MOCK_TEMPLATES } from './constants';

import { checkConflict, findAvailableStaffForSlot, calculateAge, timeStringToMinutes, minutesToTimeString, getRoleLabel, formatDate, getAbbreviation } from './utils/timeUtils';
import { setSessionBaseline, saveDeletedSessionAppointment, removeDeletedSessionAppointment, clearDeletedSessionAppointments } from './utils/scheduleHistoryUtils';
import { handleFirestoreError, OperationType, subscribeQuotaExceeded, isQuotaExceededState } from './utils/firestoreUtils';
import { isSupabaseConfigured, fetchSupabaseTable, saveSupabaseItem, deleteSupabaseItem, resetSupabaseDatabase } from './utils/supabaseService';
import { supabase } from './supabaseClient';
import { Timeline } from './components/Timeline';
import { DailyReport } from './components/DailyReport';
import { Dashboard } from './components/Dashboard';
import { BookingModal } from './components/BookingModal';
import { StaffManager } from './components/StaffManager';
import { PatientList } from './components/PatientList';
import { PatientScheduling } from './components/PatientScheduling';
import { MachineShiftManager } from './components/MachineShiftManager';
import { PatientModal } from './components/PatientModal';
import { VerificationModal } from './components/VerificationModal';
import { Login } from './components/Login';
import { LoginLoader } from './components/LoginLoader';
import { AccountManager } from './components/AccountManager';
import { BackupManager } from './components/BackupManager';
import { DepartmentBackupModal } from './components/DepartmentBackupModal';
import { BatchLoadOptions } from './components/BatchLoadModal';
import { Button } from './components/Button';
import { DateTimePicker } from './components/DateTimePicker';
import { DateInput } from './components/DateInput';
import { Home, Building2, Table2, FileText, CalendarPlus, AlertCircle, LogOut, ShieldCheck, User, UserCog, X, Briefcase, Check, Save, PieChart, Database, Clock } from 'lucide-react';

// Database operations via Supabase
import { 
  db,
  collection, 
  doc, 
  query,
  where,
  getDocs,
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch 
} from './utils/dbService';


export type MainTab = 'PATIENT_RECORDS' | 'SCHEDULING' | 'GENERAL_TIMELINE' | 'DAILY_REPORT' | 'DEPT_MANAGER' | 'ACCOUNT_MANAGER' | 'ACCOUNT_BACKUP';
export type ManagerTab = 'PERSONNEL' | 'ATTENDANCE' | 'PROCEDURES';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = sessionStorage.getItem('medflow_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [showLoginLoading, setShowLoginLoading] = useState(() => {
    const saved = sessionStorage.getItem('medflow_user');
    return !!saved;
  });

  const [loadedCollections, setLoadedCollections] = useState<Record<string, boolean>>({
    patients: false,
    appointments: false,
    templates: false,
    attendance: false,
    staff: false,
    machineShifts: false,
    procedures: false,
    scheduleSnapshots: false,
  });
  
  const [currentDept, setCurrentDept] = useState<Department | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('PATIENT_RECORDS');
  const [managerSubTab, setManagerSubTab] = useState<ManagerTab>('PERSONNEL');
  const [activeDate, setActiveDate] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISO = new Date(now.getTime() - offset).toISOString().split('T')[0];
    return localISO;
  });
  
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [machineShifts, setMachineShifts] = useState<MachineShift[]>([]);
  const [templates, setTemplates] = useState<AppointmentTemplate[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [scheduleSnapshots, setScheduleSnapshots] = useState<ScheduleSnapshot[]>([]);
  const [undoData, setUndoData] = useState<Appointment[] | null>(null);
  
  // Ref to throttle rapid database reloads (preventing lag & state overwrites during focus events)
  const lastFetchTimeRef = React.useRef<number>(0);
  
  // Verification State
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: string; data: any } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Partial<Appointment> | undefined>(undefined);
  const [isPatientEditModalOpen, setIsPatientEditModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Partial<Patient> | null>(null);
  const [referralModal, setReferralModal] = useState<{patientId: string, specialty: string, procedureIds: string[], referralTime: string} | null>(null);
  const [timelineFilters, setTimelineFilters] = useState<{procedureIds?: string[], staffIds?: string[]}>({});

  // Staff Edit State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Partial<Staff> | null>(null);
  const [isDeptBackupModalOpen, setIsDeptBackupModalOpen] = useState(false);

  const [isQuotaExceeded, setIsQuotaExceeded] = useState(isQuotaExceededState);

  useEffect(() => {
    return subscribeQuotaExceeded((exceeded) => {
      setIsQuotaExceeded(exceeded);
    });
  }, []);

  useEffect(() => {
    const handleDbChange = (e: Event) => {
      const { collectionName, docId, data, action } = (e as CustomEvent).detail;
      console.log(`[db-change event received] ${collectionName}/${docId} action: ${action}`, data);
      
      switch (collectionName) {
        case 'users':
          setUsers(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [...prev, data];
          });
          break;
        case 'appointments':
          setAppointments(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [...prev, data];
          });
          break;
        case 'machineShifts':
        case 'machine_shifts':
          setMachineShifts(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [...prev, data];
          });
          break;
        case 'templates':
          setTemplates(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [...prev, data];
          });
          break;
        case 'patients':
          setPatients(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [data, ...prev];
          });
          break;
        case 'staff':
          setStaff(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [...prev, data];
          });
          break;
        case 'attendance':
          setAttendanceRecords(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [...prev, data];
          });
          break;
        case 'procedures':
          setProcedures(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [...prev, data];
          });
          break;
        case 'backups':
          setBackups(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [...prev, data];
          });
          break;
        case 'scheduleSnapshots':
        case 'schedule_snapshots':
          setScheduleSnapshots(prev => {
            if (action === 'delete') return prev.filter(item => item.id !== docId);
            const idx = prev.findIndex(item => item.id === docId);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...data };
              return copy;
            }
            return [...prev, data];
          });
          break;
        default:
          break;
      }
    };

    window.addEventListener('db-change', handleDbChange);
    return () => {
      window.removeEventListener('db-change', handleDbChange);
    };
  }, []);

  useEffect(() => {
    if (isQuotaExceeded) {
      if (users.length === 0) setUsers([DEFAULT_ADMIN]);
      if (staff.length === 0) setStaff(MOCK_STAFF);
      if (procedures.length === 0) setProcedures(MOCK_PROCEDURES);
      if (patients.length === 0) setPatients(MOCK_PATIENTS);
      if (templates.length === 0) setTemplates(MOCK_TEMPLATES);
      setLoadedCollections({
        patients: true,
        appointments: true,
        templates: true,
        attendance: true,
        staff: true,
        machineShifts: true,
        procedures: true,
        scheduleSnapshots: true,
      });
    }
  }, [isQuotaExceeded, users.length, staff.length, procedures.length, patients.length, templates.length]);

  // Auth readiness
  useEffect(() => {
    setIsAuthReady(true);
  }, []);

  // Load users from Supabase on startup and perform basic Supabase seeding if empty
  useEffect(() => {
    if (isSupabaseConfigured()) {
      const initSupabase = async () => {
        try {
          const usrs = await fetchSupabaseTable<UserAccount>('users');
          let currentUsrs = usrs || [];
          
          // Seed DEFAULT_ADMIN if not present
          if (!currentUsrs.some(u => u.id === DEFAULT_ADMIN.id)) {
            console.log("Seeding DEFAULT_ADMIN to Supabase...");
            await saveSupabaseItem('users', DEFAULT_ADMIN.id, DEFAULT_ADMIN);
            currentUsrs.push(DEFAULT_ADMIN);
          }
          
          setUsers(currentUsrs);

          // Seed procedures if empty
          const procs = await fetchSupabaseTable<Procedure>('procedures');
          if (!procs || procs.length === 0) {
            console.log("Seeding MOCK_PROCEDURES to Supabase...");
            for (const p of MOCK_PROCEDURES) {
              await saveSupabaseItem('procedures', p.id, p);
            }
          }

          // Seed templates if empty
          const tpls = await fetchSupabaseTable<AppointmentTemplate>('templates');
          if (!tpls || tpls.length === 0) {
            console.log("Seeding MOCK_TEMPLATES to Supabase...");
            for (const t of MOCK_TEMPLATES) {
              await saveSupabaseItem('templates', t.id, t);
            }
          }
        } catch (err) {
          console.warn("Failed to initialize or fetch users on startup from Supabase:", err);
        }
      };
      initSupabase();
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (isSupabaseConfigured()) {
      console.log("Supabase configured. Loading and subscribing to real-time data from Supabase project...");
      
      const loadSupabaseData = async (force = false) => {
        const now = Date.now();
        // Throttle reloads to maximum once every 20 seconds, unless forced
        if (!force && now - lastFetchTimeRef.current < 20000) {
          console.log("[loadSupabaseData] Throttled (last sync was < 20s ago). Skipping fetch to preserve UI state.");
          return;
        }
        lastFetchTimeRef.current = now;

        try {
          const [pats, appts, stf, procs, att, shifts, tpls, usrs, snapshots, bkps] = await Promise.all([
            fetchSupabaseTable<Patient>('patients'),
            fetchSupabaseTable<Appointment>('appointments'),
            fetchSupabaseTable<Staff>('staff'),
            fetchSupabaseTable<Procedure>('procedures'),
            fetchSupabaseTable<AttendanceRecord>('attendance'),
            fetchSupabaseTable<MachineShift>('machine_shifts'),
            fetchSupabaseTable<AppointmentTemplate>('templates'),
            fetchSupabaseTable<UserAccount>('users'),
            fetchSupabaseTable<ScheduleSnapshot>('schedule_snapshots').then(res => res || fetchSupabaseTable<ScheduleSnapshot>('scheduleSnapshots')),
            fetchSupabaseTable<Backup>('backups')
          ]);
          if (pats) setPatients(pats);
          if (appts) setAppointments(appts);
          if (stf) setStaff(stf);
          if (procs) setProcedures(procs);
          if (att) setAttendanceRecords(att);
          if (shifts) setMachineShifts(shifts);
          if (tpls) {
            const sanitizedTpls = tpls.map(t => ({
              ...t,
              procedures: t.procedures || []
            }));
            setTemplates(sanitizedTpls);
          }
          if (usrs && usrs.length > 0) setUsers(usrs);
          if (snapshots) setScheduleSnapshots(snapshots);
          if (bkps) setBackups(bkps);

          setLoadedCollections({
            patients: true,
            appointments: true,
            templates: true,
            attendance: true,
            staff: true,
            machineShifts: true,
            procedures: true,
            scheduleSnapshots: true,
          });
        } catch (err) {
          console.warn("Failed to fetch Supabase data:", err);
        }
      };

      // Force initial load of data on mount
      loadSupabaseData(true);

      // Supabase Realtime Subscription for instant updates across tabs & devices
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          (payload) => {
            const tableName = payload.table;
            let collectionName = tableName;
            if (tableName === 'machine_shifts') collectionName = 'machineShifts';
            if (tableName === 'schedule_snapshots' || tableName === 'scheduleSnapshots') collectionName = 'scheduleSnapshots';

            if (payload.eventType === 'DELETE') {
              const docId = payload.old?.id;
              if (docId) {
                const event = new CustomEvent('db-change', {
                  detail: { collectionName, docId, data: null, action: 'delete' }
                });
                window.dispatchEvent(event);
              }
            } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const row = payload.new;
              if (row && row.id) {
                const itemData = row.data && typeof row.data === 'object' ? { ...row.data, id: row.id } : row;
                const event = new CustomEvent('db-change', {
                  detail: { collectionName, docId: row.id, data: itemData, action: 'set' }
                });
                window.dispatchEvent(event);
              }
            }
          }
        )
        .subscribe();

      // Background periodic sync (every 60s) when page is visible as a fallback
      const pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          loadSupabaseData(true);
        }
      }, 60000);

      // Throttled re-sync on tab visibility change (tab switches, locks, etc.)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          loadSupabaseData(false);
        }
      };

      window.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
        window.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [currentUser]);

  const handleLogin = (user: UserAccount) => {
    setShowLoginLoading(true);
    setLoadedCollections({
      patients: false,
      appointments: false,
      templates: false,
      attendance: false,
      staff: false,
      machineShifts: false,
      procedures: false,
      scheduleSnapshots: false,
    });
    setCurrentUser(user);
    sessionStorage.setItem('medflow_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentDept(null);
    setShowLoginLoading(false);
    sessionStorage.removeItem('medflow_user');
  };

  const canEditCurrentDept = useMemo(() => {
    if (!currentUser || !currentDept) return false;
    return currentUser.role === UserRole.ADMIN || currentUser.editableDeptIds.includes(currentDept.id);
  }, [currentUser, currentDept]);

  const handleSaveUser = async (user: UserAccount) => {
    if (!db) return;
    try {
      await setDoc(doc(db, "users", user.id), user);
    } catch (e) { 
      handleFirestoreError(e, OperationType.WRITE, `users/${user.id}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!db) return;
    if (confirm('Xóa tài khoản này?')) {
      try {
        await deleteDoc(doc(db, "users", id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${id}`);
      }
    }
  };

  const deptStaff = currentDept ? staff.filter(s => s.deptId === currentDept.id) : [];

  // Logic Timeline Liên khoa
  const deptAppointments = useMemo(() => {
    if (!currentDept) return [];
    return appointments.filter(a => a.date === activeDate);
  }, [appointments, currentDept, activeDate]);

  const handleSavePatient = async (patient: Patient) => {
    try {
      let apptsToDelete: Appointment[] = [];

      if (patient.status === PatientStatus.DISCHARGED && patient.dischargeDate) {
        const originalPatient = patients.find(oldP => oldP.id === patient.id);
        const isNewDischarge = originalPatient?.status !== PatientStatus.DISCHARGED;
        const isDateChanged = originalPatient?.dischargeDate !== patient.dischargeDate;

        if (isNewDischarge || isDateChanged) {
          const confirmDischarge = window.confirm("Khi cho bệnh nhân ra, các lịch trình sau thời gian ra viện sẽ bị xóa. Bạn có chắc chắn muốn tiếp tục?");
          if (!confirmDischarge) {
            return;
          }

          const dischargeDayOnly = patient.dischargeDate.split('T')[0];
          const dischargeLimit = new Date(patient.dischargeDate).getTime();
          apptsToDelete = appointments.filter(appt => {
            if (appt.patientId !== patient.id) return false;
            if (appt.date > dischargeDayOnly) {
              return true;
            }
            if (appt.date === dischargeDayOnly) {
              const apptDateObj = new Date(`${appt.date}T${appt.endTime || appt.startTime || "00:00"}:00`);
              return apptDateObj.getTime() > dischargeLimit;
            }
            return false;
          });
        }
      }

      // Close modal immediately so UI is 100% instant (0ms delay)!
      setIsPatientEditModalOpen(false);
      setEditingPatient(null);

      // Optimistic state updates
      setPatients(prev => {
        const exists = prev.some(oldP => oldP.id === patient.id);
        if (exists) return prev.map(oldP => oldP.id === patient.id ? patient : oldP);
        return [patient, ...prev];
      });

      if (apptsToDelete.length > 0) {
        const apptIdsToDelete = new Set(apptsToDelete.map(a => a.id));
        setAppointments(prev => prev.filter(a => !apptIdsToDelete.has(a.id)));
      }

      // Save to Supabase and Firestore
      const cleanPatient = JSON.parse(JSON.stringify(patient, (key, value) => value === undefined ? null : value));
      
      if (isSupabaseConfigured()) {
        await saveSupabaseItem('patients', patient.id, cleanPatient);
        if (apptsToDelete.length > 0) {
          for (const appt of apptsToDelete) {
            await deleteSupabaseItem('appointments', appt.id);
          }
        }
      }

      if (db) {
        const dbPromises: Promise<any>[] = [setDoc(doc(db, "patients", patient.id), cleanPatient)];
        if (apptsToDelete.length > 0) {
          apptsToDelete.forEach(appt => {
            dbPromises.push(deleteDoc(doc(db, "appointments", appt.id)));
          });
        }
        await Promise.all(dbPromises);
      }
    } catch (error) { 
      console.error("Error saving patient:", error);
    }
  };

  const handleDeletePatient = async (patientId: string) => {
    try {
      // Kiểm tra xem bệnh nhân còn lịch trình nào không bằng local state
      const hasAppointments = appointments.some(appt => appt.patientId === patientId);
      
      if (hasAppointments) {
        alert("Không thể xóa bệnh nhân này vì vẫn còn lịch trình. Vui lòng xóa toàn bộ lịch trình của bệnh nhân trước khi xóa hồ sơ.");
        return;
      }

      // Optimistic update
      setPatients(prev => prev.filter(p => p.id !== patientId));

      if (isSupabaseConfigured()) {
        await deleteSupabaseItem('patients', patientId);
      }
      if (db) {
        await deleteDoc(doc(db, "patients", patientId));
      }
      console.log(`Đã xóa hồ sơ bệnh nhân ${patientId}`);
    } catch (error) { 
      console.error("Error deleting patient:", error);
    }
  };

  const handleSaveBooking = async (data: Partial<Appointment>, skipVerify = false) => {
    if (!currentDept) return;
    
    // Check if patient is discharged
    const patient = patients.find(p => p.id === data.patientId);
    if (!skipVerify && patient?.status === PatientStatus.DISCHARGED) {
      setPendingAction({ type: 'SAVE_BOOKING', data });
      setIsVerificationModalOpen(true);
      return;
    }

    const conflictRes = checkConflict(data.startTime!, data.endTime!, data.date!, data.staffId!, data.patientId, appointments, staff, procedures, attendanceRecords, patients, data.procedureId, data.id, data.assistant1Id, data.assistant2Id, data);
    
    const id = data.id || 'appt_' + Math.random().toString(36).substr(2, 9);
    const baseAppt: any = {
      ...data,
      id: id,
      patientId: data.patientId || '',
      staffId: data.staffId!,
      assistant1Id: data.assistant1Id || null,
      assistant2Id: data.assistant2Id || null,
      procedureId: data.procedureId!,
      deptId: data.deptId || currentDept.id,
      date: data.date!,
      startTime: data.startTime!,
      endTime: data.endTime!,
      status: conflictRes.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING,
      assignedMachineId: data.assignedMachineId || conflictRes.assignedMachineId || null,
      machineShiftId: data.machineShiftId || null,
      conflictDetails: conflictRes.conflictDetails
    };

    // Remove undefined fields
    Object.keys(baseAppt).forEach(key => {
      if (baseAppt[key] === undefined) {
        delete baseAppt[key];
      }
    });

    // Close modal and reset editing appointment state immediately for instant local UI responsiveness
    setIsModalOpen(false);
    setEditingAppt(undefined);

    // Optimistic local state update for zero latency responsiveness
    setAppointments(prev => {
      const exists = prev.some(a => a.id === id);
      if (exists) return prev.map(a => a.id === id ? (baseAppt as Appointment) : a);
      return [...prev, baseAppt as Appointment];
    });

    try {
      if (isSupabaseConfigured()) {
        await saveSupabaseItem('appointments', id, baseAppt as Appointment);
      }
      if (db) {
        await setDoc(doc(db, "appointments", id), baseAppt as Appointment);
      }
    } catch (error) { 
      console.error("Error saving appointment:", error); 
    }
  };
  
  const handleAddMachineShift = async (shift: Omit<MachineShift, 'id'>) => {
    if (!db || !canEditCurrentDept) return;
    try {
      const newShift = { ...shift, id: `shift_${Date.now()}` };
      await setDoc(doc(db, 'machineShifts', newShift.id), newShift);
    } catch (error) { 
      handleFirestoreError(error, OperationType.CREATE, 'machineShifts');
    }
  };

  const handleUpdateMachineShift = async (id: string, shift: Partial<MachineShift>, updateLinkedAppointments: boolean) => {
    if (!db || !canEditCurrentDept) return;
    try {
      await updateDoc(doc(db, 'machineShifts', id), shift);
      
      if (updateLinkedAppointments) {
        const linkedAppts = appointments.filter(a => a.machineShiftId === id);
        for (const appt of linkedAppts) {
          const updatedAppt: any = {
            ...appt,
            startTime: shift.startTime || appt.startTime,
            endTime: shift.endTime || appt.endTime,
            staffId: shift.staffId || appt.staffId,
            assistant1Id: shift.assistant1Id !== undefined ? shift.assistant1Id : appt.assistant1Id,
            assistant2Id: shift.assistant2Id !== undefined ? shift.assistant2Id : appt.assistant2Id,
          };
          
          Object.keys(updatedAppt).forEach(key => {
            if (updatedAppt[key] === undefined) {
              delete updatedAppt[key];
            }
          });

          await updateDoc(doc(db, 'appointments', appt.id), updatedAppt);
        }
      }
    } catch (error) { 
      handleFirestoreError(error, OperationType.UPDATE, `machineShifts/${id}`);
    }
  };

  const handleDeleteMachineShift = async (id: string) => {
    if (!db || !canEditCurrentDept) return;
    try {
      // Chỉ cho phép xóa ca máy nếu trống
      const linkedAppts = appointments.filter(a => a.machineShiftId === id);
      if (linkedAppts.length > 0) {
        alert(`Không thể xóa ca máy đang có ${linkedAppts.length} bệnh nhân. Vui lòng chuyển bệnh nhân sang ca khác trước.`);
        return;
      }
      await deleteDoc(doc(db, 'machineShifts', id));
    } catch (error) { 
      handleFirestoreError(error, OperationType.DELETE, `machineShifts/${id}`);
    }
  };

  const handleCleanupEmptyMachineShifts = async () => {
    if (!db || !canEditCurrentDept || !currentDept) return;
    
    // Tìm các ca máy của khoa hiện tại không có lịch trình nào liên kết
    const emptyShifts = machineShifts.filter(shift => {
      const isFromCurrentDept = shift.deptId === currentDept.id;
      const isLinked = appointments.some(appt => appt.machineShiftId === shift.id);
      return isFromCurrentDept && !isLinked;
    });

    if (emptyShifts.length === 0) {
      alert("Không có ca máy trống nào cần dọn dẹp.");
      return;
    }

    if (!window.confirm(`Tìm thấy ${emptyShifts.length} ca máy trống (không có bệnh nhân). Bạn có chắc chắn muốn xóa tất cả?`)) return;

    try {
      for (const shift of emptyShifts) {
        await deleteDoc(doc(db, 'machineShifts', shift.id));
      }
      alert(`Đã dọn dẹp xong ${emptyShifts.length} ca máy.`);
    } catch (error) {
      console.error("Lỗi khi dọn dẹp ca máy:", error);
      alert("Có lỗi xảy ra khi dọn dẹp.");
    }
  };

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSaveScheduleSnapshot = async (deptId: string, dateStr: string) => {
    try {
      const deptAppts = appointments.filter(a => a.deptId === deptId && a.date === dateStr);
      const snapshotId = `${deptId}_${dateStr}`;
      
      await setDoc(doc(db, 'scheduleSnapshots', snapshotId), {
        id: snapshotId,
        deptId,
        date: dateStr,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.fullName || 'Hệ thống',
        appointments: deptAppts
      });
      
      setSessionBaseline(deptId, dateStr, deptAppts);
      clearDeletedSessionAppointments(deptId, dateStr);
      alert('Đã lưu phiên bản chốt thành công! Tất cả nhật ký chỉnh sửa của phiên đã được làm sạch.');
    } catch (err) {
      console.error('Error saving schedule snapshot:', err);
      alert('Không thể lưu phiên bản chốt. Vui lòng thử lại.');
    }
  };

  const handleUndoAppointmentChange = async (
    apptId: string,
    type: 'NEW' | 'MODIFIED' | 'DELETED',
    originalAppt?: Appointment
  ) => {
    try {
      if (type === 'NEW') {
        setAppointments(prev => prev.filter(a => a.id !== apptId));
        await deleteDoc(doc(db, 'appointments', apptId));
      } else if (type === 'MODIFIED' && originalAppt) {
        setAppointments(prev => prev.map(a => a.id === apptId ? originalAppt : a));
        await setDoc(doc(db, 'appointments', apptId), originalAppt);
      } else if (type === 'DELETED' && originalAppt) {
        setAppointments(prev => [...prev.filter(a => a.id !== apptId), originalAppt]);
        await setDoc(doc(db, 'appointments', apptId), originalAppt);
        removeDeletedSessionAppointment(originalAppt.deptId, originalAppt.date, apptId);
      }
      alert('Đã hoàn tác thao tác chỉnh sửa thành công!');
    } catch (err) {
      console.error('Error undoing appointment change:', err);
      alert('Không thể hoàn tác thao tác. Vui lòng thử lại.');
    }
  };

  const handleUpdateAppointment = async (updatedAppt: Appointment, skipVerify = false) => {
    // Check if patient is discharged
    const patient = patients.find(p => p.id === updatedAppt.patientId);
    if (!skipVerify && patient?.status === PatientStatus.DISCHARGED) {
      setPendingAction({ type: 'UPDATE_APPT', data: updatedAppt });
      setIsVerificationModalOpen(true);
      return;
    }

    const res = checkConflict(updatedAppt.startTime, updatedAppt.endTime, updatedAppt.date, updatedAppt.staffId, updatedAppt.patientId, appointments, staff, procedures, attendanceRecords, patients, updatedAppt.procedureId, updatedAppt.id, updatedAppt.assistant1Id, updatedAppt.assistant2Id, updatedAppt);
    
    const finalAppt: any = { 
      ...updatedAppt, 
      status: res.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING,
      assignedMachineId: updatedAppt.assignedMachineId || res.assignedMachineId || null,
      conflictDetails: res.conflictDetails
    };

    // Remove undefined fields
    Object.keys(finalAppt).forEach(key => {
      if (finalAppt[key] === undefined) {
        delete finalAppt[key];
      }
    });

    // Optimistic local state update for zero-delay UI response
    setAppointments(prev => prev.map(a => a.id === updatedAppt.id ? (finalAppt as Appointment) : a));

    try {
      if (isSupabaseConfigured()) {
        await saveSupabaseItem('appointments', updatedAppt.id, finalAppt as Appointment);
      }
      if (db) {
        await setDoc(doc(db, "appointments", updatedAppt.id), finalAppt as Appointment);
      }
    } catch (error) { 
      console.error("Error updating appointment:", error);
    }
  };

  const handleDeleteAppointment = async (apptId: string, skipVerify = false) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;

    // Check if patient is discharged
    const patient = patients.find(p => p.id === appt.patientId);
    if (!skipVerify && patient?.status === PatientStatus.DISCHARGED) {
      setPendingAction({ type: 'DELETE_APPT', data: apptId });
      setIsVerificationModalOpen(true);
      return;
    }

    // Save to deleted session storage so deletion can be undone in ScheduleHistoryModal
    saveDeletedSessionAppointment(appt);

    // Optimistic local state update for instant zero-delay deletion UI response
    setAppointments(prev => prev.filter(a => a.id !== apptId));

    try {
      if (isSupabaseConfigured()) {
        await deleteSupabaseItem('appointments', apptId);
      }
      if (db) {
        await deleteDoc(doc(db, "appointments", apptId));
      }
    } catch (error) {
      console.error("Error deleting appointment:", error);
    }
  };

  const handleCopyToDateRange = async (patientId: string, sourceDate: string, startDate: string, endDate: string, selectedApptIds?: string[]) => {
    if (!db || !canEditCurrentDept) return;
    
    // Mỗi khoa chỉ được sao chép lịch trình thuộc khoa của mình
    const targetDeptId = currentDept?.id;
    let sourceAppts = appointments.filter(a => 
      a.patientId === patientId && 
      a.date === sourceDate && 
      (!targetDeptId || a.deptId === targetDeptId)
    );
    
    // Filter by selected appointments if provided
    if (selectedApptIds && selectedApptIds.length > 0) {
      sourceAppts = sourceAppts.filter(a => selectedApptIds.includes(a.id));
    }
    
    if (sourceAppts.length === 0) {
      alert("Không tìm thấy lịch trình nào để sao chép.");
      return;
    }

    // Build dateRange in a timezone-safe manner using local year, month, day integers
    let dateRange: string[] = [];
    const [sY, sM, sD] = startDate.split('-').map(Number);
    const [eY, eM, eD] = endDate.split('-').map(Number);
    let currDate = new Date(sY, sM - 1, sD);
    const endDateObj = new Date(eY, eM - 1, eD);

    while (currDate <= endDateObj) {
      const y = currDate.getFullYear();
      const m = String(currDate.getMonth() + 1).padStart(2, '0');
      const d = String(currDate.getDate()).padStart(2, '0');
      dateRange.push(`${y}-${m}-${d}`);
      currDate.setDate(currDate.getDate() + 1);
    }

    // Lọc loại ngày (ngày nghỉ vs ngày thường)
    const isDayHoliday = (d: string) => {
      if (!targetDeptId) return false;
      return attendanceRecords.some(r => 
        (r.staffId === `holiday_dept_${targetDeptId}` || r.staffId === `holiday_${targetDeptId}`) && 
        r.date === d && 
        r.status === AttendanceStatus.OFF_FULL
      );
    };

    const isSourceHoliday = isDayHoliday(sourceDate);

    // Tự động loại bỏ các ngày khác loại (ví dụ: nguồn là ngày thường thì chỉ sao chép sang ngày thường, nguồn là ngày nghỉ thì chỉ sao chép sang ngày nghỉ)
    const actualTargetDates = dateRange.filter(d => d !== sourceDate && isDayHoliday(d) === isSourceHoliday);
    if (actualTargetDates.length === 0) {
      if (dateRange.some(d => d !== sourceDate)) {
        alert("Hệ thống tự động loại bỏ các ngày khác loại (ngày nghỉ <-> ngày thường). Vui lòng chọn khoảng ngày cùng loại với ngày nguồn.");
      } else {
        alert("Vui lòng chọn khoảng ngày đích khác với ngày nguồn.");
      }
      return;
    }

    // Tự động xóa các lịch trình trùng của bệnh nhân này ở ngày đích nếu có
    const toDeleteApptIds: string[] = [];
    actualTargetDates.forEach(targetDate => {
      const targetDateAppts = appointments.filter(a => 
        a.patientId === patientId && 
        a.date === targetDate && 
        (!targetDeptId || a.deptId === targetDeptId)
      );
      
      sourceAppts.forEach(source => {
        const dupes = targetDateAppts.filter(a => a.procedureId === source.procedureId);
        dupes.forEach(dp => {
          if (!toDeleteApptIds.includes(dp.id)) toDeleteApptIds.push(dp.id);
        });
      });
    });

    if (toDeleteApptIds.length > 0) {
      try {
        await Promise.all(toDeleteApptIds.map(id => deleteDoc(doc(db, "appointments", id))));
      } catch (e) {
        console.error("Lỗi khi xóa lịch trình trùng:", e);
      }
    }

    // Kiểm tra và tự động tạo ca máy còn thiếu trên các ngày đích
    const shiftsToCreate: MachineShift[] = [];
    actualTargetDates.forEach(targetDate => {
      sourceAppts.forEach(source => {
        if (source.machineShiftId) {
          const sourceShift = machineShifts.find(s => s.id === source.machineShiftId);
          if (sourceShift) {
            const targetShift = machineShifts.find(s => 
              s.date === targetDate && 
              s.machineId === sourceShift.machineId && 
              s.procedureId === sourceShift.procedureId && 
              s.startTime === sourceShift.startTime && 
              s.endTime === sourceShift.endTime
            );
            if (!targetShift && !shiftsToCreate.some(s => s.date === targetDate && s.machineId === sourceShift.machineId && s.startTime === sourceShift.startTime)) {
              shiftsToCreate.push({
                ...sourceShift,
                id: `shift_${Math.random().toString(36).substr(2, 9)}`,
                date: targetDate
              });
            }
          }
        }
      });
    });

    if (shiftsToCreate.length > 0) {
      try {
        const cleanedShifts = shiftsToCreate.map(shift => JSON.parse(JSON.stringify(shift, (key, value) => value === undefined ? null : value)));
        const shiftPromises = cleanedShifts.map(shift => setDoc(doc(db, "machineShifts", shift.id), shift));
        await Promise.all(shiftPromises);
        machineShifts.push(...cleanedShifts);
        setMachineShifts(prev => [...prev, ...cleanedShifts]);
      } catch (e) {
        console.error("Lỗi khi tự động tạo ca máy:", e);
      }
    }

    const newAppts: Appointment[] = [];
    let currentApptsState = appointments.filter(a => !toDeleteApptIds.includes(a.id));

    actualTargetDates.forEach(targetDate => {
      sourceAppts.forEach(source => {
        let targetMachineShiftId = source.machineShiftId || null;
        if (source.machineShiftId) {
          const sourceShift = machineShifts.find(s => s.id === source.machineShiftId);
          if (sourceShift) {
            const targetShift = machineShifts.find(s => 
              s.date === targetDate && 
              s.machineId === sourceShift.machineId && 
              s.procedureId === sourceShift.procedureId && 
              s.startTime === sourceShift.startTime && 
              s.endTime === sourceShift.endTime
            );
            if (targetShift) {
              targetMachineShiftId = targetShift.id;
            }
          }
        }

        // Vẫn thực hiện kiểm tra xung đột để đánh dấu status/details nếu có lỗi, nhưng LUÔN LUÔN tạo bản sao lịch trình
        const conflictRes = checkConflict(
          source.startTime, 
          source.endTime, 
          targetDate, 
          source.staffId, 
          patientId, 
          currentApptsState, 
          staff, 
          procedures, 
          attendanceRecords, 
          patients, 
          source.procedureId, 
          undefined, 
          source.assistant1Id, 
          source.assistant2Id, 
          source
        );

        const rawCopy: Appointment = {
          ...source,
          id: 'appt_' + Math.random().toString(36).substr(2, 9),
          date: targetDate,
          staffId: source.staffId, 
          assignedMachineId: source.assignedMachineId || conflictRes.assignedMachineId || null, 
          machineShiftId: targetMachineShiftId,
          status: conflictRes.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING,
          conflictDetails: conflictRes.conflictDetails || null
        };
        const cleanCopy: Appointment = JSON.parse(JSON.stringify(rawCopy, (key, value) => value === undefined ? null : value));
        newAppts.push(cleanCopy);
        currentApptsState.push(cleanCopy); 
      });
    });

    if (newAppts.length > 0) {
      // Cập nhật ngay lập tức giao diện local
      setAppointments(prev => {
        const filtered = prev.filter(a => !toDeleteApptIds.includes(a.id));
        return [...filtered, ...newAppts];
      });

      try {
        const apptPromises = newAppts.map(appt => setDoc(doc(db, "appointments", appt.id), appt));
        await Promise.all(apptPromises);
        
        alert(`Đã sao chép thành công ${newAppts.length} lượt lịch trình.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, "appointments");
      }
    }
  };

  const handleBatchLoadPreviousDay = async (options: BatchLoadOptions) => {
    if (!db || !currentDept || !canEditCurrentDept) {
      alert("Bạn không có quyền thực hiện thao tác này hoặc chưa chọn khoa.");
      return;
    }

    console.log("Starting batch load with options:", options);

    try {
      // 1. Sao lưu cho chức năng Hoàn tác
      const currentDeptAppts = appointments.filter(a => a.date === activeDate && a.deptId === currentDept.id);
      setUndoData([...currentDeptAppts]);

      // 2. Xử lý ghi đè
      if (options.overwrite && currentDeptAppts.length > 0) {
        console.log(`Overwriting ${currentDeptAppts.length} appointments...`);
        const deletePromises = currentDeptAppts.map(appt => deleteDoc(doc(db, "appointments", appt.id)));
        await Promise.all(deletePromises);
      }

      // 3. Lấy dữ liệu ngày nguồn
      const sourceDateAppts = appointments.filter(a => a.date === options.sourceDate && a.deptId === currentDept.id);
      console.log(`Found ${sourceDateAppts.length} source appointments for date ${options.sourceDate}`);
      
      if (sourceDateAppts.length === 0) {
        alert(`Không tìm thấy dữ liệu mẫu ở ngày ${options.sourceDate} để load.`);
        return;
      }

      // 4. Lọc bệnh nhân
      let targetAppts = [...sourceDateAppts];
      if (options.skipExistingPatients && !options.overwrite) {
        const patientsWithApptsToday = new Set(appointments.filter(a => a.date === activeDate).map(a => a.patientId));
        targetAppts = targetAppts.filter(a => !patientsWithApptsToday.has(a.patientId));
        console.log(`Filtering existing patients. ${targetAppts.length} appointments remaining.`);
      }

      // Loại bỏ bệnh nhân đã ra viện từ hôm trước của activeDate
      const beforeFilterCount = targetAppts.length;
      targetAppts = targetAppts.filter(a => {
        const pObj = patients.find(p => p.id === a.patientId);
        if (pObj && pObj.status === PatientStatus.DISCHARGED) {
          const dischargeDateStr = pObj.dischargeDate ? pObj.dischargeDate.split('T')[0] : '';
          const isDischargedBeforeActiveDate = !pObj.dischargeDate || activeDate > dischargeDateStr;
          return !isDischargedBeforeActiveDate;
        }
        return true;
      });
      const filteredDischargedCount = beforeFilterCount - targetAppts.length;
      if (filteredDischargedCount > 0) {
        console.log(`Bỏ qua ${filteredDischargedCount} lịch trình của bệnh nhân đã ra viện từ hôm trước.`);
      }

      const newAppointments: Appointment[] = [];
      const currentApptsInSystem = appointments.filter(a => a.date === activeDate && (!options.overwrite || a.deptId !== currentDept.id));

      // 5. Nhân sự đang đi làm hôm nay
      const workingStaffIds = new Set(
        attendanceRecords
          .filter(r => r.date === activeDate && r.status === AttendanceStatus.PRESENT)
          .map(r => r.staffId)
      );

      console.log(`Working staff today: ${workingStaffIds.size}`);

      for (const sourceAppt of targetAppts) {
        // Tùy chọn khớp nhân sự
        let targetStaffId = sourceAppt.staffId;
        if (options.useTodayStaff && !workingStaffIds.has(targetStaffId)) {
          // Tìm nhân sự thay thế cùng chuyên môn
          const replacement = staff.find(s => 
            s.deptId === currentDept.id && 
            workingStaffIds.has(s.id) && 
            s.role === staff.find(os => os.id === sourceAppt.staffId)?.role &&
            (s.mainCapabilityIds.includes(sourceAppt.procedureId) || s.capabilityIds.includes(sourceAppt.procedureId))
          );
          if (replacement) {
            targetStaffId = replacement.id;
          } else {
            // Nếu không tìm thấy, giữ nguyên hoặc gán trống (ở đây giữ nguyên để báo conflict)
          }
        }

        // Tùy chọn ưu tiên bệnh nhân ra viện (đẩy lên sáng)
        let startTime = sourceAppt.startTime;
        let endTime = sourceAppt.endTime;
        if (options.prioritizeDischarge && !options.simpleCopy) {
           const patient = patients.find(p => p.id === sourceAppt.patientId);
           const isDischargingToday = patient?.dischargeDate?.split('T')[0] === activeDate || patient?.status === PatientStatus.DISCHARGED;
           if (isDischargingToday) {
             // Cố gắng xếp vào buổi sáng nếu giờ cũ là chiều
             if (timeStringToMinutes(startTime) >= 810) { // >= 13:30
                startTime = "07:30";
                const duration = timeStringToMinutes(sourceAppt.endTime) - timeStringToMinutes(sourceAppt.startTime);
                endTime = minutesToTimeString(timeStringToMinutes(startTime) + duration);
             }
           }
        }

        const conflictRes = checkConflict(
          startTime, 
          endTime, 
          activeDate, 
          targetStaffId, 
          sourceAppt.patientId, 
          [...currentApptsInSystem, ...newAppointments], 
          staff, 
          procedures, 
          attendanceRecords, 
          patients, 
          sourceAppt.procedureId, 
          undefined, 
          sourceAppt.assistant1Id, 
          sourceAppt.assistant2Id
        );

        const newAppt: Appointment = {
          ...sourceAppt,
          id: 'appt_' + Math.random().toString(36).substr(2, 9),
          date: activeDate,
          staffId: targetStaffId,
          startTime: (options.simpleCopy || !conflictRes.hasConflict) ? startTime : sourceAppt.startTime,
          endTime: (options.simpleCopy || !conflictRes.hasConflict) ? endTime : sourceAppt.endTime,
          status: (options.simpleCopy) ? (sourceAppt.status as AppointmentStatus) : (conflictRes.hasConflict ? AppointmentStatus.CONFLICT : AppointmentStatus.PENDING),
          conflictDetails: options.simpleCopy ? [] : conflictRes.conflictDetails,
          assignedMachineId: options.simpleCopy ? (sourceAppt.assignedMachineId || null) : (conflictRes.assignedMachineId || null)
        };
        newAppointments.push(newAppt);
      }

      // Lưu hàng loạt
      console.log(`Saving ${newAppointments.length} new appointments...`);
      const savePromises = newAppointments.map(appt => setDoc(doc(db, "appointments", appt.id), appt));
      await Promise.all(savePromises);

      // Cập nhật React state ngay lập tức
      setAppointments(prev => {
        const filtered = options.overwrite 
          ? prev.filter(a => !(a.date === activeDate && a.deptId === currentDept.id))
          : prev;
        return [...filtered, ...newAppointments];
      });

      alert(`Đã load thành công ${newAppointments.length} chỉ định từ ngày ${options.sourceDate}.`);
    } catch (e) {
      console.error("Batch load error:", e);
      handleFirestoreError(e, OperationType.WRITE, 'batch-load');
    }
  };

  const handleUndoBatchLoad = async () => {
    if (!db || !currentDept || !undoData) return;
    try {
      // 1. Xóa các chỉ định hiện tại của khoa trong ngày
      const currentDeptAppts = appointments.filter(a => a.date === activeDate && a.deptId === currentDept.id);
      const deletePromises = currentDeptAppts.map(appt => deleteDoc(doc(db, "appointments", appt.id)));
      await Promise.all(deletePromises);

      // 2. Khôi phục từ undoData
      const restorePromises = undoData.map(appt => setDoc(doc(db, "appointments", appt.id), appt));
      await Promise.all(restorePromises);

      setAppointments(prev => {
        const filtered = prev.filter(a => !(a.date === activeDate && a.deptId === currentDept.id));
        return [...filtered, ...undoData];
      });

      setUndoData(null);
      alert("Đã hoàn tác thành công.");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'undo-batch-load');
    }
  };

  const handleRecheckConflicts = async () => {
    if (!db || !currentDept) return;
    const currentAppts = appointments.filter(a => a.date === activeDate);
    let updatedCount = 0;
    const updatedApptList: Appointment[] = [];

    for (const appt of currentAppts) {
      const conflictRes = checkConflict(
        appt.startTime,
        appt.endTime,
        appt.date,
        appt.staffId,
        appt.patientId,
        appointments,
        staff,
        procedures,
        attendanceRecords,
        patients,
        appt.procedureId,
        appt.id,
        appt.assistant1Id,
        appt.assistant2Id,
        appt
      );

      const newStatus = conflictRes.hasConflict ? AppointmentStatus.CONFLICT : (appt.status === AppointmentStatus.CONFLICT ? AppointmentStatus.PENDING : appt.status);
      
      if (newStatus !== appt.status || JSON.stringify(conflictRes.conflictDetails) !== JSON.stringify(appt.conflictDetails)) {
        const updatedAppt = {
          ...appt,
          status: newStatus,
          conflictDetails: conflictRes.conflictDetails,
          assignedMachineId: appt.assignedMachineId || conflictRes.assignedMachineId || null
        };
        await setDoc(doc(db, "appointments", appt.id), updatedAppt);
        updatedApptList.push(updatedAppt as Appointment);
        updatedCount++;
      }
    }

    if (updatedApptList.length > 0) {
      setAppointments(prev => {
        const map = new Map(updatedApptList.map(a => [a.id, a]));
        return prev.map(a => map.get(a.id) || a);
      });
    }

    alert(`Đã kiểm tra lại lỗi. Cập nhật ${updatedCount} chỉ định.`);
  };

  const handlePatientReferral = async (patientId: string, specialty: string, procedureIds: string[], referralTime?: string) => {
    if (!db || !canEditCurrentDept) return;
    const p = patients.find(pat => pat.id === patientId);
    if (!p) return;
    
    const referralDate = activeDate;
    const timestamp = referralTime || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

    const referrals = p.referrals || [];
    const exists = referrals.findIndex(r => r.specialty === specialty && r.status !== 'FINISHED');
    const newRef: PatientReferral = { 
      specialty, 
      timestamp, 
      fromDeptId: currentDept?.id || '',
      referralDate,
      status: 'ACTIVE',
      procedureIds
    };
    let newReferrals = exists > -1 ? [...referrals] : [...referrals, newRef];
    if (exists > -1) newReferrals[exists] = newRef;

    try {
      await setDoc(doc(db, "patients", patientId), { ...p, referrals: newReferrals });
      setReferralModal(null);
    } catch (error) { console.error(error); }
  };

  const handleFinishReferral = async (patientId: string, specialty: string) => {
    if (!db || !canEditCurrentDept) return;
    const p = patients.find(pat => pat.id === patientId);
    if (!p) return;

    const dt = new Date();
    const fDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const fTime = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

    const newReferrals = p.referrals?.map(r => {
      const s = (r.specialty || '').toLowerCase();
      const dId = currentDept?.id.toLowerCase() || '';
      const dName = currentDept?.name.toLowerCase() || '';
      const isMatch = r.specialty === specialty || s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                     (s.includes('phcn') && dId.includes('phcn')) ||
                     (s.includes('cdha') && dId.includes('cdha')) ||
                     (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                     (s.includes('duoc') && dId.includes('duoc')) ||
                     (dId === 'dept_phcn' && s === 'dept_phcn') ||
                     (dId === 'dept_cdha' && s === 'dept_cdha') ||
                     (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
      if (isMatch) {
        return { ...r, status: 'FINISHED' as const, finishedDate: fDate || null, finishedTime: fTime || null };
      }
      return r;
    });

    try {
      await setDoc(doc(db, "patients", patientId), { ...p, referrals: newReferrals });
    } catch (error) { console.error(error); }
  };

  const handleUpdateAttendance = async (record: AttendanceRecord) => {
    if (!db || !canEditCurrentDept) return;
    
    try {
      // Cập nhật chấm công - KHÔNG tự động xóa lịch hẹn/ca máy của nhân sự
      // Chỉ đưa ra cảnh báo để người dùng tự sắp xếp lại nếu cần
      await setDoc(doc(db, "attendance", record.id), record);
      
      // Nếu nhân sự nghỉ, cảnh báo nếu có lịch trong ngày/buổi đó
      if (record.status !== AttendanceStatus.PRESENT) {
        const affectedShifts = machineShifts.filter(shift => 
          shift.date === record.date && 
          (shift.staffId === record.staffId || shift.assistant1Id === record.staffId || shift.assistant2Id === record.staffId)
        );

        const affectedAppts = appointments.filter(appt => 
          appt.date === record.date && 
          (appt.staffId === record.staffId || appt.assistant1Id === record.staffId || appt.assistant2Id === record.staffId)
        );

        let hasConflict = false;

        for (const shift of affectedShifts) {
          const startMin = timeStringToMinutes(shift.startTime);
          if (record.status === AttendanceStatus.OFF_FULL) hasConflict = true;
          else if (record.status === AttendanceStatus.OFF_MORNING && startMin < 689) hasConflict = true;
          else if (record.status === AttendanceStatus.OFF_AFTERNOON && startMin >= 811) hasConflict = true;
        }

        for (const appt of affectedAppts) {
          const startMin = timeStringToMinutes(appt.startTime);
          if (record.status === AttendanceStatus.OFF_FULL) hasConflict = true;
          else if (record.status === AttendanceStatus.OFF_MORNING && startMin < 689) hasConflict = true;
          else if (record.status === AttendanceStatus.OFF_AFTERNOON && startMin >= 811) hasConflict = true;
        }

        if (hasConflict) {
          alert(`Cảnh báo: Nhân sự này đang có lịch hẹn/ca máy trong thời gian nghỉ (${record.date}). Vui lòng kiểm tra và sắp xếp lại nhân sự!`);
        }
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật chấm công:", error);
    }
  };

  const handleUpdateBulkAttendance = async (records: AttendanceRecord[]) => {
    if (!db || !canEditCurrentDept || records.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      for (const record of records) {
        batch.set(doc(db, "attendance", record.id), record);
      }
      await batch.commit();

      // Check conflicts for ALL records combined to avoid multiple alerts
      const offRecords = records.filter(r => r.status !== AttendanceStatus.PRESENT);
      if (offRecords.length > 0) {
        let conflictDates: string[] = [];
        const staffId = offRecords[0].staffId;
        
        for (const record of offRecords) {
          const affectedShifts = machineShifts.filter(shift => 
            shift.date === record.date && 
            (shift.staffId === staffId || shift.assistant1Id === staffId || shift.assistant2Id === staffId)
          );

          const affectedAppts = appointments.filter(appt => 
            appt.date === record.date && 
            (appt.staffId === staffId || appt.assistant1Id === staffId || appt.assistant2Id === staffId)
          );

          let hasConflict = false;
          for (const shift of affectedShifts) {
            const startMin = timeStringToMinutes(shift.startTime);
            if (record.status === AttendanceStatus.OFF_FULL) hasConflict = true;
            else if (record.status === AttendanceStatus.OFF_MORNING && startMin < 689) hasConflict = true;
            else if (record.status === AttendanceStatus.OFF_AFTERNOON && startMin >= 811) hasConflict = true;
          }

          for (const appt of affectedAppts) {
            const startMin = timeStringToMinutes(appt.startTime);
            if (record.status === AttendanceStatus.OFF_FULL) hasConflict = true;
            else if (record.status === AttendanceStatus.OFF_MORNING && startMin < 689) hasConflict = true;
            else if (record.status === AttendanceStatus.OFF_AFTERNOON && startMin >= 811) hasConflict = true;
          }

          if (hasConflict) {
            conflictDates.push(record.date);
          }
        }

        if (conflictDates.length > 0) {
          const uniqueDates = Array.from(new Set(conflictDates)).sort();
          const datesStr = uniqueDates.slice(0, 5).join(", ") + (uniqueDates.length > 5 ? "..." : "");
          alert(`Cảnh báo: Nhân sự này đang có lịch hẹn/ca máy trong thời gian nghỉ của các ngày (${datesStr}). Vui lòng kiểm tra và sắp xếp lại nhân sự!`);
        }
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật chấm công hàng loạt:", error);
    }
  };

  const handleCancelFinishReferral = async (patientId: string, specialty: string) => {
    if (!db || !canEditCurrentDept) return;
    const p = patients.find(pat => pat.id === patientId);
    if (!p) return;

    const newReferrals = p.referrals?.map(r => {
      const s = (r.specialty || '').toLowerCase();
      const dId = currentDept?.id.toLowerCase() || '';
      const dName = currentDept?.name.toLowerCase() || '';
      const isMatch = r.specialty === specialty || s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                     (s.includes('phcn') && dId.includes('phcn')) ||
                     (s.includes('cdha') && dId.includes('cdha')) ||
                     (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                     (s.includes('duoc') && dId.includes('duoc')) ||
                     (dId === 'dept_phcn' && s === 'dept_phcn') ||
                     (dId === 'dept_cdha' && s === 'dept_cdha') ||
                     (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
      if (isMatch) {
        return { ...r, status: 'ACTIVE' as const, finishedDate: null, finishedTime: null };
      }
      return r;
    });

    try {
      await setDoc(doc(db, "patients", patientId), { ...p, referrals: newReferrals });
    } catch (error) { console.error(error); }
  };

  const handleCancelReferral = async (patientId: string, specialty: string, skipVerify = false) => {
    if (!db || !canEditCurrentDept) return;
    const p = patients.find(pat => pat.id === patientId);
    if (!p) return;
    
    // Check if patient is discharged
    if (!skipVerify && p.status === 'DISCHARGED') {
      setPendingAction({ type: 'CANCEL_REFERRAL', data: { patientId, specialty } });
      setIsVerificationModalOpen(true);
      return;
    }

    const newReferrals = p.referrals?.filter(r => r.specialty !== specialty);

    try {
      await setDoc(doc(db, "patients", patientId), { ...p, referrals: newReferrals });
    } catch (error) { console.error(error); }
  };

  // Staff Modal handlers
  const openStaffModal = (s?: Staff) => {
    if (s) {
        setEditingStaff({ ...s });
    } else {
        setEditingStaff({
            name: '',
            role: 'Doctor',
            deptId: currentDept?.id,
            capabilityIds: [],
            mainCapabilityIds: [],
            assistantCapabilityIds: []
        });
    }
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!editingStaff || !editingStaff.name) return;
    
    const mainIds = editingStaff.mainCapabilityIds || [];
    const asstIds = editingStaff.assistantCapabilityIds || [];
    const combinedCapabilityIds = Array.from(new Set([...mainIds, ...asstIds]));

    const newStaff: Staff = {
        id: editingStaff.id || `s_${Math.random().toString(36).substr(2,9)}`,
        name: editingStaff.name,
        role: editingStaff.role || 'Doctor',
        deptId: editingStaff.deptId || currentDept?.id || '',
        capabilityIds: combinedCapabilityIds,
        mainCapabilityIds: mainIds,
        assistantCapabilityIds: asstIds
    };

    // Optimistically update React state immediately
    setStaff(prev => {
      const exists = prev.some(s => s.id === newStaff.id);
      if (exists) {
        return prev.map(s => s.id === newStaff.id ? newStaff : s);
      }
      return [...prev, newStaff];
    });

    setIsStaffModalOpen(false);
    setEditingStaff(null);

    try {
      if (isSupabaseConfigured()) {
        await saveSupabaseItem('staff', newStaff.id, newStaff);
      }
      if (db) {
        await setDoc(doc(db, "staff", newStaff.id), newStaff);
      }
    } catch (error) {
      console.error("Error saving staff:", error);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhân sự này?')) return;
    
    setStaff(prev => prev.filter(s => s.id !== staffId));

    try {
      if (isSupabaseConfigured()) {
        await deleteSupabaseItem('staff', staffId);
      }
      if (db) {
        await deleteDoc(doc(db, "staff", staffId));
      }
    } catch (error) {
      console.error("Error deleting staff:", error);
    }
  };

  const onVerifyAction = (patientId: string, action: () => void, description?: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient?.status === 'DISCHARGED') {
      setPendingAction({ type: 'CALLBACK', data: action });
      setIsVerificationModalOpen(true);
      return;
    }
    action();
  };

  const handleVerifyPassword = async (password: string) => {
    if (!currentUser) return;
    
    setIsVerifying(true);
    setVerificationError(null);
    
    try {
      // Simulate verification delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (password === currentUser.password) {
        const action = pendingAction;
        setPendingAction(null);
        setIsVerificationModalOpen(false);
        setIsVerifying(false);

        if (action) {
          switch (action.type) {
            case 'SAVE_BOOKING':
              await handleSaveBooking(action.data, true);
              break;
            case 'UPDATE_APPT':
              await handleUpdateAppointment(action.data, true);
              break;
            case 'DELETE_APPT':
              await handleDeleteAppointment(action.data, true);
              break;
            case 'CANCEL_REFERRAL':
              await handleCancelReferral(action.data.patientId, action.data.specialty, true);
              break;
            case 'CALLBACK':
              if (typeof action.data === 'function') {
                action.data();
              }
              break;
          }
        }
      } else {
        setVerificationError("Mật khẩu không chính xác. Vui lòng thử lại.");
        setIsVerifying(false);
      }
    } catch (e) {
      setVerificationError("Đã có lỗi xảy ra. Vui lòng thử lại.");
      setIsVerifying(false);
    }
  };

  const handleCreateBackup = async (deptId: string, date: string, note: string, isAuto: boolean = false) => {
    if (!db || !currentUser) return;
    
    const dept = DEPARTMENTS.find(d => d.id === deptId);
    const versionName = deptId === 'SYSTEM' ? `Backup_ToanHeThong_${date}` : `Backup_${dept?.name || deptId}_${date}`;

    // 1. Thu thập dữ liệu cần sao lưu
    // User yêu cầu: "Sao lưu là sao lưu toàn bộ thông tin lịch trình và tất cả thông tin bệnh nhân nhé."
    // Vì vậy ta sẽ lấy toàn bộ dữ liệu hệ thống bất kể deptId được truyền vào là gì.
    
    const snapshot = {
      patients: patients,
      appointments: appointments.filter(a => a.date === date),
      staff: staff,
      attendance: attendanceRecords.filter(r => r.date === date),
      machineShifts: machineShifts.filter(s => s.date === date),
      procedures: procedures // Bao gồm cả danh mục lịch trình
    };

    const backupId = isAuto ? `backup_${deptId}_${date}_auto` : `backup_${deptId}_${date}_${Date.now()}`;

    const backup: Backup = {
      id: backupId,
      deptId,
      backupDate: date,
      versionName,
      createdAt: new Date().toISOString(),
      snapshot: JSON.stringify(snapshot),
      note,
      createdBy: currentUser.id
    };

    await setDoc(doc(db, "backups", backup.id), backup);
  };

  // Auto-backup logic: Run when Admin is logged in
  useEffect(() => {
    if (!db || !currentUser || currentUser.role !== UserRole.ADMIN) return;

    const checkAndAutoBackup = async () => {
      const now = new Date();
      
      // 1. Auto-backup for yesterday
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];

      // Chỉ tạo 1 bản sao lưu hệ thống cho ngày hôm qua
      const hasBackup = backups.some(b => b.deptId === 'SYSTEM' && b.backupDate === yesterday);
      if (!hasBackup) {
        console.log(`Auto-backing up system for ${yesterday}`);
        await handleCreateBackup('SYSTEM', yesterday, 'Sao lưu hệ thống tự động', true);
      }

      // 2. Delete backups older than 5 days
      const fiveDaysAgoDate = new Date(now);
      fiveDaysAgoDate.setDate(fiveDaysAgoDate.getDate() - 5);
      const fiveDaysAgo = fiveDaysAgoDate.toISOString().split('T')[0];

      const oldBackups = backups.filter(b => b.backupDate < fiveDaysAgo);
      if (oldBackups.length > 0) {
        console.log(`Deleting ${oldBackups.length} old backups in parallel...`);
        const deletePromises = oldBackups.map(b => deleteDoc(doc(db, "backups", b.id)));
        await Promise.all(deletePromises);
      }
    };

    // Delay a bit to ensure all data is loaded
    const timer = setTimeout(() => {
      checkAndAutoBackup();
    }, 5000);

    return () => clearTimeout(timer);
  }, [currentUser, backups.length]);

  const handleImportData = async (snapshot: any) => {
    if (!db || !currentUser || currentUser.role !== UserRole.ADMIN) {
      alert('Chỉ quản trị viên mới có quyền nhập dữ liệu!');
      return;
    }
    
    try {
      const promises: Promise<void>[] = [];

      // 1. Khôi phục bệnh nhân
      if (snapshot.patients) {
        snapshot.patients.forEach((p: any) => {
          promises.push(setDoc(doc(db, "patients", p.id), p));
        });
      }

      // 2. Khôi phục chỉ định
      if (snapshot.appointments) {
        snapshot.appointments.forEach((a: any) => {
          promises.push(setDoc(doc(db, "appointments", a.id), a));
        });
      }

      // 3. Khôi phục nhân sự
      if (snapshot.staff) {
        snapshot.staff.forEach((s: any) => {
          promises.push(setDoc(doc(db, "staff", s.id), s));
        });
      }

      // 4. Khôi phục chấm công
      if (snapshot.attendance) {
        snapshot.attendance.forEach((r: any) => {
          promises.push(setDoc(doc(db, "attendance", r.id), r));
        });
      }

      // 5. Khôi phục ca máy
      if (snapshot.machineShifts) {
        snapshot.machineShifts.forEach((s: any) => {
          promises.push(setDoc(doc(db, "machineShifts", s.id), s));
        });
      }

      // 6. Khôi phục danh mục lịch trình
      if (snapshot.procedures) {
        snapshot.procedures.forEach((pr: any) => {
          promises.push(setDoc(doc(db, "procedures", pr.id), pr));
        });
      }

      // 7. Khôi phục tài khoản (nếu có)
      if (snapshot.users) {
        snapshot.users.forEach((u: any) => {
          promises.push(setDoc(doc(db, "users", u.id), u));
        });
      }

      console.log(`Executing ${promises.length} restoration import operations in parallel...`);
      await Promise.all(promises);
    } catch (error) {
      console.error("Lỗi khi nhập dữ liệu:", error);
      throw error;
    }
  };

  const handleRestoreBackup = async (backup: Backup) => {
    if (!db || !currentUser || currentUser.role !== UserRole.ADMIN) {
      alert('Chỉ quản trị viên mới có quyền khôi phục dữ liệu!');
      return;
    }
    const snapshot = JSON.parse(backup.snapshot);
    await handleImportData(snapshot);
  };

  const handleRestoreDepartmentData = async (restoredData: any) => {
    if (!db || !currentUser) return;
    if (currentUser.role !== UserRole.ADMIN && !currentUser.editableDeptIds?.includes(currentDept?.id || '')) {
      alert('Bạn không có quyền khôi phục dữ liệu cho khoa này.');
      return;
    }

    try {
      const promises: Promise<void>[] = [];
      const targetDeptId = restoredData.targetDeptId || currentDept?.id;

      // 1. Staff
      if (restoredData.staff) {
        restoredData.staff.forEach((s: Staff) => {
          promises.push(setDoc(doc(db, "staff", s.id), s));
        });
      }

      // 2. Procedures
      if (restoredData.procedures) {
        const normalizedProcs = restoredData.procedures.map((p: Procedure) => ({
          ...p,
          deptId: targetDeptId || p.deptId
        }));

        if (targetDeptId) {
          // Xóa các lịch trình cũ của khoa này khỏi DB để thay thế hoàn toàn
          const oldDeptProcs = procedures.filter(p => p.deptId === targetDeptId);
          oldDeptProcs.forEach(op => {
            promises.push(deleteDoc(doc(db, "procedures", op.id)));
          });
          const otherDeptsProcs = procedures.filter(p => p.deptId !== targetDeptId);
          setProcedures([...otherDeptsProcs, ...normalizedProcs]);
        }

        normalizedProcs.forEach((p: Procedure) => {
          promises.push(setDoc(doc(db, "procedures", p.id), p));
        });
      }

      // 3. Attendance
      if (restoredData.attendance) {
        restoredData.attendance.forEach((r: AttendanceRecord) => {
          promises.push(setDoc(doc(db, "attendance", r.id), r));
        });
      }

      // 4. Appointments
      if (restoredData.appointments) {
        restoredData.appointments.forEach((a: Appointment) => {
          promises.push(setDoc(doc(db, "appointments", a.id), a));
        });
      }

      // 5. Patients
      if (restoredData.patients) {
        restoredData.patients.forEach((p: Patient) => {
          promises.push(setDoc(doc(db, "patients", p.id), p));
        });
      }

      // 6. Machine shifts
      if (restoredData.machineShifts) {
        restoredData.machineShifts.forEach((m: MachineShift) => {
          promises.push(setDoc(doc(db, "machineShifts", m.id), m));
        });
      }

      await Promise.all(promises);
    } catch (error) {
      console.error("Lỗi khi khôi phục dữ liệu khoa:", error);
      throw error;
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!db) return;
    if (confirm('Xóa bản sao lưu này?')) {
      await deleteDoc(doc(db, "backups", backupId));
    }
  };


  const handleMainCapabilityToggle = (procId: string) => {
    if (!editingStaff) return;
    const current = editingStaff.mainCapabilityIds || [];
    const updated = current.includes(procId) 
        ? current.filter(id => id !== procId)
        : [...current, procId];
    setEditingStaff({ ...editingStaff, mainCapabilityIds: updated });
  };

  const handleAssistantCapabilityToggle = (procId: string) => {
    if (!editingStaff) return;
    const current = editingStaff.assistantCapabilityIds || [];
    const updated = current.includes(procId) 
        ? current.filter(id => id !== procId)
        : [...current, procId];
    setEditingStaff({ ...editingStaff, assistantCapabilityIds: updated });
  };

  const handleNavigateToTimeline = (procedureId?: string, staffId?: string) => {
    setTimelineFilters({
      procedureIds: procedureId ? [procedureId] : [],
      staffIds: staffId ? [staffId] : []
    });
    setActiveTab('GENERAL_TIMELINE');
  };

  if (!currentUser) return <Login onLogin={handleLogin} users={users} />;

  if (showLoginLoading) {
    return (
      <LoginLoader 
        loadedCollections={loadedCollections} 
        onComplete={() => setShowLoginLoading(false)} 
      />
    );
  }

  const handleResetDatabase = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu không? Thao tác này KHÔNG THỂ HOÀN TÁC! Tải lại trang sau khi hoàn tất.')) return;
    try {
      alert('Đang tiến hành xoá dữ liệu... Vui lòng đợi.');
      if (isSupabaseConfigured()) {
        const success = await resetSupabaseDatabase();
        if (!success) {
          alert('Không thể xóa toàn bộ dữ liệu trên Supabase.');
          return;
        }
      } else {
        if (!db) return;
        const collections = ['patients', 'staff', 'appointments', 'machineShifts', 'attendance', 'procedures', 'users'];
        for (const colName of collections) {
          const q = query(collection(db, colName));
          const snapshots = await getDocs(q);
          const deletePromises = snapshots.docs.map((docSnap) => 
            deleteDoc(doc(db, colName, docSnap.id)).catch(err => {
              console.error(`Error deleting doc ${docSnap.id} from ${colName}:`, err);
              // We ignore individual delete errors during reset to try and clean as much as possible
            })
          );
          await Promise.all(deletePromises);
        }
      }
      alert('Thành công! Vui lòng tải lại trang để hệ thống tự động khởi tạo dữ liệu mặc định mới.');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'batch-reset');
    }
  };

  if (!currentDept && activeTab !== 'ACCOUNT_MANAGER' && activeTab !== 'ACCOUNT_BACKUP') {
    return (
      <Dashboard 
        departments={DEPARTMENTS.filter(d => currentUser.viewableDeptIds.includes(d.id) || currentUser.editableDeptIds.includes(d.id) || currentUser.role === UserRole.ADMIN)} 
        onSelectDepartment={setCurrentDept} 
        onLogout={handleLogout}
        currentUser={currentUser}
        onManageAccounts={() => setActiveTab('ACCOUNT_MANAGER')}
      />
    );
  }

  const handleUpdateProcedures = async (updatedProcs: Procedure[]) => {
    // 1. Optimistic update: instantly update local React state so UI changes are immediate (0ms latency)!
    setProcedures(updatedProcs);

    if (!currentDept) return;

    try {
      // 2. Identify deleted procedures (only within current department)
      const currentDeptProcIds = procedures.filter(p => p.deptId === currentDept.id).map(p => p.id);
      const newIds = updatedProcs.map(p => p.id);
      const idsToDelete = currentDeptProcIds.filter(id => !newIds.includes(id));

      // 3. Identify added or modified procedures
      const changedOrNewProcs = updatedProcs.filter(p => {
        const existing = procedures.find(oldP => oldP.id === p.id);
        if (!existing) return true; // Added
        return JSON.stringify(existing) !== JSON.stringify(p);
      });

      // Supabase sync
      if (isSupabaseConfigured()) {
        for (const id of idsToDelete) {
          await deleteSupabaseItem('procedures', id);
        }
        for (const p of changedOrNewProcs) {
          await saveSupabaseItem('procedures', p.id, p);
        }
      }

      // Firestore sync
      if (db) {
        const promises: Promise<void>[] = [];
        for (const id of idsToDelete) {
          promises.push(deleteDoc(doc(db, "procedures", id)));
        }
        for (const p of changedOrNewProcs) {
          const procData: any = JSON.parse(JSON.stringify(p));
          promises.push(setDoc(doc(db, "procedures", p.id), procData));
        }
        if (promises.length > 0) {
          await Promise.all(promises);
        }
      }
    } catch (error) {
      console.error("Error updating procedures:", error);
    }
  };

  const handleUpdateStatus = async (p: Patient, status: PatientStatus, dDate?: string): Promise<boolean> => {
    try {
      const dischargeDateIso = status === PatientStatus.TREATING ? null : (dDate ? new Date(dDate).toISOString() : p.dischargeDate || null);
      let apptsToDelete: Appointment[] = [];

      if (status === PatientStatus.DISCHARGED && dischargeDateIso) {
        const confirmDischarge = window.confirm("Khi cho bệnh nhân ra, các lịch trình sau thời gian ra viện sẽ bị xóa. Bạn có chắc chắn muốn tiếp tục?");
        if (!confirmDischarge) {
          return false;
        }

        const dischargeDayOnly = dischargeDateIso.split('T')[0];
        const dischargeLimit = new Date(dischargeDateIso).getTime();
        apptsToDelete = appointments.filter(appt => {
          if (appt.patientId !== p.id) return false;
          if (appt.date > dischargeDayOnly) {
            return true;
          }
          if (appt.date === dischargeDayOnly) {
            const apptDateObj = new Date(`${appt.date}T${appt.endTime || appt.startTime || "00:00"}:00`);
            return apptDateObj.getTime() > dischargeLimit;
          }
          return false;
        });
      }

      const updatedPatient = { ...p, status, dischargeDate: dischargeDateIso };

      // Optimistic local state update for zero latency response
      setPatients(prev => prev.map(item => item.id === p.id ? updatedPatient : item));

      if (apptsToDelete.length > 0) {
        const apptIdsToDelete = new Set(apptsToDelete.map(a => a.id));
        setAppointments(prev => prev.filter(a => !apptIdsToDelete.has(a.id)));
      }

      if (isSupabaseConfigured()) {
        await saveSupabaseItem('patients', p.id, updatedPatient);
        if (apptsToDelete.length > 0) {
          for (const appt of apptsToDelete) {
            await deleteSupabaseItem('appointments', appt.id);
          }
        }
      }

      if (db) {
        const promises: Promise<any>[] = [setDoc(doc(db, "patients", p.id), updatedPatient)];
        if (apptsToDelete.length > 0) {
          apptsToDelete.forEach(appt => {
            promises.push(deleteDoc(doc(db, "appointments", appt.id)));
          });
        }
        await Promise.all(promises);
      }
      return true;
    } catch (e) { 
      console.error(e);
      alert("Lỗi khi cập nhật trạng thái bệnh nhân.");
      return false;
    }
  };

  const isAnyModalOpen = isModalOpen || isPatientEditModalOpen || isStaffModalOpen || isDeptBackupModalOpen || isVerificationModalOpen || !!referralModal;

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {isQuotaExceeded && !isSupabaseConfigured() && (
        <div className="bg-amber-600 text-white px-6 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-md z-[120] border-b border-amber-700">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0 text-amber-200" />
            <span>
              <strong>Thông báo Hạn ngạch (Firestore Quota Limit):</strong> Lượt truy vấn dữ liệu miễn phí hàng ngày đã đạt giới hạn (50.000 lượt đọc/ngày). 
              Hệ thống sẽ tự động khôi phục khi Google reset hạn ngạch (vào lúc 00:00 PST / 14:00 UTC / 21:00 giờ Việt Nam). Bạn vẫn có thể sử dụng dữ liệu lưu tạm.
            </span>
          </div>
        </div>
      )}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
          <div className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <button 
                    disabled={isAnyModalOpen}
                    onClick={() => { 
                      if (isAnyModalOpen) return;
                      setCurrentDept(null); 
                      setActiveTab('PATIENT_RECORDS'); 
                    }} 
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Về danh sách khoa"
                  >
                    <Home size={20} />
                  </button>
                  <div className="h-6 w-px bg-slate-200"></div>
                  {currentDept ? (
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{currentDept.name}</h2>
                  ) : (
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                      {activeTab === 'ACCOUNT_MANAGER' ? 'Quản lý Tài khoản' : activeTab === 'ACCOUNT_BACKUP' ? 'Quản lý Sao lưu' : 'Quản trị Hệ thống'}
                    </h2>
                  )}
              </div>
              <div className="flex items-center gap-4">
                  {currentDept && (
                    <>
                      <button 
                        disabled={isAnyModalOpen}
                        onClick={() => {
                          if (isAnyModalOpen) return;
                          setActiveTab('DEPT_MANAGER');
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border disabled:opacity-40 disabled:cursor-not-allowed ${activeTab === 'DEPT_MANAGER' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                      >
                        <Building2 size={16} />
                        Quản lý Khoa
                      </button>
                      <button 
                        disabled={isAnyModalOpen}
                        onClick={() => {
                          if (isAnyModalOpen) return;
                          if (!currentDept) {
                            alert('Lỗi: Bạn chưa chọn khoa làm việc.');
                            return;
                          }
                          const hasPermission = currentUser.role === UserRole.ADMIN || currentUser.editableDeptIds?.includes(currentDept.id);
                          if (!hasPermission) {
                            alert(`Lỗi: Tài khoản của bạn không được phân quyền quản lý / sao lưu khôi phục tại khoa "${currentDept.name}".`);
                            return;
                          }
                          setIsDeptBackupModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Sao lưu / Khôi phục dữ liệu khoa"
                      >
                        <Database size={16} className="text-sky-500" />
                        Sao lưu / Khôi phục
                      </button>
                      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                          <span className="text-[10px] font-black text-slate-400 px-2 uppercase tracking-widest">Làm việc ngày:</span>
                          <DateInput value={activeDate} onChange={(val) => { if (!isAnyModalOpen) setActiveDate(val); }} className="bg-white border-none rounded shadow-sm text-sm font-bold text-slate-700 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none">{currentUser.fullName}</p>
                    </div>
                    <button 
                      disabled={isAnyModalOpen}
                      onClick={() => { if (!isAnyModalOpen) handleLogout(); }} 
                      className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed" 
                      title="Đăng xuất"
                    >
                      <LogOut size={20} />
                    </button>
                  </div>
              </div>
          </div>
          
          {currentDept && (
            <div className="px-6 py-3.5 bg-slate-50/50 border-t border-b border-slate-200/60 flex gap-3 overflow-x-auto scrollbar-none items-center">
               {[
                   { id: 'PATIENT_RECORDS', label: 'Hồ sơ Bệnh nhân', icon: <FileText size={16} /> },
                   { id: 'SCHEDULING', label: 'Sắp xếp lịch trình', icon: <CalendarPlus size={16} /> },
                   { id: 'GENERAL_TIMELINE', label: 'Timeline Khoa', icon: <Table2 size={16} /> },
                   { id: 'DAILY_REPORT', label: 'Báo cáo thống kê', icon: <PieChart size={16} /> },
               ].map((tab) => {
                   const isActive = activeTab === tab.id;
                   return (
                     <button 
                       key={tab.id} 
                       disabled={isAnyModalOpen}
                       onClick={() => {
                         if (isAnyModalOpen) return;
                         setActiveTab(tab.id as MainTab);
                       }} 
                       className={`group flex items-center gap-2.5 px-5.5 py-2.5 rounded-2xl text-[12px] font-extrabold uppercase tracking-widest transition-all duration-300 relative whitespace-nowrap overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed ${
                         isActive 
                           ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-[1.02]' 
                           : 'text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-350 shadow-sm'
                       }`}
                     >
                       <span className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-sky-500'}`}>{tab.icon}</span>
                       <span>{tab.label}</span>
                     </button>
                   );
               })}
            </div>
          )}
      </header>

      <main className="flex-1 p-6 overflow-hidden flex flex-col">
         {activeTab === 'ACCOUNT_MANAGER' && <AccountManager users={users} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} />}
         {activeTab === 'ACCOUNT_BACKUP' && <BackupManager backups={backups} departments={DEPARTMENTS} currentUser={currentUser} onCreateBackup={handleCreateBackup} onRestoreBackup={handleRestoreBackup} onDeleteBackup={handleDeleteBackup} onImportData={handleImportData} />}
         
         {activeTab === 'PATIENT_RECORDS' && currentDept && <PatientList patients={patients} activeDate={activeDate} currentDept={currentDept} appointments={appointments} procedures={procedures} staff={staff} onAddPatient={() => { setEditingPatient(null); setIsPatientEditModalOpen(true); }} onEditPatient={p => { setEditingPatient(p); setIsPatientEditModalOpen(true); }} onDeletePatient={handleDeletePatient} onUpdateStatus={handleUpdateStatus} onReferral={(pid, s) => { setReferralModal({ patientId: pid, specialty: s, procedureIds: [], referralTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) }); }} onFinishReferral={handleFinishReferral} onCancelFinishReferral={handleCancelFinishReferral} onCancelReferral={handleCancelReferral} />}

         {activeTab === 'SCHEDULING' && currentDept && (
          <PatientScheduling 
            patients={patients} 
            currentDept={currentDept} 
            appointments={appointments} 
            templates={templates} 
            procedures={procedures} 
            staff={staff} 
            attendanceRecords={attendanceRecords} 
            machineShifts={machineShifts} 
            currentDate={activeDate} 
            currentUser={currentUser!} 
            onBookAppointment={(pid, appt) => { setEditingAppt(appt || { patientId: pid, date: activeDate }); setIsModalOpen(true); }} 
            onUpdateAppointment={handleUpdateAppointment} 
            onDeleteAppointment={handleDeleteAppointment} 
            onCopyToDateRange={handleCopyToDateRange} 
            onBatchLoadPreviousDay={handleBatchLoadPreviousDay}
            onUndoBatchLoad={handleUndoBatchLoad}
            hasUndoData={!!undoData}
            onRecheckConflicts={handleRecheckConflicts} 
            onAddShift={handleAddMachineShift} 
            onUpdateShift={handleUpdateMachineShift} 
            onDeleteShift={handleDeleteMachineShift} 
            onCleanupShifts={handleCleanupEmptyMachineShifts}
            onVerifyAction={onVerifyAction}
            scheduleSnapshots={scheduleSnapshots}
            onSaveScheduleSnapshot={handleSaveScheduleSnapshot}
            onUndoAppointmentChange={handleUndoAppointmentChange}
            onUpdateAppointments={setAppointments}
            onUpdateTemplates={setTemplates}
          />
         )}

         {activeTab === 'GENERAL_TIMELINE' && currentDept && (
           <Timeline 
             date={activeDate} 
             staff={staff} 
             appointments={deptAppointments} 
             procedures={procedures} 
             patients={patients} 
             viewMode="GENERAL" 
             filterText="" 
             currentDept={currentDept} 
             currentUser={currentUser} 
             onAppointmentClick={a => { setEditingAppt(a); setIsModalOpen(true); }} 
             onEmptySlotClick={(rid, t) => { setEditingAppt({ date: activeDate, startTime: t }); setIsModalOpen(true); }} 
             onRecheckConflicts={handleRecheckConflicts} 
             initialFilters={timelineFilters}
             scheduleSnapshots={scheduleSnapshots}
             onSaveScheduleSnapshot={handleSaveScheduleSnapshot}
             onUndoAppointmentChange={handleUndoAppointmentChange}
           />
         )}

          {activeTab === 'DAILY_REPORT' && currentDept && (
            <DailyReport 
              appointments={appointments} 
              activeDate={activeDate} 
              procedures={procedures} 
              staff={staff} 
              patients={patients}
              currentDept={currentDept}
              allDepts={DEPARTMENTS}
              attendanceRecords={attendanceRecords}
              onNavigateToTimeline={handleNavigateToTimeline} 
            />
          )}

         {activeTab === 'DEPT_MANAGER' && currentDept && (
             <div className="flex flex-col h-full gap-4">
                 <div className="flex bg-white rounded-lg p-1 w-fit shadow-sm border border-slate-200">
                     {['PERSONNEL', 'ATTENDANCE', 'PROCEDURES'].map(t => <button key={t} onClick={() => setManagerSubTab(t as ManagerTab)} className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${managerSubTab === t ? 'bg-primary text-white shadow' : 'text-slate-400 hover:bg-slate-100'}`}>{t === 'PERSONNEL' ? 'Nhân sự' : t === 'ATTENDANCE' ? 'Chấm công' : 'Danh mục'}</button>)}
                 </div>
                 <div className="flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <StaffManager 
                           activeTab={managerSubTab} 
                           staff={staff} 
                           procedures={procedures} 
                           department={currentDept} 
                           attendanceRecords={attendanceRecords} 
                           onEditStaff={openStaffModal}
                           onDeleteStaff={handleDeleteStaff}
                           onUpdateAttendance={handleUpdateAttendance} 
                           onUpdateBulkAttendance={handleUpdateBulkAttendance}
                           onUpdateProcedures={handleUpdateProcedures} 
                           appointments={appointments}
                           onUpdateAppointments={setAppointments}
                           currentUser={currentUser!}
                        />
                 </div>
             </div>
         )}
      </main>

      <VerificationModal 
        isOpen={isVerificationModalOpen}
        onClose={() => {
          setIsVerificationModalOpen(false);
          setPendingAction(null);
          setVerificationError(null);
        }}
        onVerify={handleVerifyPassword}
        isLoading={isVerifying}
        error={verificationError}
      />

      {isModalOpen && currentDept && (
        <BookingModal 
          isOpen={isModalOpen} 
          onClose={() => { setIsModalOpen(false); setEditingAppt(undefined); }} 
          onSave={handleSaveBooking} 
          onAddPatient={handleSavePatient} 
          staff={staff} 
          patients={patients} 
          procedures={procedures} 
          appointments={appointments} 
          attendanceRecords={attendanceRecords} 
          machineShifts={machineShifts} 
          currentDept={currentDept} 
          initialData={editingAppt}
          onDelete={handleDeleteAppointment}
          onAddShift={handleAddMachineShift}
          onUpdateShift={handleUpdateMachineShift}
          onDeleteShift={handleDeleteMachineShift}
        />
      )}

      {isPatientEditModalOpen && currentDept && (
          <PatientModal isOpen={isPatientEditModalOpen} onClose={() => { setIsPatientEditModalOpen(false); setEditingPatient(null); }} onSave={handleSavePatient} initialData={editingPatient} currentDept={currentDept} patients={patients} />
      )}

      {isStaffModalOpen && editingStaff && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90%] animate-in zoom-in-95 duration-200">
                  <div className="bg-primary p-6 text-white flex justify-between items-center shrink-0">
                      <div>
                        <h3 className="font-black text-xl flex items-center gap-3 uppercase tracking-tight">
                            <UserCog size={24} /> {editingStaff.id ? 'Cập nhật nhân sự' : 'Thêm nhân sự mới'}
                        </h3>
                        <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-1">Hồ sơ chuyên môn bệnh viện</p>
                      </div>
                      <button onClick={() => setIsStaffModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 scrollbar-thin space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Họ và tên đầy đủ</label>
                              <div className="relative">
                                <input 
                                    className="w-full border-2 border-slate-100 rounded-xl p-3 pl-10 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-slate-800 text-sm shadow-sm"
                                    value={editingStaff.name}
                                    onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
                                    placeholder="Nhập tên nhân viên..."
                                />
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                              </div>
                          </div>
                          <div className="space-y-3">
                              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Chức vụ / Vai trò</label>
                              <div className="relative">
                                <select 
                                    className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-slate-800 text-sm appearance-none cursor-pointer shadow-sm"
                                    value={editingStaff.role}
                                    onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value as any })}
                                >
                                    <option value="Doctor">{getRoleLabel('Doctor')}</option>
                                    <option value="Technician">{getRoleLabel('Technician')}</option>
                                    <option value="Nurse">{getRoleLabel('Nurse')}</option>
                                    <option value="PhysicianAssistant">{getRoleLabel('PhysicianAssistant')}</option>
                                    <option value="Pharmacist">{getRoleLabel('Pharmacist')}</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                  <Building2 size={18} />
                                </div>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-6">
                          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                             <div className="p-2 bg-primary/10 text-primary rounded-lg">
                               <Briefcase size={20} />
                             </div>
                             <div>
                               <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">Khả năng chuyên môn (Tay nghề)</h4>
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Danh mục các lịch trình nhân viên được phép thực hiện</p>
                             </div>
                             <div className="ml-auto flex gap-2">
                                <div className="bg-blue-50 px-3 py-1.5 rounded-lg text-[10px] font-black text-blue-600 uppercase tracking-widest border border-blue-100">
                                   Chính: {editingStaff.mainCapabilityIds?.filter(id => procedures.some(p => p.id === id)).length || 0}
                                </div>
                                <div className="bg-emerald-50 px-3 py-1.5 rounded-lg text-[10px] font-black text-emerald-600 uppercase tracking-widest border border-emerald-100">
                                   Phụ: {editingStaff.assistantCapabilityIds?.filter(id => procedures.some(p => p.id === id)).length || 0}
                                </div>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50/50 rounded-2xl border-2 border-slate-100">
                              {procedures.filter(p => p.deptId === editingStaff.deptId).map(proc => {
                                  const isMain = editingStaff.mainCapabilityIds?.includes(proc.id);
                                  const isAssistant = editingStaff.assistantCapabilityIds?.includes(proc.id);
                                  return (
                                      <div key={proc.id} className={`flex flex-col gap-2 p-3 rounded-xl transition-all border-2 shadow-sm bg-white ${isMain || isAssistant ? 'border-primary/20 ring-2 ring-primary/5' : 'border-transparent hover:border-slate-200 hover:shadow-md'}`}>
                                          <div className="flex items-center gap-2 mb-1">
                                              <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${isMain || isAssistant ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>{getAbbreviation(proc.name)}</div>
                                              <span className={`text-xs tracking-tight ${isMain || isAssistant ? 'font-black text-slate-800' : 'font-bold text-slate-400'}`}>{proc.name}</span>
                                          </div>
                                          <div className="flex gap-3">
                                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isMain ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-200' : 'border-slate-200 bg-slate-50 group-hover:border-blue-300'}`}>
                                                      {isMain && <Check size={12} className="text-white" strokeWidth={4} />}
                                                  </div>
                                                  <input 
                                                      type="checkbox"
                                                      className="hidden"
                                                      checked={isMain || false}
                                                      onChange={() => handleMainCapabilityToggle(proc.id)}
                                                  />
                                                  <span className={`text-[9px] font-black uppercase tracking-widest ${isMain ? 'text-blue-600' : 'text-slate-400'}`}>Chính</span>
                                              </label>
                                              <label className="flex items-center gap-1.5 cursor-pointer group">
                                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isAssistant ? 'bg-emerald-600 border-emerald-600 shadow-md shadow-emerald-200' : 'border-slate-200 bg-slate-50 group-hover:border-emerald-300'}`}>
                                                      {isAssistant && <Check size={12} className="text-white" strokeWidth={4} />}
                                                  </div>
                                                  <input 
                                                      type="checkbox"
                                                      className="hidden"
                                                      checked={isAssistant || false}
                                                      onChange={() => handleAssistantCapabilityToggle(proc.id)}
                                                  />
                                                  <span className={`text-[9px] font-black uppercase tracking-widest ${isAssistant ? 'text-emerald-600' : 'text-slate-400'}`}>Phụ</span>
                                              </label>
                                          </div>
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-4 shrink-0">
                      <button onClick={() => setIsStaffModalOpen(false)} className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-800 transition-colors">HỦY BỎ</button>
                      <Button onClick={handleSaveStaff} className="px-8 h-12 rounded-xl shadow-xl shadow-primary/20 text-sm">
                          <Save size={18} /> LƯU THÔNG TIN
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {referralModal && currentDept && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="shrink-0">
              <h3 className="text-lg font-black text-slate-800 text-center uppercase tracking-tighter leading-tight">
                GỬI KHÁM CHUYÊN KHOA:<br/>
                <span className="text-primary">{DEPARTMENTS.find(d => d.id === referralModal.specialty)?.name || referralModal.specialty}</span>
              </h3>
              <p className="text-[13px] text-slate-500 text-center font-bold tracking-tight mt-1">
                Bệnh nhân sẽ được chỉ định thực hiện các lịch trình sau tại chuyên khoa.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-5 py-2 scrollbar-thin">
              {/* Time select */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock size={14} className="text-primary" /> THỜI GIAN GỬI KHÁM (CHỈ ĐỊNH)
                </label>
                <input 
                  type="time" 
                  value={referralModal.referralTime} 
                  onChange={(e) => setReferralModal(prev => prev ? { ...prev, referralTime: e.target.value } : null)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              {/* Procedure select list for CĐHA and Xét nghiệm */}
              {(referralModal.specialty === 'dept_cdha' || referralModal.specialty === 'dept_xetnghiem') ? (
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 block">
                    CHỌN LỊCH TRÌNH CHỈ ĐỊNH (BẮT BUỘC)
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {procedures.filter(p => p.deptId === referralModal.specialty).map(proc => {
                      const isChecked = referralModal.procedureIds.includes(proc.id);
                      return (
                        <button
                          key={proc.id}
                          onClick={() => {
                            setReferralModal(prev => {
                              if (!prev) return null;
                              const alreadyHas = prev.procedureIds.includes(proc.id);
                              return {
                                ...prev,
                                procedureIds: alreadyHas 
                                  ? prev.procedureIds.filter(id => id !== proc.id)
                                  : [...prev.procedureIds, proc.id]
                              };
                            });
                          }}
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left font-bold text-sm transition-all ${
                            isChecked 
                              ? 'bg-blue-50/50 border-blue-500 text-blue-700 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            isChecked ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isChecked && <Check size={14} strokeWidth={3} />}
                          </div>
                          <span>{proc.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-center font-bold text-slate-400 italic">
                  Tự động chuyển tiếp toàn bộ danh mục lịch trình cho khoa PHCN/Dược.
                </p>
              )}
            </div>

            <div className="flex gap-4 shrink-0 pt-2 border-t border-slate-100">
              <button 
                onClick={() => setReferralModal(null)} 
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs"
              >
                HỦY
              </button>
              <button 
                onClick={() => {
                  const isSupportWithProc = referralModal.specialty === 'dept_cdha' || referralModal.specialty === 'dept_xetnghiem';
                  if (isSupportWithProc && referralModal.procedureIds.length === 0) {
                    alert("Vui lòng chọn ít nhất một lịch trình chỉ định!");
                    return;
                  }
                  handlePatientReferral(referralModal.patientId, referralModal.specialty, referralModal.procedureIds, referralModal.referralTime);
                }} 
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200 uppercase tracking-widest text-xs"
              >
                GỬI NGAY
              </button>
            </div>
          </div>
        </div>
      )}

      {currentDept && (
        <DepartmentBackupModal
          isOpen={isDeptBackupModalOpen}
          onClose={() => setIsDeptBackupModalOpen(false)}
          currentDept={currentDept}
          currentUser={currentUser}
          staff={staff}
          procedures={procedures}
          appointments={appointments}
          patients={patients}
          attendanceRecords={attendanceRecords}
          machineShifts={machineShifts}
          onRestoreDepartmentData={handleRestoreDepartmentData}
        />
      )}
    </div>
  );
};

export default App;
