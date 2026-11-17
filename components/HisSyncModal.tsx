import React, { useState, useEffect, useMemo } from 'react';
import { Patient, PatientStatus, Department, DepartmentType, BedType, InsuranceLevel } from '../types';
import { DEPARTMENTS } from '../constants';
import {
  HisIncomingPatient,
  HisMismatchItem,
  HisNewPatientItem,
  compareHisPatientsWithMedFlow,
  isValidDdMmYyyy,
  ddMmYyyyAndTimeToIso,
  normalizeText
} from '../utils/hisSyncUtils';
import {
  RefreshCw, X, AlertTriangle, CheckCircle2, UserPlus, Info, ArrowRight, Users
} from 'lucide-react';

interface HisSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  currentDept: Department | null;
  incomingBatch: {
    patients: HisIncomingPatient[];
    deptId?: string;
    deptName?: string;
    receivedAt: number;
  } | null;
  onApplyBatchPatients: (patientsToSave: Patient[]) => Promise<boolean>;
  onSyncCompleted?: (summary: { updatedCount: number; addedCount: number; deptId: string }) => void;
}

type SyncSubTab = 'MISMATCHED' | 'NEW' | 'MATCHED' | 'MISSING_IN_HIS';

export const HisSyncModal: React.FC<HisSyncModalProps> = ({
  isOpen,
  onClose,
  patients,
  currentDept,
  incomingBatch,
  onApplyBatchPatients,
  onSyncCompleted
}) => {
  const clinicalDepts = useMemo(
    () => DEPARTMENTS.filter(d => d.type === DepartmentType.CLINICAL),
    []
  );

  const resolveDeptId = (hintDeptId?: string, hintDeptName?: string): string => {
    if (hintDeptId && clinicalDepts.some(d => d.id === hintDeptId)) return hintDeptId;
    if (hintDeptName) {
      const normHint = normalizeText(hintDeptName).replace(/^khoa\s+/, '');
      const matched = clinicalDepts.find(d => {
        const normD = normalizeText(d.name).replace(/^khoa\s+/, '');
        return normD === normHint || normHint.includes(normD) || normD.includes(normHint);
      });
      if (matched) return matched.id;
    }
    if (currentDept && currentDept.type === DepartmentType.CLINICAL) return currentDept.id;
    return clinicalDepts[0]?.id || 'dept_phcn';
  };

  const [targetDeptId, setTargetDeptId] = useState<string>(() => resolveDeptId(incomingBatch?.deptId, incomingBatch?.deptName));
  const [rawIncoming, setRawIncoming] = useState<HisIncomingPatient[] | null>(null);
  const [mismatchedRows, setMismatchedRows] = useState<HisMismatchItem[]>([]);
  const [newRows, setNewRows] = useState<HisNewPatientItem[]>([]);
  const [selectedMismatchIds, setSelectedMismatchIds] = useState<Set<string>>(new Set());
  const [selectedNewIds, setSelectedNewIds] = useState<Set<string>>(new Set());
  const [activeSubTab, setActiveSubTab] = useState<SyncSubTab>('MISMATCHED');

  const [isSaving, setIsSaving] = useState(false);

  const requestSyncFromExtension = (deptIdToRequest: string) => {
    const deptObj = DEPARTMENTS.find(d => d.id === deptIdToRequest);
    const payload = {
      type: 'MEDFLOW_REQUEST_HIS_SYNC',
      deptId: deptIdToRequest,
      deptName: deptObj?.name || ''
    };
    try {
      window.postMessage(payload, '*');
      window.dispatchEvent(new CustomEvent('medflow-request-his-sync', { detail: payload }));
    } catch (e) {}
  };

  // Sync targetDeptId & request data from Extension if opened directly
  useEffect(() => {
    if (!isOpen) return;
    if (incomingBatch && incomingBatch.patients) {
      const resolvedId = resolveDeptId(incomingBatch.deptId, incomingBatch.deptName);
      setTargetDeptId(resolvedId);
      setRawIncoming(incomingBatch.patients);
    } else {
      const resolvedId = currentDept && currentDept.type === DepartmentType.CLINICAL
        ? currentDept.id
        : (clinicalDepts[0]?.id || 'dept_phcn');
      setRawIncoming(null);
      setTargetDeptId(resolvedId);
      requestSyncFromExtension(resolvedId);
    }
  }, [isOpen, incomingBatch]);

  // Compute comparison snapshot when rawIncoming or targetDeptId changes
  const comparison = useMemo(() => {
    if (!rawIncoming) return null;
    return compareHisPatientsWithMedFlow(rawIncoming, patients, targetDeptId);
  }, [rawIncoming, targetDeptId, patients]);

  // Initialize editable rows once when rawIncoming or targetDeptId changes (keep user's inline edits & synced status)
  useEffect(() => {
    if (!rawIncoming) {
      setMismatchedRows([]);
      setNewRows([]);
      setSelectedMismatchIds(new Set());
      setSelectedNewIds(new Set());
      return;
    }
    const fresh = compareHisPatientsWithMedFlow(rawIncoming, patients, targetDeptId);
    setMismatchedRows(fresh.mismatched);
    setNewRows(fresh.newPatients);
    setSelectedMismatchIds(new Set(fresh.mismatched.map(m => m.syncId)));
    setSelectedNewIds(new Set(fresh.newPatients.map(n => n.syncId)));

    if (fresh.mismatched.length > 0) {
      setActiveSubTab('MISMATCHED');
    } else if (fresh.newPatients.length > 0) {
      setActiveSubTab('NEW');
    } else {
      setActiveSubTab('MATCHED');
    }
  }, [rawIncoming, targetDeptId]);

  const targetDept = DEPARTMENTS.find(d => d.id === targetDeptId) || currentDept;

  const activePatientsInDept = useMemo(
    () => patients.filter(p => p.admittedByDeptId === targetDeptId && p.status === PatientStatus.TREATING),
    [patients, targetDeptId]
  );

  // Live validation for New Patients rows
  const validatedNewRows = useMemo(() => {
    const activeBedsInDept = new Set(activePatientsInDept.map(p => (p.bedNumber || '').trim()).filter(Boolean));
    const activeCodesInDept = new Set(activePatientsInDept.map(p => normalizeText(p.code)).filter(Boolean));

    return newRows.map((item, idx) => {
      const trimmedCode = (item.code || '').trim();
      const normCode = normalizeText(trimmedCode);
      const isCodeMissing = !trimmedCode;
      const isCodeDuplicateInDb = !item.added && normCode ? activeCodesInDept.has(normCode) : false;
      const isCodeDuplicateInBatch = !item.added && normCode
        ? newRows.some((x, j) => j !== idx && !x.added && normalizeText(x.code) === normCode)
        : false;
      const hasCodeError = !item.added && (isCodeMissing || isCodeDuplicateInDb || isCodeDuplicateInBatch);

      const trimmedBed = (item.bedNumber || '').trim();
      const isBedOccupied = !item.added && trimmedBed ? activeBedsInDept.has(trimmedBed) : false;
      const isBedDupInBatch = !item.added && trimmedBed
        ? newRows.some((x, j) => j !== idx && !x.added && (x.bedNumber || '').trim() === trimmedBed)
        : false;
      const hasBedConflict = !item.added && (isBedOccupied || isBedDupInBatch);
      const isDateValid = item.added || isValidDdMmYyyy(item.admissionDate);

      return {
        ...item,
        isCodeMissing,
        isCodeDuplicateInDb,
        isCodeDuplicateInBatch,
        hasCodeError,
        isBedOccupied,
        isBedDupInBatch,
        hasBedConflict,
        isDateValid
      };
    });
  }, [newRows, activePatientsInDept]);

  // Live validation for Mismatched rows
  const validatedMismatchedRows = useMemo(() => {
    return mismatchedRows.map((item, idx) => {
      const trimmedCode = (item.code || '').trim();
      const normCode = normalizeText(trimmedCode);
      const isCodeMissing = !trimmedCode;
      const isCodeDupInDb = !item.synced && normCode
        ? activePatientsInDept.some(p => p.id !== item.patientId && normalizeText(p.code) === normCode)
        : false;
      const isCodeDupInBatch = !item.synced && normCode
        ? mismatchedRows.some((x, j) => j !== idx && !x.synced && normalizeText(x.code) === normCode)
        : false;
      const hasCodeError = !item.synced && (isCodeMissing || isCodeDupInDb || isCodeDupInBatch);
      const isDateValid = item.synced || isValidDdMmYyyy(item.admissionDate);

      return {
        ...item,
        isCodeMissing,
        isCodeDupInDb,
        isCodeDupInBatch,
        hasCodeError,
        isDateValid
      };
    });
  }, [mismatchedRows, activePatientsInDept]);

  if (!isOpen) return null;

  const buildUpdatedPatient = (row: HisMismatchItem): Patient => {
    const cleanYob = (row.yob || '').replace(/\D/g, '').slice(0, 4);
    const oldDobParts = (row.existingPatient.dob || '1970-01-01').split('-');
    const nextDob = cleanYob
      ? `${cleanYob}-${oldDobParts[1] || '01'}-${oldDobParts[2] || '01'}`
      : row.existingPatient.dob;

    return {
      ...row.existingPatient,
      code: row.code.trim(),
      name: row.name.trim() || row.existingPatient.name,
      dob: nextDob,
      bedNumber: (row.bedNumber || '').trim(),
      roomNumber: (row.roomNumber || '').trim() || row.existingPatient.roomNumber || '',
      bedType: row.bedType || row.existingPatient.bedType || 'Nội trú',
      insuranceLevel: row.insuranceLevel || row.existingPatient.insuranceLevel || '100%',
      admissionDate: ddMmYyyyAndTimeToIso(
        row.admissionDate,
        row.admissionTime,
        row.existingPatient.admissionDate
      )
      // gender intentionally preserved untouched from existingPatient
    };
  };

  const buildNewPatient = (row: HisNewPatientItem): Patient => {
    const cleanYob = (row.yob || '').replace(/\D/g, '').slice(0, 4) || '1960';
    return {
      id: `p_${Math.random().toString(36).substr(2, 9)}`,
      name: row.name.trim(),
      dob: `${cleanYob}-01-01`,
      gender: row.gender || 'Nam',
      code: row.code.trim(),
      bedNumber: (row.bedNumber || '').trim(),
      roomNumber: (row.roomNumber || '').trim(),
      admissionDate: ddMmYyyyAndTimeToIso(row.admissionDate, row.admissionTime),
      dischargeDate: null,
      bedType: row.bedType || 'Nội trú',
      status: PatientStatus.TREATING,
      admittedByDeptId: targetDeptId,
      referrals: [],
      insuranceLevel: row.insuranceLevel || '100%',
      note: (row.note || '').trim()
    };
  };

  const handleSyncMismatchedItems = async (itemsToSync: typeof validatedMismatchedRows) => {
    const pending = itemsToSync.filter(i => !i.synced);
    if (pending.length === 0) return;

    const bad = pending.find(i => i.hasCodeError || !i.isDateValid || !i.name.trim());
    if (bad) {
      alert(`Vui lòng kiểm tra lại dòng bệnh nhân "${bad.name || bad.code}": thiếu/trùng mã bệnh án hoặc sai định dạng ngày (dd/mm/yyyy).`);
      return;
    }

    setIsSaving(true);
    try {
      const updatedPatients = pending.map(buildUpdatedPatient);
      const ok = await onApplyBatchPatients(updatedPatients);
      if (ok) {
        const syncedSet = new Set(pending.map(i => i.syncId));
        setMismatchedRows(prev => prev.map(r => syncedSet.has(r.syncId) ? { ...r, synced: true } : r));
        setSelectedMismatchIds(prev => {
          const next = new Set(prev);
          pending.forEach(i => next.delete(i.syncId));
          return next;
        });
        onSyncCompleted?.({ updatedCount: updatedPatients.length, addedCount: 0, deptId: targetDeptId });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNewItems = async (itemsToAdd: typeof validatedNewRows, allowBedConflictOverride = false) => {
    const pending = itemsToAdd.filter(i => !i.added);
    if (pending.length === 0) return;

    const badCodeOrDate = pending.find(i => i.hasCodeError || !i.isDateValid || !i.name.trim());
    if (badCodeOrDate) {
      alert(`Bệnh nhân "${badCodeOrDate.name || badCodeOrDate.code}" bị thiếu/trùng Mã bệnh án hoặc sai định dạng ngày vào viện (dd/mm/yyyy).`);
      return;
    }

    const bedConflicts = pending.filter(i => i.hasBedConflict);
    if (bedConflicts.length > 0 && !allowBedConflictOverride) {
      const names = bedConflicts.map(b => `${b.name} (Giường ${b.bedNumber})`).slice(0, 3).join(', ');
      const confirmProceed = window.confirm(
        `Có ${bedConflicts.length} bệnh nhân mới trùng số giường đang có người nằm trong khoa (${names}${bedConflicts.length > 3 ? '...' : ''}).\nBạn có vẫn muốn thêm vào không?`
      );
      if (!confirmProceed) return;
    }

    setIsSaving(true);
    try {
      const patientsToCreate = pending.map(buildNewPatient);
      const ok = await onApplyBatchPatients(patientsToCreate);
      if (ok) {
        const addedSet = new Set(pending.map(i => i.syncId));
        setNewRows(prev => prev.map(r => addedSet.has(r.syncId) ? { ...r, added: true } : r));
        setSelectedNewIds(prev => {
          const next = new Set(prev);
          pending.forEach(i => next.delete(i.syncId));
          return next;
        });
        onSyncCompleted?.({ updatedCount: 0, addedCount: patientsToCreate.length, deptId: targetDeptId });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const pendingMismatchCount = validatedMismatchedRows.filter(r => !r.synced).length;
  const pendingNewCount = validatedNewRows.filter(r => !r.added).length;
  const selectedPendingMismatches = validatedMismatchedRows.filter(r => !r.synced && selectedMismatchIds.has(r.syncId));
  const selectedPendingNews = validatedNewRows.filter(r => !r.added && selectedNewIds.has(r.syncId));

  const allPendingMismatchesSelected = pendingMismatchCount > 0 && selectedPendingMismatches.length === pendingMismatchCount;
  const allPendingNewsSelected = pendingNewCount > 0 && selectedPendingNews.length === pendingNewCount;

  const updateMismatchField = (syncId: string, field: keyof HisMismatchItem, value: any) => {
    setMismatchedRows(prev => prev.map(r => r.syncId === syncId ? { ...r, [field]: value } : r));
  };

  const updateNewField = (syncId: string, field: keyof HisNewPatientItem, value: any) => {
    setNewRows(prev => prev.map(r => r.syncId === syncId ? { ...r, [field]: value } : r));
  };

  return (
    <div className="fixed inset-0 z-[220] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className={`bg-white rounded-3xl p-5 sm:p-7 w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[94vh] ${
        !rawIncoming ? 'max-w-3xl' : 'max-w-[97vw] 2xl:max-w-[1520px]'
      }`}>
        {/* Modal Header */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4 border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-xs">
              <RefreshCw size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">
                Đồng bộ & Đối chiếu bệnh nhân VNPT-HIS
              </h3>
              <p className="text-xs text-slate-500 font-semibold flex items-center gap-2 mt-0.5">
                <span>Khoa đối chiếu:</span>
                <select
                  value={targetDeptId}
                  onChange={e => setTargetDeptId(e.target.value)}
                  className="bg-slate-100 hover:bg-slate-200/70 text-slate-800 font-black px-2.5 py-0.5 rounded-lg border border-slate-200 outline-none cursor-pointer text-xs"
                >
                  {clinicalDepts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {targetDept && (
                  <span className="text-[11px] text-slate-400">
                    ({activePatientsInDept.length} BN đang điều trị trên MedFlow)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!rawIncoming ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
              <RefreshCw size={26} className="animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                Đang chờ dữ liệu từ Extension VNPT-HIS
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hãy bấm nút đồng bộ trên Extension của bạn (hoặc tại danh sách bệnh nhân VNPT-HIS), bảng đối chiếu sai lệch &amp; bệnh nhân mới sẽ tự động hiển thị ngay tại đây.
              </p>
            </div>
            <button
              type="button"
              onClick={() => requestSyncFromExtension(targetDeptId)}
              className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} />
              <span>Gửi lại yêu cầu đồng bộ</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Summary Tab Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('MISMATCHED')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
                    activeSubTab === 'MISMATCHED'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50'
                  }`}
                >
                  <AlertTriangle size={14} />
                  <span>Sai lệch thông tin</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    activeSubTab === 'MISMATCHED' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pendingMismatchCount}{mismatchedRows.length > pendingMismatchCount ? `/${mismatchedRows.length}` : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('NEW')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
                    activeSubTab === 'NEW'
                      ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50'
                  }`}
                >
                  <UserPlus size={14} />
                  <span>Bệnh nhân mới (Chưa có trên MedFlow)</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    activeSubTab === 'NEW' ? 'bg-white/25 text-white' : 'bg-sky-100 text-sky-800'
                  }`}>
                    {pendingNewCount}{newRows.length > pendingNewCount ? `/${newRows.length}` : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('MATCHED')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
                    activeSubTab === 'MATCHED'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  <span>Khớp hoàn toàn</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    activeSubTab === 'MATCHED' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {comparison?.matched.length || 0}
                  </span>
                </button>

                {(comparison?.missingInHis.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('MISSING_IN_HIS')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
                      activeSubTab === 'MISSING_IN_HIS'
                        ? 'bg-slate-700 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Users size={14} />
                    <span>Chỉ có trên MedFlow</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                      activeSubTab === 'MISSING_IN_HIS' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {comparison?.missingInHis.length}
                    </span>
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-500 font-semibold">
                Tổng HIS gửi: <strong className="text-slate-800">{rawIncoming.length} BN</strong> • Không kiểm tra giới tính
              </div>
            </div>

            {/* SUB-TAB 1: MISMATCHED */}
            {activeSubTab === 'MISMATCHED' && (
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 shrink-0">
                  <div className="text-xs text-amber-900 font-semibold flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    {pendingMismatchCount > 0 ? (
                      <span>
                        Có <strong>{pendingMismatchCount}</strong> bệnh nhân đang sai lệch thông tin giữa VNPT-HIS và MedFlow. Bạn có thể sửa trực tiếp trên bảng và đồng bộ từng người hoặc tất cả.
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold">Tất cả các sai lệch đã được đồng bộ xong!</span>
                    )}
                  </div>
                  {pendingMismatchCount > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSaving || selectedPendingMismatches.length === 0}
                        onClick={() => handleSyncMismatchedItems(selectedPendingMismatches)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                          selectedPendingMismatches.length > 0 && !isSaving
                            ? 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 cursor-pointer shadow-xs'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        }`}
                      >
                        Đồng bộ đã chọn ({selectedPendingMismatches.length})
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSyncMismatchedItems(validatedMismatchedRows.filter(r => !r.synced))}
                        className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-sm cursor-pointer transition-all"
                      >
                        Đồng bộ tất cả thay đổi ({pendingMismatchCount})
                      </button>
                    </div>
                  )}
                </div>

                {validatedMismatchedRows.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 border border-slate-100 rounded-2xl">
                    <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
                    <p className="text-sm font-bold text-slate-600">Không có bệnh nhân nào sai lệch thông tin!</p>
                  </div>
                ) : (
                  <div className="flex-1 border border-slate-200 rounded-2xl overflow-auto shadow-inner scrollbar-thin">
                    <table className="min-w-[1520px] w-full text-sm text-left border-collapse table-fixed">
                      <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-20 text-[11px] uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-[44px] text-center">
                            <input
                              type="checkbox"
                              checked={allPendingMismatchesSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMismatchIds(new Set(validatedMismatchedRows.filter(r => !r.synced).map(r => r.syncId)));
                                } else {
                                  setSelectedMismatchIds(new Set());
                                }
                              }}
                              className="w-4 h-4 rounded accent-primary cursor-pointer"
                            />
                          </th>
                          <th className="p-3 w-[48px] text-center">STT</th>
                          <th className="p-3 w-[150px]">Mã bệnh án <span className="text-rose-500">*</span></th>
                          <th className="p-3 w-[210px]">Họ tên bệnh nhân</th>
                          <th className="p-3 w-[95px] text-center">Năm sinh</th>
                          <th className="p-3 w-[95px] text-center">Số giường</th>
                          <th className="p-3 w-[125px] text-center">Ngày vào</th>
                          <th className="p-3 w-[85px] text-center">Giờ vào</th>
                          <th className="p-3 w-[100px] text-center">Mức BHYT</th>
                          <th className="p-3 w-[145px]">Loại giường</th>
                          <th className="p-3 min-w-[230px]">Chi tiết sai lệch (MedFlow → HIS)</th>
                          <th className="p-3 w-[140px] text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validatedMismatchedRows.map((item, idx) => {
                          const hasDiff = (f: string) => item.diffs.some(d => d.field === f);
                          const getOldVal = (f: string) => item.diffs.find(d => d.field === f)?.oldValue;

                          return (
                            <tr key={item.syncId} className={item.synced ? 'bg-emerald-50/40 opacity-75' : 'hover:bg-slate-50/70'}>
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  disabled={item.synced}
                                  checked={!item.synced && selectedMismatchIds.has(item.syncId)}
                                  onChange={(e) => {
                                    setSelectedMismatchIds(prev => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(item.syncId);
                                      else next.delete(item.syncId);
                                      return next;
                                    });
                                  }}
                                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                                />
                              </td>
                              <td className="p-2.5 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  disabled={item.synced}
                                  value={item.code}
                                  onChange={e => updateMismatchField(item.syncId, 'code', e.target.value)}
                                  className={`w-full text-xs p-2 border rounded-xl font-mono font-bold text-center outline-none ${
                                    item.hasCodeError
                                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                                      : hasDiff('code')
                                      ? 'border-amber-400 bg-amber-50 text-amber-900'
                                      : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                />
                                {hasDiff('code') && (
                                  <div className="text-[10px] text-slate-400 line-through text-center mt-0.5 font-mono">
                                    Cũ: {getOldVal('code')}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  disabled={item.synced}
                                  value={item.name}
                                  onChange={e => updateMismatchField(item.syncId, 'name', e.target.value)}
                                  className={`w-full text-xs p-2 border rounded-xl uppercase font-black outline-none ${
                                    hasDiff('name') ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                />
                                {hasDiff('name') && (
                                  <div className="text-[10px] text-slate-400 line-through mt-0.5 truncate" title={getOldVal('name')}>
                                    Cũ: {getOldVal('name')}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="number"
                                  disabled={item.synced}
                                  value={item.yob}
                                  onChange={e => updateMismatchField(item.syncId, 'yob', e.target.value)}
                                  className={`w-full text-xs p-2 border rounded-xl font-mono font-bold text-center outline-none ${
                                    hasDiff('yob') ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                />
                                {hasDiff('yob') && (
                                  <div className="text-[10px] text-slate-400 line-through text-center mt-0.5">
                                    Cũ: {getOldVal('yob')}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  disabled={item.synced}
                                  value={item.bedNumber}
                                  onChange={e => updateMismatchField(item.syncId, 'bedNumber', e.target.value)}
                                  className={`w-full text-xs p-2 border rounded-xl font-bold text-center outline-none ${
                                    hasDiff('bedNumber') ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                />
                                {hasDiff('bedNumber') && (
                                  <div className="text-[10px] text-slate-400 line-through text-center mt-0.5">
                                    Cũ: {getOldVal('bedNumber')}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  disabled={item.synced}
                                  value={item.admissionDate}
                                  onChange={e => updateMismatchField(item.syncId, 'admissionDate', e.target.value)}
                                  className={`w-full text-xs p-2 border rounded-xl font-bold text-center outline-none ${
                                    !item.isDateValid
                                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                                      : hasDiff('admissionDate')
                                      ? 'border-amber-400 bg-amber-50 text-amber-900'
                                      : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                />
                                {hasDiff('admissionDate') && (
                                  <div className="text-[10px] text-slate-400 line-through text-center mt-0.5">
                                    Cũ: {getOldVal('admissionDate')}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  disabled={item.synced}
                                  value={item.admissionTime}
                                  onChange={e => updateMismatchField(item.syncId, 'admissionTime', e.target.value)}
                                  className={`w-full text-xs p-2 border rounded-xl font-mono font-bold text-center outline-none ${
                                    hasDiff('admissionTime') ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                />
                                {hasDiff('admissionTime') && (
                                  <div className="text-[10px] text-slate-400 line-through text-center mt-0.5">
                                    Cũ: {getOldVal('admissionTime')}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5">
                                <select
                                  disabled={item.synced}
                                  value={item.insuranceLevel}
                                  onChange={e => updateMismatchField(item.syncId, 'insuranceLevel', e.target.value as InsuranceLevel)}
                                  className={`w-full text-xs p-2 border rounded-xl font-bold outline-none ${
                                    hasDiff('insuranceLevel') ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                >
                                  <option value="100%">100%</option>
                                  <option value="95%">95%</option>
                                  <option value="80%">80%</option>
                                  <option value="0%">0%</option>
                                </select>
                                {hasDiff('insuranceLevel') && (
                                  <div className="text-[10px] text-slate-400 line-through text-center mt-0.5">
                                    Cũ: {getOldVal('insuranceLevel')}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5">
                                <select
                                  disabled={item.synced}
                                  value={item.bedType}
                                  onChange={e => updateMismatchField(item.syncId, 'bedType', e.target.value as BedType)}
                                  className={`w-full text-xs p-2 border rounded-xl font-bold outline-none ${
                                    hasDiff('bedType') ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                >
                                  <option value="Nội trú">Nội trú</option>
                                  <option value="Nội trú ban ngày">Nội trú ban ngày</option>
                                  <option value="Ngoại trú">Ngoại trú</option>
                                  <option value="Khác">Khác</option>
                                </select>
                              </td>
                              <td className="p-2.5">
                                <div className="flex flex-col gap-1">
                                  {item.matchedBy === 'TEMP_CODE_NAME_YOB' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md w-fit">
                                      Khớp Tên + Năm sinh (đổi mã tạm)
                                    </span>
                                  )}
                                  {item.matchedBy === 'NAME_YOB_CODE_MISMATCH' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md w-fit">
                                      Khớp thông tin BN (sai Mã bệnh án)
                                    </span>
                                  )}
                                  {item.diffs.map((d, di) => (
                                    <div key={di} className="text-[11px] flex items-center gap-1 flex-wrap bg-amber-50/80 border border-amber-200/70 px-2 py-0.5 rounded-lg">
                                      <span className="font-black text-slate-600">{d.label}:</span>
                                      <span className="text-rose-600 line-through">{d.oldValue}</span>
                                      <ArrowRight size={10} className="text-slate-400" />
                                      <span className="text-emerald-700 font-bold">{d.newValue}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="p-2.5 text-center">
                                {item.synced ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1.5 rounded-xl">
                                    <CheckCircle2 size={13} /> Đã đồng bộ
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isSaving || item.hasCodeError || !item.isDateValid}
                                    onClick={() => handleSyncMismatchedItems([item])}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                                      item.hasCodeError || !item.isDateValid || isSaving
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-primary text-white hover:bg-primary/90 shadow-xs cursor-pointer'
                                    }`}
                                  >
                                    Đồng bộ BN này
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 2: NEW PATIENTS */}
            {activeSubTab === 'NEW' && (
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-sky-50 border border-sky-200/80 shrink-0">
                  <div className="text-xs text-sky-900 font-semibold flex items-center gap-2">
                    <UserPlus size={16} className="text-sky-600 shrink-0" />
                    {pendingNewCount > 0 ? (
                      <span>
                        Phát hiện <strong>{pendingNewCount}</strong> bệnh nhân mới trên VNPT-HIS chưa có trong MedFlow. Bạn có muốn đồng bộ thêm vào khoa không? <em className="text-sky-700">(Vui lòng tự kiểm tra/chỉnh cột Giới tính)</em>
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold">Đã thêm xong tất cả bệnh nhân mới!</span>
                    )}
                  </div>
                  {pendingNewCount > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSaving || selectedPendingNews.length === 0}
                        onClick={() => handleAddNewItems(selectedPendingNews)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                          selectedPendingNews.length > 0 && !isSaving
                            ? 'bg-white border border-sky-300 text-sky-800 hover:bg-sky-100 cursor-pointer shadow-xs'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        }`}
                      >
                        Thêm BN đã chọn ({selectedPendingNews.length})
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleAddNewItems(validatedNewRows.filter(r => !r.added))}
                        className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-sm cursor-pointer transition-all"
                      >
                        Đồng bộ tất cả BN mới ({pendingNewCount})
                      </button>
                    </div>
                  )}
                </div>

                {validatedNewRows.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 border border-slate-100 rounded-2xl">
                    <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
                    <p className="text-sm font-bold text-slate-600">Không có bệnh nhân mới cần thêm!</p>
                  </div>
                ) : (
                  <div className="flex-1 border border-slate-200 rounded-2xl overflow-auto shadow-inner scrollbar-thin">
                    <table className="min-w-[1580px] w-full text-sm text-left border-collapse table-fixed">
                      <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-20 text-[11px] uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-[44px] text-center">
                            <input
                              type="checkbox"
                              checked={allPendingNewsSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedNewIds(new Set(validatedNewRows.filter(r => !r.added).map(r => r.syncId)));
                                } else {
                                  setSelectedNewIds(new Set());
                                }
                              }}
                              className="w-4 h-4 rounded accent-sky-600 cursor-pointer"
                            />
                          </th>
                          <th className="p-3 w-[48px] text-center">STT</th>
                          <th className="p-3 w-[145px]">Mã bệnh án <span className="text-rose-500">*</span></th>
                          <th className="p-3 w-[210px]">Họ tên bệnh nhân</th>
                          <th className="p-3 w-[105px]">Giới tính <span className="text-amber-500 text-[9px]">(Tự k.tra)</span></th>
                          <th className="p-3 w-[95px] text-center">Năm sinh</th>
                          <th className="p-3 w-[95px] text-center">Số giường</th>
                          <th className="p-3 w-[145px]">Loại giường</th>
                          <th className="p-3 w-[95px] text-center">Mức BHYT</th>
                          <th className="p-3 w-[125px] text-center">Ngày vào</th>
                          <th className="p-3 w-[85px] text-center">Giờ vào</th>
                          <th className="p-3 min-w-[150px]">Ghi chú</th>
                          <th className="p-3 w-[130px] text-center">Trạng thái</th>
                          <th className="p-3 w-[135px] text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validatedNewRows.map((item, idx) => (
                          <tr key={item.syncId} className={item.added ? 'bg-emerald-50/40 opacity-75' : 'hover:bg-slate-50/70'}>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                disabled={item.added}
                                checked={!item.added && selectedNewIds.has(item.syncId)}
                                onChange={(e) => {
                                  setSelectedNewIds(prev => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(item.syncId);
                                    else next.delete(item.syncId);
                                    return next;
                                  });
                                }}
                                className="w-4 h-4 rounded accent-sky-600 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                disabled={item.added}
                                value={item.code}
                                onChange={e => updateNewField(item.syncId, 'code', e.target.value)}
                                className={`w-full text-xs p-2 border rounded-xl font-mono font-bold text-center outline-none ${
                                  item.hasCodeError ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-800'
                                }`}
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                disabled={item.added}
                                value={item.name}
                                onChange={e => updateNewField(item.syncId, 'name', e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 rounded-xl uppercase font-black text-slate-800 outline-none"
                              />
                            </td>
                            <td className="p-2.5">
                              <select
                                disabled={item.added}
                                value={item.gender}
                                onChange={e => updateNewField(item.syncId, 'gender', e.target.value as 'Nam' | 'Nữ')}
                                className="w-full text-xs p-2 border border-amber-300 bg-amber-50/40 rounded-xl font-bold text-slate-800 outline-none"
                                title="Vui lòng tự kiểm tra và chọn giới tính phù hợp"
                              >
                                <option value="Nam">Nam</option>
                                <option value="Nữ">Nữ</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                disabled={item.added}
                                value={item.yob}
                                onChange={e => updateNewField(item.syncId, 'yob', e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 rounded-xl font-mono font-bold text-center text-slate-800 outline-none"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                disabled={item.added}
                                value={item.bedNumber}
                                onChange={e => updateNewField(item.syncId, 'bedNumber', e.target.value)}
                                className={`w-full text-xs p-2 border rounded-xl font-bold text-center outline-none ${
                                  item.hasBedConflict ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-800'
                                }`}
                              />
                            </td>
                            <td className="p-2.5">
                              <select
                                disabled={item.added}
                                value={item.bedType}
                                onChange={e => updateNewField(item.syncId, 'bedType', e.target.value as BedType)}
                                className="w-full text-xs p-2 border border-slate-200 rounded-xl font-bold bg-white text-slate-800 outline-none"
                              >
                                <option value="Nội trú">Nội trú</option>
                                <option value="Nội trú ban ngày">Nội trú ban ngày</option>
                                <option value="Ngoại trú">Ngoại trú</option>
                                <option value="Khác">Khác</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <select
                                disabled={item.added}
                                value={item.insuranceLevel}
                                onChange={e => updateNewField(item.syncId, 'insuranceLevel', e.target.value as InsuranceLevel)}
                                className="w-full text-xs p-2 border border-slate-200 rounded-xl font-bold bg-white text-slate-800 outline-none"
                              >
                                <option value="100%">100%</option>
                                <option value="95%">95%</option>
                                <option value="80%">80%</option>
                                <option value="0%">0%</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                disabled={item.added}
                                value={item.admissionDate}
                                onChange={e => updateNewField(item.syncId, 'admissionDate', e.target.value)}
                                className={`w-full text-xs p-2 border rounded-xl font-bold text-center outline-none ${
                                  !item.isDateValid ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-800'
                                }`}
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                disabled={item.added}
                                value={item.admissionTime}
                                onChange={e => updateNewField(item.syncId, 'admissionTime', e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 rounded-xl font-mono font-bold text-center text-slate-800 outline-none"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                disabled={item.added}
                                value={item.note}
                                onChange={e => updateNewField(item.syncId, 'note', e.target.value)}
                                className="w-full text-xs p-2 border border-slate-200 rounded-xl text-slate-800 outline-none"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              {item.added ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg">
                                  ĐÃ THÊM
                                </span>
                              ) : item.hasCodeError ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700 px-2 py-1 rounded-lg">
                                  {item.isCodeMissing ? 'THIẾU MÃ BA' : 'TRÙNG MÃ BA'}
                                </span>
                              ) : !item.isDateValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700 px-2 py-1 rounded-lg">
                                  SAI NGÀY
                                </span>
                              ) : item.hasBedConflict ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 rounded-lg" title="Giường đang có người nằm trong khoa">
                                  TRÙNG GIƯỜNG
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded-lg">
                                  HỢP LỆ
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {item.added ? (
                                <span className="text-[11px] font-black text-emerald-700">✓ Xong</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isSaving || item.hasCodeError || !item.isDateValid}
                                  onClick={() => handleAddNewItems([item])}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                                    item.hasCodeError || !item.isDateValid || isSaving
                                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                      : 'bg-sky-600 text-white hover:bg-sky-700 shadow-xs cursor-pointer'
                                  }`}
                                >
                                  Thêm BN này
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: MATCHED */}
            {activeSubTab === 'MATCHED' && comparison && (
              <div className="flex-1 border border-slate-200 rounded-2xl overflow-auto shadow-inner scrollbar-thin">
                {comparison.matched.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm font-bold">
                    Chưa có bệnh nhân nào khớp hoàn toàn.
                  </div>
                ) : (
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 text-[11px] uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-14 text-center">STT</th>
                        <th className="p-3 w-40">Mã bệnh án</th>
                        <th className="p-3">Họ và tên</th>
                        <th className="p-3 w-28 text-center">Năm sinh</th>
                        <th className="p-3 w-28 text-center">Số giường</th>
                        <th className="p-3 w-28 text-center">Mức BHYT</th>
                        <th className="p-3 w-36 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparison.matched.map((m, idx) => (
                        <tr key={m.syncId} className="hover:bg-slate-50/50">
                          <td className="p-3 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono text-xs font-bold text-slate-700">{m.code}</td>
                          <td className="p-3 font-bold text-slate-800 uppercase text-xs">{m.name}</td>
                          <td className="p-3 text-center text-xs font-mono text-slate-600">{m.yob}</td>
                          <td className="p-3 text-center text-xs font-bold text-indigo-700">{m.bedNumber || '-'}</td>
                          <td className="p-3 text-center text-xs font-bold text-slate-700">{m.insuranceLevel}</td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <CheckCircle2 size={11} /> KHỚP DỮ LIỆU
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* SUB-TAB 4: MISSING IN HIS (Informational only) */}
            {activeSubTab === 'MISSING_IN_HIS' && comparison && (
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                <div className="px-4 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold flex items-center gap-2 shrink-0">
                  <Info size={16} className="text-slate-500 shrink-0" />
                  <span>
                    Danh sách dưới đây đang có trạng thái <strong>Đang điều trị</strong> trên MedFlow nhưng chưa thấy trong đợt đối chiếu VNPT-HIS này (hệ thống giữ nguyên, không tự động xóa hay cho ra viện).
                  </span>
                </div>
                <div className="flex-1 border border-slate-200 rounded-2xl overflow-auto shadow-inner scrollbar-thin">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 text-[11px] uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-14 text-center">STT</th>
                        <th className="p-3 w-40">Mã bệnh án</th>
                        <th className="p-3">Họ và tên</th>
                        <th className="p-3 w-28 text-center">Số giường</th>
                        <th className="p-3 w-28 text-center">Mức BHYT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparison.missingInHis.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-mono text-xs font-bold text-slate-700">{p.code}</td>
                          <td className="p-3 font-bold text-slate-800 uppercase text-xs">{p.name}</td>
                          <td className="p-3 text-center text-xs font-bold text-indigo-700">{p.bedNumber || '-'}</td>
                          <td className="p-3 text-center text-xs font-bold text-slate-700">{p.insuranceLevel || '100%'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 shrink-0">
          <div className="text-xs text-slate-500 font-semibold">
            {isSaving && <span className="text-primary font-bold">Đang lưu đồng bộ dữ liệu...</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
