import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Search,
  RotateCcw,
  Calendar,
  Clock,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { Appointment, Department, Patient, Procedure, Staff } from '../types';
import { downloadCSV } from '../utils/csvUtils';
import {
  AuditComparisonRow,
  AuditResult,
  AuditStatus,
  buildAuditExportData,
  runHisProcedureAuditAsync,
} from '../utils/hisAuditUtils';

interface HisProcedureAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDept: Department;
  currentDate: string;
  onChangeDate?: (date: string) => void;
  appointments: Appointment[];
  patients: Patient[];
  staff: Staff[];
  procedures: Procedure[];
}

type StatusFilter = 'ALL' | 'ISSUES_ONLY' | AuditStatus;

export const HisProcedureAuditModal: React.FC<HisProcedureAuditModalProps> = ({
  isOpen,
  onClose,
  currentDept,
  currentDate,
  onChangeDate,
  appointments,
  patients,
  staff,
  procedures,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lastCsvText, setLastCsvText] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string>('');
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [procedureFilter, setProcedureFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeTolerance, setTimeTolerance] = useState<0 | 5>(0);
  const [showAllRows, setShowAllRows] = useState(false);

  const runAnalysis = async (
    fileName: string,
    csvText: string,
    tolerance: 0 | 5 = timeTolerance
  ) => {
    setErrorMsg(null);
    setIsAnalyzing(true);
    setProgressPercent(2);
    setProgressStage('Đang khởi tạo bộ phân tích...');

    try {
      const result = await runHisProcedureAuditAsync({
        fileName,
        csvText,
        currentDept,
        appointments,
        patients,
        staff,
        procedures,
        timeToleranceMinutes: tolerance,
        onProgress: (pct, stage) => {
          setProgressPercent(pct);
          setProgressStage(stage);
        },
      });
      setAuditResult(result);
      setDateFilter('ALL');
      setProcedureFilter('ALL');
      setStatusFilter('ALL');
      setShowAllRows(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể phân tích file CSV này.');
      setAuditResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileSelected = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type && !file.type.includes('csv') && !file.type.includes('text')) {
      setErrorMsg('Vui lòng chọn đúng định dạng file .csv xuất từ VNPT-HIS.');
      return;
    }

    setErrorMsg(null);
    setIsAnalyzing(true);
    setProgressPercent(1);
    setProgressStage(`Đang nạp file ${file.name}...`);

    const reader = new FileReader();
    reader.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        const readPct = Math.max(1, Math.min(8, Math.round((ev.loaded / ev.total) * 8)));
        setProgressPercent(readPct);
      }
    };
    reader.onload = async (ev) => {
      const text = typeof ev.target?.result === 'string' ? ev.target.result : '';
      if (!text.trim()) {
        setIsAnalyzing(false);
        setErrorMsg('File CSV rỗng, không có nội dung để đối chiếu.');
        return;
      }
      setLastCsvText(text);
      setLastFileName(file.name);
      await runAnalysis(file.name, text, timeTolerance);
    };
    reader.onerror = () => {
      setIsAnalyzing(false);
      setErrorMsg('Lỗi khi đọc file từ máy tính. Vui lòng thử lại.');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleToleranceChange = async (newTol: 0 | 5) => {
    setTimeTolerance(newTol);
    if (lastCsvText && lastFileName) {
      await runAnalysis(lastFileName, lastCsvText, newTol);
    }
  };

  const handleReset = () => {
    setAuditResult(null);
    setLastCsvText(null);
    setLastFileName('');
    setErrorMsg(null);
    setProgressPercent(0);
    setProgressStage('');
    setSearchQuery('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uniqueProcedures = useMemo(() => {
    if (!auditResult) return [];
    const set = new Set<string>();
    auditResult.rows.forEach(r => {
      if (r.his?.normalizedProcedure) set.add(r.his.normalizedProcedure);
      if (r.timeline?.procedureName) set.add(r.timeline.procedureName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [auditResult]);

  const filteredRows = useMemo(() => {
    if (!auditResult) return [];
    const q = searchQuery.trim().toLowerCase();
    return auditResult.rows.filter(row => {
      if (dateFilter !== 'ALL' && row.date !== dateFilter) return false;
      if (statusFilter === 'ISSUES_ONLY' && row.status === 'MATCHED') return false;
      if (
        statusFilter !== 'ALL' &&
        statusFilter !== 'ISSUES_ONLY' &&
        row.status !== statusFilter
      ) {
        return false;
      }
      if (procedureFilter !== 'ALL') {
        const hisProc = row.his?.normalizedProcedure || '';
        const tlProc = row.timeline?.procedureName || '';
        if (hisProc !== procedureFilter && tlProc !== procedureFilter) return false;
      }
      if (q) {
        const haystack = [
          row.patientName,
          row.patientMeta,
          row.his?.normalizedProcedure,
          row.timeline?.procedureName,
          row.his?.mainStaff,
          row.his?.assistant1,
          row.his?.assistant2,
          row.timeline?.mainStaff,
          row.timeline?.assistant1,
          row.timeline?.assistant2,
          row.his?.normalizedMachine,
          row.timeline?.normalizedMachine,
          row.diffReasons.join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [auditResult, dateFilter, statusFilter, procedureFilter, searchQuery]);

  const RENDER_LIMIT = 200;
  const visibleRows = showAllRows ? filteredRows : filteredRows.slice(0, RENDER_LIMIT);

  const handleDownloadResultCsv = () => {
    if (!auditResult) return;
    const rowsToExport = filteredRows.length > 0 ? filteredRows : auditResult.rows;
    const { headers, data } = buildAuditExportData(rowsToExport);
    const dateTag =
      dateFilter !== 'ALL'
        ? dateFilter
        : auditResult.summary.detectedDates.length === 1
          ? auditResult.summary.detectedDates[0]
          : `${auditResult.summary.detectedDates[0] || currentDate}_MultiDay`;
    downloadCSV(
      data,
      `DoiChieu_ThuThuat_HIS_${currentDept.name.replace(/\s+/g, '_')}_${dateTag}.csv`,
      headers
    );
  };

  if (!isOpen) return null;

  const formatDateVi = (iso: string) => {
    const parts = iso.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
  };

  const renderStaffStack = (
    main: string,
    asst1: string,
    asst2: string,
    diffs?: { main: boolean; asst1: boolean; asst2: boolean; swapped: boolean },
    side?: 'HIS' | 'TL'
  ) => {
    if (!main && !asst1 && !asst2) {
      return <span className="text-xs text-slate-400 italic">— Trống —</span>;
    }
    return (
      <div className="space-y-0.5 text-xs">
        <div
          className={`font-semibold truncate ${
            diffs?.main
              ? 'text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300'
              : 'text-slate-800'
          }`}
          title={main ? `Chính (${side}): ${main}` : 'Chưa có người thực hiện chính'}
        >
          {main || <span className="text-rose-600 italic">Thiếu NS chính</span>}
        </div>
        {(asst1 || diffs?.asst1 || diffs?.swapped) && (
          <div
            className={`text-[11px] truncate ${
              diffs?.asst1 || diffs?.swapped
                ? 'text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300 font-semibold'
                : 'text-slate-600'
            }`}
          >
            <span className="text-slate-400 font-medium">P1:</span>{' '}
            {asst1 || <span className="text-rose-600 italic">Trống</span>}
          </div>
        )}
        {(asst2 || diffs?.asst2 || diffs?.swapped) && (
          <div
            className={`text-[11px] truncate ${
              diffs?.asst2 || diffs?.swapped
                ? 'text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300 font-semibold'
                : 'text-slate-600'
            }`}
          >
            <span className="text-slate-400 font-medium">P2:</span>{' '}
            {asst2 || <span className="text-rose-600 italic">Trống</span>}
          </div>
        )}
      </div>
    );
  };

  const renderStatusIndicator = (row: AuditComparisonRow) => {
    switch (row.status) {
      case 'MATCHED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            Khớp
          </span>
        );
      case 'MISMATCH':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            Sai lệch
          </span>
        );
      case 'MISSING_IN_TIMELINE':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700">
            <XCircle size={14} className="text-rose-600 shrink-0" />
            Thiếu Timeline
          </span>
        );
      case 'MISSING_IN_HIS':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700">
            <XCircle size={14} className="text-purple-600 shrink-0" />
            Thiếu HIS
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[220] flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[94vw] xl:max-w-[1400px] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight truncate">
                  Đối chiếu Sổ Thủ Thuật VNPT-HIS & Timeline Khoa
                </h3>
                <span className="text-xs font-semibold text-slate-500 border-l border-slate-300 pl-2.5">
                  Khoa: <strong className="text-slate-800">{currentDept.name}</strong>
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                <span>
                  Chế độ chỉ đọc — Không chỉnh sửa dữ liệu Timeline. Tự động bỏ qua Sắc thuốc (HIS) & Đi buồng/Khám (Timeline).
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {auditResult && !isAnalyzing && (
              <>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw size={14} />
                  Chọn file khác
                </button>
                <button
                  type="button"
                  onClick={handleDownloadResultCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Download size={14} />
                  Tải kết quả CSV ({filteredRows.length})
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0])}
        />

        {/* Main Content */}
        {isAnalyzing ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-white">
            <div className="w-full max-w-md space-y-4">
              <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                <span>Đang phân tích & đối chiếu dữ liệu...</span>
                <span className="font-mono tabular-nums text-sky-600 text-base font-extrabold">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-600 transition-all duration-150 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 text-center font-medium">
                {progressStage || 'Đang xử lý...'}
              </p>
            </div>
          </div>
        ) : !auditResult ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col items-center justify-center bg-slate-50/40">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileSelected(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all bg-white ${
                isDragging
                  ? 'border-sky-500 bg-sky-50/50'
                  : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50/50'
              }`}
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
                <Upload size={26} />
              </div>
              <h4 className="text-base font-extrabold text-slate-800">
                Kéo thả hoặc bấm để tải file CSV Sổ Thủ Thuật VNPT-HIS
              </h4>
              <p className="text-xs text-slate-500 mt-1.5 max-w-lg mx-auto leading-relaxed">
                Hỗ trợ file xuất dạng <span className="font-mono font-semibold text-slate-700">NGT010_SOTHUTHUAT_EXCELL...csv</span> (1 ngày hoặc nhiều ngày). Hệ thống tự động nhận diện toàn bộ ngày có trong file và đối chiếu với Timeline của <strong>{currentDept.name}</strong>.
              </p>
              <button
                type="button"
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
              >
                <Upload size={15} />
                Chọn file CSV từ máy tính
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 w-full max-w-2xl p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="mt-6 w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="font-bold text-slate-800 mb-1">1. Tiêu chí kiểm tra</div>
                <p className="text-slate-500 leading-relaxed">
                  Đối chiếu Bệnh nhân, Tên thủ thuật, Khung giờ (Bắt đầu – Kết thúc), Nhân sự Chính, Phụ 1, Phụ 2 và Mã máy.
                </p>
              </div>
              <div>
                <div className="font-bold text-slate-800 mb-1">2. Tự động lọc nhiễu</div>
                <p className="text-slate-500 leading-relaxed">
                  Tự bỏ qua dòng Sắc thuốc / Nhân viên sắc thuốc ở HIS và Đi buồng / Khám vào-ra viện trên Timeline.
                </p>
              </div>
              <div>
                <div className="font-bold text-slate-800 mb-1">3. Xuất báo cáo CSV</div>
                <p className="text-slate-500 leading-relaxed">
                  Tải về bảng tổng hợp sai lệch hai vế HIS ↔ Timeline để nhân viên rà soát và tự chỉnh lại cho chuẩn.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Strip (Single-Elevation Flat Grid, Tabular Numerals) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter(prev => (prev === 'MATCHED' ? 'ALL' : 'MATCHED'))}
                className={`px-4 py-2.5 text-left transition-colors cursor-pointer ${
                  statusFilter === 'MATCHED' ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Khớp hoàn toàn
                </div>
                <div className="text-xl font-extrabold text-emerald-600 font-mono tabular-nums mt-0.5">
                  {auditResult.summary.matchedCount}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter(prev => (prev === 'MISMATCH' ? 'ALL' : 'MISMATCH'))}
                className={`px-4 py-2.5 text-left transition-colors cursor-pointer ${
                  statusFilter === 'MISMATCH' ? 'bg-amber-50/80' : 'hover:bg-slate-50'
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Sai lệch chi tiết
                </div>
                <div className="text-xl font-extrabold text-amber-600 font-mono tabular-nums mt-0.5">
                  {auditResult.summary.mismatchCount}
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatusFilter(prev =>
                    prev === 'MISSING_IN_TIMELINE' ? 'ALL' : 'MISSING_IN_TIMELINE'
                  )
                }
                className={`px-4 py-2.5 text-left transition-colors cursor-pointer ${
                  statusFilter === 'MISSING_IN_TIMELINE' ? 'bg-rose-50/80' : 'hover:bg-slate-50'
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Thiếu trên Timeline
                </div>
                <div className="text-xl font-extrabold text-rose-600 font-mono tabular-nums mt-0.5">
                  {auditResult.summary.missingInTimelineCount}
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatusFilter(prev => (prev === 'MISSING_IN_HIS' ? 'ALL' : 'MISSING_IN_HIS'))
                }
                className={`px-4 py-2.5 text-left transition-colors cursor-pointer ${
                  statusFilter === 'MISSING_IN_HIS' ? 'bg-purple-50/80' : 'hover:bg-slate-50'
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Thiếu trên HIS
                </div>
                <div className="text-xl font-extrabold text-purple-600 font-mono tabular-nums mt-0.5">
                  {auditResult.summary.missingInHisCount}
                </div>
              </button>

              <div className="px-4 py-2.5 text-left bg-slate-50/60 col-span-2 sm:col-span-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Tự động bỏ qua
                </div>
                <div className="text-sm font-bold text-slate-700 font-mono tabular-nums mt-1">
                  HIS: {auditResult.summary.excludedHisCount} • TL: {auditResult.summary.excludedTimelineCount}
                </div>
              </div>
            </div>

            {/* Warning if any CSV dates have zero Timeline appointments */}
            {auditResult.summary.datesWithoutTimelineData.length > 0 && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Info size={14} className="shrink-0 text-amber-600" />
                  <span>
                    Ngày{' '}
                    <strong className="font-mono">
                      {auditResult.summary.datesWithoutTimelineData.map(formatDateVi).join(', ')}
                    </strong>{' '}
                    trong file chưa có lịch thủ thuật nào trên Timeline của {currentDept.name} (hoặc dữ liệu ngày đó chưa tải xong).
                  </span>
                </div>
                {onChangeDate && auditResult.summary.detectedDates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeDate(auditResult.summary.detectedDates[0]);
                      onClose();
                    }}
                    className="px-2.5 py-1 bg-white border border-amber-300 rounded-md text-amber-800 font-bold hover:bg-amber-100 whitespace-nowrap cursor-pointer"
                  >
                    Chuyển Timeline tới ngày {formatDateVi(auditResult.summary.detectedDates[0])}
                  </button>
                )}
              </div>
            )}

            {/* Toolbar Filters */}
            <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2.5 flex-wrap shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Date filter */}
                <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                  <Calendar size={13} className="text-slate-400" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer font-mono tabular-nums"
                  >
                    <option value="ALL">
                      Tất cả ngày ({auditResult.summary.detectedDates.length})
                    </option>
                    {auditResult.summary.detectedDates.map(d => (
                      <option key={d} value={d}>
                        {formatDateVi(d)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái ({auditResult.rows.length})</option>
                  <option value="ISSUES_ONLY">
                    Chỉ xem sai lệch & thiếu (
                    {auditResult.summary.mismatchCount +
                      auditResult.summary.missingInTimelineCount +
                      auditResult.summary.missingInHisCount}
                    )
                  </option>
                  <option value="MISMATCH">Sai lệch chi tiết ({auditResult.summary.mismatchCount})</option>
                  <option value="MISSING_IN_TIMELINE">
                    Thiếu trên Timeline ({auditResult.summary.missingInTimelineCount})
                  </option>
                  <option value="MISSING_IN_HIS">
                    Thiếu trên HIS ({auditResult.summary.missingInHisCount})
                  </option>
                  <option value="MATCHED">Khớp hoàn toàn ({auditResult.summary.matchedCount})</option>
                </select>

                {/* Procedure filter */}
                <select
                  value={procedureFilter}
                  onChange={(e) => setProcedureFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả thủ thuật</option>
                  {uniqueProcedures.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                {/* Search */}
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm BN, nhân viên, mã máy..."
                    className="pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-400 w-52"
                  />
                </div>
              </div>

              {/* Time tolerance toggle & file info */}
              <div className="flex items-center gap-3 text-xs">
                <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                  <span className="px-2 text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1">
                    <Clock size={12} /> Dung sai giờ:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToleranceChange(0)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      timeTolerance === 0
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Đúng từng phút
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToleranceChange(5)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      timeTolerance === 5
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ±5 phút
                  </button>
                </div>
              </div>
            </div>

            {/* High-Density Comparison Table */}
            <div className="flex-1 overflow-auto bg-white">
              {filteredRows.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                  <div className="text-sm font-bold text-slate-700">
                    Không có dòng nào phù hợp bộ lọc hiện tại
                  </div>
                  <p className="text-xs text-slate-500">
                    Thử chuyển bộ lọc sang "Tất cả trạng thái" hoặc xóa từ khóa tìm kiếm.
                  </p>
                </div>
              ) : (
                <table className="w-full min-w-[1060px] text-left border-collapse">
                  <thead className="bg-slate-50 sticky top-0 z-20 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    <tr className="divide-x divide-slate-200">
                      <th className="px-3 py-2.5 w-24">Ngày / Trạng thái</th>
                      <th className="px-3 py-2.5 w-44">Bệnh nhân</th>
                      <th className="px-3 py-2.5 w-36">Thủ thuật</th>
                      <th className="px-3 py-2.5 w-48 bg-sky-50/50 text-sky-900">
                        Giờ & Máy (VNPT-HIS)
                      </th>
                      <th className="px-3 py-2.5 w-48 bg-sky-50/50 text-sky-900">
                        Nhân sự (VNPT-HIS)
                      </th>
                      <th className="px-3 py-2.5 w-48 bg-emerald-50/40 text-emerald-900">
                        Giờ & Máy (Timeline)
                      </th>
                      <th className="px-3 py-2.5 w-48 bg-emerald-50/40 text-emerald-900">
                        Nhân sự (Timeline)
                      </th>
                      <th className="px-3 py-2.5 min-w-[200px]">Chi tiết đối chiếu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {visibleRows.map(row => {
                      const rowBg =
                        row.status === 'MATCHED'
                          ? 'hover:bg-slate-50/70'
                          : row.status === 'MISMATCH'
                            ? 'bg-amber-50/20 hover:bg-amber-50/40'
                            : row.status === 'MISSING_IN_TIMELINE'
                              ? 'bg-rose-50/25 hover:bg-rose-50/45'
                              : 'bg-purple-50/20 hover:bg-purple-50/40';

                      return (
                        <tr key={row.id} className={`divide-x divide-slate-200 align-top ${rowBg}`}>
                          {/* Date & Status */}
                          <td className="px-3 py-2.5 space-y-1">
                            <div className="font-mono tabular-nums text-[11px] font-semibold text-slate-500">
                              {row.displayDate}
                            </div>
                            <div>{renderStatusIndicator(row)}</div>
                          </td>

                          {/* Patient */}
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-slate-900 leading-snug">
                              {row.patientName}
                            </div>
                            {row.patientMeta && (
                              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                {row.patientMeta}
                              </div>
                            )}
                          </td>

                          {/* Procedure */}
                          <td className="px-3 py-2.5">
                            {row.his && row.timeline && row.diffs.procedure ? (
                              <div className="space-y-1">
                                <div className="font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300">
                                  HIS: {row.his.normalizedProcedure}
                                </div>
                                <div className="font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300">
                                  TL: {row.timeline.procedureName}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="font-bold text-slate-800">
                                  {row.timeline?.procedureName || row.his?.normalizedProcedure}
                                </div>
                                {row.his?.rawProcedure &&
                                  row.his.rawProcedure !== row.his.normalizedProcedure && (
                                    <div
                                      className="text-[11px] text-slate-400 truncate max-w-[160px] mt-0.5"
                                      title={row.his.rawProcedure}
                                    >
                                      {row.his.rawProcedure}
                                    </div>
                                  )}
                              </>
                            )}
                          </td>

                          {/* Time & Machine (HIS) */}
                          <td className="px-3 py-2.5">
                            {row.his ? (
                              <div className="space-y-1">
                                <div
                                  className={`font-mono tabular-nums font-bold inline-block ${
                                    row.status === 'MISMATCH' && row.diffs.time
                                      ? 'text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300'
                                      : 'text-slate-800'
                                  }`}
                                >
                                  {row.his.startTime} – {row.his.endTime}
                                </div>
                                <div>
                                  <span
                                    className={`font-mono tabular-nums text-[11px] font-bold inline-block ${
                                      row.status === 'MISMATCH' && row.diffs.machine
                                        ? 'text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300'
                                        : 'text-slate-600'
                                    }`}
                                  >
                                    Máy: {row.his.normalizedMachine || '—'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-rose-600 font-semibold italic">
                                Không có trên HIS
                              </span>
                            )}
                          </td>

                          {/* Staff (HIS) */}
                          <td className="px-3 py-2.5">
                            {row.his ? (
                              renderStaffStack(
                                row.his.mainStaff,
                                row.his.assistant1,
                                row.his.assistant2,
                                row.status === 'MISMATCH'
                                  ? {
                                      main: row.diffs.mainStaff,
                                      asst1: row.diffs.assistant1,
                                      asst2: row.diffs.assistant2,
                                      swapped: row.diffs.swappedAssistants,
                                    }
                                  : undefined,
                                'HIS'
                              )
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          {/* Time & Machine (Timeline) */}
                          <td className="px-3 py-2.5">
                            {row.timeline ? (
                              <div className="space-y-1">
                                <div
                                  className={`font-mono tabular-nums font-bold inline-block ${
                                    row.status === 'MISMATCH' && row.diffs.time
                                      ? 'text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300'
                                      : 'text-slate-800'
                                  }`}
                                >
                                  {row.timeline.startTime} – {row.timeline.endTime}
                                </div>
                                <div>
                                  <span
                                    className={`font-mono tabular-nums text-[11px] font-bold inline-block ${
                                      row.status === 'MISMATCH' && row.diffs.machine
                                        ? 'text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300'
                                        : 'text-slate-600'
                                    }`}
                                  >
                                    Máy: {row.timeline.normalizedMachine || '—'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-rose-600 font-semibold italic">
                                Chưa có trên Timeline
                              </span>
                            )}
                          </td>

                          {/* Staff (Timeline) */}
                          <td className="px-3 py-2.5">
                            {row.timeline ? (
                              renderStaffStack(
                                row.timeline.mainStaff,
                                row.timeline.assistant1,
                                row.timeline.assistant2,
                                row.status === 'MISMATCH'
                                  ? {
                                      main: row.diffs.mainStaff,
                                      asst1: row.diffs.assistant1,
                                      asst2: row.diffs.assistant2,
                                      swapped: row.diffs.swappedAssistants,
                                    }
                                  : undefined,
                                'TL'
                              )
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          {/* Diff Reasons */}
                          <td className="px-3 py-2.5">
                            {row.status === 'MATCHED' ? (
                              <span className="text-emerald-700 font-medium">
                                Khớp giờ, thủ thuật, nhân sự & máy
                              </span>
                            ) : (
                              <ul className="space-y-0.5 text-[11px] font-semibold text-slate-700 list-disc list-inside">
                                {row.diffReasons.map((reason, idx) => (
                                  <li key={idx}>{reason}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {filteredRows.length > RENDER_LIMIT && !showAllRows && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-3 text-xs">
                  <span className="text-slate-600 font-medium">
                    Đang hiển thị {RENDER_LIMIT}/{filteredRows.length} dòng để giữ mượt giao diện.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllRows(true)}
                    className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold text-sky-700 hover:bg-sky-50 cursor-pointer"
                  >
                    Hiển thị toàn bộ {filteredRows.length} dòng
                  </button>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <div className="truncate">
                File: <strong className="text-slate-700">{auditResult.fileName}</strong> • Tổng{' '}
                <strong className="font-mono tabular-nums text-slate-700">
                  {auditResult.summary.totalHisClinicalRows}
                </strong>{' '}
                thủ thuật HIS /{' '}
                <strong className="font-mono tabular-nums text-slate-700">
                  {auditResult.summary.totalTimelineClinicalRows}
                </strong>{' '}
                thủ thuật Timeline
              </div>
              <div className="font-mono tabular-nums shrink-0">
                Đang hiện: <strong className="text-slate-800">{filteredRows.length}</strong> /{' '}
                {auditResult.rows.length} dòng
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
