
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Patient, PatientStatus, Department, DepartmentType, BedType, InsuranceLevel, UserAccount, UserRole } from '../types';
import { Button } from './Button';
import { DateTimePicker } from './DateTimePicker';
import { DateInput } from './DateInput';
import { TimeInput } from './TimeInput';
import { Search, Plus, User, MapPin, Bed, LogOut, FileText, Edit3, Printer, Send, Activity, FlaskConical, HeartPulse, CheckCircle2, Clock, Building2, Filter, Calendar, CheckSquare, Trash2, AlertTriangle, Power, CheckCircle, RotateCcw, X, XCircle, Pill, ChevronDown, DoorOpen, Download, Shield, Upload, ArrowUpDown, ArrowUp, ArrowDown, ArrowUpAZ, ArrowDownZA, Check, Wrench } from 'lucide-react';
import { calculateAge, getAbbreviation, timeStringToMinutes, generatePatientCode } from '../utils/timeUtils';
import { DEPARTMENTS } from '../constants';
import { Appointment, Procedure, Staff } from '../types';
import { downloadCSV, parseCSV } from '../utils/csvUtils';
import { db, doc, setDoc } from '../utils/dbService';


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

type SortField = 'NAME' | 'GENDER' | 'AGE' | 'DEPT' | 'BHYT' | 'ROOM' | 'BED' | 'BED_TYPE' | 'ADMISSION' | 'DISCHARGE';
type SortDirection = 'ASC' | 'DESC';
interface SortConfig { field: SortField; direction: SortDirection }

interface PatientListProps {
  patients: Patient[];
  activeDate: string;
  currentDept: Department;
  appointments: Appointment[];
  procedures: Procedure[];
  staff: Staff[];
  currentUser?: UserAccount;
  onAddPatient: () => void;
  onEditPatient: (p: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  onUpdateStatus: (patient: Patient, status: PatientStatus, dischargeDate?: string) => Promise<boolean> | void;
  onReferral: (patientId: string, specialty: string) => void;
  onFinishReferral: (patientId: string, specialty: string) => void;
  onCancelFinishReferral: (patientId: string, specialty: string) => void;
  onCancelReferral: (patientId: string, specialty: string) => void;
}

export const PatientList: React.FC<PatientListProps> = ({
  patients,
  activeDate,
  currentDept,
  appointments,
  procedures,
  staff,
  currentUser,
  onAddPatient,
  onEditPatient,
  onDeletePatient,
  onUpdateStatus,
  onReferral,
  onFinishReferral,
  onCancelFinishReferral,
  onCancelReferral,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'TREATING' | 'DISCHARGED'>('TREATING');
  const [bedTypeFilter, setBedTypeFilter] = useState<string>('ALL');
  const [insuranceFilter, setInsuranceFilter] = useState<string>('ALL');
  const [openHeaderFilter, setOpenHeaderFilter] = useState<'BHYT' | 'BED_TYPE' | null>(null);
  const [referringDeptFilter, setReferringDeptFilter] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [dischargingPatient, setDischargingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [finishingReferral, setFinishingReferral] = useState<{patient: Patient, specialty: string} | null>(null);
  
  // States cho in chỉ định
  const [printingPatient, setPrintingPatient] = useState<Patient | null>(null);
  const [printFromDate, setPrintFromDate] = useState<string>(activeDate);
  const [printToDate, setPrintToDate] = useState<string>(activeDate);
  const [printDeptId, setPrintDeptId] = useState<string>('ALL');
  
  // States cho Modal kết thúc
  const [dischargeDateInput, setDischargeDateInput] = useState('');

  // States & Helpers cho nhập CSV bệnh nhân
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [csvPatients, setCsvPatients] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // State cho dropdown chọn chuyên khoa gửi khám
  const [openReferralMenuPatientId, setOpenReferralMenuPatientId] = useState<string | null>(null);
  // State cho dropdown menu tác vụ quản lý (cờ lê) của từng bệnh nhân
  const [openActionsMenuPatientId, setOpenActionsMenuPatientId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
      const target = event.target as HTMLElement;
      if (!target.closest('.referral-menu-container')) {
        setOpenReferralMenuPatientId(null);
      }
      if (!target.closest('.header-filter-container')) {
        setOpenHeaderFilter(null);
      }
      if (!target.closest('.patient-actions-menu-container')) {
        setOpenActionsMenuPatientId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isValidDdMmYyyy = (str: string): boolean => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return false;
    const [d, m, y] = str.split('/').map(Number);
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d;
  };

  const convertToDdMmYyyy = (str: string): string => {
    str = (str || '').trim();
    if (!str) {
      const today = new Date();
      return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    }
    // If already dd/mm/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
    // If yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const parts = str.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) { // DD/MM/YYYY
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      } else if (parts[0].length === 4) { // YYYY/MM/DD
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
    }
    const today = new Date();
    return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  };

  const convertToYyyyMmDd = (ddMmYyyy: string): string => {
    const parts = (ddMmYyyy || '').trim().split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  const normalizeDate = (str: string): string => {
    return convertToDdMmYyyy(str);
  };

  const normalizeTime = (str: string): string => {
    str = (str || '').trim();
    if (!str) return '08:00';
    const parts = str.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return '08:00';
  };

  const downloadSampleCSV = () => {
    const headers = [
      { label: 'Ngày vào viện', key: 'admissionDate' },
      { label: 'Giờ vào viện', key: 'admissionTime' },
      { label: 'Họ tên bệnh nhân', key: 'name' },
      { label: 'Giới tính', key: 'gender' },
      { label: 'Năm sinh', key: 'yob' },
      { label: 'Số giường', key: 'bedNumber' },
      { label: 'Loại giường', key: 'bedType' },
      { label: 'Mức hưởng BHYT', key: 'insurance' },
      { label: 'Ghi chú', key: 'note' }
    ];
    const sampleData = [
      { admissionDate: '14/07/2026', admissionTime: '10:27', name: 'Phan Thị Hằng', gender: 'Nữ', yob: '1979', bedNumber: '477', bedType: 'Nội trú ban ngày', insurance: '80%', note: 'Theo dõi tăng huyết áp' },
      { admissionDate: '14/07/2026', admissionTime: '09:24', name: 'Vì Văn Ne', gender: 'Nam', yob: '1957', bedNumber: '452B', bedType: 'Nội trú', insurance: '100%', note: '' },
      { admissionDate: '14/07/2026', admissionTime: '09:19', name: 'Nguyễn Văn Vẽ', gender: 'Nam', yob: '1964', bedNumber: '475', bedType: 'Nội trú ban ngày', insurance: '95%', note: '' }
    ];
    downloadCSV(sampleData, 'mau_danh_sach_benh_nhan.csv', headers);
  };

  const processCsvContent = (text: string) => {
    try {
      let rows = parseCSV(text);
      if (rows.length === 0) {
        alert("File CSV không có dữ liệu!");
        return;
      }
      
      const firstRowStr = rows[0].join(',');
      if (
        firstRowStr.includes('Ngày') || 
        firstRowStr.includes('Giờ') || 
        firstRowStr.includes('Họ tên') || 
        firstRowStr.includes('Giường') ||
        firstRowStr.includes('Mức hưởng')
      ) {
        rows = rows.slice(1);
      }

      if (rows.length === 0) {
        alert("File CSV chỉ chứa tiêu đề, không có dữ liệu bệnh nhân!");
        return;
      }

      const parsedPatients = rows.map((row, idx) => {
        const dateRaw = row[0] || '';
        const timeRaw = row[1] || '';
        const nameRaw = row[2] || '';
        const genderRaw = row[3] || '';
        const yobRaw = row[4] || '';
        const bedRaw = row[5] || '';
        const bedTypeRaw = row[6] || '';
        const insRaw = row[7] || '';
        const noteRaw = row[8] || '';

        const admissionDate = normalizeDate(dateRaw);
        const admissionTime = normalizeTime(timeRaw);
        const name = nameRaw.trim();
        const gender = genderRaw.trim().toLowerCase() === 'nam' ? 'Nam' : 'Nữ';
        const yob = yobRaw.trim().replace(/\D/g, '') || '1960';
        const bedNumber = bedRaw.trim();
        
        let bedType: BedType = 'Nội trú';
        const bt = bedTypeRaw.trim().toLowerCase();
        if (bt.includes('ban ngày')) bedType = 'Nội trú ban ngày';
        else if (bt.includes('ngoại')) bedType = 'Ngoại trú';
        else if (bt.includes('khác')) bedType = 'Khác';

        let insuranceLevel: InsuranceLevel = '100%';
        const ins = insRaw.trim().replace(/%/g, '');
        if (ins === '0') insuranceLevel = '0%';
        else if (ins === '80') insuranceLevel = '80%';
        else if (ins === '95') insuranceLevel = '95%';
        else if (ins === '100') insuranceLevel = '100%';

        const note = noteRaw.trim();

        return {
          tempId: `temp_${idx}_${Date.now()}_${Math.random()}`,
          admissionDate,
          admissionTime,
          name,
          gender,
          yob,
          bedNumber,
          bedType,
          insuranceLevel,
          note
        };
      });

      setCsvPatients(parsedPatients);
    } catch (err) {
      console.error("Error processing CSV:", err);
      alert("Định dạng file CSV không hợp lệ hoặc bị lỗi. Vui lòng kiểm tra lại!");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        processCsvContent(text);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          processCsvContent(text);
        }
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const updateCsvField = (index: number, field: string, value: any) => {
    setCsvPatients(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Realtime validation
  const validatedCsvPatients = useMemo(() => {
    const activePatientsInDept = patients.filter(
      p => p.admittedByDeptId === currentDept.id && p.status === PatientStatus.TREATING
    );
    const activeBedsInDept = new Set(activePatientsInDept.map(p => p.bedNumber));

    return csvPatients.map((item, index) => {
      const isBedOccupied = item.bedNumber ? activeBedsInDept.has(item.bedNumber) : false;
      const isBedDuplicateInCsv = item.bedNumber 
        ? csvPatients.some((x, idx) => idx !== index && x.bedNumber === item.bedNumber) 
        : false;
      const hasBedConflict = isBedOccupied || isBedDuplicateInCsv;

      const hasNameWarning = activePatientsInDept.some(p => {
        const sameName = (p.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase();
        const sameGender = p.gender === item.gender;
        const sameYob = p.dob && p.dob.substring(0, 4) === item.yob;
        return sameName && sameGender && sameYob;
      });

      const isDateValid = isValidDdMmYyyy(item.admissionDate);

      return {
        ...item,
        isBedOccupied,
        isBedDuplicateInCsv,
        hasBedConflict,
        hasNameWarning,
        isDateValid
      };
    });
  }, [csvPatients, patients, currentDept.id]);

  const hasAnyBedConflict = useMemo(() => {
    return validatedCsvPatients.some(p => p.hasBedConflict);
  }, [validatedCsvPatients]);

  const hasAnyInvalidDate = useMemo(() => {
    return validatedCsvPatients.some(p => !p.isDateValid);
  }, [validatedCsvPatients]);

  const handleConfirmImport = async () => {
    if (!db || hasAnyBedConflict || hasAnyInvalidDate || validatedCsvPatients.length === 0) return;
    try {
      const promises = validatedCsvPatients.map(async (item) => {
        const patientId = `p_${Math.random().toString(36).substr(2, 9)}`;
        const yyyyMmDd = convertToYyyyMmDd(item.admissionDate);
        const localDtStr = `${yyyyMmDd}T${item.admissionTime || '08:00'}:00`;
        const admissionDateIso = new Date(localDtStr).toISOString();
        const dob = `${item.yob}-01-01`;
        const code = generatePatientCode(item.name, admissionDateIso, currentDept.id);

        const newPatient: Patient = {
          id: patientId,
          name: item.name,
          dob: dob,
          gender: item.gender,
          code: code,
          bedNumber: item.bedNumber || '',
          roomNumber: '',
          admissionDate: admissionDateIso,
          dischargeDate: null,
          bedType: item.bedType || 'Nội trú',
          status: PatientStatus.TREATING,
          admittedByDeptId: currentDept.id,
          referrals: [],
          insuranceLevel: item.insuranceLevel || '100%',
          note: item.note || ''
        };

        const cleanPatient = JSON.parse(JSON.stringify(newPatient, (key, value) => value === undefined ? null : value));
        return setDoc(doc(db, "patients", patientId), cleanPatient);
      });

      await Promise.all(promises);
      setIsCsvImportModalOpen(false);
      setCsvPatients([]);
      alert(`Đã nhập thành công ${validatedCsvPatients.length} bệnh nhân vào khoa.`);
    } catch (err) {
      console.error("Error importing patients:", err);
      alert("Có lỗi xảy ra khi nhập danh sách bệnh nhân. Vui lòng thử lại.");
    }
  };

  useEffect(() => {
    if (dischargingPatient) {
      if (dischargingPatient.dischargeDate) {
        // Convert ISO to local YYYY-MM-DDTHH:mm
        const d = new Date(dischargingPatient.dischargeDate);
        const localDatetime = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setDischargeDateInput(localDatetime);
      } else {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const localDatetime = `${activeDate}T${hours}:${minutes}`;
        setDischargeDateInput(localDatetime);
      }
    }
  }, [dischargingPatient, activeDate]);

  const isSupportDept = currentDept.type === DepartmentType.SUPPORT;

  const counts = useMemo(() => {
    let all = 0;
    let treating = 0;
    let discharged = 0;

    patients.forEach(p => {
      const admissionDateStr = getLocalDateString(p.admissionDate);
      if (activeDate < admissionDateStr) return;

      const isDischarged = p.status === 'DISCHARGED';
      const dischargeDateStr = getLocalDateString(p.dischargeDate);

      // Loại bỏ hoàn toàn nếu đã ra viện trước activeDate
      if (isDischarged && dischargeDateStr && dischargeDateStr < activeDate) {
        return;
      }

      const isDischargedOnActiveDate = isDischarged && dischargeDateStr === activeDate;
      const isTreatingOnActiveDate = !isDischarged || (dischargeDateStr && dischargeDateStr > activeDate);

      if (currentDept.type === DepartmentType.CLINICAL) {
        if (p.admittedByDeptId !== currentDept.id) return;
        if (isTreatingOnActiveDate) treating++;
        if (isDischargedOnActiveDate) discharged++;
        if (isTreatingOnActiveDate || isDischargedOnActiveDate) all++;
      } else {
        if (p.admittedByDeptId === currentDept.id) {
          if (isTreatingOnActiveDate) treating++;
          if (isDischargedOnActiveDate) discharged++;
          if (isTreatingOnActiveDate || isDischargedOnActiveDate) all++;
        } else {
          const matchedReferral = p.referrals?.find(r => {
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
            if (!isMatch) return false;
            const refDate = r.referralDate || getLocalDateString(p.admissionDate);
            if (activeDate < refDate) return false;
            const isFin = r.status === 'FINISHED';
            const finDate = r.finishedDate || '';
            if (isFin && finDate && finDate < activeDate) return false;
            return true;
          });

          if (matchedReferral) {
            const isFin = matchedReferral.status === 'FINISHED';
            const finDate = matchedReferral.finishedDate || '';
            const isFinishedOnActiveDate = isFin && finDate === activeDate;
            const isTreatingOnActiveDateRef = !isFin || (finDate && finDate > activeDate);

            if (isTreatingOnActiveDateRef) treating++;
            if (isFinishedOnActiveDate) discharged++;
            if (isTreatingOnActiveDateRef || isFinishedOnActiveDate) all++;
          }
        }
      }
    });

    return { all, treating, discharged };
  }, [patients, activeDate, currentDept]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      // 1. Bệnh nhân chưa vào viện vào thời điểm activeDate
      const admissionDateStr = getLocalDateString(p.admissionDate);
      if (activeDate < admissionDateStr) return false;

      // 2. Logic lọc theo trạng thái điều trị gắn chặt với activeDate (giống tab Sắp xếp lịch trình)
      const isDischarged = p.status === 'DISCHARGED';
      const dischargeDateStr = getLocalDateString(p.dischargeDate);

      // Loại bỏ hoàn toàn bệnh nhân đã ra viện từ trước ngày làm việc (activeDate)
      if (isDischarged && dischargeDateStr && dischargeDateStr < activeDate) {
        return false;
      }

      let isVisible = false;
      if (currentDept.type === DepartmentType.CLINICAL) {
        if (p.admittedByDeptId !== currentDept.id) return false;

        const isDischargedOnActiveDate = isDischarged && dischargeDateStr === activeDate;
        const isTreatingOnActiveDate = !isDischarged || (dischargeDateStr && dischargeDateStr > activeDate);

        if (filterStatus === 'DISCHARGED') {
          // Tab "Ra viện": Chỉ giữ BN ra viện trong ngày hiện tại (activeDate)
          if (!isDischargedOnActiveDate) return false;
        } else if (filterStatus === 'TREATING') {
          // Tab "Đang điều trị": Chỉ giữ BN đang điều trị trong ngày hiện tại (activeDate)
          if (!isTreatingOnActiveDate) return false;
        } else {
          // Tab "Tất cả": Chỉ giữ BN hiện diện trong ngày hiện tại (đang điều trị hoặc ra viện trong ngày)
          if (!isTreatingOnActiveDate && !isDischargedOnActiveDate) return false;
        }
        isVisible = true;
      } else {
        if (p.admittedByDeptId === currentDept.id) {
          const isDischargedOnActiveDate = isDischarged && dischargeDateStr === activeDate;
          const isTreatingOnActiveDate = !isDischarged || (dischargeDateStr && dischargeDateStr > activeDate);

          if (filterStatus === 'DISCHARGED') {
            if (!isDischargedOnActiveDate) return false;
          } else if (filterStatus === 'TREATING') {
            if (!isTreatingOnActiveDate) return false;
          } else {
            if (!isTreatingOnActiveDate && !isDischargedOnActiveDate) return false;
          }
          isVisible = true;
        } else {
          isVisible = p.referrals?.some(r => {
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
            if (activeDate < refDate) return false;

            // Logic lọc theo trạng thái kết thúc tại chuyên khoa (Tab Đang điều trị / Ra viện)
            const isFinished = r.status === 'FINISHED';
            const finishedDateStr = r.finishedDate || '';

            // Loại bỏ hoàn toàn nếu đã hoàn thành chỉ định chuyên khoa từ các ngày trước
            if (isFinished && finishedDateStr && finishedDateStr < activeDate) {
              return false;
            }

            const isFinishedOnActiveDate = isFinished && finishedDateStr === activeDate;
            const isTreatingOnActiveDateRef = !isFinished || (finishedDateStr && finishedDateStr > activeDate);

            if (filterStatus === 'DISCHARGED') {
              // Tab "Ra viện": Chỉ giữ BN hoàn thành trong ngày làm việc hiện tại
              if (!isFinishedOnActiveDate) return false;
            } else if (filterStatus === 'TREATING') {
              // Tab "Đang điều trị": Chỉ giữ BN đang điều trị tại khoa trong ngày làm việc
              if (!isTreatingOnActiveDateRef) return false;
            } else {
              // Tab "Tất cả": Chỉ giữ BN hiện diện trong ngày làm việc
              if (!isTreatingOnActiveDateRef && !isFinishedOnActiveDate) return false;
            }

            return true;
          }) ?? false;
        }
      }

      if (!isVisible) return false;

      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term || (p.name || '').toLowerCase().includes(term) || (p.code || '').toLowerCase().includes(term);
      if (!matchesSearch) return false;

      const matchesBedType = bedTypeFilter === 'ALL' || (p.bedType || 'Nội trú') === bedTypeFilter;
      if (!matchesBedType) return false;

      const matchesInsurance = insuranceFilter === 'ALL' || (p.insuranceLevel || '100%') === insuranceFilter;
      if (!matchesInsurance) return false;

      const matchesDeptFilter = referringDeptFilter === 'ALL' || p.admittedByDeptId === referringDeptFilter;
      if (!matchesDeptFilter) return false;

      return true;
    }).sort((a, b) => {
      if (!sortConfig) {
        // Mặc định: theo thời gian vào viện tăng dần (sớm nhất trước)
        return new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime();
      }

      const { field, direction } = sortConfig;
      let cmp = 0;

      if (field === 'NAME') {
        const getFirstName = (fullName: string) => {
          const parts = (fullName || '').trim().split(/\s+/);
          return parts[parts.length - 1] || '';
        };
        const firstNameA = getFirstName(a.name);
        const firstNameB = getFirstName(b.name);
        cmp = firstNameA.localeCompare(firstNameB, 'vi');
        if (cmp === 0) {
          cmp = (a.name || '').localeCompare(b.name || '', 'vi');
        }
      } else if (field === 'GENDER') {
        cmp = (a.gender || '').localeCompare(b.gender || '', 'vi');
      } else if (field === 'AGE') {
        const ageA = a.dob ? (Number(calculateAge(a.dob)) || 0) : 0;
        const ageB = b.dob ? (Number(calculateAge(b.dob)) || 0) : 0;
        cmp = ageA - ageB;
        if (cmp === 0) {
          cmp = (a.dob || '').localeCompare(b.dob || '');
        }
      } else if (field === 'DEPT') {
        const deptA = DEPARTMENTS.find(d => d.id === a.admittedByDeptId)?.name || '';
        const deptB = DEPARTMENTS.find(d => d.id === b.admittedByDeptId)?.name || '';
        cmp = deptA.localeCompare(deptB, 'vi');
      } else if (field === 'BHYT') {
        const parseLevel = (lvl?: string | null) => parseInt((lvl || '0%').replace('%', ''), 10) || 0;
        cmp = parseLevel(a.insuranceLevel) - parseLevel(b.insuranceLevel);
      } else if (field === 'ROOM') {
        const roomA = a.roomNumber || '';
        const roomB = b.roomNumber || '';
        cmp = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (field === 'BED') {
        const bedA = a.bedNumber || '';
        const bedB = b.bedNumber || '';
        cmp = bedA.localeCompare(bedB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (field === 'BED_TYPE') {
        const typeA = a.bedType || 'Nội trú';
        const typeB = b.bedType || 'Nội trú';
        cmp = typeA.localeCompare(typeB, 'vi');
      } else if (field === 'ADMISSION') {
        cmp = new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime();
      } else if (field === 'DISCHARGE') {
        const timeA = a.dischargeDate ? new Date(a.dischargeDate).getTime() : 0;
        const timeB = b.dischargeDate ? new Date(b.dischargeDate).getTime() : 0;
        cmp = timeA - timeB;
      }

      return direction === 'ASC' ? cmp : -cmp;
    });
  }, [patients, activeDate, filterStatus, searchTerm, bedTypeFilter, insuranceFilter, referringDeptFilter, currentDept, sortConfig]);

  const handleConfirmDischarge = async () => {
    if (dischargingPatient) {
      const result = await onUpdateStatus(dischargingPatient, PatientStatus.DISCHARGED, dischargeDateInput);
      if (result !== false) {
        setDischargingPatient(null);
      }
    }
  };

  const handleConfirmDelete = () => {
    if (deletingPatient) {
      onDeletePatient(deletingPatient.id);
      setDeletingPatient(null);
    }
  };

  const handleConfirmFinishReferral = () => {
    if (finishingReferral) {
        onFinishReferral(finishingReferral.patient.id, finishingReferral.specialty);
        setFinishingReferral(null);
    }
  };

  const executePrint = () => {
    if (!printingPatient) return;
    
    let patientAppts = appointments.filter(a => a.patientId === printingPatient.id);
    
    // Filter by date
    if (printFromDate) {
      patientAppts = patientAppts.filter(a => a.date >= printFromDate);
    }
    if (printToDate) {
      patientAppts = patientAppts.filter(a => a.date <= printToDate);
    }
    
    // Filter by department
    if (printDeptId !== 'ALL') {
      patientAppts = patientAppts.filter(a => {
        const proc = procedures.find(p => p.id === a.procedureId);
        const procedureDeptId = proc?.deptId || a.deptId;
        return procedureDeptId === printDeptId;
      });
    }

    if (patientAppts.length === 0) {
      alert('Không có chỉ định nào thỏa mãn điều kiện.');
      return;
    }

    // Sort by date and time
    patientAppts.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Phiếu Chỉ Định - ${printingPatient.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; font-size: 24px; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 18px; font-weight: normal; margin-top: 0; margin-bottom: 20px; }
            .info { margin-bottom: 20px; }
            .info p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>PHIẾU CHỈ ĐỊNH LỊCH TRÌNH</h1>
          <h2>Khoa: ${currentDept.name}</h2>
          
          <div class="info">
            <p><strong>Họ và tên người bệnh:</strong> ${printingPatient.name} - <strong>Tuổi:</strong> ${calculateAge(printingPatient.dob)} - <strong>Giới tính:</strong> ${printingPatient.gender}</p>
            <p><strong>Loại giường:</strong> ${printingPatient.bedType || 'Nội trú'}</p>
            <p><strong>Mã BN:</strong> ${printingPatient.code}</p>
            <p><strong>Phòng/Giường:</strong> P${printingPatient.roomNumber || '?'} - G${printingPatient.bedNumber}</p>
            <p><strong>Ngày vào viện:</strong> ${new Date(printingPatient.admissionDate).toLocaleDateString('vi-VN')}</p>
            <p><strong>Từ ngày:</strong> ${printFromDate ? new Date(printFromDate).toLocaleDateString('vi-VN') : '...'} - <strong>Đến ngày:</strong> ${printToDate ? new Date(printToDate).toLocaleDateString('vi-VN') : '...'}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Ngày thực hiện</th>
                <th>Giờ thực hiện</th>
                <th>Thời lượng</th>
                <th>Tên lịch trình</th>
                <th>Người thực hiện</th>
                <th>Khoa thực hiện</th>
              </tr>
            </thead>
            <tbody>
              ${patientAppts.map((appt, idx) => {
                const proc = procedures.find(p => p.id === appt.procedureId);
                const staffMember = staff.find(s => s.id === appt.staffId);
                const a1 = staff.find(s => s.id === appt.assistant1Id);
                const a2 = staff.find(s => s.id === appt.assistant2Id);
                const procedureDeptId = proc?.deptId || appt.deptId;
                const performingDept = DEPARTMENTS.find(d => d.id === procedureDeptId);
                let staffStr = staffMember?.name || 'Chưa phân công';
                if (a1) staffStr += `<br><small>Phụ 1: ${a1.name}</small>`;
                if (a2) staffStr += `<br><small>Phụ 2: ${a2.name}</small>`;
                
                const startMin = timeStringToMinutes(appt.startTime);
                const endMin = timeStringToMinutes(appt.endTime);
                const duration = endMin - startMin;

                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${new Date(appt.date).toLocaleDateString('vi-VN')}</td>
                    <td>${appt.startTime} - ${appt.endTime}</td>
                    <td style="text-align:center">${duration}p</td>
                    <td>${proc?.name || 'Không rõ'}</td>
                    <td>${staffStr}</td>
                    <td>${performingDept?.name || 'Không rõ'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div style="margin-top: 40px; display: flex; justify-content: space-between;">
            <div></div>
            <div style="text-align: center;">
              <p><em>Ngày ..... tháng ..... năm .....</em></p>
              <p><strong>Người chỉ định</strong></p>
              <br/><br/><br/>
              <p>.........................................</p>
            </div>
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setPrintingPatient(null);
  };

  const handleExportCSVPatient = () => {
    if (!printingPatient) return;
    
    let patientAppts = appointments.filter(a => a.patientId === printingPatient.id);
    
    // Filter by date
    if (printFromDate) {
      patientAppts = patientAppts.filter(a => a.date >= printFromDate);
    }
    if (printToDate) {
      patientAppts = patientAppts.filter(a => a.date <= printToDate);
    }
    
    // Filter by department
    if (printDeptId !== 'ALL') {
      patientAppts = patientAppts.filter(a => {
        const proc = procedures.find(p => p.id === a.procedureId);
        const procedureDeptId = proc?.deptId || a.deptId;
        return procedureDeptId === printDeptId;
      });
    }

    if (patientAppts.length === 0) {
      alert('Không có chỉ định nào thỏa mãn điều kiện.');
      return;
    }

    // Sort by date and time
    patientAppts.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    const csvData = patientAppts.map((appt, idx) => {
      const proc = procedures.find(p => p.id === appt.procedureId);
      const staffMember = staff.find(s => s.id === appt.staffId);
      const a1 = staff.find(s => s.id === appt.assistant1Id);
      const a2 = staff.find(s => s.id === appt.assistant2Id);
      const procedureDeptId = proc?.deptId || appt.deptId;
      const performingDept = DEPARTMENTS.find(d => d.id === procedureDeptId);

      let staffStr = staffMember?.name || 'Chưa phân công';
      if (a1) staffStr += ` (Phụ 1: ${a1.name})`;
      if (a2) staffStr += ` (Phụ 2: ${a2.name})`;

      const startMin = timeStringToMinutes(appt.startTime);
      const endMin = timeStringToMinutes(appt.endTime);
      const duration = endMin - startMin;

      return {
        stt: idx + 1,
        date: new Date(appt.date).toLocaleDateString('vi-VN'),
        time: `${appt.startTime} - ${appt.endTime}`,
        duration: `${duration}p`,
        procedure: proc?.name || 'Lịch trình đã xóa',
        staff: staffStr,
        dept: performingDept?.name || 'Không rõ'
      };
    });

    const headers = [
      { label: 'STT', key: 'stt' },
      { label: 'Ngày thực hiện', key: 'date' },
      { label: 'Giờ thực hiện', key: 'time' },
      { label: 'Thời lượng', key: 'duration' },
      { label: 'Tên lịch trình', key: 'procedure' },
      { label: 'Người thực hiện', key: 'staff' },
      { label: 'Khoa thực hiện', key: 'dept' }
    ];

    downloadCSV(csvData, `Chi_Dinh_${printingPatient.name}_${printFromDate}_${printToDate}.csv`, headers);
    setPrintingPatient(null);
  };

  const referralSpecialties = [
    { 
      id: 'dept_phcn', 
      label: 'PHCN', 
      fullName: 'Phục hồi chức năng',
      icon: <Activity size={13} />, 
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200' 
    },
    { 
      id: 'dept_xetnghiem', 
      label: 'Xét nghiệm', 
      fullName: 'Khoa Xét nghiệm',
      icon: <FlaskConical size={13} />, 
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' 
    },
    { 
      id: 'dept_cdha', 
      label: 'CDHA', 
      fullName: 'Chẩn đoán hình ảnh',
      icon: <HeartPulse size={13} />, 
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' 
    },
    { 
      id: 'dept_duoc', 
      label: 'Dược', 
      fullName: 'Khoa Dược',
      icon: <Pill size={13} />, 
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' 
    }
  ];

  const formatReferralDateTime = (ref: any): string => {
    const time = ref.timestamp ? (ref.timestamp.length > 5 ? ref.timestamp.slice(0, 5) : ref.timestamp) : '';
    let date = '';
    if (ref.referralDate) {
      if (ref.referralDate.includes('-')) {
        const parts = ref.referralDate.split('T')[0].split('-');
        if (parts.length === 3) {
          date = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          date = ref.referralDate;
        }
      } else {
        date = ref.referralDate;
      }
    }
    if (time && date) return `${time} ${date}`;
    return time || date || '--:--';
  };

  const handleSort = (field: SortField) => {
    if (!sortConfig || sortConfig.field !== field) {
      setSortConfig({ field, direction: 'ASC' });
    } else if (sortConfig.direction === 'ASC') {
      setSortConfig({ field, direction: 'DESC' });
    } else {
      setSortConfig(null);
    }
  };

  const renderSortHeader = (
    field: SortField, 
    label: string, 
    align: 'center' | 'left' = 'center',
    isAlpha = false,
    className = ''
  ) => {
    const isSorted = sortConfig?.field === field;
    const isAsc = isSorted && sortConfig?.direction === 'ASC';
    const isDesc = isSorted && sortConfig?.direction === 'DESC';

    let tooltip = `Nhấn lần 1: Sắp xếp ${isAlpha ? 'A-Z' : 'tăng dần'} • Lần 2: ${isAlpha ? 'Z-A' : 'giảm dần'} • Lần 3: Hủy sắp xếp`;
    if (isAsc) {
      tooltip = `Đang xếp ${isAlpha ? 'A-Z' : 'tăng dần'} (Nhấn lần 2 để đổi sang ${isAlpha ? 'Z-A' : 'giảm dần'})`;
    } else if (isDesc) {
      tooltip = `Đang xếp ${isAlpha ? 'Z-A' : 'giảm dần'} (Nhấn lần 3 để hủy sắp xếp)`;
    }

    return (
      <th 
        onClick={() => handleSort(field)}
        title={tooltip}
        className={`p-3.5 select-none cursor-pointer transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 group ${className} ${
          isSorted ? 'bg-sky-50 text-sky-700 font-black' : 'text-slate-600'
        }`}
      >
        <div className={`flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span className={`text-[11px] font-black tracking-[0.08em] ${isSorted ? 'text-sky-700' : ''}`}>
            {label}
          </span>
          <span className="inline-flex items-center shrink-0">
            {isAsc ? (
              isAlpha ? (
                <ArrowUpAZ size={14} className="text-sky-600 stroke-[2.5]" />
              ) : (
                <ArrowUp size={14} className="text-sky-600 stroke-[2.5]" />
              )
            ) : isDesc ? (
              isAlpha ? (
                <ArrowDownZA size={14} className="text-sky-600 stroke-[2.5]" />
              ) : (
                <ArrowDown size={14} className="text-sky-600 stroke-[2.5]" />
              )
            ) : (
              <ArrowUpDown size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 bg-slate-50/50">
        <div className="flex items-center gap-4">
           <div className="flex bg-slate-200 rounded-xl p-1 shrink-0">
              <button 
                onClick={() => setFilterStatus('ALL')} 
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all uppercase tracking-wider flex items-center gap-1.5 ${filterStatus === 'ALL' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                title="Tất cả bệnh nhân hiện diện trong ngày làm việc"
              >
                Tất cả <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${filterStatus === 'ALL' ? 'bg-primary/10 text-primary' : 'bg-slate-300 text-slate-700'}`}>{counts.all}</span>
              </button>
              <button 
                onClick={() => setFilterStatus('TREATING')} 
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all uppercase tracking-wider flex items-center gap-1.5 ${filterStatus === 'TREATING' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                title="Bệnh nhân đang điều trị trong ngày làm việc"
              >
                Đang điều trị <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${filterStatus === 'TREATING' ? 'bg-primary/10 text-primary' : 'bg-slate-300 text-slate-700'}`}>{counts.treating}</span>
              </button>
              <button 
                onClick={() => setFilterStatus('DISCHARGED')} 
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all uppercase tracking-wider flex items-center gap-1.5 ${filterStatus === 'DISCHARGED' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                title="Bệnh nhân ra viện trong ngày làm việc"
              >
                Ra viện <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${filterStatus === 'DISCHARGED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-300 text-slate-700'}`}>{counts.discharged}</span>
              </button>
           </div>
           
           {isSupportDept && (
             <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 shadow-sm">
               <Filter size={15} className="text-slate-400" />
               <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider mr-1">Từ khoa:</span>
               <select className="text-xs font-bold bg-transparent outline-none cursor-pointer text-slate-700" value={referringDeptFilter} onChange={e => setReferringDeptFilter(e.target.value)}>
                  <option value="ALL">Tất cả khoa lâm sàng</option>
                  <option value="dept_ngoai">Khoa Ngoại</option>
                  <option value="dept_noi">Khoa Nội</option>
                  <option value="dept_chamcuu">Khoa Châm cứu</option>
               </select>
             </div>
           )}
        </div>

        <div className="flex-1 max-md:hidden max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none text-sm font-bold transition-all" placeholder="Tìm tên, mã BN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {!isSupportDept && (
          <div className="relative shrink-0" ref={addMenuRef}>
            <div className="flex items-center shadow-md shadow-primary/10 rounded-xl overflow-hidden border border-primary/20 bg-primary">
              <button 
                type="button"
                onClick={onAddPatient}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-all active:scale-95 cursor-pointer"
                title="BN vào khoa mới"
              >
                <Plus size={16} />
                <span>Thêm</span>
              </button>
              <button 
                type="button"
                onClick={() => setIsAddMenuOpen(prev => !prev)}
                className="flex items-center justify-center w-8 h-8 text-white/90 hover:text-white hover:bg-primary/80 border-l border-white/20 transition-all active:scale-95 cursor-pointer"
                title="Tùy chọn thêm bệnh nhân"
              >
                <ChevronDown size={14} className={`transition-transform duration-200 ${isAddMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isAddMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    onAddPatient();
                  }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-primary flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Plus size={15} />
                  </div>
                  <div>
                    <div className="text-slate-800">BN vào khoa mới</div>
                    <div className="text-[10px] text-slate-400 font-normal">Thêm hồ sơ 1 bệnh nhân</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setCsvPatients([]);
                    setIsCsvImportModalOpen(true);
                  }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-3 transition-colors cursor-pointer border-t border-slate-50"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Upload size={15} />
                  </div>
                  <div>
                    <div className="text-slate-800">Nhập từ file CSV</div>
                    <div className="text-[10px] text-slate-400 font-normal">Tải danh sách hàng loạt</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-black sticky top-0 z-20 uppercase border-b border-slate-200">
            {/* Hàng 1: Phân nhóm các khối cột thông tin */}
            <tr className="border-b border-slate-200/80 bg-slate-100/70">
              <th rowSpan={2} className="p-3 w-12 text-center border-r border-slate-200 text-slate-600 font-black text-xs">STT</th>
              <th colSpan={3} className="py-2.5 px-3 text-center font-black tracking-wider text-[11px] text-slate-700 border-r border-slate-200 bg-slate-100/90">
                THÔNG TIN BỆNH NHÂN
              </th>
              <th colSpan={5} className="py-2.5 px-3 text-center font-black tracking-wider text-[11px] text-slate-700 border-r border-slate-200 bg-slate-100/90">
                {isSupportDept ? 'THÔNG TIN TIẾP NHẬN & BUỒNG GIƯỜNG' : 'THÔNG TIN ĐIỀU TRỊ & BUỒNG GIƯỜNG'}
              </th>
              <th colSpan={3} className="py-2.5 px-3 text-center font-black tracking-wider text-[11px] text-slate-700 border-r border-slate-200 bg-slate-100/90">
                {isSupportDept ? 'CHỈ ĐỊNH & THỜI GIAN' : 'GỬI KHÁM & THỜI GIAN'}
              </th>
              <th rowSpan={2} className="p-3 w-20 text-center text-slate-600 font-black text-xs">QUẢN LÝ</th>
            </tr>

            {/* Hàng 2: Các cột chi tiết có chức năng sắp xếp và bộ lọc */}
            <tr>
              {renderSortHeader('NAME', 'HỌ VÀ TÊN', 'left', true, 'min-w-[210px]')}
              {renderSortHeader('GENDER', 'GIỚI TÍNH', 'center', false, 'w-24 text-center')}
              {renderSortHeader('AGE', 'TUỔI', 'center', false, 'w-20 text-center border-r border-slate-200')}
              {renderSortHeader('DEPT', isSupportDept ? 'KHOA GỬI' : 'KHOA ĐIỀU TRỊ', 'center', true, 'w-36 text-center')}
              
              {/* Cột BHYT với tính năng lọc mức hưởng & sắp xếp */}
              <th className={`p-3 select-none relative header-filter-container ${
                sortConfig?.field === 'BHYT' ? 'bg-sky-50 text-sky-700 font-black' : 'text-slate-600'
              } w-28 text-center`}>
                <div className="flex items-center justify-center gap-1.5">
                  <div 
                    onClick={() => handleSort('BHYT')}
                    className="flex items-center gap-1 cursor-pointer hover:text-slate-900 group"
                    title="Nhấn để sắp xếp theo mức BHYT"
                  >
                    <span className={`text-[11px] font-black tracking-[0.08em] ${sortConfig?.field === 'BHYT' ? 'text-sky-700' : ''}`}>
                      BHYT
                    </span>
                    <span className="inline-flex items-center shrink-0">
                      {sortConfig?.field === 'BHYT' ? (
                        sortConfig.direction === 'ASC' ? (
                          <ArrowUp size={14} className="text-sky-600 stroke-[2.5]" />
                        ) : (
                          <ArrowDown size={14} className="text-sky-600 stroke-[2.5]" />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenHeaderFilter(openHeaderFilter === 'BHYT' ? null : 'BHYT');
                      }}
                      className={`p-1 rounded-md transition-all flex items-center gap-0.5 cursor-pointer ${
                        insuranceFilter !== 'ALL'
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
                      }`}
                      title={`Lọc mức hưởng BHYT ${insuranceFilter !== 'ALL' ? `(Đang lọc: ${insuranceFilter})` : ''}`}
                    >
                      <Filter size={13} className={insuranceFilter !== 'ALL' ? 'text-white' : ''} />
                      {insuranceFilter !== 'ALL' && (
                        <span className="text-[10px] font-black">{insuranceFilter}</span>
                      )}
                    </button>

                    {openHeaderFilter === 'BHYT' && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-left font-normal"
                      >
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 px-1">
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Mức hưởng BHYT</span>
                          {insuranceFilter !== 'ALL' && (
                            <button
                              type="button"
                              onClick={() => {
                                setInsuranceFilter('ALL');
                                setOpenHeaderFilter(null);
                              }}
                              className="text-xs text-rose-500 hover:text-rose-600 font-bold"
                            >
                              Xóa lọc
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {[
                            { val: 'ALL', label: 'Tất cả mức hưởng', badge: null },
                            { val: '100%', label: '100%', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                            { val: '95%', label: '95%', badge: 'bg-lime-50 text-lime-700 border-lime-200' },
                            { val: '80%', label: '80%', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
                            { val: '0%', label: '0% (Không BHYT)', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
                          ].map(opt => {
                            const isSelected = insuranceFilter === opt.val;
                            return (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => {
                                  setInsuranceFilter(opt.val);
                                  setOpenHeaderFilter(null);
                                }}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                  isSelected ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {opt.badge ? (
                                    <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-black ${opt.badge}`}>
                                      {opt.label}
                                    </span>
                                  ) : (
                                    <span>{opt.label}</span>
                                  )}
                                </div>
                                {isSelected && <Check size={14} className="text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {renderSortHeader('ROOM', 'PHÒNG', 'center', false, 'w-20 text-center')}
              {renderSortHeader('BED', 'GIƯỜNG', 'center', false, 'w-20 text-center')}
              
              {/* Cột LOẠI GIƯỜNG với tính năng lọc loại giường & sắp xếp */}
              <th className={`p-3 select-none relative header-filter-container border-r border-slate-200 ${
                sortConfig?.field === 'BED_TYPE' ? 'bg-sky-50 text-sky-700 font-black' : 'text-slate-600'
              } w-36 text-center`}>
                <div className="flex items-center justify-center gap-1.5">
                  <div 
                    onClick={() => handleSort('BED_TYPE')}
                    className="flex items-center gap-1 cursor-pointer hover:text-slate-900 group"
                    title="Nhấn để sắp xếp theo loại giường"
                  >
                    <span className={`text-[11px] font-black tracking-[0.08em] ${sortConfig?.field === 'BED_TYPE' ? 'text-sky-700' : ''}`}>
                      LOẠI GIƯỜNG
                    </span>
                    <span className="inline-flex items-center shrink-0">
                      {sortConfig?.field === 'BED_TYPE' ? (
                        sortConfig.direction === 'ASC' ? (
                          <ArrowUp size={14} className="text-sky-600 stroke-[2.5]" />
                        ) : (
                          <ArrowDown size={14} className="text-sky-600 stroke-[2.5]" />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenHeaderFilter(openHeaderFilter === 'BED_TYPE' ? null : 'BED_TYPE');
                      }}
                      className={`p-1 rounded-md transition-all flex items-center gap-0.5 cursor-pointer ${
                        bedTypeFilter !== 'ALL'
                          ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-300'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
                      }`}
                      title={`Lọc loại giường ${bedTypeFilter !== 'ALL' ? `(Đang lọc: ${bedTypeFilter})` : ''}`}
                    >
                      <Filter size={13} className={bedTypeFilter !== 'ALL' ? 'text-white' : ''} />
                    </button>

                    {openHeaderFilter === 'BED_TYPE' && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-left font-normal"
                      >
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 px-1">
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Loại giường</span>
                          {bedTypeFilter !== 'ALL' && (
                            <button
                              type="button"
                              onClick={() => {
                                setBedTypeFilter('ALL');
                                setOpenHeaderFilter(null);
                              }}
                              className="text-xs text-rose-500 hover:text-rose-600 font-bold"
                            >
                              Xóa lọc
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {[
                            { val: 'ALL', label: 'Tất cả loại giường', badge: null },
                            { val: 'Nội trú', label: 'Nội trú', badge: 'bg-slate-50 text-slate-600 border-slate-200' },
                            { val: 'Nội trú ban ngày', label: 'Nội trú ban ngày', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
                            { val: 'Ngoại trú', label: 'Ngoại trú', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
                            { val: 'Khác', label: 'Khác', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
                          ].map(opt => {
                            const isSelected = bedTypeFilter === opt.val;
                            return (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => {
                                  setBedTypeFilter(opt.val);
                                  setOpenHeaderFilter(null);
                                }}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                  isSelected ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {opt.badge ? (
                                    <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-black ${opt.badge}`}>
                                      {opt.label}
                                    </span>
                                  ) : (
                                    <span>{opt.label}</span>
                                  )}
                                </div>
                                {isSelected && <Check size={14} className="text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              <th className="p-3.5 min-w-[260px] text-center text-[11px] font-black tracking-wider text-slate-600">{isSupportDept ? 'CHỈ ĐỊNH' : 'TÌNH TRẠNG GỬI KHÁM'}</th>
              {renderSortHeader('ADMISSION', 'VÀO VIỆN', 'center', false, 'w-44 text-center')}
              {renderSortHeader('DISCHARGE', 'RA VIỆN', 'center', false, 'w-44 text-center border-r border-slate-200')}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPatients.map((p, idx) => {
              const activeReferralForMe = p.referrals?.find(r => {
                const s = (r.specialty || '').toLowerCase();
                const dId = currentDept.id.toLowerCase();
                const dName = currentDept.name.toLowerCase();
                const isMatch = s === dId || s === dName || dName.includes(s) || s.includes(dName) ||
                                (s.includes('phcn') && dId.includes('phcn')) ||
                                (s.includes('cdha') && dId.includes('cdha')) ||
                                (s.includes('xetnghiem') && dId.includes('xetnghiem')) ||
                                (s.includes('duoc') && dId.includes('duoc')) ||
                                (dId === 'dept_phcn' && s === 'dept_phcn') ||
                                (dId === 'dept_cdha' && s === 'dept_cdha') ||
                                (dId === 'dept_xetnghiem' && s === 'dept_xetnghiem');
                return isMatch && r.status !== 'FINISHED';
              });
              const isOwner = p.admittedByDeptId === currentDept.id;
              const referringDept = DEPARTMENTS.find(d => d.id === p.admittedByDeptId);
              
              return (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="p-3 text-slate-500 text-center font-mono text-xs font-bold border-r border-slate-100">{idx + 1}</td>
                  
                  {/* Nhóm 1: Thông tin bệnh nhân */}
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black shadow-sm shrink-0 ${p.gender === 'Nam' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="font-black text-slate-800 text-[13.5px] leading-tight uppercase whitespace-nowrap" title={p.name}>{p.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl inline-block whitespace-nowrap ${p.gender === 'Nam' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                      {p.gender}
                    </span>
                  </td>
                  <td className="p-3 text-center border-r border-slate-100">
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl whitespace-nowrap inline-block">
                      {calculateAge(p.dob)} tuổi
                    </span>
                  </td>

                  {/* Nhóm 2: Thông tin điều trị & Buồng giường */}
                  <td className="p-3 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black text-slate-700 uppercase tracking-wider whitespace-nowrap shadow-xs">
                       <Building2 size={14} className="text-primary/70 shrink-0" />
                       <span className="whitespace-nowrap">{referringDept?.name || 'Chưa rõ'}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border shadow-xs w-fit whitespace-nowrap mx-auto ${
                      p.insuranceLevel === '0%' 
                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                        : p.insuranceLevel === '80%'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : p.insuranceLevel === '95%'
                        ? 'bg-lime-50 text-lime-700 border-lime-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      <Shield size={12} className="stroke-[2.5]" />
                      {p.insuranceLevel || '100%'}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-800 px-3 py-1.5 rounded-xl text-[11px] font-black border border-slate-200 shadow-xs w-fit whitespace-nowrap mx-auto">
                      <DoorOpen size={14} className="text-primary/70" /> 
                      <span>{p.roomNumber || '?'}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-800 px-3 py-1.5 rounded-xl text-[11px] font-black border border-slate-200 shadow-xs w-fit whitespace-nowrap mx-auto">
                      <Bed size={14} className="text-primary/70" /> 
                      <span>{p.bedNumber}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center border-r border-slate-100">
                    <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black border shadow-xs w-fit whitespace-nowrap mx-auto ${
                      p.bedType === 'Nội trú ban ngày' 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : p.bedType === 'Ngoại trú'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : p.bedType === 'Khác'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      {p.bedType || 'Nội trú'}
                    </div>
                  </td>

                  {/* Nhóm 3: Chỉ định / Gửi khám & Thời gian */}
                  <td className="p-3">
                    {isSupportDept ? (
                      <div className="flex flex-col gap-1.5 items-start">
                        {p.referrals?.filter(r => {
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
                        }).map((ref, idx) => {
                          if (currentDept.id === 'dept_cdha' || currentDept.id === 'dept_xetnghiem') {
                            const refProcIds = ref.procedureIds || [];
                            return (
                              <div key={idx} className="flex flex-wrap gap-2">
                                {refProcIds.map(procId => {
                                  const proc = procedures.find(pr => pr.id === procId);
                                  if (!proc) return null;
                                  const appt = appointments.find(a => a.patientId === p.id && a.procedureId === procId && a.date === activeDate);
                                  
                                  let badgeClass = "bg-slate-50 text-slate-600 border-slate-200";
                                  let statusText = "Chờ xếp lịch";
                                  let indicator = "bg-slate-400";

                                  if (appt) {
                                    badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                                    statusText = `Đã xếp lịch (${appt.startTime})`;
                                    indicator = "bg-amber-500";
                                  }

                                  return (
                                    <div key={procId} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-xs ${badgeClass}`}>
                                      <div className={`w-2 h-2 rounded-full ${indicator}`} />
                                      <span>{proc.name}</span>
                                      <span className="text-[10px] font-black opacity-70 bg-black/5 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{statusText}</span>
                                    </div>
                                  );
                                })}
                                {refProcIds.length === 0 && (
                                  <span className="text-xs text-slate-400 font-bold italic">Không có lịch trình chỉ định</span>
                                )}
                              </div>
                            );
                          } else {
                            const procNames = appointments
                              .filter(a => a.patientId === p.id && a.deptId === currentDept.id && a.date === activeDate)
                              .map(a => procedures.find(pr => pr.id === a.procedureId)?.name || 'Lịch trình');
                            return (
                              <div key={idx} className="flex flex-wrap gap-2 justify-center">
                                {procNames.length > 0 ? procNames.map((name, i) => (
                                  <div key={i} className="flex items-center gap-2.5 px-3.5 py-2 bg-blue-50/80 text-blue-700 border border-blue-100 rounded-xl text-xs font-bold w-fit shadow-xs hover:bg-blue-100 transition-all">
                                    <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black bg-blue-100 text-blue-600 shrink-0">{getAbbreviation(name)}</div>
                                    <span className="truncate max-w-[300px]">{name}</span>
                                  </div>
                                )) : (
                                  <span className="text-xs text-slate-400 font-bold italic">Chờ chỉ định lịch trình</span>
                                )}
                              </div>
                            );
                          }
                        })}
                        {!p.referrals?.some(r => {
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
                        }) && (
                          <span className="text-xs text-slate-400 font-bold italic">Không có gửi khám</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 min-w-[220px]">
                        {/* Hiển thị thẻ các chuyên khoa đã gửi khám cùng ngày giờ */}
                        {p.referrals && p.referrals.length > 0 && (
                          <div className="flex flex-wrap gap-2 items-center justify-center w-full">
                            {p.referrals.map((ref, rIdx) => {
                              const spec = referralSpecialties.find(s => s.id === ref.specialty);
                              const label = spec?.label || ref.specialty.replace('dept_', '').toUpperCase();
                              const icon = spec?.icon || <Activity size={13} />;
                              const badgeBg = spec?.badgeColor || 'bg-blue-50 text-blue-700 border-blue-200';
                              const dateTimeStr = formatReferralDateTime(ref);

                              return (
                                <div 
                                  key={rIdx} 
                                  className={`flex flex-col px-3 py-1.5 rounded-xl border shadow-xs text-left transition-all ${badgeBg} ${ref.status === 'FINISHED' ? 'opacity-70' : ''}`}
                                >
                                  <div className="flex items-center justify-between gap-2.5">
                                    <span className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wide">
                                      {icon}
                                      <span>{label}</span>
                                    </span>
                                    {ref.status === 'FINISHED' ? (
                                      <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Xong</span>
                                    ) : (
                                      p.admittedByDeptId === currentDept.id && (
                                        <button 
                                          onClick={(e) => { 
                                           e.stopPropagation(); 
                                           if (window.confirm(`Hủy gửi khám chuyên khoa ${label} cho bệnh nhân ${p.name}?`)) {
                                             onCancelReferral(p.id, ref.specialty); 
                                           }
                                         }} 
                                         className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded transition-colors"
                                         title="Hủy gửi khám"
                                       >
                                         <X size={12} />
                                       </button>
                                      )
                                    )}
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 mt-0.5 font-mono">
                                    <Clock size={11} className="text-slate-400 shrink-0" />
                                    <span>{dateTimeStr}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Nút bấm + Gửi khám chuyên khoa / + Gửi thêm */}
                        {p.status === 'TREATING' && p.admittedByDeptId === currentDept.id && (() => {
                          const unreferredSpecialties = referralSpecialties.filter(
                            s => !p.referrals?.some(r => r.specialty === s.id && r.status !== 'FINISHED')
                          );

                          if (unreferredSpecialties.length === 0) return null;

                          const isMenuOpen = openReferralMenuPatientId === p.id;
                          const hasReferrals = (p.referrals?.length || 0) > 0;

                          return (
                            <div className="relative inline-block text-center referral-menu-container">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenReferralMenuPatientId(isMenuOpen ? null : p.id);
                                }}
                                className={`px-3.5 py-1.5 rounded-xl font-extrabold transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer ${
                                  hasReferrals 
                                    ? 'bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 hover:border-sky-200 text-xs' 
                                    : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/20 shadow-md hover:scale-[1.02] text-xs'
                                }`}
                              >
                                <Plus size={hasReferrals ? 13 : 14} className="stroke-[2.5]" />
                                <span>{hasReferrals ? 'Gửi thêm chuyên khoa' : 'Gửi khám chuyên khoa'}</span>
                                <ChevronDown size={13} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {isMenuOpen && (
                                <div 
                                  className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                                    Chọn chuyên khoa gửi khám
                                  </div>
                                  <div className="space-y-0.5">
                                    {unreferredSpecialties.map(spec => (
                                      <button
                                        key={spec.id}
                                        onClick={() => {
                                          setOpenReferralMenuPatientId(null);
                                          onReferral(p.id, spec.id);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors text-left group"
                                      >
                                        <span className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-sky-100 text-slate-500 group-hover:text-sky-600 transition-colors">
                                          {spec.icon}
                                        </span>
                                        <div className="flex flex-col">
                                          <span className="font-extrabold text-xs leading-tight">{spec.label}</span>
                                          <span className="text-[10px] text-slate-400 font-normal leading-tight">{spec.fullName}</span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {(!p.referrals || p.referrals.length === 0) && (p.status !== 'TREATING' || p.admittedByDeptId !== currentDept.id) && (
                          <span className="text-xs font-bold text-slate-400 uppercase">Chưa gửi khám</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-xs whitespace-nowrap text-xs font-bold mx-auto">
                      <Clock size={13} className="text-emerald-500 shrink-0" />
                      <span>{new Date(p.admissionDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center border-r border-slate-100">
                    {p.dischargeDate ? (
                      <div className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 shadow-xs whitespace-nowrap text-xs font-bold mx-auto">
                        <Clock size={13} className="text-rose-500 shrink-0" />
                        <span>{new Date(p.dischargeDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 font-bold text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="relative inline-block text-center patient-actions-menu-container">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenActionsMenuPatientId(openActionsMenuPatientId === p.id ? null : p.id);
                        }}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shadow-xs mx-auto ${
                          openActionsMenuPatientId === p.id
                            ? 'bg-primary text-white border-primary shadow-primary/20 shadow-md'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-primary hover:border-primary/40 hover:bg-slate-50'
                        }`}
                        title="Công cụ quản lý hồ sơ"
                      >
                        <Wrench size={16} className={openActionsMenuPatientId === p.id ? 'stroke-[2.5]' : ''} />
                      </button>

                      {openActionsMenuPatientId === p.id && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-left font-normal"
                        >
                          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                            <span>Công cụ quản lý</span>
                            <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                          </div>

                          <div className="space-y-0.5">
                            {/* Sửa thông tin */}
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionsMenuPatientId(null);
                                  onEditPatient(p);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors text-left group"
                              >
                                <span className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-sky-100 text-slate-500 group-hover:text-sky-600 transition-colors">
                                  <Edit3 size={14} />
                                </span>
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-[11px] leading-tight">Sửa thông tin</span>
                                  <span className="text-[9px] text-slate-400 font-normal leading-tight">Cập nhật hồ sơ bệnh nhân</span>
                                </div>
                              </button>
                            )}

                            {/* In chỉ định */}
                            {!isSupportDept && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionsMenuPatientId(null);
                                  setPrintingPatient(p);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left group"
                              >
                                <span className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 transition-colors">
                                  <Printer size={14} />
                                </span>
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-[11px] leading-tight">In chỉ định</span>
                                  <span className="text-[9px] text-slate-400 font-normal leading-tight">Xuất phiếu chỉ định khám</span>
                                </div>
                              </button>
                            )}

                            {/* Ra viện / Sửa giờ ra viện */}
                            {!isSupportDept && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionsMenuPatientId(null);
                                  setDischargingPatient(p);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors text-left group"
                              >
                                <span className={`p-1.5 rounded-lg text-slate-500 transition-colors ${
                                  p.status === 'DISCHARGED' 
                                    ? 'bg-rose-100 text-rose-600 group-hover:bg-rose-200' 
                                    : 'bg-slate-100 group-hover:bg-amber-100 group-hover:text-amber-600'
                                }`}>
                                  <LogOut size={14} />
                                </span>
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-[11px] leading-tight">
                                    {p.status === 'DISCHARGED' ? 'Sửa giờ ra viện' : 'Cho ra viện'}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-normal leading-tight">
                                    {p.status === 'DISCHARGED' ? 'Cập nhật thời gian ra viện' : 'Hoàn tất điều trị nội trú'}
                                  </span>
                                </div>
                              </button>
                            )}

                            {/* Hủy ra viện */}
                            {!isSupportDept && p.status === PatientStatus.DISCHARGED && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionsMenuPatientId(null);
                                  if (window.confirm(`Bạn có chắc chắn muốn hủy ra viện cho bệnh nhân ${p.name} không?`)) {
                                    onUpdateStatus(p, PatientStatus.TREATING);
                                  }
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left group"
                              >
                                <span className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-emerald-100 text-slate-500 group-hover:text-emerald-600 transition-colors">
                                  <RotateCcw size={14} />
                                </span>
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-[11px] leading-tight">Hủy ra viện</span>
                                  <span className="text-[9px] text-slate-400 font-normal leading-tight">Chuyển về đang điều trị</span>
                                </div>
                              </button>
                            )}

                            {/* Kết thúc khám (khoa cận lâm sàng / hỗ trợ) */}
                            {isSupportDept && activeReferralForMe && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionsMenuPatientId(null);
                                  setFinishingReferral({ patient: p, specialty: activeReferralForMe.specialty });
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors text-left group"
                              >
                                <span className="p-1.5 rounded-lg bg-rose-100 text-rose-600 group-hover:bg-rose-200 transition-colors">
                                  <Power size={14} />
                                </span>
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-[11px] leading-tight">Kết thúc khám</span>
                                  <span className="text-[9px] text-slate-400 font-normal leading-tight">Hoàn tất chỉ định gửi khám</span>
                                </div>
                              </button>
                            )}

                            {/* Xóa hồ sơ */}
                            {!isSupportDept && (
                              <>
                                <div className="my-1 border-t border-slate-100" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionsMenuPatientId(null);
                                    const isAdmin = currentUser?.role === UserRole.ADMIN;
                                    const hasAppointments = appointments.some(a => a.patientId === p.id);
                                    if (!isAdmin && hasAppointments) {
                                      alert("Không thể xóa bệnh nhân này vì vẫn còn thủ thuật. Vui lòng xóa toàn bộ thủ thuật của bệnh nhân trước khi xóa hồ sơ.");
                                    } else {
                                      setDeletingPatient(p);
                                    }
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left group"
                                >
                                  <span className="p-1.5 rounded-lg bg-rose-100/60 text-rose-500 group-hover:bg-rose-200/80 group-hover:text-rose-600 transition-colors">
                                    <Trash2 size={14} />
                                  </span>
                                  <div className="flex flex-col">
                                    <span className="font-extrabold text-[11px] leading-tight">Xóa hồ sơ</span>
                                    <span className="text-[9px] text-rose-400 font-normal leading-tight">
                                      {currentUser?.role === UserRole.ADMIN ? 'Quản trị: Xóa kèm thủ thuật' : 'Xóa vĩnh viễn khỏi danh sách'}
                                    </span>
                                  </div>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredPatients.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4 text-slate-300">
             <Search size={48} className="opacity-10" />
             <p className="font-black text-xs uppercase tracking-widest">Không tìm thấy bệnh nhân nào</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPatient && (() => {
        const isAdmin = currentUser?.role === UserRole.ADMIN;
        const patientApptCount = appointments.filter(a => a.patientId === deletingPatient.id).length;

        return (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center space-y-5">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center shadow-inner">
                  <Trash2 size={32} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">XÓA HỒ SƠ BỆNH NHÂN</h3>
                  <p className="text-sm text-slate-500 font-bold">
                    Bệnh nhân: <span className="text-slate-800 font-black">{deletingPatient.name}</span> {deletingPatient.bedNumber ? `(Giường ${deletingPatient.bedNumber})` : ''}
                  </p>
                </div>

                {isAdmin && patientApptCount > 0 ? (
                  <div className="w-full bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-left">
                    <AlertTriangle size={22} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-black text-amber-800 uppercase tracking-tight">
                        Tài khoản Quản trị: Tự động xóa {patientApptCount} thủ thuật
                      </p>
                      <p className="text-[12px] text-amber-700 font-medium leading-relaxed">
                        Bệnh nhân hiện đang có <strong className="font-black text-amber-900">{patientApptCount}</strong> thủ thuật. Vì bạn đang đăng nhập bằng tài khoản quản trị, hệ thống sẽ <strong className="font-black text-rose-700">tự động xóa toàn bộ các thủ thuật này</strong> cùng với hồ sơ bệnh nhân.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3 text-left">
                    <AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-rose-600 font-bold leading-relaxed uppercase">
                      Hành động này sẽ xóa vĩnh viễn hồ sơ bệnh nhân khỏi danh sách. Không thể hoàn tác!
                    </p>
                  </div>
                )}

                <div className="flex gap-3 w-full pt-2">
                  <button 
                    type="button"
                    onClick={() => setDeletingPatient(null)} 
                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs"
                  >
                    HỦY
                  </button>
                  <button 
                    type="button"
                    onClick={handleConfirmDelete} 
                    className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-rose-200 uppercase tracking-widest text-xs flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={16} />
                    <span>XÓA NGAY</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Discharge Confirmation Modal */}
      {dischargingPatient && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-2">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {dischargingPatient.status === 'DISCHARGED' ? 'CẬP NHẬT GIỜ RA VIỆN' : 'XÁC NHẬN RA VIỆN'}
              </h3>
              <p className="text-sm text-slate-500 font-bold">Bệnh nhân: <span className="text-slate-800">{dischargingPatient.name}</span></p>
              
              <div className="w-full space-y-4 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} /> Ngày ra viện
                    </label>
                    <DateInput 
                      className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-rose-400 outline-none transition-all"
                      value={dischargeDateInput.split('T')[0] || ''}
                      onChange={val => {
                        const time = dischargeDateInput.split('T')[1] || '00:00';
                        setDischargeDateInput(`${val}T${time}`);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={12} /> Giờ ra viện
                    </label>
                    <TimeInput 
                      className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-rose-400 outline-none transition-all"
                      value={dischargeDateInput.split('T')[1] || ''}
                      onChange={val => {
                        const date = dischargeDateInput.split('T')[0] || new Date().toISOString().split('T')[0];
                        setDischargeDateInput(`${date}T${val}`);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full pt-4">
                <Button onClick={() => setDischargingPatient(null)} variant="secondary" className="flex-1">HỦY</Button>
                <Button onClick={handleConfirmDischarge} className="flex-1 bg-rose-600 hover:bg-rose-700">
                  {dischargingPatient.status === 'DISCHARGED' ? 'CẬP NHẬT' : 'RA VIỆN'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finish Referral Modal */}
      {finishingReferral && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                <CheckSquare size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">
                KẾT THÚC KHÁM<br/>
                <span className="text-primary">{finishingReferral.specialty}</span>
              </h3>
              <p className="text-xs text-slate-500 font-bold -mt-4">BN: {finishingReferral.patient.name}</p>

              <div className="flex gap-4 w-full pt-2">
                <button onClick={() => setFinishingReferral(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs">HỦY</button>
                <button onClick={handleConfirmFinishReferral} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-200 uppercase tracking-widest text-xs">XÁC NHẬN</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Print Modal */}
      {printingPatient && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                <Printer size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">IN CHỈ ĐỊNH</h3>
                <p className="text-sm text-slate-500 font-bold">Bệnh nhân: <span className="text-slate-800">{printingPatient.name}</span></p>
              </div>
              
              <div className="w-full space-y-4 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} /> Từ ngày
                    </label>
                    <DateInput 
                      className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-indigo-400 outline-none"
                      value={printFromDate}
                      onChange={val => setPrintFromDate(val)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} /> Đến ngày
                    </label>
                    <DateInput 
                      className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-indigo-400 outline-none"
                      value={printToDate}
                      onChange={val => setPrintToDate(val)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Filter size={12} /> Khoa thực hiện
                  </label>
                  <select 
                    className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-indigo-400 outline-none"
                    value={printDeptId}
                    onChange={e => setPrintDeptId(e.target.value)}
                  >
                    <option value="ALL">Tất cả các khoa</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 w-full pt-4">
                <button onClick={() => setPrintingPatient(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs">HỦY</button>
                <button onClick={executePrint} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                  <Printer size={16} /> IN NGAY
                </button>
                <button onClick={handleExportCSVPatient} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                  <FileText size={16} /> XUẤT CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvImportModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl p-6 sm:p-8 w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] ${
            csvPatients.length === 0 ? 'max-w-xl' : 'max-w-[95vw] 2xl:max-w-7xl'
          }`}>
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Upload size={22} className="text-primary" /> Nhập danh sách bệnh nhân từ CSV
              </h3>
              <button 
                onClick={() => { setIsCsvImportModalOpen(false); setCsvPatients([]); }}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto min-h-0 space-y-6 scrollbar-thin pr-1">
              {csvPatients.length === 0 ? (
                <div 
                  className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-4 transition-all ${
                    dragActive ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
                    <Upload size={24} />
                  </div>
                  
                  <p className="text-sm font-bold text-slate-700">Kéo thả file CSV vào đây</p>

                  <label className="cursor-pointer bg-primary text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 transition-all">
                    Chọn file từ máy tính
                    <input 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      onChange={handleFileChange} 
                    />
                  </label>
                  
                  <div className="border-t border-slate-100 w-full pt-4 mt-2 flex flex-col items-center">
                    <button 
                      type="button"
                      onClick={downloadSampleCSV}
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline py-1 px-3 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      <Download size={14} /> Tải file CSV mẫu
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm self-start">
                        Đã tải lên: <strong className="text-slate-800">{csvPatients.length} bệnh nhân</strong>
                      </span>
                      {hasAnyBedConflict && (
                        <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-bounce">
                          <AlertTriangle size={14} /> Trùng số giường! Vui lòng chỉnh sửa giường bị đỏ trước khi nhập.
                        </span>
                      )}
                      {hasAnyInvalidDate && (
                        <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-bounce">
                          <AlertTriangle size={14} /> Sai định dạng ngày! Định dạng bắt buộc là dd/mm/yyyy (Ví dụ: 14/07/2026).
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={downloadSampleCSV}
                      className="text-xs text-primary font-black flex items-center gap-1.5 hover:underline bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm"
                    >
                      <Download size={14} /> TẢI FILE CSV MẪU
                    </button>
                  </div>

                  <div className="border border-slate-100 rounded-2xl overflow-auto max-h-[55vh] shadow-inner scrollbar-thin">
                    <table className="min-w-[1350px] w-full text-sm text-left border-collapse table-fixed">
                      <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-20 text-[11px] uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="p-3 w-[50px] text-center">STT</th>
                          <th className="p-3 w-[150px]">Ngày vào viện</th>
                          <th className="p-3 w-[100px]">Giờ vào</th>
                          <th className="p-3 w-[220px]">Họ tên bệnh nhân</th>
                          <th className="p-3 w-[110px]">Giới tính</th>
                          <th className="p-3 w-[100px]">Năm sinh</th>
                          <th className="p-3 w-[100px] text-center">Số giường</th>
                          <th className="p-3 w-[160px]">Loại giường</th>
                          <th className="p-3 w-[110px]">Mức BHYT</th>
                          <th className="p-3 min-w-[180px]">Ghi chú</th>
                          <th className="p-3 w-[140px] text-center">Trạng thái</th>
                          <th className="p-3 w-[60px] text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validatedCsvPatients.map((item, index) => (
                          <tr key={item.tempId} className="hover:bg-slate-50/50">
                            <td className="p-3 text-center text-xs font-mono text-slate-400">{index + 1}</td>
                            <td className="p-3">
                              <input 
                                type="text" 
                                placeholder="dd/mm/yyyy"
                                value={item.admissionDate} 
                                onChange={e => updateCsvField(index, 'admissionDate', e.target.value)}
                                className={`w-full text-sm p-2 border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none font-bold text-center ${!item.isDateValid ? 'border-rose-400 bg-rose-50 text-rose-700 font-extrabold shadow-sm' : 'border-slate-200 bg-white text-slate-800'}`}
                              />
                            </td>
                            <td className="p-3">
                              <input 
                                type="text" 
                                placeholder="08:00"
                                value={item.admissionTime} 
                                onChange={e => updateCsvField(index, 'admissionTime', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-200 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none font-mono text-center text-slate-800 font-bold"
                              />
                            </td>
                            <td className="p-3">
                              <input 
                                type="text" 
                                value={item.name} 
                                onChange={e => updateCsvField(index, 'name', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-200 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none uppercase font-black text-slate-800"
                              />
                            </td>
                            <td className="p-3">
                              <select 
                                value={item.gender} 
                                onChange={e => updateCsvField(index, 'gender', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-200 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none font-bold bg-white text-slate-800"
                              >
                                <option value="Nam">Nam</option>
                                <option value="Nữ">Nữ</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <input 
                                type="number" 
                                value={item.yob} 
                                onChange={e => updateCsvField(index, 'yob', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-200 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none font-mono text-center font-bold text-slate-800"
                              />
                            </td>
                            <td className="p-3">
                              <input 
                                type="text" 
                                value={item.bedNumber} 
                                onChange={e => updateCsvField(index, 'bedNumber', e.target.value)}
                                className={`w-full text-sm p-2 border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none font-bold text-center ${item.hasBedConflict ? 'border-rose-400 bg-rose-50 text-rose-700 font-extrabold shadow-sm' : 'border-slate-200 bg-white text-slate-800'}`}
                              />
                            </td>
                            <td className="p-3">
                              <select 
                                value={item.bedType} 
                                onChange={e => updateCsvField(index, 'bedType', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-200 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none font-bold bg-white text-slate-800"
                              >
                                <option value="Nội trú">Nội trú</option>
                                <option value="Nội trú ban ngày">Nội trú ban ngày</option>
                                <option value="Ngoại trú">Ngoại trú</option>
                                <option value="Khác">Khác</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <select 
                                value={item.insuranceLevel} 
                                onChange={e => updateCsvField(index, 'insuranceLevel', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-200 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none font-bold bg-white text-slate-800"
                              >
                                <option value="100%">100%</option>
                                <option value="95%">95%</option>
                                <option value="80%">80%</option>
                                <option value="0%">0%</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <input 
                                type="text" 
                                value={item.note} 
                                onChange={e => updateCsvField(index, 'note', e.target.value)}
                                className="w-full text-sm p-2 border border-slate-200 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-slate-800"
                              />
                            </td>
                            <td className="p-3 text-center">
                              {!item.isDateValid && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 border border-rose-200 text-rose-700 font-bold px-2 py-1 rounded-lg shadow-sm cursor-help" title="Sai định dạng ngày, vui lòng dùng dd/mm/yyyy (ví dụ: 14/07/2026)">
                                  <AlertTriangle size={10} className="shrink-0 text-rose-500" /> SAI ĐỊNH DẠNG NGÀY
                                </span>
                              )}
                              {item.isDateValid && item.hasBedConflict && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 border border-rose-200 text-rose-700 font-bold px-2 py-1 rounded-lg shadow-sm cursor-help" title={item.isBedOccupied ? "Giường đang có bệnh nhân điều trị trong khoa" : "Trùng số giường trong danh sách tải lên"}>
                                  <AlertTriangle size={10} className="shrink-0 text-rose-500" /> TRÙNG GIƯỜNG
                                </span>
                              )}
                              {item.isDateValid && !item.hasBedConflict && item.hasNameWarning && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-bold px-2 py-1 rounded-lg shadow-sm cursor-help" title="Có bệnh nhân trùng cả Họ tên, Giới tính & Năm sinh đang điều trị tại khoa">
                                  <AlertTriangle size={10} className="shrink-0 text-amber-500" /> TRÙNG TÊN/TUỔI
                                </span>
                              )}
                              {item.isDateValid && !item.hasBedConflict && !item.hasNameWarning && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-lg shadow-sm">
                                  HỢP LỆ
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => {
                                  setCsvPatients(prev => prev.filter((_, idx) => idx !== index));
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all"
                                title="Xóa dòng này"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-100">
              {csvPatients.length > 0 ? (
                <button 
                  onClick={() => setCsvPatients([])}
                  className="px-6 py-3 text-slate-500 hover:bg-slate-100 font-black rounded-xl text-xs transition-all uppercase tracking-wider"
                >
                  Xóa danh sách & Tải file khác
                </button>
              ) : (
                <div></div>
              )}
              
              <div className="flex gap-3">
                <Button 
                  onClick={() => { setIsCsvImportModalOpen(false); setCsvPatients([]); }} 
                  variant="secondary"
                  className="px-6"
                >
                  HỦY
                </Button>
                {csvPatients.length > 0 && (
                  <Button 
                    onClick={handleConfirmImport} 
                    disabled={hasAnyBedConflict || hasAnyInvalidDate || validatedCsvPatients.length === 0}
                    className={`px-8 font-black ${hasAnyBedConflict || hasAnyInvalidDate ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}
                  >
                    XÁC NHẬN NHẬP
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
