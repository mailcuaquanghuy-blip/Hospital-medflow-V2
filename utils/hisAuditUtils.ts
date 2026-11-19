import { Appointment, Department, Patient, Procedure, Staff } from '../types';
import { calculateAge, timeStringToMinutes } from './timeUtils';

export type AuditStatus =
  | 'MATCHED'
  | 'MISMATCH'
  | 'MISSING_IN_TIMELINE'
  | 'MISSING_IN_HIS';

export interface NormalizedHisRow {
  rowIndex: number;
  date: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  patientName: string;
  patientCodeHis: string;
  bhyt: string;
  age: number | null;
  gender: 'Nam' | 'Nữ' | '';
  rawProcedure: string;
  normalizedProcedure: string;
  matchedProcedureId?: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  mainStaff: string;
  assistant1: string;
  assistant2: string;
  rawMachine: string;
  normalizedMachine: string;
  performerUnit: string;
  isExcluded: boolean;
  excludeReason?: string;
}

export interface NormalizedTimelineRow {
  apptId: string;
  date: string; // YYYY-MM-DD
  displayDate: string; // DD/MM/YYYY
  patientId: string;
  patientName: string;
  patientCode: string;
  patientAge: number | null;
  patientGender: string;
  bedRoom: string;
  procedureId: string;
  procedureName: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  mainStaff: string;
  assistant1: string;
  assistant2: string;
  rawMachine: string;
  normalizedMachine: string;
  isExcluded: boolean;
  excludeReason?: string;
}

export interface AuditFieldDiffs {
  time: boolean;
  procedure: boolean;
  mainStaff: boolean;
  assistant1: boolean;
  assistant2: boolean;
  machine: boolean;
  swappedAssistants: boolean;
}

export interface AuditComparisonRow {
  id: string;
  date: string;
  displayDate: string;
  status: AuditStatus;
  patientName: string;
  patientMeta: string;
  his?: NormalizedHisRow;
  timeline?: NormalizedTimelineRow;
  diffs: AuditFieldDiffs;
  diffReasons: string[];
  timeDeltaMinutes?: number;
}

export interface AuditSummary {
  totalHisRawRows: number;
  totalHisClinicalRows: number;
  totalTimelineClinicalRows: number;
  excludedHisCount: number;
  excludedTimelineCount: number;
  matchedCount: number;
  mismatchCount: number;
  missingInTimelineCount: number;
  missingInHisCount: number;
  detectedDates: string[];
  datesWithoutTimelineData: string[];
}

export interface AuditResult {
  fileName: string;
  rows: AuditComparisonRow[];
  summary: AuditSummary;
}

export interface AuditRunInput {
  fileName: string;
  csvText: string;
  currentDept: Department;
  appointments: Appointment[];
  patients: Patient[];
  staff: Staff[];
  procedures: Procedure[];
  timeToleranceMinutes?: number;
  onProgress?: (percent: number, stageLabel: string) => void;
}

const yieldToMain = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 0));

const waitTick = (ms = 40): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const cleanSpaceNFC = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
};

export const normalizeViText = (value: string | null | undefined): string => {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const normalizeMachineCode = (raw: string | null | undefined): string => {
  if (!raw) return '';
  let s = cleanSpaceNFC(raw).replace(/^'+/, '').trim();
  if (!s || s === '-1' || s === '-' || s.toLowerCase() === 'null') return '';
  if (s.includes('.')) {
    const parts = s.split('.').filter(Boolean);
    if (parts.length > 0) {
      s = parts[parts.length - 1];
    }
  }
  s = s.replace(/[-\s_]/g, '').toUpperCase();
  if (!s || s === '1' && raw.includes('-1')) return '';
  return s;
};

const cleanHisField = (raw: string | null | undefined): string => {
  const s = cleanSpaceNFC(raw);
  if (!s || s === "'-1" || s === '-1' || s === '-' || s.toLowerCase() === 'null') {
    return '';
  }
  return s;
};

/**
 * RFC-4180 compliant character-by-character CSV parser.
 * Properly handles UTF-8 BOM, quoted multiline cells (like MOTA), and escaped "" quotes.
 */
export const parseRFC4180CSV = (rawText: string): string[][] => {
  const text = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        if (text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
};

const formatDisplayDate = (isoDate: string): string => {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const parseHisDate = (raw: string): string => {
  const s = cleanSpaceNFC(raw);
  if (!s) return '';
  // DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
  const dmyMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // YYYY-MM-DD ...
  const ymdMatch = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = ymdMatch[2].padStart(2, '0');
    const dd = ymdMatch[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
};

const parseHisTime = (raw: string): string => {
  const s = cleanSpaceNFC(raw);
  if (!s) return '';
  const timeMatch = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!timeMatch) return '';
  const hh = timeMatch[1].padStart(2, '0');
  const mm = timeMatch[2].padStart(2, '0');
  return `${hh}:${mm}`;
};

const KNOWN_PROC_PREFIXES: { prefixNorm: string; canonical: string }[] = [
  { prefixNorm: 'xoa bop bam huyet', canonical: 'Xoa bóp' },
  { prefixNorm: 'xoa bop', canonical: 'Xoa bóp' },
  { prefixNorm: 'thuy cham', canonical: 'Thủy châm' },
  { prefixNorm: 'dien cham', canonical: 'Điện châm' },
  { prefixNorm: 'cay chi', canonical: 'Cấy chỉ' },
  { prefixNorm: 'cuu ngai', canonical: 'Cứu ngải' },
  { prefixNorm: 'giac hoi', canonical: 'Giác hơi' },
  { prefixNorm: 'hao cham', canonical: 'Hào châm' },
  { prefixNorm: 'nhi cham', canonical: 'Nhĩ châm' },
  { prefixNorm: 'dien xung', canonical: 'Điện xung' },
  { prefixNorm: 'sieu am dieu tri', canonical: 'Siêu âm điều trị' },
  { prefixNorm: 'keo gian cot song', canonical: 'Kéo giãn cột sống' },
  { prefixNorm: 'hong ngoai', canonical: 'Chiếu hồng ngoại' },
  { prefixNorm: 'parafin', canonical: 'Đắp Parafin' },
  { prefixNorm: 'tap van dong', canonical: 'Tập vận động' },
];

const resolveHisProcedureName = (
  rawProc: string,
  deptProcedures: Procedure[],
  allProcedures: Procedure[]
): { normalizedName: string; matchedProcId?: string } => {
  const rawNorm = normalizeViText(rawProc);
  if (!rawNorm) return { normalizedName: cleanSpaceNFC(rawProc) };

  // Prefer matching procedures configured for the current department (longest name first)
  const sortedDeptProcs = [...deptProcedures].sort(
    (a, b) => normalizeViText(b.name).length - normalizeViText(a.name).length
  );
  for (const p of sortedDeptProcs) {
    const pNorm = normalizeViText(p.name);
    if (!pNorm) continue;
    if (
      rawNorm === pNorm ||
      rawNorm.startsWith(pNorm + ' ') ||
      (pNorm === 'xoa bop' && rawNorm.startsWith('xoa bop bam huyet'))
    ) {
      return { normalizedName: p.name, matchedProcId: p.id };
    }
  }

  // Fallback to any matching procedure in catalog
  const sortedAllProcs = [...allProcedures].sort(
    (a, b) => normalizeViText(b.name).length - normalizeViText(a.name).length
  );
  for (const p of sortedAllProcs) {
    const pNorm = normalizeViText(p.name);
    if (!pNorm) continue;
    if (rawNorm === pNorm || rawNorm.startsWith(pNorm + ' ')) {
      return { normalizedName: p.name, matchedProcId: p.id };
    }
  }

  for (const entry of KNOWN_PROC_PREFIXES) {
    if (rawNorm === entry.prefixNorm || rawNorm.startsWith(entry.prefixNorm + ' ')) {
      const matched =
        deptProcedures.find(p => normalizeViText(p.name) === normalizeViText(entry.canonical)) ||
        allProcedures.find(p => normalizeViText(p.name) === normalizeViText(entry.canonical));
      return {
        normalizedName: matched?.name || entry.canonical,
        matchedProcId: matched?.id,
      };
    }
  }

  // Strip parenthetical details cleanly if unmatched
  const shortRaw = cleanSpaceNFC(rawProc).split('(')[0].trim();
  return { normalizedName: shortRaw || cleanSpaceNFC(rawProc) };
};

const shouldExcludeHisRow = (rawProc: string, performerUnit: string): string | null => {
  const procNorm = normalizeViText(rawProc);
  const unitNorm = normalizeViText(performerUnit);
  if (procNorm.startsWith('sac thuoc') || unitNorm.includes('nhan vien sac thuoc')) {
    return 'Sắc thuốc (Dược)';
  }
  if (
    procNorm.startsWith('di buong') ||
    procNorm.startsWith('kham vao vien') ||
    procNorm.startsWith('kham ra vien') ||
    procNorm.startsWith('kham benh')
  ) {
    return 'Hành chính / Khám';
  }
  return null;
};

const shouldExcludeTimelineProcedure = (proc?: Procedure): string | null => {
  if (!proc) return null;
  if (proc.category === 'Hành chính') {
    return `Mục hành chính (${proc.name})`;
  }
  const pNorm = normalizeViText(proc.name);
  if (
    pNorm.includes('di buong') ||
    pNorm.includes('kham vao vien') ||
    pNorm.includes('kham ra vien') ||
    pNorm === 'kham benh' ||
    pNorm.startsWith('sac thuoc') ||
    pNorm.startsWith('phat thuoc')
  ) {
    return `Không phải thủ thuật (${proc.name})`;
  }
  return null;
};

const matchPatientIdForHis = (
  hisNameNorm: string,
  hisAge: number | null,
  hisGender: string,
  hisCode: string,
  patients: Patient[],
  deptId: string
): string | null => {
  if (!hisNameNorm) return null;
  const candidates = patients.filter(p => {
    if (hisCode && p.code && normalizeViText(p.code) === normalizeViText(hisCode)) {
      return true;
    }
    return normalizeViText(p.name) === hisNameNorm;
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  let bestId = candidates[0].id;
  let bestScore = -1;
  for (const p of candidates) {
    let score = 0;
    if (p.admittedByDeptId === deptId) score += 3;
    if (hisGender && p.gender === hisGender) score += 2;
    if (hisAge !== null && p.dob) {
      const pAge = Number(calculateAge(p.dob));
      if (!isNaN(pAge)) {
        const diff = Math.abs(pAge - hisAge);
        if (diff === 0) score += 5;
        else if (diff <= 1) score += 3;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = p.id;
    }
  }
  return bestId;
};

const compareNamesEqual = (a: string, b: string): boolean => {
  const na = normalizeViText(a);
  const nb = normalizeViText(b);
  if (!na && !nb) return true;
  return na === nb;
};

const compareRecordPair = (
  his: NormalizedHisRow,
  tl: NormalizedTimelineRow,
  timeToleranceMinutes: number
): {
  status: 'MATCHED' | 'MISMATCH';
  diffs: AuditFieldDiffs;
  reasons: string[];
  timeDeltaMinutes: number;
} => {
  const hisStartMin = timeStringToMinutes(his.startTime);
  const hisEndMin = timeStringToMinutes(his.endTime);
  const tlStartMin = timeStringToMinutes(tl.startTime);
  const tlEndMin = timeStringToMinutes(tl.endTime);

  const startDiff = Math.abs(hisStartMin - tlStartMin);
  const endDiff = Math.abs(hisEndMin - tlEndMin);
  const timeDeltaMinutes = Math.max(startDiff, endDiff);

  const timeDiff = startDiff > timeToleranceMinutes || endDiff > timeToleranceMinutes;
  const procDiff =
    normalizeViText(his.normalizedProcedure) !== normalizeViText(tl.procedureName);
  const mainStaffDiff = !compareNamesEqual(his.mainStaff, tl.mainStaff);

  const asst1DirectMatch = compareNamesEqual(his.assistant1, tl.assistant1);
  const asst2DirectMatch = compareNamesEqual(his.assistant2, tl.assistant2);
  const swappedAssistants =
    !asst1DirectMatch &&
    !asst2DirectMatch &&
    !!his.assistant1 &&
    !!his.assistant2 &&
    compareNamesEqual(his.assistant1, tl.assistant2) &&
    compareNamesEqual(his.assistant2, tl.assistant1);

  const assistant1Diff = !asst1DirectMatch && !swappedAssistants;
  const assistant2Diff = !asst2DirectMatch && !swappedAssistants;

  const machineDiff = his.normalizedMachine !== tl.normalizedMachine;

  const reasons: string[] = [];
  if (procDiff) {
    reasons.push(`Khác thủ thuật (HIS: ${his.normalizedProcedure} ↔ TL: ${tl.procedureName})`);
  }
  if (timeDiff) {
    reasons.push(
      `Lệch giờ (HIS: ${his.startTime}–${his.endTime} ↔ TL: ${tl.startTime}–${tl.endTime})`
    );
  }
  if (mainStaffDiff) {
    reasons.push(
      `Sai NS chính (HIS: ${his.mainStaff || 'Trống'} ↔ TL: ${tl.mainStaff || 'Trống'})`
    );
  }
  if (swappedAssistants) {
    reasons.push(
      `Đảo vị trí Phụ 1 ↔ Phụ 2 (HIS: ${his.assistant1} / ${his.assistant2} ↔ TL: ${tl.assistant1} / ${tl.assistant2})`
    );
  } else {
    if (assistant1Diff) {
      reasons.push(
        `Sai Phụ 1 (HIS: ${his.assistant1 || 'Trống'} ↔ TL: ${tl.assistant1 || 'Trống'})`
      );
    }
    if (assistant2Diff) {
      reasons.push(
        `Sai Phụ 2 (HIS: ${his.assistant2 || 'Trống'} ↔ TL: ${tl.assistant2 || 'Trống'})`
      );
    }
  }
  if (machineDiff) {
    reasons.push(
      `Sai mã máy (HIS: ${his.normalizedMachine || 'Không'} ↔ TL: ${tl.normalizedMachine || 'Không'})`
    );
  }

  const hasAnyDiff =
    timeDiff ||
    procDiff ||
    mainStaffDiff ||
    assistant1Diff ||
    assistant2Diff ||
    machineDiff ||
    swappedAssistants;

  return {
    status: hasAnyDiff ? 'MISMATCH' : 'MATCHED',
    diffs: {
      time: timeDiff,
      procedure: procDiff,
      mainStaff: mainStaffDiff,
      assistant1: assistant1Diff,
      assistant2: assistant2Diff,
      machine: machineDiff,
      swappedAssistants,
    },
    reasons,
    timeDeltaMinutes,
  };
};

export const runHisProcedureAuditAsync = async ({
  fileName,
  csvText,
  currentDept,
  appointments,
  patients,
  staff,
  procedures,
  timeToleranceMinutes = 0,
  onProgress,
}: AuditRunInput): Promise<AuditResult> => {
  onProgress?.(8, 'Đang đọc và tách cấu trúc file CSV VNPT-HIS...');
  await waitTick(35);

  const grid = parseRFC4180CSV(csvText);
  if (grid.length < 2) {
    throw new Error('File CSV không có dữ liệu hoặc chỉ có dòng tiêu đề.');
  }

  const headers = grid[0].map(h => h.trim().toUpperCase());
  const colIdx = (name: string): number => headers.indexOf(name.toUpperCase());

  const idxHoten = colIdx('HOTEN');
  const idxProc = colIdx('PHUONGPHAPPTTT');
  const idxStart = colIdx('GIOBATDAU');
  const idxEnd = colIdx('GIOKETTHUC');

  if (idxHoten === -1 || idxProc === -1 || idxStart === -1) {
    throw new Error(
      'File CSV không đúng định dạng sổ thủ thuật VNPT-HIS (thiếu cột HOTEN, PHUONGPHAPPTTT hoặc GIOBATDAU).'
    );
  }

  const idxDateTxt = colIdx('NGAYTHUCHIENTXT');
  const idxDateAlt = colIdx('NGAYPHAUTHUATTHUTHUAT1');
  const idxMaBn = colIdx('MABENHNHAN');
  const idxBhyt = colIdx('BHYT');
  const idxTnam = colIdx('TNAM');
  const idxTnu = colIdx('TNU');
  const idxGender = colIdx('GIOITINH');
  const idxMain = colIdx('TENPHAUTHUATVIEN');
  const idxMain2 = colIdx('TENPHAUTHUATVIEN2');
  const idxPhume = colIdx('TENPHUME');
  const idxPhume2 = colIdx('TENPHUME2');
  const idxPhumo1 = colIdx('TENPHUMO1');
  const idxPhumo2 = colIdx('TENPHUMO2');
  const idxDungCu = colIdx('TENDUNGCUVIEN');
  const idxDieuDuong = colIdx('TENDIEUDUONG');
  const idxMachine = colIdx('MAMAY');
  const idxUnit = colIdx('NGUOITHUCHIEN');

  onProgress?.(28, `Đã đọc ${grid.length - 1} dòng từ file CSV. Đang chuẩn hóa dữ liệu...`);
  await waitTick(45);

  const deptProcedures = procedures.filter(p => p.deptId === currentDept.id);
  const rawHisRows: NormalizedHisRow[] = [];
  const dataRowCount = grid.length - 1;

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    const patientName = cleanHisField(row[idxHoten]);
    const rawProc = cleanHisField(row[idxProc]);
    if (!patientName && !rawProc) continue;

    const date =
      parseHisDate(idxDateTxt >= 0 ? row[idxDateTxt] || '' : '') ||
      parseHisDate(row[idxStart] || '') ||
      parseHisDate(idxDateAlt >= 0 ? row[idxDateAlt] || '' : '');

    if (!date) continue;

    const startTime =
      parseHisTime(row[idxStart] || '') ||
      parseHisTime(idxDateAlt >= 0 ? row[idxDateAlt] || '' : '');
    const endTime = idxEnd >= 0 ? parseHisTime(row[idxEnd] || '') : '';

    const performerUnit = idxUnit >= 0 ? cleanHisField(row[idxUnit]) : '';
    const excludeReason = shouldExcludeHisRow(rawProc, performerUnit);

    const tnam = idxTnam >= 0 ? parseInt(cleanHisField(row[idxTnam]) || '0', 10) : 0;
    const tnu = idxTnu >= 0 ? parseInt(cleanHisField(row[idxTnu]) || '0', 10) : 0;
    const age = tnam > 0 ? tnam : tnu > 0 ? tnu : null;
    const genderRaw = idxGender >= 0 ? cleanHisField(row[idxGender]) : '';
    const gender: 'Nam' | 'Nữ' | '' =
      genderRaw === 'Nam' || genderRaw === 'Nữ' ? genderRaw : '';

    const { normalizedName, matchedProcId } = resolveHisProcedureName(
      rawProc,
      deptProcedures,
      procedures
    );

    const mainStaff = idxMain >= 0 ? cleanHisField(row[idxMain]) : '';

    // Collect assistants cleanly across VNPT-HIS role columns (TENPHUME + TENPHUMO1 etc.)
    const assistantCandidates = [
      idxPhume >= 0 ? cleanHisField(row[idxPhume]) : '',
      idxPhume2 >= 0 ? cleanHisField(row[idxPhume2]) : '',
      idxPhumo1 >= 0 ? cleanHisField(row[idxPhumo1]) : '',
      idxPhumo2 >= 0 ? cleanHisField(row[idxPhumo2]) : '',
      idxMain2 >= 0 ? cleanHisField(row[idxMain2]) : '',
      idxDungCu >= 0 ? cleanHisField(row[idxDungCu]) : '',
      idxDieuDuong >= 0 ? cleanHisField(row[idxDieuDuong]) : '',
    ].filter(Boolean);

    const assistant1 = assistantCandidates[0] || '';
    const assistant2 = assistantCandidates[1] || '';

    const rawMachine = idxMachine >= 0 ? cleanHisField(row[idxMachine]) : '';
    const normalizedMachine = normalizeMachineCode(rawMachine);

    rawHisRows.push({
      rowIndex: i,
      date,
      displayDate: formatDisplayDate(date),
      patientName,
      patientCodeHis: idxMaBn >= 0 ? cleanHisField(row[idxMaBn]) : '',
      bhyt: idxBhyt >= 0 ? cleanHisField(row[idxBhyt]) : '',
      age,
      gender,
      rawProcedure: rawProc,
      normalizedProcedure: normalizedName,
      matchedProcedureId: matchedProcId,
      startTime,
      endTime,
      mainStaff,
      assistant1,
      assistant2,
      rawMachine,
      normalizedMachine,
      performerUnit,
      isExcluded: !!excludeReason,
      excludeReason: excludeReason || undefined,
    });

    if (i % 150 === 0) {
      const pct = 28 + Math.round((i / dataRowCount) * 24);
      onProgress?.(pct, `Đang chuẩn hóa dòng ${i}/${dataRowCount} từ file HIS...`);
      await yieldToMain();
    }
  }

  onProgress?.(56, 'Đang trích xuất dữ liệu Timeline Khoa theo các ngày trong file...');
  await waitTick(45);

  const detectedDateSet = new Set<string>(rawHisRows.map(r => r.date));
  const detectedDates = Array.from(detectedDateSet).sort();

  const patientMap = new Map<string, Patient>();
  patients.forEach(p => patientMap.set(p.id, p));
  const staffMap = new Map<string, Staff>();
  staff.forEach(s => staffMap.set(s.id, s));
  const procMap = new Map<string, Procedure>();
  procedures.forEach(pr => procMap.set(pr.id, pr));

  const clinicalHisRows = rawHisRows.filter(r => !r.isExcluded);
  const excludedHisCount = rawHisRows.length - clinicalHisRows.length;

  const timelineRowsByDate = new Map<string, NormalizedTimelineRow[]>();
  const datesWithoutTimelineData: string[] = [];
  let excludedTimelineCount = 0;
  let totalTimelineClinicalRows = 0;

  for (const d of detectedDates) {
    const dayAppts = appointments.filter(a => {
      if (a.date !== d || a.isDeleted) return false;
      const proc = procMap.get(a.procedureId);
      const effectiveDeptId = proc?.deptId || a.deptId;
      return effectiveDeptId === currentDept.id;
    });

    if (dayAppts.length === 0) {
      datesWithoutTimelineData.push(d);
      timelineRowsByDate.set(d, []);
      continue;
    }

    const list: NormalizedTimelineRow[] = [];
    for (const appt of dayAppts) {
      const proc = procMap.get(appt.procedureId);
      const excludeReason = shouldExcludeTimelineProcedure(proc);
      if (excludeReason) {
        excludedTimelineCount++;
        continue;
      }

      const pat = patientMap.get(appt.patientId);
      const mainSt = staffMap.get(appt.staffId);
      const asst1St = appt.assistant1Id ? staffMap.get(appt.assistant1Id) : undefined;
      const asst2St = appt.assistant2Id ? staffMap.get(appt.assistant2Id) : undefined;
      const rawMac = appt.assignedMachineId || '';

      const parsedPatAge = pat?.dob ? Number(calculateAge(pat.dob)) : NaN;

      list.push({
        apptId: appt.id,
        date: d,
        displayDate: formatDisplayDate(d),
        patientId: appt.patientId,
        patientName: pat?.name || 'Không rõ bệnh nhân',
        patientCode: pat?.code || '',
        patientAge: !isNaN(parsedPatAge) ? parsedPatAge : null,
        patientGender: pat?.gender || '',
        bedRoom: pat
          ? `${pat.bedNumber || '?'}${pat.roomNumber ? ` - P:${pat.roomNumber}` : ''}`
          : '-',
        procedureId: appt.procedureId,
        procedureName: proc?.name || 'Thủ thuật không rõ',
        startTime: appt.startTime,
        endTime: appt.endTime,
        mainStaff: mainSt?.name || '',
        assistant1: asst1St?.name || '',
        assistant2: asst2St?.name || '',
        rawMachine: rawMac,
        normalizedMachine: normalizeMachineCode(rawMac),
        isExcluded: false,
      });
    }

    totalTimelineClinicalRows += list.length;
    timelineRowsByDate.set(d, list);
  }

  onProgress?.(76, `Đang đối chiếu ${clinicalHisRows.length} lượt thủ thuật theo từng ngày...`);
  await waitTick(50);

  const comparisonRows: AuditComparisonRow[] = [];
  let matchedCount = 0;
  let mismatchCount = 0;
  let missingInTimelineCount = 0;
  let missingInHisCount = 0;

  for (let dIdx = 0; dIdx < detectedDates.length; dIdx++) {
    const targetDate = detectedDates[dIdx];
    const hisOfDay = clinicalHisRows.filter(r => r.date === targetDate);
    const tlOfDay = timelineRowsByDate.get(targetDate) || [];
    const usedTimelineIds = new Set<string>();

    // Resolve patient key for each HIS row so same patient's rows pair accurately
    const hisWithPatId = hisOfDay.map(h => {
      const hisNameNorm = normalizeViText(h.patientName);
      const matchedPatId = matchPatientIdForHis(
        hisNameNorm,
        h.age,
        h.gender,
        h.patientCodeHis,
        patients,
        currentDept.id
      );
      return { his: h, patKey: matchedPatId || `NAME:${hisNameNorm}` };
    });

    // Build candidate pairs scored by procedure match + closeness in start time + staff match
    interface PairCandidate {
      hisIdx: number;
      tlIdx: number;
      score: number;
    }
    const candidates: PairCandidate[] = [];

    for (let hi = 0; hi < hisWithPatId.length; hi++) {
      const { his, patKey } = hisWithPatId[hi];
      const hisNameNorm = normalizeViText(his.patientName);
      const hisProcNorm = normalizeViText(his.normalizedProcedure);
      const hisStartMin = timeStringToMinutes(his.startTime);

      for (let ti = 0; ti < tlOfDay.length; ti++) {
        const tl = tlOfDay[ti];
        const tlPatKey = tl.patientId || `NAME:${normalizeViText(tl.patientName)}`;
        const samePatient =
          patKey === tlPatKey || normalizeViText(tl.patientName) === hisNameNorm;
        if (!samePatient) continue;

        const tlProcNorm = normalizeViText(tl.procedureName);
        const procMatch = hisProcNorm === tlProcNorm;
        const tlStartMin = timeStringToMinutes(tl.startTime);
        const timeGap = Math.abs(hisStartMin - tlStartMin);

        // Score higher for matching procedure, close time, matching main staff
        let score = 0;
        if (procMatch) score += 10000;
        score -= timeGap * 10;
        if (compareNamesEqual(his.mainStaff, tl.mainStaff)) score += 50;
        if (his.normalizedMachine && his.normalizedMachine === tl.normalizedMachine) {
          score += 20;
        }
        candidates.push({ hisIdx: hi, tlIdx: ti, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const matchedHisIdx = new Set<number>();
    const matchedTlIdx = new Set<number>();

    for (const c of candidates) {
      if (matchedHisIdx.has(c.hisIdx) || matchedTlIdx.has(c.tlIdx)) continue;
      // Only pair different procedures for the same patient if no procedure match exists and both unmatched,
      // OR prefer strict procedure match first (which is already sorted first via +10000).
      // Wait: if a patient is missing Xoa bóp on Timeline and missing Thủy châm on HIS,
      // don't pair Xoa bóp with Thủy châm unless they are clearly the same slot!
      const h = hisWithPatId[c.hisIdx].his;
      const t = tlOfDay[c.tlIdx];
      const sameProc =
        normalizeViText(h.normalizedProcedure) === normalizeViText(t.procedureName);
      if (!sameProc) continue;

      matchedHisIdx.add(c.hisIdx);
      matchedTlIdx.add(c.tlIdx);
      usedTimelineIds.add(t.apptId);

      const cmp = compareRecordPair(h, t, timeToleranceMinutes);
      if (cmp.status === 'MATCHED') matchedCount++;
      else mismatchCount++;

      comparisonRows.push({
        id: `pair_${targetDate}_${h.rowIndex}_${t.apptId}`,
        date: targetDate,
        displayDate: h.displayDate,
        status: cmp.status,
        patientName: t.patientName || h.patientName,
        patientMeta: [
          h.gender || t.patientGender,
          (h.age ?? t.patientAge) ? `${h.age ?? t.patientAge}t` : '',
          t.bedRoom && t.bedRoom !== '-' ? `G:${t.bedRoom}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        his: h,
        timeline: t,
        diffs: cmp.diffs,
        diffReasons: cmp.reasons,
        timeDeltaMinutes: cmp.timeDeltaMinutes,
      });
    }

    // Unmatched HIS rows -> MISSING_IN_TIMELINE
    for (let hi = 0; hi < hisWithPatId.length; hi++) {
      if (matchedHisIdx.has(hi)) continue;
      const h = hisWithPatId[hi].his;
      missingInTimelineCount++;
      comparisonRows.push({
        id: `his_only_${targetDate}_${h.rowIndex}`,
        date: targetDate,
        displayDate: h.displayDate,
        status: 'MISSING_IN_TIMELINE',
        patientName: h.patientName,
        patientMeta: [
          h.gender,
          h.age ? `${h.age}t` : '',
          h.patientCodeHis || '',
        ]
          .filter(Boolean)
          .join(' • '),
        his: h,
        diffs: {
          time: true,
          procedure: true,
          mainStaff: true,
          assistant1: !!h.assistant1,
          assistant2: !!h.assistant2,
          machine: !!h.normalizedMachine,
          swappedAssistants: false,
        },
        diffReasons: ['Có trong file VNPT-HIS nhưng chưa có trên Timeline Khoa'],
      });
    }

    // Unmatched Timeline rows -> MISSING_IN_HIS
    for (let ti = 0; ti < tlOfDay.length; ti++) {
      if (matchedTlIdx.has(ti)) continue;
      const t = tlOfDay[ti];
      missingInHisCount++;
      comparisonRows.push({
        id: `tl_only_${targetDate}_${t.apptId}`,
        date: targetDate,
        displayDate: t.displayDate,
        status: 'MISSING_IN_HIS',
        patientName: t.patientName,
        patientMeta: [
          t.patientGender,
          t.patientAge ? `${t.patientAge}t` : '',
          t.bedRoom && t.bedRoom !== '-' ? `G:${t.bedRoom}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        timeline: t,
        diffs: {
          time: true,
          procedure: true,
          mainStaff: true,
          assistant1: !!t.assistant1,
          assistant2: !!t.assistant2,
          machine: !!t.normalizedMachine,
          swappedAssistants: false,
        },
        diffReasons: ['Có trên Timeline Khoa nhưng chưa thấy trong file VNPT-HIS'],
      });
    }

    const pct = 76 + Math.round(((dIdx + 1) / Math.max(detectedDates.length, 1)) * 20);
    onProgress?.(pct, `Đã đối chiếu xong ngày ${formatDisplayDate(targetDate)}...`);
    await yieldToMain();
  }

  // Sort: mismatches & missing first, then matched; within same priority by date, patient name, start time
  const statusPriority: Record<AuditStatus, number> = {
    MISMATCH: 0,
    MISSING_IN_TIMELINE: 1,
    MISSING_IN_HIS: 2,
    MATCHED: 3,
  };

  comparisonRows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status];
    }
    const nameCmp = a.patientName.localeCompare(b.patientName, 'vi');
    if (nameCmp !== 0) return nameCmp;
    const tA = a.his?.startTime || a.timeline?.startTime || '';
    const tB = b.his?.startTime || b.timeline?.startTime || '';
    return tA.localeCompare(tB);
  });

  onProgress?.(100, 'Hoàn tất phân tích & tổng hợp báo cáo!');
  await waitTick(60);

  return {
    fileName,
    rows: comparisonRows,
    summary: {
      totalHisRawRows: rawHisRows.length,
      totalHisClinicalRows: clinicalHisRows.length,
      totalTimelineClinicalRows,
      excludedHisCount,
      excludedTimelineCount,
      matchedCount,
      mismatchCount,
      missingInTimelineCount,
      missingInHisCount,
      detectedDates,
      datesWithoutTimelineData,
    },
  };
};

export const getAuditStatusLabel = (status: AuditStatus): string => {
  switch (status) {
    case 'MATCHED':
      return 'Khớp hoàn toàn';
    case 'MISMATCH':
      return 'Sai lệch chi tiết';
    case 'MISSING_IN_TIMELINE':
      return 'Thiếu trên Timeline';
    case 'MISSING_IN_HIS':
      return 'Thiếu trên HIS';
  }
};

export const buildAuditExportData = (rows: AuditComparisonRow[]) => {
  const headers = [
    { label: 'STT', key: 'stt' },
    { label: 'Ngày', key: 'date' },
    { label: 'Trạng thái', key: 'status' },
    { label: 'Bệnh nhân', key: 'patientName' },
    { label: 'Thông tin BN', key: 'patientMeta' },
    { label: 'Thủ thuật (HIS)', key: 'hisProc' },
    { label: 'Thủ thuật (Timeline)', key: 'tlProc' },
    { label: 'Giờ (HIS)', key: 'hisTime' },
    { label: 'Giờ (Timeline)', key: 'tlTime' },
    { label: 'NS Chính (HIS)', key: 'hisMain' },
    { label: 'NS Chính (Timeline)', key: 'tlMain' },
    { label: 'Phụ 1 (HIS)', key: 'hisAsst1' },
    { label: 'Phụ 1 (Timeline)', key: 'tlAsst1' },
    { label: 'Phụ 2 (HIS)', key: 'hisAsst2' },
    { label: 'Phụ 2 (Timeline)', key: 'tlAsst2' },
    { label: 'Mã máy (HIS)', key: 'hisMachine' },
    { label: 'Mã máy (Timeline)', key: 'tlMachine' },
    { label: 'Chi tiết sai lệch', key: 'reasons' },
  ];

  const data = rows.map((row, idx) => ({
    stt: idx + 1,
    date: row.displayDate,
    status: getAuditStatusLabel(row.status),
    patientName: row.patientName,
    patientMeta: row.patientMeta,
    hisProc: row.his?.normalizedProcedure || '',
    tlProc: row.timeline?.procedureName || '',
    hisTime: row.his ? `${row.his.startTime} - ${row.his.endTime}` : '',
    tlTime: row.timeline ? `${row.timeline.startTime} - ${row.timeline.endTime}` : '',
    hisMain: row.his?.mainStaff || '',
    tlMain: row.timeline?.mainStaff || '',
    hisAsst1: row.his?.assistant1 || '',
    tlAsst1: row.timeline?.assistant1 || '',
    hisAsst2: row.his?.assistant2 || '',
    tlAsst2: row.timeline?.assistant2 || '',
    hisMachine: row.his?.normalizedMachine || '',
    tlMachine: row.timeline?.normalizedMachine || '',
    reasons:
      row.diffReasons.length > 0
        ? row.diffReasons.join(' | ')
        : 'Khớp đầy đủ giờ, thủ thuật, nhân sự và máy',
  }));

  return { headers, data };
};
