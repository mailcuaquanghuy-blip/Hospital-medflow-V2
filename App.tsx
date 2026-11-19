
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Staff, Patient, Procedure, Appointment, AppointmentStatus, Department, DepartmentType, TimelineViewMode, AttendanceRecord, AttendanceStatus, PatientStatus, PatientReferral, UserAccount, UserRole, AppointmentTemplate, MachineShift, Backup, ScheduleSnapshot } from './types';
import { MOCK_STAFF, MOCK_PATIENTS, MOCK_PROCEDURES, DEPARTMENTS, DEFAULT_ADMIN, MOCK_TEMPLATES } from './constants';

import { checkConflict, findAvailableStaffForSlot, calculateAge, timeStringToMinutes, minutesToTimeString, getRoleLabel, formatDate, getAbbreviation, getLocalDateString } from './utils/timeUtils';
import { setSessionBaseline, saveDeletedSessionAppointment, removeDeletedSessionAppointment, clearDeletedSessionAppointments, clearAllSessionBaselines, getDeletedSessionAppointments, formatDateVi } from './utils/scheduleHistoryUtils';
import { handleFirestoreError, OperationType, subscribeQuotaExceeded, isQuotaExceededState } from './utils/firestoreUtils';
import { isSupabaseConfigured, fetchSupabaseTable, fetchSupabaseAppointmentsByDate, cacheActiveDateAppointments, resetSupabaseDatabase, fetchScheduleSnapshotsFromSupabase, fetchBackupsFromSupabase } from './utils/supabaseService';
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
import { HisSyncModal } from './components/HisSyncModal';
import { HisIncomingPatient } from './utils/hisSyncUtils';
import { BatchLoadOptions } from './components/BatchLoadModal';
import { Button } from './components/Button';
import { DateTimePicker } from './components/DateTimePicker';
import { DateInput } from './components/DateInput';
import { Home, Building2, Table2, FileText, CalendarPlus, AlertCircle, LogOut, ShieldCheck, User, UserCog, X, Briefcase, Check, Save, PieChart, Database, Clock, CalendarCheck, ChevronDown } from 'lucide-react';

// Database operations via Firestore
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
  writeBatch,
  fetchCollectionFromFirestore,
  fetchScheduleSnapshotsFromFirestore,
  saveScheduleSnapshotToFirestore,
  ensureAuthReady,
  seedDocCache,
  hasPendingSync,
  normalizeCollectionName
} from './utils/dbService';



export type MainTab = 'PATIENT_RECORDS' | 'SCHEDULING' | 'GENERAL_TIMELINE' | 'DAILY_REPORT' | 'DEPT_MANAGER' | 'ATTENDANCE' | 'ACCOUNT_MANAGER' | 'ACCOUNT_BACKUP';
export type ManagerTab = 'PERSONNEL' | 'ATTENDANCE' | 'PROCEDURES';

const getLocalTodayISO = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

const readLocalCache = <T,>(keys: string[]): T[] => {
  if (typeof window === 'undefined') return [];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as T[];
        }
      }
    } catch (e) {}
  }
  return [];
};

const sanitizeTemplatesList = (tpls: AppointmentTemplate[]): AppointmentTemplate[] =>
  tpls
    .filter(
      t =>
        t &&
        t.id &&
        !t.id.startsWith('snap_') &&
        !t.id.startsWith('bkp_') &&
        !(t as any).backupDate &&
        !(t as any).snapshot &&
        !(Array.isArray((t as any).appointments) && !Array.isArray(t.procedures))
    )
    .map(t => ({
      ...t,
      procedures: t.procedures || []
    }));

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = sessionStorage.getItem('medflow_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Skip blocking LoginLoader on F5 reload if core tables are already hydrated from localStorage
  const [showLoginLoading, setShowLoginLoading] = useState(() => {
    const saved = sessionStorage.getItem('medflow_user');
    if (!saved) return false;
    const hasCachedPatients = readLocalCache<Patient>(['medflow_local_patients']).length > 0;
    const hasCachedStaff = readLocalCache<Staff>(['medflow_local_staff']).length > 0;
    const hasCachedProcs = readLocalCache<Procedure>(['medflow_local_procedures']).length > 0;
    return !(hasCachedPatients && hasCachedStaff && hasCachedProcs);
  });

  const [loadedCollections, setLoadedCollections] = useState<Record<string, boolean>>({
    patients: false,
    appointmentsActiveDate: false,
    appointments: false,
    templates: false,
    attendance: false,
    staff: false,
    machineShifts: false,
    procedures: false,
    scheduleSnapshots: false,
    backups: false,
  });
  
  const [currentDept, setCurrentDept] = useState<Department | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('PATIENT_RECORDS');
  const previousTabRef = useRef<MainTab>('DEPT_MANAGER');
  const [managerSubTab, setManagerSubTab] = useState<ManagerTab>('PERSONNEL');
  const [activeDate, setActiveDate] = useState<string>(getLocalTodayISO);
  const activeDateRef = useRef<string>(activeDate);
  useEffect(() => {
    activeDateRef.current = activeDate;
  }, [activeDate]);

  const loadedAppointmentsFullRef = useRef<boolean>(false);
  const loadedBackupsRef = useRef<boolean>(false);
  
  const [users, setUsers] = useState<UserAccount[]>(() => readLocalCache<UserAccount>(['medflow_local_users']));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>(() =>
    readLocalCache<Appointment>([`medflow_local_appts_${getLocalTodayISO()}`])
  );
  
  // Safe updater that prevents duplicate appointments in state
  const handleUpdateAppointmentsSafely: React.Dispatch<React.SetStateAction<Appointment[]>> = (value) => {
    setAppointments(prev => {
      const next = typeof value === 'function' ? (value as any)(prev) : value;
      if (!Array.isArray(next)) return next;
      const seen = new Set<string>();
      const result: Appointment[] = [];
      for (const item of next) {
        if (item && item.id) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            result.push(item);
          }
        }
      }
      return result;
    });
  };

  const [machineShifts, setMachineShifts] = useState<MachineShift[]>(() =>
    readLocalCache<MachineShift>(['medflow_local_machine_shifts', 'medflow_local_machineShifts'])
  );
  const [templates, setTemplates] = useState<AppointmentTemplate[]>(() =>
    sanitizeTemplatesList(readLocalCache<AppointmentTemplate>(['medflow_local_templates']))
  );
  const [patients, setPatients] = useState<Patient[]>(() => readLocalCache<Patient>(['medflow_local_patients']));
  const [staff, setStaff] = useState<Staff[]>(() => readLocalCache<Staff>(['medflow_local_staff']));
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    readLocalCache<AttendanceRecord>(['medflow_local_attendance'])
  );
  const [procedures, setProcedures] = useState<Procedure[]>(() => readLocalCache<Procedure>(['medflow_local_procedures']));
  const [backups, setBackups] = useState<Backup[]>([]);
  const [scheduleSnapshots, setScheduleSnapshots] = useState<ScheduleSnapshot[]>(() =>
    readLocalCache<ScheduleSnapshot>(['medflow_schedule_snapshots', 'medflow_local_schedule_snapshots'])
  );

  // Seed in-memory doc cache immediately from hydrated localStorage state
  useEffect(() => {
    if (users.length > 0) seedDocCache('users', users);
    if (patients.length > 0) seedDocCache('patients', patients);
    if (staff.length > 0) seedDocCache('staff', staff);
    if (procedures.length > 0) seedDocCache('procedures', procedures);
    if (attendanceRecords.length > 0) seedDocCache('attendance', attendanceRecords);
    if (machineShifts.length > 0) seedDocCache('machineShifts', machineShifts);
    if (templates.length > 0) seedDocCache('templates', templates);
    if (appointments.length > 0) seedDocCache('appointments', appointments);
    if (scheduleSnapshots.length > 0) seedDocCache('scheduleSnapshots', scheduleSnapshots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep active-date appointments cached locally so next reload renders Timeline instantaneously
  useEffect(() => {
    if (!activeDate || appointments.length === 0) return;
    const timer = setTimeout(() => {
      const dayAppts = appointments.filter(a => a.date === activeDate);
      if (dayAppts.length > 0) {
        cacheActiveDateAppointments(activeDate, dayAppts);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [appointments, activeDate]);
  const [undoData, setUndoData] = useState<Appointment[] | null>(null);
  
  // Ref to throttle rapid database reloads (preventing lag & state overwrites during focus events)
  const lastFetchTimeRef = React.useRef<number>(0);
  const recentlyDeletedApptIdsRef = useRef<Map<string, number>>(new Map());
  const recentlyDeletedPatientIdsRef = useRef<Map<string, number>>(new Map());
  const recentlyUpdatedApptsRef = useRef<Map<string, { appt: Appointment; timestamp: number }>>(new Map());
  const recentlyUpdatedPatientsRef = useRef<Map<string, { patient: Patient; timestamp: number }>>(new Map());
  const recentlySavedSnapshotsRef = useRef<Map<string, { snapshot: ScheduleSnapshot; timestamp: number }>>(new Map());
  const recentlyUpdatedByCollRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const recentlyDeletedByCollRef = useRef<Map<string, number>>(new Map());
  const lastUserActionTimeRef = useRef<number>(0);
  
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
  const [isHisSyncModalOpen, setIsHisSyncModalOpen] = useState(false);
  const [hisSyncIncomingBatch, setHisSyncIncomingBatch] = useState<{
    patients: HisIncomingPatient[];
    deptId?: string;
    deptName?: string;
    receivedAt: number;
  } | null>(null);
  const [hisSyncBridgeStatus, setHisSyncBridgeStatus] = useState<{
    status: 'idle' | 'requesting' | 'progress' | 'error' | 'received';
    message?: string;
    extensionDetected?: boolean;
    updatedAt?: number;
  }>({ status: 'idle', extensionDetected: false });

  // Department quick switcher dropdown in header
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Bridge lắng nghe dữ liệu đồng bộ từ Chrome Extension VNPT-HIS
  useEffect(() => {
    const processIncomingSync = (payload: any, replyTarget?: Window | null) => {
      if (!payload || !Array.isArray(payload.patients)) return;
      setHisSyncBridgeStatus({
        status: 'received',
        extensionDetected: true,
        updatedAt: Date.now()
      });
      setHisSyncIncomingBatch({
        patients: payload.patients,
        deptId: payload.deptId,
        deptName: payload.deptName,
        receivedAt: Date.now()
      });
      setIsHisSyncModalOpen(true);
      try {
        (replyTarget || window).postMessage({
          type: 'MEDFLOW_SYNC_ACK',
          receivedCount: payload.patients.length,
          currentDeptId: currentDept?.id || null,
          currentDeptName: currentDept?.name || null
        }, '*');
      } catch (e) {}
    };

    const handleWindowMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'MEDFLOW_SYNC_PING' || msg.type === 'MEDFLOW_EXTENSION_READY') {
        setHisSyncBridgeStatus(prev => ({
          ...prev,
          extensionDetected: true
        }));
        try {
          (event.source as Window | null)?.postMessage?.({
            type: 'MEDFLOW_SYNC_PONG',
            version: '1.1',
            loggedIn: Boolean(currentUser),
            currentDeptId: currentDept?.id || null,
            currentDeptName: currentDept?.name || null,
            activeDate
          }, '*');
        } catch (e) {}
      } else if (msg.type === 'MEDFLOW_SYNC_PROGRESS') {
        setHisSyncBridgeStatus({
          status: 'progress',
          message: msg.message || 'Đang lấy danh sách bệnh nhân từ tab VNPT-HIS...',
          extensionDetected: true,
          updatedAt: Date.now()
        });
      } else if (msg.type === 'MEDFLOW_SYNC_ERROR') {
        setHisSyncBridgeStatus({
          status: 'error',
          message: msg.error || msg.message || 'Không thể lấy dữ liệu từ VNPT-HIS.',
          extensionDetected: true,
          updatedAt: Date.now()
        });
      } else if (msg.type === 'MEDFLOW_SYNC_PATIENTS') {
        processIncomingSync(msg, event.source as Window | null);
      }
    };

    const handleCustomSyncEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      processIncomingSync(detail);
    };

    (window as any).medflowSyncPatients = (payload: any) => processIncomingSync(payload);
    window.addEventListener('message', handleWindowMessage);
    window.addEventListener('medflow-sync-patients', handleCustomSyncEvent);
    return () => {
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('medflow-sync-patients', handleCustomSyncEvent);
      delete (window as any).medflowSyncPatients;
    };
  }, [currentUser, currentDept?.id, currentDept?.name, activeDate]);

  const authorizedDepartments = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === UserRole.ADMIN) return DEPARTMENTS;
    return DEPARTMENTS.filter(d => 
      currentUser.viewableDeptIds?.includes(d.id) || 
      currentUser.editableDeptIds?.includes(d.id)
    );
  }, [currentUser]);

  const [isQuotaExceeded, setIsQuotaExceeded] = useState(isQuotaExceededState);

  useEffect(() => {
    return subscribeQuotaExceeded((exceeded) => {
      setIsQuotaExceeded(exceeded);
    });
  }, []);

  useEffect(() => {
    const handleDbChange = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const collectionName = normalizeCollectionName(detail.collectionName || '');
      const docId: string = detail.docId || '';
      const data = detail.data;
      const action: 'set' | 'delete' = detail.action;
      const source: 'local' | 'broadcast' | 'realtime' = detail.source || 'local';

      if (!collectionName || !docId) return;
      if (collectionName === 'templates' && (docId.startsWith('snap_') || docId.startsWith('bkp_'))) {
        return;
      }
      if (collectionName === 'templates' && action === 'set' && data && ((Array.isArray(data.appointments) && !Array.isArray(data.procedures)) || data.backupDate || data.snapshot)) {
        return;
      }

      const now = Date.now();
      const normalizedDocId = collectionName === 'scheduleSnapshots'
        ? docId.replace(/^snap_/, '')
        : (collectionName === 'backups' ? docId.replace(/^bkp_/, '') : docId);
      const docKey = `${collectionName}:${normalizedDocId}`;

      if (source === 'local') {
        if (collectionName !== 'backups') {
          lastUserActionTimeRef.current = now;
        }
        if (action === 'delete') {
          recentlyDeletedByCollRef.current.set(docKey, now);
          recentlyUpdatedByCollRef.current.delete(docKey);
          if (collectionName === 'appointments') recentlyDeletedApptIdsRef.current.set(normalizedDocId, now);
          if (collectionName === 'patients') recentlyDeletedPatientIdsRef.current.set(normalizedDocId, now);
        } else if (action === 'set' && data) {
          recentlyDeletedByCollRef.current.delete(docKey);
          recentlyUpdatedByCollRef.current.set(docKey, { data, timestamp: now });
          if (collectionName === 'appointments') recentlyUpdatedApptsRef.current.set(normalizedDocId, { appt: data, timestamp: now });
          if (collectionName === 'patients') recentlyUpdatedPatientsRef.current.set(normalizedDocId, { patient: data, timestamp: now });
          if (collectionName === 'scheduleSnapshots') recentlySavedSnapshotsRef.current.set(normalizedDocId, { snapshot: data, timestamp: now });
        }
      } else {
        // Ignore stale realtime or cross-tab echoes while local writes are pending or very fresh
        if (hasPendingSync(collectionName, normalizedDocId)) {
          return;
        }
        const protectionWindow = source === 'realtime' ? 15000 : 3000;
        if (action === 'set') {
          const delTime = recentlyDeletedByCollRef.current.get(docKey);
          if (delTime && now - delTime < 45000) return;
          const recent = recentlyUpdatedByCollRef.current.get(docKey);
          if (recent && now - recent.timestamp < protectionWindow) return;
        } else if (action === 'delete') {
          const recent = recentlyUpdatedByCollRef.current.get(docKey);
          if (recent && now - recent.timestamp < protectionWindow) return;
        }
      }

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
          if (source !== 'local' && data && action === 'set') {
            const deletedTime = recentlyDeletedApptIdsRef.current.get(docId);
            if (deletedTime && now - deletedTime < 45000) return;
            const recent = recentlyUpdatedApptsRef.current.get(docId);
            if (recent && now - recent.timestamp < 15000) return;
          }
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
          if (source !== 'local' && data && action === 'set') {
            const deletedTime = recentlyDeletedPatientIdsRef.current.get(docId);
            if (deletedTime && now - deletedTime < 45000) return;
            const recent = recentlyUpdatedPatientsRef.current.get(docId);
            if (recent && now - recent.timestamp < 15000) return;
          }
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
        case 'schedule_snapshots': {
          const rawSnapId = docId.replace(/^snap_/, '');
          if (source !== 'local' && action === 'set' && data) {
            const recent = recentlySavedSnapshotsRef.current.get(rawSnapId);
            if (recent && now - recent.timestamp < 15000) {
              return;
            }
          }
          setScheduleSnapshots(prev => {
            let updated: ScheduleSnapshot[];
            if (action === 'delete') {
              updated = prev.filter(item => item.id !== rawSnapId && item.id !== `snap_${rawSnapId}`);
            } else {
              const cleanData = { ...data, id: rawSnapId };
              const idx = prev.findIndex(item => item.id === rawSnapId || item.id === `snap_${rawSnapId}`);
              if (idx > -1) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...cleanData };
                updated = copy;
              } else {
                updated = [...prev, cleanData];
              }
            }
            if (typeof window !== 'undefined') {
              try {
                const trimmed = updated.slice(-30);
                localStorage.setItem('medflow_schedule_snapshots', JSON.stringify(trimmed));
                localStorage.setItem('medflow_local_schedule_snapshots', JSON.stringify(trimmed));
              } catch (e) {}
            }
            return updated;
          });
          break;
        }
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
        appointmentsActiveDate: true,
        appointments: true,
        templates: true,
        attendance: true,
        staff: true,
        machineShifts: true,
        procedures: true,
        scheduleSnapshots: true,
        backups: true,
      });
    }
  }, [isQuotaExceeded, users.length, staff.length, procedures.length, patients.length, templates.length]);

  // Auth readiness
  useEffect(() => {
    ensureAuthReady().then(() => setIsAuthReady(true)).catch(() => setIsAuthReady(true));
  }, []);

  // Load users for the Login screen only when not yet logged in (avoids duplicate fetches when already authenticated)
  useEffect(() => {
    if (currentUser) return;
    const initLoginUsers = async () => {
      try {
        let usrs = await fetchSupabaseTable<UserAccount>('users');
        if (!usrs || usrs.length === 0) {
          await ensureAuthReady();
          usrs = await fetchCollectionFromFirestore<UserAccount>('users');
        }
        const currentUsrs = usrs || [];
        if (!currentUsrs.some(u => u.id === DEFAULT_ADMIN.id)) {
          await setDoc(doc(db, 'users', DEFAULT_ADMIN.id), DEFAULT_ADMIN);
          currentUsrs.push(DEFAULT_ADMIN);
        }
        seedDocCache('users', currentUsrs);
        setUsers(currentUsrs);
      } catch (err) {
        console.warn("Failed to initialize users for login:", err);
      }
    };
    initLoginUsers();
  }, [currentUser]);

  const mergeWithLocalProtection = <T extends { id: string }>(
    collName: string,
    prev: T[],
    serverItems: T[] | null,
    prependNew = false
  ): T[] => {
    if (serverItems === null) return prev;
    const currentTime = Date.now();

    const validServerItems = serverItems.filter(item => {
      const key = `${collName}:${item.id}`;
      const delTime = recentlyDeletedByCollRef.current.get(key);
      if (delTime && currentTime - delTime < 60000) return false;
      if (collName === 'appointments') {
        const apptDel = recentlyDeletedApptIdsRef.current.get(item.id);
        if (apptDel && currentTime - apptDel < 60000) return false;
      }
      if (collName === 'patients') {
        const patDel = recentlyDeletedPatientIdsRef.current.get(item.id);
        if (patDel && currentTime - patDel < 60000) return false;
      }
      return true;
    });

    const mergedServerItems = validServerItems.map(serverItem => {
      const key = `${collName}:${serverItem.id}`;
      const recent = recentlyUpdatedByCollRef.current.get(key);
      if ((recent && currentTime - recent.timestamp < 60000) || hasPendingSync(collName, serverItem.id)) {
        if (recent?.data) return recent.data as T;
      }
      if (collName === 'appointments') {
        const rAppt = recentlyUpdatedApptsRef.current.get(serverItem.id);
        if (rAppt && currentTime - rAppt.timestamp < 60000) return rAppt.appt as unknown as T;
      }
      if (collName === 'patients') {
        const rPat = recentlyUpdatedPatientsRef.current.get(serverItem.id);
        if (rPat && currentTime - rPat.timestamp < 60000) return rPat.patient as unknown as T;
      }
      if (collName === 'scheduleSnapshots') {
        const rSnap = recentlySavedSnapshotsRef.current.get(serverItem.id);
        if (rSnap && currentTime - rSnap.timestamp < 60000) return rSnap.snapshot as unknown as T;
      }
      return serverItem;
    });

    const serverIdSet = new Set(mergedServerItems.map(i => i.id));
    const newLocalItems = prev.filter(localItem => {
      if (serverIdSet.has(localItem.id)) return false;
      const key = `${collName}:${localItem.id}`;
      const delTime = recentlyDeletedByCollRef.current.get(key);
      if (delTime && currentTime - delTime < 60000) return false;
      if (hasPendingSync(collName, localItem.id)) return true;
      const upd = recentlyUpdatedByCollRef.current.get(key);
      if (upd && currentTime - upd.timestamp < 90000) return true;
      if (collName === 'appointments') {
        const rAppt = recentlyUpdatedApptsRef.current.get(localItem.id);
        if (rAppt && currentTime - rAppt.timestamp < 90000) return true;
      }
      if (collName === 'patients') {
        const rPat = recentlyUpdatedPatientsRef.current.get(localItem.id);
        if (rPat && currentTime - rPat.timestamp < 90000) return true;
      }
      if (collName === 'scheduleSnapshots') {
        const rSnap = recentlySavedSnapshotsRef.current.get(localItem.id);
        if (rSnap && currentTime - rSnap.timestamp < 90000) return true;
      }
      return false;
    });

    return prependNew ? [...newLocalItems, ...mergedServerItems] : [...mergedServerItems, ...newLocalItems];
  };

  // Safely merge appointments for a single date without discarding appointments from other dates
  const mergeDateScopedAppointments = (
    prev: Appointment[],
    dateStr: string,
    serverItems: Appointment[] | null
  ): Appointment[] => {
    if (serverItems === null) return prev;
    const serverDateItems = serverItems.filter(a => a && a.date === dateStr);
    const mergedForDate = mergeWithLocalProtection('appointments', prev.filter(a => a.date === dateStr), serverDateItems, false);
    const otherDates = prev.filter(a => a.date !== dateStr);
    return [...otherDates, ...mergedForDate];
  };

  // If user switches to another date before full historical backfill finishes, fetch that date immediately (~200ms)
  useEffect(() => {
    if (!currentUser || !activeDate || loadedCollections.appointments) return;
    let cancelled = false;
    fetchSupabaseAppointmentsByDate<Appointment>(activeDate).then(dayAppts => {
      if (cancelled || dayAppts === null) return;
      seedDocCache('appointments', dayAppts);
      setAppointments(prev => mergeDateScopedAppointments(prev, activeDate, dayAppts));
    });
    return () => {
      cancelled = true;
    };
  }, [activeDate, currentUser, loadedCollections.appointments]);

  useEffect(() => {
    if (!currentUser) return;
    let isCancelled = false;
    console.log("Loading and synchronizing real-time data (progressive 3-tier mode)...");

    const loadAppData = async (force = false) => {
      const fetchStartTime = Date.now();
      // If user performed an action recently (< 45s ago), skip background reload to prevent race conditions
      if (!force && fetchStartTime - lastUserActionTimeRef.current < 45000) {
        return;
      }
      // Throttle reloads to maximum once every 20 seconds, unless forced
      if (!force && fetchStartTime - lastFetchTimeRef.current < 20000) {
        return;
      }
      lastFetchTimeRef.current = fetchStartTime;

      const shouldCommit = () => !isCancelled && (force || lastUserActionTimeRef.current <= fetchStartTime);
      const targetDate = activeDateRef.current;

      try {
        // ============================================================
        // TIER 1: Core small tables + Active Date appointments in parallel
        // Each table renders immediately upon arrival without waiting for others.
        // ============================================================
        const tPatients = (async () => {
          let pats = await fetchSupabaseTable<Patient>('patients');
          if (pats === null) {
            await ensureAuthReady();
            pats = await fetchCollectionFromFirestore<Patient>('patients');
          }
          if (!shouldCommit()) return;
          if (pats) {
            seedDocCache('patients', pats);
            setPatients(prev => mergeWithLocalProtection('patients', prev, pats, true));
          }
          setLoadedCollections(prev => ({ ...prev, patients: true }));
        })();

        const tApptsDay = (async () => {
          let dayAppts = await fetchSupabaseAppointmentsByDate<Appointment>(targetDate);
          if (dayAppts === null) {
            await ensureAuthReady();
            const fsAppts = await fetchCollectionFromFirestore<Appointment>('appointments');
            dayAppts = fsAppts ? fsAppts.filter(a => a.date === targetDate) : null;
          }
          if (!shouldCommit()) return;
          if (dayAppts) {
            seedDocCache('appointments', dayAppts);
            setAppointments(prev => mergeDateScopedAppointments(prev, targetDate, dayAppts));
          }
          setLoadedCollections(prev => ({ ...prev, appointmentsActiveDate: true }));
        })();

        const tStaff = (async () => {
          let stf = await fetchSupabaseTable<Staff>('staff');
          if (stf === null) {
            await ensureAuthReady();
            stf = await fetchCollectionFromFirestore<Staff>('staff');
          }
          if (!shouldCommit()) return;
          if (stf) {
            seedDocCache('staff', stf);
            setStaff(prev => mergeWithLocalProtection('staff', prev, stf, false));
          }
          setLoadedCollections(prev => ({ ...prev, staff: true }));
        })();

        const tProcs = (async () => {
          let procs = await fetchSupabaseTable<Procedure>('procedures');
          if (procs === null) {
            await ensureAuthReady();
            procs = await fetchCollectionFromFirestore<Procedure>('procedures');
          }
          if (!shouldCommit()) return;
          if (procs && procs.length === 0) {
            for (const p of MOCK_PROCEDURES) {
              await setDoc(doc(db, 'procedures', p.id), p);
            }
            procs = MOCK_PROCEDURES;
          }
          if (procs) {
            seedDocCache('procedures', procs);
            setProcedures(prev => mergeWithLocalProtection('procedures', prev, procs, false));
          }
          setLoadedCollections(prev => ({ ...prev, procedures: true }));
        })();

        const tAtt = (async () => {
          let att = await fetchSupabaseTable<AttendanceRecord>('attendance');
          if (att === null) {
            await ensureAuthReady();
            att = await fetchCollectionFromFirestore<AttendanceRecord>('attendance');
          }
          if (!shouldCommit()) return;
          if (att) {
            seedDocCache('attendance', att);
            setAttendanceRecords(prev => mergeWithLocalProtection('attendance', prev, att, false));
          }
          setLoadedCollections(prev => ({ ...prev, attendance: true }));
        })();

        const tShifts = (async () => {
          let shifts = await fetchSupabaseTable<MachineShift>('machine_shifts');
          if (shifts === null) {
            await ensureAuthReady();
            shifts = await fetchCollectionFromFirestore<MachineShift>('machineShifts');
          }
          if (!shouldCommit()) return;
          if (shifts) {
            seedDocCache('machineShifts', shifts);
            setMachineShifts(prev => mergeWithLocalProtection('machineShifts', prev, shifts, false));
          }
          setLoadedCollections(prev => ({ ...prev, machineShifts: true }));
        })();

        const tTpls = (async () => {
          let tpls = await fetchSupabaseTable<AppointmentTemplate>('templates');
          if (tpls === null) {
            await ensureAuthReady();
            tpls = await fetchCollectionFromFirestore<AppointmentTemplate>('templates');
          }
          if (!shouldCommit()) return;
          if (tpls) {
            const sanitizedTpls = sanitizeTemplatesList(tpls);
            seedDocCache('templates', sanitizedTpls);
            setTemplates(prev => mergeWithLocalProtection('templates', prev, sanitizedTpls, false));
          }
          setLoadedCollections(prev => ({ ...prev, templates: true }));
        })();

        const tUsers = (async () => {
          let usrs = await fetchSupabaseTable<UserAccount>('users');
          if (usrs === null || usrs.length === 0) {
            await ensureAuthReady();
            usrs = await fetchCollectionFromFirestore<UserAccount>('users');
          }
          if (!shouldCommit()) return;
          if (usrs && usrs.length > 0) {
            if (!usrs.some(u => u.id === DEFAULT_ADMIN.id)) {
              setDoc(doc(db, 'users', DEFAULT_ADMIN.id), DEFAULT_ADMIN).catch(() => {});
              usrs = [...usrs, DEFAULT_ADMIN];
            }
            seedDocCache('users', usrs);
            setUsers(prev => mergeWithLocalProtection('users', prev, usrs, false));
          }
        })();

        const tSnapshots = (async () => {
          let snapshots = await fetchScheduleSnapshotsFromSupabase();
          if (snapshots === null) {
            await ensureAuthReady();
            snapshots = await fetchScheduleSnapshotsFromFirestore();
          }
          if (!shouldCommit()) return;
          if (snapshots && snapshots.length > 0) {
            seedDocCache('scheduleSnapshots', snapshots);
            setScheduleSnapshots(prev => {
              const finalSnapshots = mergeWithLocalProtection('scheduleSnapshots', prev, snapshots, false);
              if (typeof window !== 'undefined') {
                try {
                  const trimmed = finalSnapshots.slice(-30);
                  localStorage.setItem('medflow_schedule_snapshots', JSON.stringify(trimmed));
                  localStorage.setItem('medflow_local_schedule_snapshots', JSON.stringify(trimmed));
                } catch (e) {}
              }
              return finalSnapshots;
            });
          } else if (snapshots !== null) {
            setScheduleSnapshots(prev => {
              if (prev.length > 0) {
                return mergeWithLocalProtection('scheduleSnapshots', prev, snapshots, false);
              }
              return prev;
            });
          }
          setLoadedCollections(prev => ({ ...prev, scheduleSnapshots: true }));
        })();

        // Wait only for Tier 1 so Tier 2/3 never contend for bandwidth during initial render
        await Promise.allSettled([
          tPatients,
          tApptsDay,
          tStaff,
          tProcs,
          tAtt,
          tShifts,
          tTpls,
          tUsers,
          tSnapshots
        ]);

        if (isCancelled) return;

        // ============================================================
        // TIER 2 & TIER 3: Non-blocking background backfill
        // Full 30k+ appointments and backups only load when forced or not yet loaded,
        // avoiding costly full downloads when switching back from VNPT-HIS tabs.
        // ============================================================
        if (force || !loadedAppointmentsFullRef.current) {
          (async () => {
            try {
              let allAppts = await fetchSupabaseTable<Appointment>('appointments');
              if (allAppts === null) {
                await ensureAuthReady();
                allAppts = await fetchCollectionFromFirestore<Appointment>('appointments');
              }
              if (isCancelled) return;
              if (allAppts) {
                seedDocCache('appointments', allAppts);
                setAppointments(prev => mergeWithLocalProtection('appointments', prev, allAppts, false));
                loadedAppointmentsFullRef.current = true;
                setLoadedCollections(prev => ({ ...prev, appointments: true }));
              }
            } catch (err) {
              console.warn("Background full appointments backfill error:", err);
            }
          })();
        }

        if (force || !loadedBackupsRef.current) {
          (async () => {
            try {
              let bkps = await fetchBackupsFromSupabase<Backup>();
              if (bkps === null || bkps.length === 0) {
                await ensureAuthReady();
                const fsBkps = await fetchCollectionFromFirestore<Backup>('backups');
                if (fsBkps && fsBkps.length > 0) bkps = fsBkps;
              }
              if (isCancelled) return;
              if (bkps) {
                seedDocCache('backups', bkps);
                setBackups(prev => mergeWithLocalProtection('backups', prev, bkps, false));
                loadedBackupsRef.current = true;
              }
              setLoadedCollections(prev => ({ ...prev, backups: true }));
            } catch (err) {
              console.warn("Background backups load error:", err);
            }
          })();
        }
      } catch (err) {
        console.warn("Failed to fetch application data:", err);
      }
    };

    // Force initial progressive load of data on mount
    loadAppData(true);

    // Supabase Realtime Subscription for instant cross-tab & cross-device updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const tableName = payload.table;
          let collectionName = normalizeCollectionName(tableName);

          const oldId = (payload.old as any)?.id;
          const newId = (payload.new as any)?.id;
          const isSnapshotRow = (newId && typeof newId === 'string' && newId.startsWith('snap_')) ||
                                (oldId && typeof oldId === 'string' && oldId.startsWith('snap_'));
          const isBackupRow = (newId && typeof newId === 'string' && newId.startsWith('bkp_')) ||
                              (oldId && typeof oldId === 'string' && oldId.startsWith('bkp_'));

          if (tableName === 'templates' && isSnapshotRow) {
            collectionName = 'scheduleSnapshots';
          } else if (tableName === 'templates' && isBackupRow) {
            collectionName = 'backups';
          }

          if (payload.eventType === 'DELETE') {
            const rawDocId = oldId || '';
            const docId = isSnapshotRow
              ? rawDocId.replace(/^snap_/, '')
              : (isBackupRow ? rawDocId.replace(/^bkp_/, '') : rawDocId);
            if (docId) {
              const event = new CustomEvent('db-change', {
                detail: { collectionName, docId, data: null, action: 'delete', source: 'realtime' }
              });
              window.dispatchEvent(event);
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (row && row.id) {
              const cleanDocId = isSnapshotRow
                ? row.id.replace(/^snap_/, '')
                : (isBackupRow ? row.id.replace(/^bkp_/, '') : row.id);
              const itemData = row.data && typeof row.data === 'object' ? { ...row.data, id: cleanDocId } : { ...row, id: cleanDocId };
              const event = new CustomEvent('db-change', {
                detail: { collectionName, docId: cleanDocId, data: itemData, action: 'set', source: 'realtime' }
              });
              window.dispatchEvent(event);
            }
          }
        }
      )
      .subscribe();

    // Background periodic sync (every 60s) when page is visible — refreshes Tier 1 deltas only
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadAppData(false);
      }
    }, 60000);

    // Throttled re-sync on tab visibility change (tab switches from HIS, locks, etc.)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadAppData(false);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);



  const handleLogin = (user: UserAccount) => {
    loadedAppointmentsFullRef.current = false;
    loadedBackupsRef.current = false;
    setShowLoginLoading(true);
    setLoadedCollections({
      patients: false,
      appointmentsActiveDate: false,
      appointments: false,
      templates: false,
      attendance: false,
      staff: false,
      machineShifts: false,
      procedures: false,
      scheduleSnapshots: false,
      backups: false,
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

  // Logic Timeline Khoa: Chỉ hiển thị các lịch trình thuộc khoa hiện tại và các chuyên khoa liên quan
  const deptAppointments = useMemo(() => {
    if (!currentDept) return [];

    const patMap = new Map<string, Patient>();
    patients.forEach(p => patMap.set(p.id, p));
    const procMap = new Map<string, Procedure>();
    procedures.forEach(pr => procMap.set(pr.id, pr));
    const deptMap = new Map<string, Department>();
    DEPARTMENTS.forEach(d => deptMap.set(d.id, d));

    const isCurrentDeptSupport = currentDept.type === DepartmentType.SUPPORT;

    return appointments.filter(a => {
      if (a.date !== activeDate) return false;

      const proc = procMap.get(a.procedureId);
      const procedureDeptId = proc?.deptId || a.deptId;
      const patient = patMap.get(a.patientId);

      if (isCurrentDeptSupport) {
        // Khoa cận lâm sàng / chuyên khoa hỗ trợ (SUPPORT):
        // Chỉ lấy các lịch trình do chính chuyên khoa này thực hiện (hoặc đặt cho chuyên khoa này)
        return procedureDeptId === currentDept.id || a.deptId === currentDept.id;
      } else {
        // Khoa lâm sàng (CLINICAL):
        // 1. Lịch trình do chính khoa lâm sàng này thực hiện
        if (a.deptId === currentDept.id || procedureDeptId === currentDept.id) {
          return true;
        }
        // 2. Các lịch trình của CHUYÊN KHOA (SUPPORT) liên quan đến bệnh nhân thuộc khoa lâm sàng này:
        // Bệnh nhân do khoa này tiếp nhận (admittedByDeptId === currentDept.id) và thực hiện tại chuyên khoa hỗ trợ (SUPPORT)
        if (patient && patient.admittedByDeptId === currentDept.id) {
          const performingDept = deptMap.get(procedureDeptId);
          // Chỉ lấy nếu khoa thực hiện là khoa chuyên khoa / cận lâm sàng (SUPPORT)
          if (performingDept?.type === DepartmentType.SUPPORT || !performingDept) {
            return true;
          }
        }
        return false;
      }
    });
  }, [appointments, currentDept, activeDate, patients, procedures]);

  const handleSavePatient = async (patient: Patient) => {
    if (!canEditCurrentDept) {
      alert("Bạn không có quyền chỉnh sửa hồ sơ bệnh nhân ở khoa này.");
      return;
    }
    try {
      let apptsToDelete: Appointment[] = [];

      if (patient.status === PatientStatus.DISCHARGED && patient.dischargeDate) {
        const originalPatient = patients.find(oldP => oldP.id === patient.id);
        const isNewDischarge = originalPatient?.status !== PatientStatus.DISCHARGED;
        const isDateChanged = originalPatient?.dischargeDate !== patient.dischargeDate;

        if (isNewDischarge || isDateChanged) {
          const dischargeDayOnly = getLocalDateString(patient.dischargeDate);
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

      const now = Date.now();
      lastUserActionTimeRef.current = now;
      recentlyUpdatedPatientsRef.current.set(patient.id, { patient, timestamp: now });

      // Optimistic state updates
      setPatients(prev => {
        const exists = prev.some(oldP => oldP.id === patient.id);
        if (exists) return prev.map(oldP => oldP.id === patient.id ? patient : oldP);
        return [patient, ...prev];
      });

      if (apptsToDelete.length > 0) {
        apptsToDelete.forEach(a => recentlyDeletedApptIdsRef.current.set(a.id, now));
        const apptIdsToDelete = new Set(apptsToDelete.map(a => a.id));
        setAppointments(prev => prev.filter(a => !apptIdsToDelete.has(a.id)));
      }

      // Save to Supabase and database
      const cleanPatient = JSON.parse(JSON.stringify(patient, (key, value) => value === undefined ? null : value));
      await setDoc(doc(db, "patients", patient.id), cleanPatient);
      if (apptsToDelete.length > 0 && db) {
        const batch = writeBatch(db);
        apptsToDelete.forEach(a => batch.delete(doc(db, "appointments", a.id)));
        await batch.commit();
      }
    } catch (error) { 
      console.error("Error saving patient:", error);
    }
  };

  const handleBatchSavePatients = async (patientsToSave: Patient[]): Promise<boolean> => {
    if (!patientsToSave || patientsToSave.length === 0) return true;
    const canEditTarget = currentUser?.role === UserRole.ADMIN || patientsToSave.every(
      p => currentUser?.editableDeptIds?.includes(p.admittedByDeptId)
    );
    if (!canEditTarget && !canEditCurrentDept) {
      alert("Bạn không có quyền chỉnh sửa hoặc thêm bệnh nhân ở khoa này.");
      return false;
    }
    try {
      const now = Date.now();
      lastUserActionTimeRef.current = now;
      const cleanList = patientsToSave.map(p => {
        const clean = JSON.parse(JSON.stringify(p, (key, value) => value === undefined ? null : value)) as Patient;
        recentlyUpdatedPatientsRef.current.set(clean.id, { patient: clean, timestamp: now });
        return clean;
      });

      const cleanMap = new Map(cleanList.map(p => [p.id, p]));
      setPatients(prev => {
        const updated = prev.map(oldP => cleanMap.has(oldP.id) ? cleanMap.get(oldP.id)! : oldP);
        const existingIds = new Set(prev.map(oldP => oldP.id));
        const newlyAdded = cleanList.filter(p => !existingIds.has(p.id));
        return newlyAdded.length > 0 ? [...newlyAdded, ...updated] : updated;
      });

      if (db) {
        const batch = writeBatch(db);
        cleanList.forEach(p => {
          batch.set(doc(db, "patients", p.id), p);
        });
        await batch.commit();
      }
      return true;
    } catch (error) {
      console.error("Error batch saving patients:", error);
      alert("Có lỗi xảy ra khi đồng bộ bệnh nhân. Vui lòng thử lại!");
      return false;
    }
  };

  const handleDeletePatient = async (patientId: string) => {
    if (!canEditCurrentDept) {
      alert("Bạn không có quyền xóa hồ sơ bệnh nhân ở khoa này.");
      return;
    }
    try {
      const isAdmin = currentUser?.role === UserRole.ADMIN;
      const patientAppointments = appointments.filter(appt => appt.patientId === patientId);

      if (!isAdmin && patientAppointments.length > 0) {
        alert("Không thể xóa bệnh nhân này vì vẫn còn thủ thuật. Vui lòng xóa toàn bộ thủ thuật của bệnh nhân trước khi xóa hồ sơ.");
        return;
      }

      const now = Date.now();
      lastUserActionTimeRef.current = now;
      recentlyDeletedPatientIdsRef.current.set(patientId, now);

      // Khi xóa hồ sơ bệnh nhân bằng tài khoản quản trị thì các thủ thuật của bệnh nhân đó sẽ tự động xóa hết
      if (isAdmin && patientAppointments.length > 0) {
        patientAppointments.forEach(a => recentlyDeletedApptIdsRef.current.set(a.id, now));
        setAppointments(prev => prev.filter(appt => appt.patientId !== patientId));
        if (db) {
          const batch = writeBatch(db);
          patientAppointments.forEach(a => batch.delete(doc(db, "appointments", a.id)));
          await batch.commit();
        }
      }

      // Optimistic update bệnh nhân
      setPatients(prev => prev.filter(p => p.id !== patientId));
      await deleteDoc(doc(db, "patients", patientId));

      console.log(`Đã xóa hồ sơ bệnh nhân ${patientId}${isAdmin && patientAppointments.length > 0 ? ` cùng ${patientAppointments.length} thủ thuật` : ''}`);
    } catch (error) { 
      console.error("Error deleting patient:", error);
    }
  };

  const handleSaveBooking = async (data: Partial<Appointment>, skipVerify = false) => {
    if (!currentDept || !canEditCurrentDept) {
      alert("Bạn không có quyền chỉnh sửa ở khoa này.");
      return;
    }
    
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

    const now = Date.now();
    lastUserActionTimeRef.current = now;
    recentlyUpdatedApptsRef.current.set(id, { appt: baseAppt as Appointment, timestamp: now });

    // Optimistic local state update for zero latency responsiveness
    setAppointments(prev => {
      const exists = prev.some(a => a.id === id);
      if (exists) return prev.map(a => a.id === id ? (baseAppt as Appointment) : a);
      return [...prev, baseAppt as Appointment];
    });

    try {
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

  const areApptListsEqual = (listA: Appointment[], listB: Appointment[]) => {
    if (listA.length !== listB.length) return false;
    const normalize = (arr: Appointment[]) =>
      [...arr]
        .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
        .map(a => ({
          id: a.id,
          patientId: a.patientId,
          procedureId: a.procedureId,
          staffId: a.staffId || '',
          assistant1Id: a.assistant1Id || null,
          assistant2Id: a.assistant2Id || null,
          date: a.date,
          startTime: a.startTime,
          endTime: a.endTime,
          deptId: a.deptId,
          assignedMachineId: a.assignedMachineId || null,
          machineShiftId: a.machineShiftId || null,
          notes: a.notes || '',
          selectedDurationOptionId: a.selectedDurationOptionId || null,
        }));
    return JSON.stringify(normalize(listA)) === JSON.stringify(normalize(listB));
  };

  const autoFinalizeScheduleSnapshotForDate = (deptId: string, dateStr: string) => {
    if (!deptId || !dateStr) return;
    try {
      const now = Date.now();
      lastUserActionTimeRef.current = now;

      const deptAppts = appointments.filter(a => a.deptId === deptId && a.date === dateStr);
      const snapshotId = `${deptId}_${dateStr}`;
      const snapObj: ScheduleSnapshot = {
        id: snapshotId,
        deptId,
        date: dateStr,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.fullName || 'Tự động lưu khi chuyển ngày',
        appointments: JSON.parse(JSON.stringify(deptAppts))
      };

      recentlySavedSnapshotsRef.current.set(snapshotId, { snapshot: snapObj, timestamp: now });
      setSessionBaseline(deptId, dateStr, deptAppts);
      clearDeletedSessionAppointments(deptId, dateStr);

      setScheduleSnapshots(prev => {
        const filtered = prev.filter(s => !(s.deptId === deptId && s.date === dateStr));
        const updated = [...filtered, snapObj];
        if (typeof window !== 'undefined') {
          try {
            // Giữ tối đa 30 snapshot gần nhất trong localStorage để tránh tràn bộ nhớ
            const trimmed = updated.slice(-30);
            localStorage.setItem('medflow_schedule_snapshots', JSON.stringify(trimmed));
            localStorage.setItem('medflow_local_schedule_snapshots', JSON.stringify(trimmed));
          } catch (e) {
            console.warn('LocalStorage snapshot write error:', e);
          }
        }
        return updated;
      });

      // Lập tức lưu lên Supabase & Firestore khi chuyển ngày làm việc
      setDoc(doc(db, 'scheduleSnapshots', snapshotId), snapObj).catch(err => {
        console.warn('Error auto saving snapshot on date change:', err);
      });
    } catch (err) {
      console.warn('Error in autoFinalizeScheduleSnapshotForDate:', err);
    }
  };

  const handleDateChange = (newDate: string) => {
    if (!newDate || newDate === activeDate) return;
    if (
      currentDept &&
      canEditCurrentDept &&
      loadedCollections.appointments &&
      loadedCollections.scheduleSnapshots
    ) {
      const prevDateAppts = appointments.filter(a => a.deptId === currentDept.id && a.date === activeDate);
      const existingSnap = scheduleSnapshots.find(s => s.deptId === currentDept.id && s.date === activeDate);
      const deletedSession = getDeletedSessionAppointments(currentDept.id, activeDate);
      const hasChangesVsExisting = existingSnap
        ? !areApptListsEqual(prevDateAppts, existingSnap.appointments || []) || deletedSession.length > 0
        : prevDateAppts.length > 0 || deletedSession.length > 0;

      if (hasChangesVsExisting) {
        autoFinalizeScheduleSnapshotForDate(currentDept.id, activeDate);
      }
    }
    setActiveDate(newDate);
  };

  const handleSaveScheduleSnapshot = async (deptId: string, dateStr: string) => {
    try {
      const now = Date.now();
      lastUserActionTimeRef.current = now;

      const deptAppts = appointments.filter(a => a.deptId === deptId && a.date === dateStr);
      const snapshotId = `${deptId}_${dateStr}`;
      const snapObj: ScheduleSnapshot = {
        id: snapshotId,
        deptId,
        date: dateStr,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.fullName || 'Hệ thống',
        appointments: JSON.parse(JSON.stringify(deptAppts))
      };

      recentlySavedSnapshotsRef.current.set(snapshotId, { snapshot: snapObj, timestamp: now });

      setSessionBaseline(deptId, dateStr, deptAppts);
      clearDeletedSessionAppointments(deptId, dateStr);

      setScheduleSnapshots(prev => {
        const filtered = prev.filter(s => !(s.deptId === deptId && s.date === dateStr));
        const updated = [...filtered, snapObj];
        if (typeof window !== 'undefined') {
          try {
            const trimmed = updated.slice(-30);
            localStorage.setItem('medflow_schedule_snapshots', JSON.stringify(trimmed));
            localStorage.setItem('medflow_local_schedule_snapshots', JSON.stringify(trimmed));
          } catch (e) {
            console.warn('LocalStorage snapshot write error:', e);
          }
        }
        return updated;
      });

      await setDoc(doc(db, 'scheduleSnapshots', snapshotId), snapObj);

      alert(`Đã lưu chốt mốc phiên bản ngày ${formatDateVi(dateStr)} thành công!`);
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
      const now = Date.now();
      lastUserActionTimeRef.current = now;

      if (type === 'NEW') {
        recentlyDeletedApptIdsRef.current.set(apptId, now);
        setAppointments(prev => prev.filter(a => a.id !== apptId));
        await deleteDoc(doc(db, 'appointments', apptId));
      } else if (type === 'MODIFIED' && originalAppt) {
        recentlyUpdatedApptsRef.current.set(apptId, { appt: originalAppt, timestamp: now });
        setAppointments(prev => prev.map(a => a.id === apptId ? originalAppt : a));
        await setDoc(doc(db, 'appointments', apptId), originalAppt);
      } else if (type === 'DELETED' && originalAppt) {
        recentlyDeletedApptIdsRef.current.delete(apptId);
        recentlyUpdatedApptsRef.current.set(apptId, { appt: originalAppt, timestamp: now });
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
    const targetDeptId = updatedAppt.deptId || currentDept?.id;
    const isAuthorized = currentUser?.role === UserRole.ADMIN || (currentUser?.editableDeptIds && currentUser.editableDeptIds.includes(targetDeptId));
    if (!isAuthorized) {
      alert("Bạn không có quyền chỉnh sửa lịch trình ở khoa này.");
      return;
    }

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

    const now = Date.now();
    lastUserActionTimeRef.current = now;
    recentlyUpdatedApptsRef.current.set(updatedAppt.id, { appt: finalAppt as Appointment, timestamp: now });

    // Optimistic local state update for zero-delay UI response
    setAppointments(prev => prev.map(a => a.id === updatedAppt.id ? (finalAppt as Appointment) : a));

    try {
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

    const targetDeptId = appt.deptId;
    const isAuthorized = currentUser?.role === UserRole.ADMIN || (currentUser?.editableDeptIds && currentUser.editableDeptIds.includes(targetDeptId));
    if (!isAuthorized) {
      alert("Bạn không có quyền xóa lịch trình ở khoa này.");
      return;
    }

    // Check if patient is discharged
    const patient = patients.find(p => p.id === appt.patientId);
    if (!skipVerify && patient?.status === PatientStatus.DISCHARGED) {
      setPendingAction({ type: 'DELETE_APPT', data: apptId });
      setIsVerificationModalOpen(true);
      return;
    }

    // Save to deleted session storage so deletion can be undone in ScheduleHistoryModal
    saveDeletedSessionAppointment(appt);

    const now = Date.now();
    lastUserActionTimeRef.current = now;
    recentlyDeletedApptIdsRef.current.set(apptId, now);

    // Optimistic local state update for instant zero-delay deletion UI response
    setAppointments(prev => prev.filter(a => a.id !== apptId));

    try {
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
      const now = Date.now();
      lastUserActionTimeRef.current = now;
      toDeleteApptIds.forEach(id => recentlyDeletedApptIdsRef.current.set(id, now));
      newAppts.forEach(a => recentlyUpdatedApptsRef.current.set(a.id, { appt: a, timestamp: now }));

      // Cập nhật ngay lập tức giao diện local
      setAppointments(prev => {
        const filtered = prev.filter(a => !toDeleteApptIds.includes(a.id));
        return [...filtered, ...newAppts];
      });

      // Bỏ qua lịch sử chỉnh sửa những ngày sau khi sao chép thủ thuật đi để chống tràn bộ nhớ
      if (targetDeptId) {
        actualTargetDates.forEach(targetDate => {
          clearDeletedSessionAppointments(targetDeptId, targetDate);
        });
      }

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
          sourceAppt.assistant2Id,
          sourceAppt
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
      const now = Date.now();
      lastUserActionTimeRef.current = now;
      newAppointments.forEach(a => recentlyUpdatedApptsRef.current.set(a.id, { appt: a, timestamp: now }));

      console.log(`Saving ${newAppointments.length} new appointments...`);
      const saveBatch = writeBatch(db);
      newAppointments.forEach(appt => saveBatch.set(doc(db, "appointments", appt.id), appt));
      await saveBatch.commit();

      // Cập nhật React state ngay lập tức
      setAppointments(prev => {
        const filtered = options.overwrite 
          ? prev.filter(a => !(a.date === activeDate && a.deptId === currentDept.id))
          : prev;
        return [...filtered, ...newAppointments];
      });

      // Tự động chốt mốc lịch trình activeDate để không ghi nhận tải ngày mẫu thành biến động
      const finalApptsOnActiveDate = (options.overwrite ? newAppointments : [...appointments.filter(a => !(a.date === activeDate && a.deptId === currentDept.id)), ...newAppointments]).filter(a => a.date === activeDate && a.deptId === currentDept.id);
      const snapshotId = `${currentDept.id}_${activeDate}`;
      const snapObj: ScheduleSnapshot = {
        id: snapshotId,
        deptId: currentDept.id,
        date: activeDate,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.fullName || 'Tải ngày mẫu',
        appointments: JSON.parse(JSON.stringify(finalApptsOnActiveDate))
      };
      recentlySavedSnapshotsRef.current.set(snapshotId, { snapshot: snapObj, timestamp: now });
      setSessionBaseline(currentDept.id, activeDate, finalApptsOnActiveDate);
      clearDeletedSessionAppointments(currentDept.id, activeDate);
      setScheduleSnapshots(prev => {
        const filtered = prev.filter(s => !(s.deptId === currentDept.id && s.date === activeDate));
        const updated = [...filtered, snapObj];
        if (typeof window !== 'undefined') {
          try {
            const trimmed = updated.slice(-30);
            localStorage.setItem('medflow_schedule_snapshots', JSON.stringify(trimmed));
            localStorage.setItem('medflow_local_schedule_snapshots', JSON.stringify(trimmed));
          } catch (e) {}
        }
        return updated;
      });
      setDoc(doc(db, 'scheduleSnapshots', snapshotId), snapObj).catch(e => console.warn(e));

      alert(`Đã load thành công ${newAppointments.length} chỉ định từ ngày ${options.sourceDate}.`);
    } catch (e) {
      console.error("Batch load error:", e);
      handleFirestoreError(e, OperationType.WRITE, 'batch-load');
    }
  };

  const handleUndoBatchLoad = async () => {
    if (!db || !currentDept || !undoData) return;
    try {
      // 1. Xóa các chỉ định hiện tại của khoa trong ngày & khôi phục từ undoData
      const currentDeptAppts = appointments.filter(a => a.date === activeDate && a.deptId === currentDept.id);
      const batch = writeBatch(db);
      currentDeptAppts.forEach(appt => batch.delete(doc(db, "appointments", appt.id)));
      undoData.forEach(appt => batch.set(doc(db, "appointments", appt.id), appt));
      await batch.commit();

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
        updatedApptList.push(updatedAppt as Appointment);
        updatedCount++;
      }
    }

    if (updatedApptList.length > 0) {
      const batch = writeBatch(db);
      updatedApptList.forEach(a => batch.set(doc(db, "appointments", a.id), a));
      await batch.commit();

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
    const targetDeptId = s?.deptId || currentDept?.id || '';
    const canEditTargetDept = currentUser?.role === UserRole.ADMIN || (targetDeptId && currentUser?.editableDeptIds?.includes(targetDeptId));
    if (!canEditTargetDept) {
      alert('Bạn không có quyền chỉnh sửa nhân sự của khoa này.');
      return;
    }
    if (s) {
        setEditingStaff({ ...s });
    } else {
        setEditingStaff({
            name: '',
            role: 'Doctor',
            deptId: currentDept?.id,
            capabilityIds: [],
            mainCapabilityIds: [],
            assistantCapabilityIds: [],
            isResigned: false,
            resignationDate: null
        });
    }
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!editingStaff || !editingStaff.name) return;
    const targetDeptId = editingStaff.deptId || currentDept?.id || '';
    const canEditTargetDept = currentUser?.role === UserRole.ADMIN || (targetDeptId && currentUser?.editableDeptIds?.includes(targetDeptId));
    if (!canEditTargetDept) {
      alert('Bạn không có quyền chỉnh sửa nhân sự của khoa này.');
      return;
    }
    
    const mainIds = editingStaff.mainCapabilityIds || [];
    const asstIds = editingStaff.assistantCapabilityIds || [];
    const combinedCapabilityIds = Array.from(new Set([...mainIds, ...asstIds]));

    const isResigned = !!editingStaff.isResigned;
    const resignationDate = isResigned ? (editingStaff.resignationDate || new Date().toISOString().split('T')[0]) : null;

    const newStaff: Staff = {
        id: editingStaff.id || `s_${Math.random().toString(36).substr(2,9)}`,
        name: editingStaff.name,
        role: editingStaff.role || 'Doctor',
        deptId: editingStaff.deptId || currentDept?.id || '',
        capabilityIds: combinedCapabilityIds,
        mainCapabilityIds: mainIds,
        assistantCapabilityIds: asstIds,
        isResigned,
        resignationDate
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
      if (db) {
        await setDoc(doc(db, "staff", newStaff.id), newStaff);
      }
    } catch (error) {
      console.error("Error saving staff:", error);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    const targetStaff = staff.find(s => s.id === staffId);
    const targetDeptId = targetStaff?.deptId || currentDept?.id || '';
    const canEditTargetDept = currentUser?.role === UserRole.ADMIN || (targetDeptId && currentUser?.editableDeptIds?.includes(targetDeptId));
    if (!canEditTargetDept) {
      alert('Bạn không có quyền xóa nhân sự của khoa này.');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhân sự này?')) return;
    
    setStaff(prev => prev.filter(s => s.id !== staffId));

    try {
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

  // Auto-backup logic: Run when Admin is logged in AND core data has finished loading
  useEffect(() => {
    if (!db || !currentUser || currentUser.role !== UserRole.ADMIN) return;
    if (!loadedCollections.patients || !loadedCollections.appointments || !loadedCollections.backups) return;

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

    // Delay a bit to ensure all data is settled
    const timer = setTimeout(() => {
      checkAndAutoBackup();
    }, 3000);

    return () => clearTimeout(timer);
  }, [currentUser, backups.length, loadedCollections.patients, loadedCollections.appointments, loadedCollections.backups]);

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
        departments={authorizedDepartments} 
        onSelectDepartment={setCurrentDept} 
        onLogout={handleLogout}
        currentUser={currentUser}
        onManageAccounts={() => setActiveTab('ACCOUNT_MANAGER')}
      />
    );
  }

  const handleUpdateProcedures = async (updatedProcs: Procedure[]) => {
    if (!currentDept || !canEditCurrentDept) {
      alert("Bạn không có quyền chỉnh sửa danh mục ở khoa này.");
      return;
    }

    // 1. Optimistic update: instantly update local React state so UI changes are immediate (0ms latency)!
    lastUserActionTimeRef.current = Date.now();
    setProcedures(updatedProcs);

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

      // 4. Unified batch persistence to Supabase + Firestore
      if (db && (idsToDelete.length > 0 || changedOrNewProcs.length > 0)) {
        const batch = writeBatch(db);
        idsToDelete.forEach(id => batch.delete(doc(db, "procedures", id)));
        changedOrNewProcs.forEach(p => {
          const procData: any = JSON.parse(JSON.stringify(p));
          batch.set(doc(db, "procedures", p.id), procData);
        });
        await batch.commit();
      }
    } catch (error) {
      console.error("Error updating procedures:", error);
    }
  };

  const handleUpdateStatus = async (p: Patient, status: PatientStatus, dDate?: string): Promise<boolean> => {
    if (!canEditCurrentDept) {
      alert("Bạn không có quyền thay đổi trạng thái bệnh nhân ở khoa này.");
      return false;
    }
    try {
      const dischargeDateIso = status === PatientStatus.TREATING ? null : (dDate ? new Date(dDate).toISOString() : p.dischargeDate || null);
      let apptsToDelete: Appointment[] = [];

      if (status === PatientStatus.DISCHARGED && dischargeDateIso) {
        const dischargeDayOnly = getLocalDateString(dischargeDateIso);
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
      const now = Date.now();
      lastUserActionTimeRef.current = now;
      recentlyUpdatedPatientsRef.current.set(p.id, { patient: updatedPatient, timestamp: now });

      // Optimistic local state update for zero latency response
      setPatients(prev => prev.map(item => item.id === p.id ? updatedPatient : item));

      if (apptsToDelete.length > 0) {
        apptsToDelete.forEach(a => recentlyDeletedApptIdsRef.current.set(a.id, now));
        const apptIdsToDelete = new Set(apptsToDelete.map(a => a.id));
        setAppointments(prev => prev.filter(a => !apptIdsToDelete.has(a.id)));
      }

      await setDoc(doc(db, "patients", p.id), updatedPatient);
      if (apptsToDelete.length > 0 && db) {
        const batch = writeBatch(db);
        apptsToDelete.forEach(a => batch.delete(doc(db, "appointments", a.id)));
        await batch.commit();
      }
      return true;
    } catch (e) { 
      console.error(e);
      alert("Lỗi khi cập nhật trạng thái bệnh nhân.");
      return false;
    }
  };

  const isAnyModalOpen = isModalOpen || isPatientEditModalOpen || isStaffModalOpen || isDeptBackupModalOpen || isHisSyncModalOpen || isVerificationModalOpen || !!referralModal;

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
                    className="flex items-center gap-2.5 p-1 -ml-1 hover:bg-slate-100 rounded-2xl text-slate-700 transition-all group disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Hospital MedFlow - Về danh sách khoa"
                  >
                    <img 
                      src="/logo.png" 
                      alt="Hospital MedFlow Logo" 
                      className="w-8 h-8 rounded-xl object-contain shadow-xs group-hover:scale-105 transition-transform" 
                    />
                    <div className="hidden sm:flex flex-col text-left leading-none">
                      <span className="text-[11px] font-black tracking-wider text-sky-600 uppercase">MedFlow</span>
                      <span className="text-[9px] font-bold text-slate-400">Hospital</span>
                    </div>
                  </button>
                  <div className="h-6 w-px bg-slate-200"></div>
                  {currentDept ? (
                    <div className="relative" ref={deptDropdownRef}>
                      {authorizedDepartments.length > 1 ? (
                        <button
                          type="button"
                          disabled={isAnyModalOpen}
                          onClick={() => setIsDeptDropdownOpen(prev => !prev)}
                          className="flex items-center gap-2 px-3 py-1.5 -ml-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group text-left disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Bấm để chuyển sang khoa khác đã được phân quyền"
                        >
                          <Building2 size={20} className="text-sky-600 shrink-0" />
                          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight group-hover:text-sky-600 transition-colors">
                            {currentDept.name}
                          </h2>
                          <ChevronDown size={18} className={`text-slate-400 group-hover:text-sky-600 transition-transform ${isDeptDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Building2 size={20} className="text-sky-600 shrink-0" />
                          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{currentDept.name}</h2>
                        </div>
                      )}

                      {isDeptDropdownOpen && (
                        <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[300] py-2 animate-in fade-in duration-100">
                          <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Chọn khoa làm việc (Được phân quyền)</p>
                          </div>
                          <div className="max-h-80 overflow-y-auto space-y-0.5 px-1.5">
                            {authorizedDepartments.map(d => {
                              const isSelected = d.id === currentDept.id;
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => {
                                    setCurrentDept(d);
                                    setIsDeptDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                                    isSelected 
                                      ? 'bg-sky-50 text-sky-600 font-black' 
                                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-sky-500' : 'bg-slate-300'}`} />
                                    <div>
                                      <span className="block">{d.name}</span>
                                      <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">
                                        {d.type === DepartmentType.CLINICAL ? 'Khoa lâm sàng' : 'Chuyên khoa / Cận lâm sàng'}
                                      </span>
                                    </div>
                                  </div>
                                  {isSelected && <Check size={16} className="text-sky-600 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                      {activeTab === 'ACCOUNT_MANAGER' ? 'Quản lý Tài khoản' : activeTab === 'ACCOUNT_BACKUP' ? 'Quản lý Sao lưu' : 'Quản trị Hệ thống'}
                    </h2>
                  )}
              </div>
              <div className="flex items-center gap-4">
                  {currentDept && (
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
                      className="p-2.5 bg-white text-sky-500 hover:bg-sky-50 hover:text-sky-600 rounded-xl transition-all border border-slate-200 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                      title="Sao lưu / Khôi phục dữ liệu khoa"
                      aria-label="Sao lưu / Khôi phục"
                    >
                      <Database size={20} />
                    </button>
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
      </header>

      {/* Body area with vertical icon sidebar on the left and content on the right */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {currentDept && (
          <aside className="w-16 bg-white border-r border-slate-200 shadow-xs flex flex-col items-center py-4 shrink-0 z-20 overflow-y-auto">
            <div className="flex flex-col items-center gap-3 w-full">
              {[
                { id: 'PATIENT_RECORDS', label: 'Hồ sơ Bệnh nhân', icon: <FileText size={20} /> },
                { id: 'SCHEDULING', label: 'Sắp xếp lịch trình', icon: <CalendarPlus size={20} /> },
                { id: 'GENERAL_TIMELINE', label: 'Timeline Khoa', icon: <Table2 size={20} /> },
                { id: 'DAILY_REPORT', label: 'Báo cáo thống kê', icon: <PieChart size={20} /> },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <div key={tab.id} className="relative group">
                    <button 
                      disabled={isAnyModalOpen}
                      onClick={() => {
                        if (isAnyModalOpen) return;
                        setActiveTab(tab.id as MainTab);
                      }} 
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 relative cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isActive 
                          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 scale-105 ring-2 ring-sky-400/20' 
                          : 'text-slate-500 hover:text-sky-600 hover:bg-sky-50/80 bg-white border border-slate-200 hover:border-sky-200 shadow-2xs'
                      }`}
                      title={tab.label}
                      aria-label={tab.label}
                    >
                      <span className={`transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'}`}>{tab.icon}</span>
                    </button>

                    {/* Floating tooltip on hover */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-wider rounded-xl whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 translate-x-[-4px] group-hover:translate-x-0">
                      {tab.label}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-slate-900" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom action: Quản lý Khoa */}
            <div className="mt-auto pt-3 flex flex-col items-center gap-3 w-full border-t border-slate-100">
              <div className="relative group">
                <button 
                  disabled={isAnyModalOpen}
                  onClick={() => {
                    if (isAnyModalOpen) return;
                    setActiveTab('DEPT_MANAGER');
                  }} 
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 relative cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeTab === 'DEPT_MANAGER' 
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 scale-105 ring-2 ring-sky-400/20' 
                      : 'text-slate-500 hover:text-sky-600 hover:bg-sky-50/80 bg-white border border-slate-200 hover:border-sky-200 shadow-2xs'
                  }`}
                  title="Quản lý Khoa"
                  aria-label="Quản lý Khoa"
                >
                  <span className={`transition-transform duration-300 ${activeTab === 'DEPT_MANAGER' ? '' : 'group-hover:scale-110'}`}>
                    <Building2 size={20} />
                  </span>
                </button>

                {/* Floating tooltip on hover */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-wider rounded-xl whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 translate-x-[-4px] group-hover:translate-x-0">
                  Quản lý Khoa
                  <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-slate-900" />
                </div>
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {currentDept && (
            <div className="px-3 sm:px-4 py-1.5 bg-slate-50/70 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                  <span className="text-sky-600">
                    {activeTab === 'PATIENT_RECORDS' && <FileText size={15} />}
                    {activeTab === 'SCHEDULING' && <CalendarPlus size={15} />}
                    {activeTab === 'GENERAL_TIMELINE' && <Table2 size={15} />}
                    {activeTab === 'DAILY_REPORT' && <PieChart size={15} />}
                    {activeTab === 'DEPT_MANAGER' && <Building2 size={15} />}
                    {activeTab === 'ATTENDANCE' && <CalendarCheck size={15} />}
                  </span>
                  <span className="text-[12px] font-black uppercase tracking-wider text-slate-700">
                    {activeTab === 'PATIENT_RECORDS' && 'Hồ sơ Bệnh nhân'}
                    {activeTab === 'SCHEDULING' && 'Sắp xếp lịch trình'}
                    {activeTab === 'GENERAL_TIMELINE' && 'Timeline Khoa'}
                    {activeTab === 'DAILY_REPORT' && 'Báo cáo thống kê'}
                    {activeTab === 'DEPT_MANAGER' && 'Quản lý Khoa'}
                    {activeTab === 'ATTENDANCE' && 'Bảng Chấm Công'}
                  </span>
                </div>
              </div>

              {/* Nhóm Chấm công & Làm việc ngày */}
              <div className="flex items-center gap-2.5 ml-auto shrink-0">
                {/* Nút Tab Chấm công tách riêng */}
                <button
                  type="button"
                  disabled={isAnyModalOpen}
                  onClick={() => {
                    if (isAnyModalOpen) return;
                    if (activeTab === 'ATTENDANCE') {
                      setActiveTab(previousTabRef.current || 'DEPT_MANAGER');
                    } else {
                      previousTabRef.current = activeTab;
                      setActiveTab('ATTENDANCE');
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs border active:scale-95 ${
                    activeTab === 'ATTENDANCE'
                      ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/25 ring-2 ring-sky-400/20'
                      : 'bg-white text-slate-700 hover:text-sky-600 hover:bg-sky-50 border-slate-200 hover:border-sky-200'
                  }`}
                  title="Xem và quản lý Bảng chấm công"
                >
                  <CalendarCheck size={16} className={activeTab === 'ATTENDANCE' ? 'text-white' : 'text-sky-600'} />
                  <span>Chấm công</span>
                </button>

                {/* Khung Làm việc ngày */}
                <div className="flex items-center gap-2 bg-slate-100/90 rounded-2xl p-1 border border-slate-200/90 shadow-2xs">
                  <span className="text-[11px] font-black text-slate-500 px-2 uppercase tracking-widest hidden sm:inline">Làm việc ngày:</span>
                  <DateInput 
                    value={activeDate} 
                    onChange={(val) => { if (!isAnyModalOpen) handleDateChange(val); }} 
                    showNavigation={true}
                    showWeekday={true}
                    size="lg"
                    disabled={isAnyModalOpen}
                  />
                </div>
              </div>
            </div>
          )}

          <main className="flex-1 p-1.5 sm:p-2.5 overflow-hidden flex flex-col">
         {activeTab === 'ACCOUNT_MANAGER' && <AccountManager users={users} onSaveUser={handleSaveUser} onDeleteUser={handleDeleteUser} />}
         {activeTab === 'ACCOUNT_BACKUP' && <BackupManager backups={backups} departments={DEPARTMENTS} currentUser={currentUser} onCreateBackup={handleCreateBackup} onRestoreBackup={handleRestoreBackup} onDeleteBackup={handleDeleteBackup} onImportData={handleImportData} />}
         
         {activeTab === 'PATIENT_RECORDS' && currentDept && <PatientList patients={patients} activeDate={activeDate} currentDept={currentDept} appointments={appointments} procedures={procedures} staff={staff} currentUser={currentUser || undefined} onAddPatient={() => { setEditingPatient(null); setIsPatientEditModalOpen(true); }} onOpenHisSync={() => { setHisSyncIncomingBatch(null); setHisSyncBridgeStatus(prev => ({ ...prev, status: 'requesting', message: undefined, updatedAt: Date.now() })); setIsHisSyncModalOpen(true); }} onEditPatient={p => { setEditingPatient(p); setIsPatientEditModalOpen(true); }} onDeletePatient={handleDeletePatient} onUpdateStatus={handleUpdateStatus} onReferral={(pid, s) => { setReferralModal({ patientId: pid, specialty: s, procedureIds: [], referralTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) }); }} onFinishReferral={handleFinishReferral} onCancelFinishReferral={handleCancelFinishReferral} onCancelReferral={handleCancelReferral} />}

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
            onChangeDate={handleDateChange}
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
            onUpdateAppointments={handleUpdateAppointmentsSafely}
            onUpdateTemplates={setTemplates}
            onUpdateStatus={handleUpdateStatus}
            onUpdatePatient={handleSavePatient}
          />
         )}

         {activeTab === 'GENERAL_TIMELINE' && currentDept && (
           <Timeline 
             key={currentDept.id}
             date={activeDate} 
             onChangeDate={handleDateChange} 
             staff={staff} 
             appointments={deptAppointments} 
             allAppointments={appointments}
             attendanceRecords={attendanceRecords}
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
              onChangeDate={handleDateChange} 
              procedures={procedures} 
              staff={staff} 
              patients={patients}
              currentDept={currentDept}
              allDepts={DEPARTMENTS}
              attendanceRecords={attendanceRecords}
              onNavigateToTimeline={handleNavigateToTimeline} 
            />
          )}

          {activeTab === 'ATTENDANCE' && currentDept && (
            <div className="flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
              <StaffManager 
                activeTab="ATTENDANCE" 
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
                onUpdateAppointments={handleUpdateAppointmentsSafely}
                currentUser={currentUser!}
              />
            </div>
          )}

         {activeTab === 'DEPT_MANAGER' && currentDept && (
             <div className="flex flex-col h-full gap-4">
                 <div className="flex bg-white rounded-lg p-1 w-fit shadow-sm border border-slate-200">
                     {['PERSONNEL', 'PROCEDURES'].map(t => (
                       <button 
                         key={t} 
                         onClick={() => setManagerSubTab(t as ManagerTab)} 
                         className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${managerSubTab === t ? 'bg-primary text-white shadow' : 'text-slate-400 hover:bg-slate-100'}`}
                       >
                         {t === 'PERSONNEL' ? 'Nhân sự' : 'Danh mục'}
                       </button>
                     ))}
                 </div>
                 <div className="flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <StaffManager 
                           activeTab={managerSubTab === 'ATTENDANCE' ? 'PERSONNEL' : managerSubTab} 
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
                           onUpdateAppointments={handleUpdateAppointmentsSafely}
                           currentUser={currentUser!}
                        />
                 </div>
             </div>
         )}
      </main>
        </div>
      </div>

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
          currentUser={currentUser || undefined}
          canEdit={canEditCurrentDept}
          onDelete={handleDeleteAppointment}
          onAddShift={handleAddMachineShift}
          onUpdateShift={handleUpdateMachineShift}
          onDeleteShift={handleDeleteMachineShift}
        />
      )}

      {isPatientEditModalOpen && currentDept && (
          <PatientModal isOpen={isPatientEditModalOpen} onClose={() => { setIsPatientEditModalOpen(false); setEditingPatient(null); }} onSave={handleSavePatient} initialData={editingPatient} currentDept={currentDept} patients={patients} />
      )}

      {isHisSyncModalOpen && (
        <HisSyncModal
          isOpen={isHisSyncModalOpen}
          onClose={() => setIsHisSyncModalOpen(false)}
          patients={patients}
          currentDept={currentDept}
          activeDate={activeDate}
          incomingBatch={hisSyncIncomingBatch}
          bridgeStatus={hisSyncBridgeStatus}
          onRequestSyncReset={() => {
            setHisSyncIncomingBatch(null);
            setHisSyncBridgeStatus(prev => ({
              ...prev,
              status: 'requesting',
              message: undefined,
              updatedAt: Date.now()
            }));
          }}
          onApplyBatchPatients={handleBatchSavePatients}
          onSyncCompleted={(summary) => {
            try {
              window.postMessage({ type: 'MEDFLOW_SYNC_DONE', ...summary }, '*');
            } catch (e) {}
          }}
        />
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

                      {/* Cài đặt trạng thái làm việc / Nghỉ việc */}
                      <div className="bg-slate-50/80 p-4 rounded-2xl border-2 border-slate-100 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                  <label className="block text-[11px] font-black text-slate-600 uppercase tracking-widest">Trạng thái công tác</label>
                                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Cài đặt nhân sự đang làm việc hoặc đã nghỉ việc</p>
                              </div>
                              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                                  <button
                                      type="button"
                                      onClick={() => setEditingStaff({ ...editingStaff, isResigned: false })}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${!editingStaff.isResigned ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                  >
                                      Đang làm việc
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => setEditingStaff({ 
                                          ...editingStaff, 
                                          isResigned: true,
                                          resignationDate: editingStaff.resignationDate || new Date().toISOString().split('T')[0]
                                      })}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${editingStaff.isResigned ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                  >
                                      Đã nghỉ việc
                                  </button>
                              </div>
                          </div>

                          {editingStaff.isResigned && (
                              <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                  <div>
                                      <label className="block text-[11px] font-black text-rose-600 uppercase tracking-widest mb-1.5">
                                          Nghỉ việc từ ngày (áp dụng đến hiện tại)
                                      </label>
                                      <input 
                                          type="date"
                                          className="w-full border-2 border-rose-200 bg-white rounded-xl p-2.5 font-bold text-slate-800 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all shadow-sm"
                                          value={editingStaff.resignationDate || ''}
                                          onChange={e => setEditingStaff({ ...editingStaff, resignationDate: e.target.value })}
                                      />
                                  </div>
                                  <div className="text-[11px] font-medium text-slate-500 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                                      Từ ngày này trở đi, nhân sự sẽ không thể chỉ định vào lịch trình mới. Bảng chấm công sẽ bỏ chấm công từ ngày nghỉ và sang tháng mới sẽ không hiển thị nhân sự này nữa. Các lịch trình và mẫu trước ngày nghỉ vẫn được bảo toàn.
                                  </div>
                              </div>
                          )}
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
