
import React, { useState, useEffect, useMemo } from 'react';
import { Patient, PatientStatus, Department, DepartmentType, BedType, InsuranceLevel } from '../types';
import { Button } from './Button';
import { DateTimePicker } from './DateTimePicker';
import { TimeInput } from './TimeInput';
import { Search, Plus, User, MapPin, Bed, LogOut, FileText, Edit3, Printer, Send, Activity, FlaskConical, HeartPulse, CheckCircle2, Clock, Building2, Filter, Calendar, CheckSquare, Trash2, AlertTriangle, Power, CheckCircle, RotateCcw, X, XCircle, Pill, ChevronDown, DoorOpen, Download, Shield, Upload } from 'lucide-react';
import { calculateAge, getAbbreviation, timeStringToMinutes, generatePatientCode } from '../utils/timeUtils';
import { DEPARTMENTS } from '../constants';
import { Appointment, Procedure, Staff } from '../types';
import { downloadCSV, parseCSV } from '../utils/csvUtils';
import { db } from '../firebase';
import { collection, doc } from 'firebase/firestore';
import { setDoc } from '../utils/dbService';


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

type SortField = 'NAME' | 'ROOM' | 'BED' | 'ADMISSION';
type SortDirection = 'ASC' | 'DESC';
interface SortConfig { field: SortField; direction: SortDirection }

interface PatientListProps {
  patients: Patient[];
  activeDate: string;
  currentDept: Department;
  appointments: Appointment[];
  procedures: Procedure[];
  staff: Staff[];
  onAddPatient: () => void;
  onEditPatient: (p: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  onUpdateStatus: (patient: Patient, status: PatientStatus, dischargeDate?: string) => void;
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
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'TREATING' | 'DISCHARGED'>('ALL');
  const [bedTypeFilter, setBedTypeFilter] = useState<string>('ALL');
  const [referringDeptFilter, setReferringDeptFilter] = useState<string>('ALL');
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([{ field: 'ADMISSION', direction: 'ASC' }]);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
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
  const [csvPatients, setCsvPatients] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);

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

  const filteredPatients = patients.filter(p => {
    // Bệnh nhân chưa vào viện vào thời điểm activeDate
    const admissionDateStr = getLocalDateString(p.admissionDate);
    if (activeDate < admissionDateStr) return false;

    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.code || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    const matchesBedType = bedTypeFilter === 'ALL' || (p.bedType || 'Nội trú') === bedTypeFilter;

    let isVisible = false;
    if (currentDept.type === DepartmentType.CLINICAL) {
        isVisible = p.admittedByDeptId === currentDept.id;
    } else {
        if (p.admittedByDeptId === currentDept.id) {
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
                if (r.status === 'FINISHED' && r.finishedDate && activeDate > r.finishedDate) return false;
                return true;
            }) ?? false;
        }
    }

    const matchesDeptFilter = referringDeptFilter === 'ALL' || p.admittedByDeptId === referringDeptFilter;

    return matchesSearch && matchesStatus && isVisible && matchesDeptFilter && matchesBedType;
  }).sort((a, b) => {
    const getFirstName = (fullName: string) => {
      const parts = fullName.trim().split(/\s+/);
      return parts[parts.length - 1] || '';
    };

    for (const config of sortConfigs) {
      let cmp = 0;
      if (config.field === 'NAME') {
        const firstNameA = getFirstName(a.name);
        const firstNameB = getFirstName(b.name);
        cmp = firstNameA.localeCompare(firstNameB, 'vi');
        if (cmp === 0) {
          cmp = a.name.localeCompare(b.name, 'vi');
        }
      } else if (config.field === 'ROOM') {
        const roomA = a.roomNumber || '';
        const roomB = b.roomNumber || '';
        cmp = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (config.field === 'BED') {
        const bedA = a.bedNumber || '';
        const bedB = b.bedNumber || '';
        cmp = bedA.localeCompare(bedB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (config.field === 'ADMISSION') {
        cmp = new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime();
      }
      if (cmp !== 0) {
        return config.direction === 'ASC' ? cmp : -cmp;
      }
    }
    return 0;
  });

  const handleConfirmDischarge = () => {
    if (dischargingPatient) {
      onUpdateStatus(dischargingPatient, PatientStatus.DISCHARGED, dischargeDateInput);
      setDischargingPatient(null);
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
          <h1>PHIẾU CHỈ ĐỊNH THỦ THUẬT</h1>
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
                <th>Tên thủ thuật</th>
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
        procedure: proc?.name || 'Thủ thuật đã xóa',
        staff: staffStr,
        dept: performingDept?.name || 'Không rõ'
      };
    });

    const headers = [
      { label: 'STT', key: 'stt' },
      { label: 'Ngày thực hiện', key: 'date' },
      { label: 'Giờ thực hiện', key: 'time' },
      { label: 'Thời lượng', key: 'duration' },
      { label: 'Tên thủ thuật', key: 'procedure' },
      { label: 'Người thực hiện', key: 'staff' },
      { label: 'Khoa thực hiện', key: 'dept' }
    ];

    downloadCSV(csvData, `Chi_Dinh_${printingPatient.name}_${printFromDate}_${printToDate}.csv`, headers);
    setPrintingPatient(null);
  };

  const referralSpecialties = [
    { id: 'dept_phcn', label: 'PHCN', icon: <Activity size={12} /> },
    { id: 'dept_xetnghiem', label: 'Xét nghiệm', icon: <FlaskConical size={12} /> },
    { id: 'dept_cdha', label: 'CDHA', icon: <HeartPulse size={12} /> },
    { id: 'dept_duoc', label: 'Dược', icon: <Pill size={12} /> }
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 bg-slate-50/50">
        <div className="flex items-center gap-4">
           <div className="flex bg-slate-200 rounded-lg p-1 shrink-0">
              <button onClick={() => setFilterStatus('ALL')} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all uppercase tracking-wider ${filterStatus === 'ALL' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tất cả</button>
               <button onClick={() => setFilterStatus('TREATING')} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all uppercase tracking-wider ${filterStatus === 'TREATING' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Đang điều trị</button>
              <button onClick={() => setFilterStatus('DISCHARGED')} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all uppercase tracking-wider ${filterStatus === 'DISCHARGED' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Ra viện</button>
           </div>
           
           {isSupportDept && (
             <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
               <Filter size={14} className="text-slate-400" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Từ khoa:</span>
               <select className="text-xs font-bold bg-transparent outline-none cursor-pointer" value={referringDeptFilter} onChange={e => setReferringDeptFilter(e.target.value)}>
                  <option value="ALL">Tất cả khoa lâm sàng</option>
                  <option value="dept_ngoai">Khoa Ngoại</option>
                  <option value="dept_noi">Khoa Nội</option>
                  <option value="dept_chamcuu">Khoa Châm cứu</option>
               </select>
             </div>
           )}

           <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
             <Bed size={14} className="text-slate-400" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Loại giường:</span>
             <select className="text-xs font-bold bg-transparent outline-none cursor-pointer" value={bedTypeFilter} onChange={e => setBedTypeFilter(e.target.value)}>
                <option value="ALL">Tất cả</option>
                <option value="Nội trú">Nội trú</option>
                <option value="Nội trú ban ngày">Nội trú ban ngày</option>
                <option value="Ngoại trú">Ngoại trú</option>
                <option value="Khác">Khác</option>
             </select>
           </div>
        </div>

        <div className="flex-1 max-md:hidden max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-100 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none text-sm font-bold transition-all" placeholder="Tìm tên, mã BN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        <div className="relative">
          <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm hover:bg-slate-50 transition-all">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sắp xếp {sortConfigs.length > 0 ? `(${sortConfigs.length})` : ''}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          
          {isSortMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 flex flex-col gap-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Điều kiện sắp xếp</span>
                <button onClick={() => setIsSortMenuOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
              </div>
              
              {sortConfigs.length === 0 && (
                <p className="text-xs text-slate-400 font-bold text-center py-2">Chưa có điều kiện sắp xếp (Mặc định)</p>
              )}

              {sortConfigs.map((config, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select 
                    className="flex-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-primary"
                    value={config.field}
                    onChange={e => {
                      const newConfigs = [...sortConfigs];
                      newConfigs[idx].field = e.target.value as SortField;
                      setSortConfigs(newConfigs);
                    }}
                  >
                    <option value="NAME">Tên bệnh nhân</option>
                    <option value="ROOM">Phòng</option>
                    <option value="BED">Giường</option>
                    <option value="ADMISSION">Thời gian vào viện</option>
                  </select>
                  
                  <button 
                    onClick={() => {
                      const newConfigs = [...sortConfigs];
                      newConfigs[idx].direction = config.direction === 'ASC' ? 'DESC' : 'ASC';
                      setSortConfigs(newConfigs);
                    }}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-[10px] w-14 text-center uppercase"
                    title="Đổi chiều sắp xếp"
                  >
                    {config.direction === 'ASC' ? 'Tăng' : 'Giảm'}
                  </button>
                  
                  <button 
                    onClick={() => {
                      const newConfigs = sortConfigs.filter((_, i) => i !== idx);
                      setSortConfigs(newConfigs);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"
                    title="Xóa điều kiện này"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              {sortConfigs.length < 4 && (
                <button 
                  onClick={() => {
                    const usedFields = sortConfigs.map(c => c.field);
                    const availableFields: SortField[] = ['NAME', 'ROOM', 'BED', 'ADMISSION'];
                    const nextField = availableFields.find(f => !usedFields.includes(f)) || 'NAME';
                    setSortConfigs([...sortConfigs, { field: nextField, direction: 'ASC' }]);
                  }}
                  className="flex items-center justify-center gap-1 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all mt-1"
                >
                  <Plus size={14} /> Thêm điều kiện
                </button>
              )}
            </div>
          )}
        </div>

        {!isSupportDept && (
          <div className="flex items-center gap-2">
            <Button onClick={() => { setCsvPatients([]); setIsCsvImportModalOpen(true); }} variant="secondary" className="border border-slate-200">
              <Upload size={18} /> Nhập từ file CSV
            </Button>
            <Button onClick={onAddPatient} className="shadow-lg shadow-primary/10">
              <Plus size={18} /> BN vào khoa mới
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-black sticky top-0 z-20 text-[10px] uppercase tracking-[0.1em] border-b border-slate-200">
            <tr>
              <th className="p-4 w-12 text-center">STT</th>
              <th className="p-4 min-w-[200px]">THÔNG TIN BỆNH NHÂN</th>
              <th className="p-4 w-24 text-center">GIỚI TÍNH</th>
              <th className="p-4 w-24 text-center">TUỔI</th>
              <th className="p-4 w-48 text-center">{isSupportDept ? 'KHOA GỬI KHÁM' : 'KHOA ĐIỀU TRỊ'}</th>
              <th className="p-4 w-24 text-center">BHYT</th>
              <th className="p-4 w-24 text-center">PHÒNG</th>
              <th className="p-4 w-24 text-center">GIƯỜNG</th>
              <th className="p-4 w-32 text-center">LOẠI GIƯỜNG</th>
              <th className="p-4 w-[320px] text-center">{isSupportDept ? 'CHỈ ĐỊNH' : 'TÌNH TRẠNG GỬI KHÁM'}</th>
              <th className="p-4 w-48 text-center">{isSupportDept ? 'GIỜ VÀO VIỆN' : 'THỜI GIAN'}</th>
              <th className="p-4 w-32 text-center">QUẢN LÝ</th>
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
                  <td className="p-4 text-slate-400 text-center font-mono text-xs">{idx + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black shadow-sm ${p.gender === 'Nam' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <div className="font-black text-slate-800 text-sm leading-tight uppercase">{p.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${p.gender === 'Nam' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                      {p.gender}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg whitespace-nowrap">
                      {calculateAge(p.dob)} tuổi
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap shadow-sm">
                       <Building2 size={14} className="text-primary/60" />
                       {referringDept?.name || 'Chưa rõ'}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border shadow-sm w-fit whitespace-nowrap mx-auto ${
                      p.insuranceLevel === '0%' 
                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                        : p.insuranceLevel === '80%'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : p.insuranceLevel === '95%'
                        ? 'bg-lime-50 text-lime-700 border-lime-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      <Shield size={10} />
                      {p.insuranceLevel || '100%'}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black border border-slate-200 shadow-sm w-fit whitespace-nowrap mx-auto">
                      <DoorOpen size={14} className="text-primary/60" /> 
                      <span>{p.roomNumber || '?'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black border border-slate-200 shadow-sm w-fit whitespace-nowrap mx-auto">
                      <Bed size={14} className="text-primary/60" /> 
                      <span>{p.bedNumber}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border shadow-sm w-fit whitespace-nowrap mx-auto ${
                      p.bedType === 'Nội trú ban ngày' 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : p.bedType === 'Ngoại trú'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : p.bedType === 'Khác'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {p.bedType || 'Nội trú'}
                    </div>
                  </td>
                  <td className="p-4">
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
                                  
                                  let badgeClass = "bg-slate-50 text-slate-500 border-slate-200";
                                  let statusText = "Chờ xếp lịch";
                                  let indicator = "bg-slate-400";

                                  if (appt) {
                                    if (appt.status === 'COMPLETED') {
                                      badgeClass = "bg-emerald-50 text-emerald-750 border-emerald-200";
                                      statusText = `Đã thực hiện (${appt.endTime})`;
                                      indicator = "bg-emerald-500";
                                    } else {
                                      badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                                      statusText = `Đã xếp lịch (${appt.startTime})`;
                                      indicator = "bg-amber-500";
                                    }
                                  }

                                  return (
                                    <div key={procId} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-sm ${badgeClass}`}>
                                      <div className={`w-1.5 h-1.5 rounded-full ${indicator}`} />
                                      <span>{proc.name}</span>
                                      <span className="text-[9px] font-black opacity-60 bg-black/5 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{statusText}</span>
                                    </div>
                                  );
                                })}
                                {refProcIds.length === 0 && (
                                  <span className="text-[10px] text-slate-400 font-bold italic">Không có thủ thuật chỉ định</span>
                                )}
                              </div>
                            );
                          } else {
                            const procNames = appointments
                              .filter(a => a.patientId === p.id && a.deptId === currentDept.id && a.date === activeDate)
                              .map(a => procedures.find(pr => pr.id === a.procedureId)?.name || 'Thủ thuật');
                            return (
                              <div key={idx} className="flex flex-wrap gap-2 justify-center">
                                {procNames.length > 0 ? procNames.map((name, i) => (
                                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-blue-50/80 text-blue-700 border border-blue-100 rounded-xl text-xs font-bold w-fit shadow-sm hover:bg-blue-100 transition-all">
                                    <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black bg-blue-100 text-blue-600 shrink-0">{getAbbreviation(name)}</div>
                                    <span className="truncate max-w-[300px]">{name}</span>
                                  </div>
                                )) : (
                                  <span className="text-[10px] text-slate-400 font-bold italic">Chờ chỉ định thủ thuật</span>
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
                          <span className="text-[10px] text-slate-400 font-bold italic">Không có gửi khám</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        {p.referrals && p.referrals.length > 0 ? (
                          <div className="flex flex-wrap gap-2 items-center justify-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Đã gửi khám:</span>
                            {p.referrals.map((ref, rIdx) => (
                              <div key={rIdx} className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 border border-blue-100">
                                {referralSpecialties.find(s => s.id === ref.specialty)?.label || ref.specialty.replace('dept_', '')}
                                {p.admittedByDeptId === currentDept.id && (
                                  <button onClick={(e) => { e.stopPropagation(); onCancelReferral(p.id, ref.specialty); }} className="ml-1 hover:text-rose-500"><X size={10} /></button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Chưa gửi khám</span>
                        )}
                        
                        {p.status === 'TREATING' && p.admittedByDeptId === currentDept.id && (
                          <div className="flex justify-center gap-2 mt-1 w-full">
                            {referralSpecialties.filter(s => !p.referrals?.some(r => r.specialty === s.id && r.status !== 'FINISHED')).map(s => (
                              <button key={s.id} onClick={() => onReferral(p.id, s.id)} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black text-slate-500 hover:text-primary hover:border-primary transition-all flex items-center gap-1">{s.icon} {s.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col gap-1.5 text-[10px] font-bold items-center">
                      <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm whitespace-nowrap">
                        <Clock size={14} className="text-emerald-500" />
                        <span>Vào: {new Date(p.admissionDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })}</span>
                      </div>
                      {p.dischargeDate && (
                        <div className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 shadow-sm whitespace-nowrap">
                          <Clock size={14} className="text-rose-500" />
                          <span>Ra: {new Date(p.dischargeDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      {isOwner ? (
                          <button onClick={() => onEditPatient(p)} className="p-2.5 bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-primary rounded-xl transition-all" title="Sửa hồ sơ"><Edit3 size={16} /></button>
                      ) : (
                          isSupportDept && activeReferralForMe && (
                            <button 
                                onClick={() => setFinishingReferral({ patient: p, specialty: activeReferralForMe.specialty })} 
                                className="p-2.5 bg-rose-50 border border-rose-100 shadow-sm text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center gap-2" 
                                title="Kết thúc khám chuyên khoa"
                            >
                                <Power size={18} />
                                <span className="hidden group-hover:block text-[10px] font-black uppercase">Kết thúc</span>
                            </button>
                          )
                      )}
                      
                      {!isSupportDept && (
                        <>
                          <button onClick={() => setPrintingPatient(p)} className="p-2.5 bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-indigo-600 rounded-xl transition-all" title="In chỉ định"><Printer size={16} /></button>
                          <button onClick={() => setDischargingPatient(p)} className={`p-2.5 bg-white border border-slate-100 shadow-sm transition-all rounded-xl ${p.status === 'DISCHARGED' ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-slate-400 hover:text-rose-600'}`} title={p.status === 'DISCHARGED' ? "Sửa giờ ra viện" : "Ra viện"}><LogOut size={16} /></button>
                          {p.status === PatientStatus.DISCHARGED && (
                            <button onClick={() => {
                              if (window.confirm(`Bạn có chắc chắn muốn hủy ra viện cho bệnh nhân ${p.name} không?`)) {
                                onUpdateStatus(p, PatientStatus.TREATING);
                              }
                            }} className="p-2.5 bg-white border border-emerald-100 hover:border-emerald-300 shadow-sm text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all" title="Hủy ra viện"><RotateCcw size={16} /></button>
                          )}
                          <button onClick={() => {
                            const hasAppointments = appointments.some(a => a.patientId === p.id);
                            if (hasAppointments) {
                              alert("Không thể xóa bệnh nhân này vì vẫn còn thủ thuật. Vui lòng xóa toàn bộ thủ thuật của bệnh nhân trước khi xóa hồ sơ.");
                            } else {
                              setDeletingPatient(p);
                            }
                          }} className="p-2.5 bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-rose-600 rounded-xl transition-all" title="Xóa hồ sơ"><Trash2 size={16} /></button>
                        </>
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
      {deletingPatient && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">XÓA HỒ SƠ</h3>
                <p className="text-sm text-slate-500 font-bold">Bệnh nhân: <span className="text-slate-800">{deletingPatient.name}</span></p>
              </div>
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle size={20} className="text-rose-500 shrink-0" />
                <p className="text-[11px] text-rose-600 font-bold text-left leading-relaxed uppercase">Hành động này sẽ xóa vĩnh viễn hồ sơ và toàn bộ chỉ định liên quan. Không thể hoàn tác!</p>
              </div>
              <div className="flex gap-4 w-full pt-2">
                <button onClick={() => setDeletingPatient(null)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-all uppercase tracking-widest text-xs">HỦY</button>
                <button onClick={handleConfirmDelete} className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-rose-200 uppercase tracking-widest text-xs">XÓA NGAY</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Confirmation Modal */}
      {dischargingPatient && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                    <input 
                      type="date"
                      className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-rose-400 outline-none transition-all"
                      value={dischargeDateInput.split('T')[0] || ''}
                      onChange={e => {
                        const time = dischargeDateInput.split('T')[1] || '00:00';
                        setDischargeDateInput(`${e.target.value}T${time}`);
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
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                    <input 
                      type="date"
                      className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-indigo-400 outline-none"
                      value={printFromDate}
                      onChange={e => setPrintFromDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} /> Đến ngày
                    </label>
                    <input 
                      type="date"
                      className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-indigo-400 outline-none"
                      value={printToDate}
                      onChange={e => setPrintToDate(e.target.value)}
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
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-[95vw] 2xl:max-w-7xl w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Upload size={24} className="text-primary animate-pulse" /> Nhập danh sách bệnh nhân từ CSV
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-1">Chọn hoặc kéo thả file CSV chứa thông tin bệnh nhân để nhập tự động.</p>
              </div>
              <button 
                onClick={() => { setIsCsvImportModalOpen(false); setCsvPatients([]); }}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto min-h-0 space-y-6 scrollbar-thin pr-1">
              {csvPatients.length === 0 ? (
                <div 
                  className={`border-4 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 transition-all ${
                    dragActive ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-slate-100 hover:border-slate-200'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center shadow-inner">
                    <Download size={28} className="rotate-180 text-primary/80" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-700 uppercase tracking-wide">Kéo thả file CSV vào đây</p>
                    <p className="text-xs text-slate-400 font-bold">Hoặc click để chọn file từ máy tính</p>
                  </div>
                  <label className="cursor-pointer bg-primary text-white font-black text-[10px] tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all uppercase">
                    Chọn file
                    <input 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      onChange={handleFileChange} 
                    />
                  </label>
                  
                  <div className="border-t border-slate-100 w-full pt-6 mt-4 flex flex-col items-center gap-2">
                    <p className="text-[11px] text-slate-400 font-bold">Thứ tự các cột: Ngày vào viện, Giờ vào viện, Họ tên, Giới tính, Năm sinh, Số giường, Loại giường, Mức hưởng BHYT, Ghi chú</p>
                    <button 
                      onClick={downloadSampleCSV}
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-black hover:underline mt-1"
                    >
                      <Download size={14} /> TẢI FILE CSV MẪU
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
