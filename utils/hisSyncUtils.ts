import { Patient, PatientStatus, BedType, InsuranceLevel } from '../types';
import { parseCSV } from './csvUtils';

export interface HisIncomingPatient {
  code: string;
  name: string;
  yob?: string | number;
  dob?: string;
  gender?: 'Nam' | 'Nữ' | string;
  bedNumber?: string;
  roomNumber?: string;
  bedType?: string;
  admissionDate?: string; // dd/mm/yyyy or yyyy-mm-dd or ISO
  admissionTime?: string; // HH:mm
  insuranceLevel?: string; // 100 | 100% | 95 | 80 | 0
  note?: string;
}

export interface HisSyncFieldDiff {
  field: 'code' | 'name' | 'yob' | 'bedNumber' | 'roomNumber' | 'admissionDate' | 'admissionTime' | 'insuranceLevel' | 'bedType';
  label: string;
  oldValue: string;
  newValue: string;
}

export interface HisMismatchItem {
  syncId: string;
  patientId: string;
  existingPatient: Patient;
  matchedBy: 'CODE' | 'TEMP_CODE_NAME_YOB' | 'NAME_YOB_CODE_MISMATCH';
  // Editable target values (initially populated from HIS, or existing when HIS omitted)
  code: string;
  name: string;
  yob: string;
  bedNumber: string;
  roomNumber: string;
  bedType: BedType;
  admissionDate: string; // dd/mm/yyyy
  admissionTime: string; // HH:mm
  insuranceLevel: InsuranceLevel;
  diffs: HisSyncFieldDiff[];
  synced?: boolean;
}

export interface HisNewPatientItem {
  syncId: string;
  code: string;
  name: string;
  gender: 'Nam' | 'Nữ';
  yob: string;
  bedNumber: string;
  roomNumber: string;
  bedType: BedType;
  admissionDate: string; // dd/mm/yyyy
  admissionTime: string; // HH:mm
  insuranceLevel: InsuranceLevel;
  note: string;
  previouslyDischarged?: boolean;
  added?: boolean;
}

export interface HisMatchedItem {
  syncId: string;
  patient: Patient;
  code: string;
  name: string;
  bedNumber: string;
  yob: string;
  insuranceLevel: InsuranceLevel;
}

export interface HisComparisonResult {
  mismatched: HisMismatchItem[];
  newPatients: HisNewPatientItem[];
  matched: HisMatchedItem[];
  missingInHis: Patient[];
  invalidRowsCount: number;
}

export const normalizeText = (s: string | null | undefined): string => {
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
};

export const normalizeHisBed = (raw: string | null | undefined): string => {
  const s = (raw || '').trim().replace(/\s+/g, ' ');
  return s.replace(/^(giường|g\.|g)\s*/i, '').trim();
};

export const normalizeHisRoom = (raw: string | null | undefined): string => {
  const s = (raw || '').trim().replace(/\s+/g, ' ');
  return s.replace(/^(buồng|phòng|p\.|p)\s*/i, '').trim();
};

export const normalizeHisInsurance = (raw: string | number | null | undefined): InsuranceLevel | '' => {
  if (raw === null || raw === undefined) return '';
  const cleaned = String(raw).trim().replace(/%/g, '');
  if (!cleaned) return '';
  if (cleaned === '0') return '0%';
  if (cleaned === '80') return '80%';
  if (cleaned === '95') return '95%';
  if (cleaned === '100') return '100%';
  return '';
};

export const normalizeHisBedType = (raw: string | null | undefined): BedType | '' => {
  const bt = normalizeText(raw);
  if (!bt) return '';
  if (bt.includes('ban ngày') || bt.includes('ban ngay')) return 'Nội trú ban ngày';
  if (bt.includes('ngoại') || bt.includes('ngoai')) return 'Ngoại trú';
  if (bt.includes('khác') || bt.includes('khac')) return 'Khác';
  if (bt.includes('nội') || bt.includes('noi')) return 'Nội trú';
  return '';
};

export const extractYob = (yobRaw?: string | number, dobRaw?: string): string => {
  if (yobRaw !== undefined && yobRaw !== null && String(yobRaw).trim()) {
    const digits = String(yobRaw).replace(/\D/g, '');
    if (digits.length >= 4) return digits.slice(0, 4);
    if (digits.length > 0) return digits;
  }
  if (dobRaw) {
    const m = String(dobRaw).match(/(\d{4})/);
    if (m) return m[1];
  }
  return '';
};

export const formatPatientDateDdMmYyyy = (isoOrDateStr: string | null | undefined): string => {
  if (!isoOrDateStr) return '';
  const trimmed = isoOrDateStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).formatToParts(d);
      const day = parts.find(p => p.type === 'day')?.value || '01';
      const month = parts.find(p => p.type === 'month')?.value || '01';
      const year = parts.find(p => p.type === 'year')?.value || '2026';
      return `${day}/${month}/${year}`;
    } catch {
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
  }
  return '';
};

export const formatPatientTimeHHmm = (isoOrTimeStr: string | null | undefined): string => {
  if (!isoOrTimeStr) return '';
  const trimmed = isoOrTimeStr.trim();
  if (/^\d{1,2}:\d{2}/.test(trimmed)) {
    const [h, m] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m.slice(0, 2).padStart(2, '0')}`;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(d);
      const h = parts.find(p => p.type === 'hour')?.value || '08';
      const m = parts.find(p => p.type === 'minute')?.value || '00';
      return `${h === '24' ? '00' : h}:${m}`;
    } catch {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  return '';
};

export const isValidDdMmYyyy = (str: string): boolean => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return false;
  const [d, m, y] = str.split('/').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.getFullYear() === y && dateObj.getMonth() === m - 1 && dateObj.getDate() === d;
};

export const ddMmYyyyAndTimeToIso = (ddMmYyyy: string, hhMm: string, fallbackIso?: string): string => {
  if (!isValidDdMmYyyy(ddMmYyyy)) {
    return fallbackIso || new Date().toISOString();
  }
  const [d, m, y] = ddMmYyyy.split('/');
  const cleanTime = /^\d{2}:\d{2}$/.test(hhMm) ? hhMm : '08:00';
  // Explicit +07:00 offset so VNPT-HIS local timestamps remain exact across browsers
  const parsed = new Date(`${y}-${m}-${d}T${cleanTime}:00+07:00`);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return fallbackIso || new Date().toISOString();
};

export const normalizeIncomingDate = (raw?: string): string => {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return formatPatientDateDdMmYyyy(s);
  }
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  }
  return formatPatientDateDdMmYyyy(s);
};

export const normalizeIncomingTime = (raw?: string): string => {
  const s = (raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return '';
};

export function compareHisPatientsWithMedFlow(
  incomingList: HisIncomingPatient[],
  allMedflowPatients: Patient[],
  targetDeptId: string
): HisComparisonResult {
  const activeInDept = allMedflowPatients.filter(
    p => p.admittedByDeptId === targetDeptId && p.status === PatientStatus.TREATING
  );
  const dischargedCodesInDept = new Set(
    allMedflowPatients
      .filter(p => p.admittedByDeptId === targetDeptId && p.status === PatientStatus.DISCHARGED)
      .map(p => normalizeText(p.code))
      .filter(Boolean)
  );

  const byCode = new Map<string, Patient>();
  activeInDept.forEach(p => {
    const c = normalizeText(p.code);
    if (c) byCode.set(c, p);
  });

  const matchedPatientIds = new Set<string>();
  const mismatched: HisMismatchItem[] = [];
  const newPatients: HisNewPatientItem[] = [];
  const matched: HisMatchedItem[] = [];
  let invalidRowsCount = 0;

  const todayDdMmYyyy = formatPatientDateDdMmYyyy(new Date().toISOString());

  interface ParsedIncoming {
    raw: HisIncomingPatient;
    idx: number;
    hisCode: string;
    hisName: string;
    hisYob: string;
    hisBed: string;
    hisRoom: string;
    hisDate: string;
    hisTime: string;
    hisIns: InsuranceLevel | '';
    hisBedType: BedType | '';
    existing?: Patient;
    matchedBy: 'CODE' | 'TEMP_CODE_NAME_YOB' | 'NAME_YOB_CODE_MISMATCH';
  }

  const parsedRows: ParsedIncoming[] = [];
  incomingList.forEach((raw, idx) => {
    const hisCode = (raw.code || '').trim();
    const hisName = (raw.name || '').trim().replace(/\s+/g, ' ');
    if (!hisCode && !hisName) {
      invalidRowsCount++;
      return;
    }
    parsedRows.push({
      raw,
      idx,
      hisCode,
      hisName,
      hisYob: extractYob(raw.yob, raw.dob),
      hisBed: normalizeHisBed(raw.bedNumber),
      hisRoom: normalizeHisRoom(raw.roomNumber),
      hisDate: normalizeIncomingDate(raw.admissionDate),
      hisTime: normalizeIncomingTime(raw.admissionTime),
      hisIns: normalizeHisInsurance(raw.insuranceLevel),
      hisBedType: normalizeHisBedType(raw.bedType),
      matchedBy: 'CODE'
    });
  });

  // Pass 1: Match by exact Mã bệnh án first across ALL rows so exact matches are never stolen
  for (const item of parsedRows) {
    if (!item.hisCode) continue;
    const candidate = byCode.get(normalizeText(item.hisCode));
    if (candidate && !matchedPatientIds.has(candidate.id)) {
      item.existing = candidate;
      item.matchedBy = 'CODE';
      matchedPatientIds.add(candidate.id);
    }
  }

  // Pass 2: Fallback matching for remaining rows (catches BOTH TAM-* codes AND manually mistyped codes)
  for (const item of parsedRows) {
    if (item.existing) continue;
    const remaining = activeInDept.filter(p => !matchedPatientIds.has(p.id));
    if (remaining.length === 0) break;

    let candidate: Patient | undefined;

    if (item.hisName) {
      const normHisName = normalizeText(item.hisName);
      const sameName = remaining.filter(p => normalizeText(p.name) === normHisName);

      if (sameName.length > 0) {
        // 2a. Name + YOB match (or Name alone if unique and YOB omitted)
        const yobMatched = item.hisYob
          ? sameName.filter(p => {
              const py = extractYob(undefined, p.dob);
              return !py || py === item.hisYob;
            })
          : sameName;

        if (yobMatched.length === 1) {
          candidate = yobMatched[0];
        } else if (yobMatched.length > 1) {
          // Disambiguate multiple patients with same Name + YOB using bedNumber or admissionDate
          const byBed = item.hisBed
            ? yobMatched.filter(p => normalizeHisBed(p.bedNumber) === item.hisBed)
            : [];
          if (byBed.length === 1) {
            candidate = byBed[0];
          } else if (item.hisDate) {
            const byDate = yobMatched.filter(p => formatPatientDateDdMmYyyy(p.admissionDate) === item.hisDate);
            if (byDate.length === 1) candidate = byDate[0];
          }
        } else if (item.hisBed) {
          // 2b. Name + Bed match (if YOB was also mistyped manually)
          const byNameAndBed = sameName.filter(p => normalizeHisBed(p.bedNumber) === item.hisBed);
          if (byNameAndBed.length === 1) {
            candidate = byNameAndBed[0];
          }
        }
      }
    }

    // 2c. Unique Bed + YOB + Admission Date match (if BOTH Name and Code had manual typos)
    if (!candidate && item.hisBed && item.hisYob && item.hisDate) {
      const strongSignals = remaining.filter(p =>
        normalizeHisBed(p.bedNumber) === item.hisBed &&
        extractYob(undefined, p.dob) === item.hisYob &&
        formatPatientDateDdMmYyyy(p.admissionDate) === item.hisDate
      );
      if (strongSignals.length === 1) {
        candidate = strongSignals[0];
      }
    }

    if (candidate) {
      matchedPatientIds.add(candidate.id);
      item.existing = candidate;
      const pCode = (candidate.code || '').trim();
      const isTemp = pCode.startsWith('TAM-') || !pCode || pCode === 'N/A';
      item.matchedBy = isTemp ? 'TEMP_CODE_NAME_YOB' : 'NAME_YOB_CODE_MISMATCH';
    }
  }

  for (const item of parsedRows) {
    const { raw, idx, hisCode, hisName, hisYob, hisBed, hisRoom, hisDate, hisTime, hisIns, hisBedType, existing, matchedBy } = item;

    if (existing) {

      const mfCode = (existing.code || '').trim();
      const mfName = (existing.name || '').trim().replace(/\s+/g, ' ');
      const mfYob = extractYob(undefined, existing.dob);
      const mfBed = normalizeHisBed(existing.bedNumber);
      const mfRoom = normalizeHisRoom(existing.roomNumber);
      const mfDate = formatPatientDateDdMmYyyy(existing.admissionDate);
      const mfTime = formatPatientTimeHHmm(existing.admissionDate);
      const mfIns: InsuranceLevel = existing.insuranceLevel || '100%';
      const mfBedType: BedType = existing.bedType || 'Nội trú';

      const diffs: HisSyncFieldDiff[] = [];

      if (hisCode && normalizeText(hisCode) !== normalizeText(mfCode)) {
        diffs.push({
          field: 'code',
          label: 'Mã bệnh án',
          oldValue: mfCode || '(Trống)',
          newValue: hisCode
        });
      }

      if (hisName && normalizeText(hisName) !== normalizeText(mfName)) {
        diffs.push({
          field: 'name',
          label: 'Họ tên',
          oldValue: mfName || '(Trống)',
          newValue: hisName
        });
      }

      if (hisYob && hisYob !== mfYob) {
        diffs.push({
          field: 'yob',
          label: 'Năm sinh',
          oldValue: mfYob || '(Trống)',
          newValue: hisYob
        });
      }

      if (raw.bedNumber !== undefined && hisBed !== mfBed) {
        diffs.push({
          field: 'bedNumber',
          label: 'Số giường',
          oldValue: mfBed || '(Trống)',
          newValue: hisBed || '(Trống)'
        });
      }

      if (raw.roomNumber !== undefined && hisRoom && hisRoom !== mfRoom) {
        diffs.push({
          field: 'roomNumber',
          label: 'Số phòng',
          oldValue: mfRoom || '(Trống)',
          newValue: hisRoom
        });
      }

      if (hisDate && hisDate !== mfDate) {
        diffs.push({
          field: 'admissionDate',
          label: 'Ngày vào viện',
          oldValue: mfDate || '(Trống)',
          newValue: hisDate
        });
      }

      if (hisTime && hisTime !== mfTime) {
        diffs.push({
          field: 'admissionTime',
          label: 'Giờ vào viện',
          oldValue: mfTime || '(Trống)',
          newValue: hisTime
        });
      }

      if (hisIns && hisIns !== mfIns) {
        diffs.push({
          field: 'insuranceLevel',
          label: 'Mức BHYT',
          oldValue: mfIns,
          newValue: hisIns
        });
      }

      if (hisBedType && hisBedType !== mfBedType) {
        diffs.push({
          field: 'bedType',
          label: 'Loại giường',
          oldValue: mfBedType,
          newValue: hisBedType
        });
      }

      // NOTE: Gender is intentionally NOT checked/compared per user requirement.

      if (diffs.length > 0) {
        mismatched.push({
          syncId: `mismatch_${existing.id}_${idx}`,
          patientId: existing.id,
          existingPatient: existing,
          matchedBy,
          code: hisCode || mfCode,
          name: hisName ? (normalizeText(hisName) !== normalizeText(mfName) ? hisName : existing.name) : existing.name,
          yob: hisYob || mfYob,
          bedNumber: raw.bedNumber !== undefined ? hisBed : mfBed,
          roomNumber: hisRoom || mfRoom,
          bedType: (hisBedType || mfBedType) as BedType,
          admissionDate: hisDate || mfDate || todayDdMmYyyy,
          admissionTime: hisTime || mfTime || '08:00',
          insuranceLevel: (hisIns || mfIns) as InsuranceLevel,
          diffs
        });
      } else {
        matched.push({
          syncId: `matched_${existing.id}_${idx}`,
          patient: existing,
          code: existing.code,
          name: existing.name,
          bedNumber: existing.bedNumber,
          yob: mfYob,
          insuranceLevel: mfIns
        });
      }
    } else {
      const genderGuess: 'Nam' | 'Nữ' =
        raw.gender && normalizeText(raw.gender) === 'nữ' ? 'Nữ' : 'Nam';

      newPatients.push({
        syncId: `new_${idx}_${hisCode || hisName}`,
        code: hisCode,
        name: hisName,
        gender: genderGuess,
        yob: hisYob || '1960',
        bedNumber: hisBed,
        roomNumber: hisRoom,
        bedType: (hisBedType || 'Nội trú') as BedType,
        admissionDate: hisDate || todayDdMmYyyy,
        admissionTime: hisTime || '08:00',
        insuranceLevel: (hisIns || '100%') as InsuranceLevel,
        note: (raw.note || '').trim(),
        previouslyDischarged: hisCode ? dischargedCodesInDept.has(normalizeText(hisCode)) : false
      });
    }
  }

  const missingInHis = activeInDept.filter(p => !matchedPatientIds.has(p.id));

  return {
    mismatched,
    newPatients,
    matched,
    missingInHis,
    invalidRowsCount
  };
}

export function parseHisTextInput(rawText: string): HisIncomingPatient[] {
  const text = (rawText || '').trim();
  if (!text) return [];

  // 1. Try JSON first
  if (text.startsWith('{') || text.startsWith('[')) {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.patients) ? parsed.patients : []);
    return arr.map((item: any) => ({
      code: String(item.code ?? item.maBenhAn ?? item.maBA ?? item.ma_ba ?? '').trim(),
      name: String(item.name ?? item.hoTen ?? item.tenBenhNhan ?? '').trim(),
      yob: item.yob ?? item.namSinh ?? item.ns ?? '',
      dob: item.dob ?? '',
      gender: item.gender ?? item.gioiTinh ?? '',
      bedNumber: item.bedNumber ?? item.giuong ?? item.soGiuong ?? '',
      roomNumber: item.roomNumber ?? item.buong ?? item.phong ?? item.soPhong ?? '',
      bedType: item.bedType ?? item.loaiGiuong ?? '',
      admissionDate: item.admissionDate ?? item.ngayVao ?? item.vaoKhoa ?? '',
      admissionTime: item.admissionTime ?? item.gioVao ?? item.gio ?? '',
      insuranceLevel: item.insuranceLevel ?? item.tyLe ?? item.mucHuong ?? item.bhyt ?? '',
      note: item.note ?? item.ghiChu ?? ''
    }));
  }

  // 2. Fallback to CSV / TSV (if tabs are present without commas, convert TSV rows carefully)
  let rows: string[][] = [];
  if (text.includes('\t') && !text.split('\n')[0].includes(',')) {
    rows = text
      .split(/\r?\n/)
      .map(line => line.split('\t').map(c => c.trim()))
      .filter(r => r.some(Boolean));
  } else {
    rows = parseCSV(text);
  }

  if (rows.length === 0) return [];

  const firstRowNorm = rows[0].map(c => normalizeText(c));
  const firstRowJoined = firstRowNorm.join(' ');
  const hasHeader =
    firstRowJoined.includes('mã ba') ||
    firstRowJoined.includes('mã bệnh án') ||
    firstRowJoined.includes('họ tên') ||
    firstRowJoined.includes('giường') ||
    firstRowJoined.includes('vào khoa');

  const findCol = (keywords: string[]) =>
    firstRowNorm.findIndex(h => keywords.some(k => h === k || h.includes(k)));

  let colMap = {
    code: 1,
    name: 5,
    yob: 6,
    bed: 0,
    room: -1,
    bedType: -1,
    date: 2,
    time: 3,
    ins: 9,
    note: -1,
    gender: -1
  };

  if (hasHeader) {
    colMap = {
      code: findCol(['mã bệnh án', 'mã ba', 'mã bn']),
      name: findCol(['họ tên', 'họ và tên', 'tên bệnh nhân']),
      yob: findCol(['năm sinh', 'ns']),
      bed: findCol(['số giường', 'giường']),
      room: findCol(['buồng', 'phòng', 'số phòng']),
      bedType: findCol(['loại giường']),
      date: findCol(['ngày vào', 'vào khoa', 'ngày']),
      time: findCol(['giờ vào', 'giờ']),
      ins: findCol(['tỷ lệ', 'mức hưởng', 'bhyt']),
      note: findCol(['ghi chú', 'mã icd']),
      gender: findCol(['giới tính'])
    };
    rows = rows.slice(1);
  } else if (rows[0].length === 10) {
    // Standard 10-col CSV export template from MedFlow
    colMap = {
      date: 0,
      time: 1,
      code: 2,
      name: 3,
      gender: 4,
      yob: 5,
      bed: 6,
      bedType: 7,
      ins: 8,
      note: 9,
      room: -1
    };
  }

  return rows.map(r => ({
    code: colMap.code >= 0 ? (r[colMap.code] || '').trim() : '',
    name: colMap.name >= 0 ? (r[colMap.name] || '').trim() : '',
    yob: colMap.yob >= 0 ? (r[colMap.yob] || '').trim() : '',
    gender: colMap.gender >= 0 ? (r[colMap.gender] || '').trim() : '',
    bedNumber: colMap.bed >= 0 ? (r[colMap.bed] || '').trim() : '',
    roomNumber: colMap.room >= 0 ? (r[colMap.room] || '').trim() : '',
    bedType: colMap.bedType >= 0 ? (r[colMap.bedType] || '').trim() : '',
    admissionDate: colMap.date >= 0 ? (r[colMap.date] || '').trim() : '',
    admissionTime: colMap.time >= 0 ? (r[colMap.time] || '').trim() : '',
    insuranceLevel: colMap.ins >= 0 ? (r[colMap.ins] || '').trim() : '',
    note: colMap.note >= 0 ? (r[colMap.note] || '').trim() : ''
  }));
}
