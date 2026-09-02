import React, { useState, useRef, useMemo } from 'react';
import { Department, Staff, Procedure, Appointment, Patient, AttendanceRecord, MachineShift, UserAccount, UserRole } from '../types';
import { Button } from './Button';
import { Database, Download, Upload, Calendar, Building2, AlertTriangle, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { DateInput } from './DateInput';

interface DepartmentBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDept: Department;
  currentUser: UserAccount;
  staff: Staff[];
  procedures: Procedure[];
  appointments: Appointment[];
  patients: Patient[];
  attendanceRecords: AttendanceRecord[];
  machineShifts: MachineShift[];
  onRestoreDepartmentData: (restoredData: any) => Promise<void>;
}

export const DepartmentBackupModal: React.FC<DepartmentBackupModalProps> = ({
  isOpen,
  onClose,
  currentDept,
  currentUser,
  staff,
  procedures,
  appointments,
  patients,
  attendanceRecords,
  machineShifts,
  onRestoreDepartmentData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'BACKUP' | 'RESTORE'>('BACKUP');
  
  // Backup state
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [backupNote, setBackupNote] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);

  // Restore state
  const [uploadedFileContent, setUploadedFileContent] = useState<any | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backup selective states
  const [backupStaff, setBackupStaff] = useState<boolean>(true);
  const [backupProcedures, setBackupProcedures] = useState<boolean>(true);
  const [backupAttendance, setBackupAttendance] = useState<boolean>(true);
  const [backupAppointments, setBackupAppointments] = useState<boolean>(true);

  // Restore selective states
  const [restoreStaff, setRestoreStaff] = useState<boolean>(true);
  const [restoreProcedures, setRestoreProcedures] = useState<boolean>(true);
  const [restoreAttendance, setRestoreAttendance] = useState<boolean>(true);
  const [restoreAppointments, setRestoreAppointments] = useState<boolean>(true);

  // Permission check
  const hasPermission = currentUser.role === UserRole.ADMIN || currentUser.editableDeptIds?.includes(currentDept.id);

  // Filtered data for backup based on date range and currentDept
  const deptStaff = useMemo(() => staff.filter(s => s.deptId === currentDept.id), [staff, currentDept.id]);
  const deptProcedures = useMemo(() => procedures.filter(p => p.deptId === currentDept.id), [procedures, currentDept.id]);
  
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => a.deptId === currentDept.id && a.date >= fromDate && a.date <= toDate);
  }, [appointments, currentDept.id, fromDate, toDate]);

  const filteredAttendance = useMemo(() => {
    const staffIds = new Set(deptStaff.map(s => s.id));
    return attendanceRecords.filter(r => staffIds.has(r.staffId) && r.date >= fromDate && r.date <= toDate);
  }, [attendanceRecords, deptStaff, fromDate, toDate]);

  const filteredMachineShifts = useMemo(() => {
    return machineShifts.filter(m => m.deptId === currentDept.id && m.date >= fromDate && m.date <= toDate);
  }, [machineShifts, currentDept.id, fromDate, toDate]);

  const relevantPatients = useMemo(() => {
    const patientIds = new Set(filteredAppointments.map(a => a.patientId));
    return patients.filter(p => patientIds.has(p.id) || p.admittedByDeptId === currentDept.id);
  }, [patients, filteredAppointments, currentDept.id]);

  // Handle Backup execution
  const handleExecuteBackup = () => {
    if (!hasPermission) {
      alert(`Lỗi: Tài khoản của bạn không được phân quyền quản lý / sao lưu ở khoa "${currentDept.name}".`);
      return;
    }

    if (!fromDate || !toDate) {
      alert('Vui lòng chọn đầy đủ từ ngày và đến ngày.');
      return;
    }

    if (fromDate > toDate) {
      alert('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }

    if (!backupStaff && !backupProcedures && !backupAttendance && !backupAppointments) {
      alert('Vui lòng chọn ít nhất một loại dữ liệu để sao lưu.');
      return;
    }

    setIsBackingUp(true);
    try {
      const backupPayload = {
        version: '1.0',
        type: 'DEPARTMENT_BACKUP',
        deptId: currentDept.id,
        deptName: currentDept.name,
        fromDate,
        toDate,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.fullName,
        note: backupNote,
        data: {
          department: currentDept,
          staff: backupStaff ? deptStaff : [],
          procedures: backupProcedures ? deptProcedures : [],
          attendance: backupAttendance ? filteredAttendance : [],
          appointments: backupAppointments ? filteredAppointments : [],
          patients: backupAppointments ? relevantPatients : [],
          machineShifts: backupAppointments ? filteredMachineShifts : []
        }
      };

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanDeptName = currentDept.name.replace(/[\/\\:*?"<>|]/g, '_').trim();
      const filename = `${cleanDeptName}_Tu_${fromDate}_Den_${toDate}.json`;

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`Sao lưu dữ liệu khoa ${currentDept.name} (Từ ngày ${fromDate} đến ngày ${toDate}) thành công!`);
      onClose();
    } catch (error) {
      console.error(error);
      alert('Lỗi khi tạo file sao lưu.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handle file upload for restore
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!hasPermission) {
      alert(`Lỗi: Tài khoản của bạn không có quyền khôi phục dữ liệu ở khoa "${currentDept.name}".`);
      setUploadedFileContent(null);
      return;
    }

    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.deptId || !json.data || json.type !== 'DEPARTMENT_BACKUP') {
          alert('Lỗi: File JSON không đúng định dạng sao lưu dữ liệu khoa.');
          setUploadedFileContent(null);
          return;
        }

        // Check if file matches currentDept
        if (json.deptId !== currentDept.id) {
          alert(`Lỗi: File sao lưu này thuộc về khoa "${json.deptName || json.deptId}". Bạn đang ở khoa "${currentDept.name}". Chỉ có thể khôi phục file trùng với khoa hiện tại!`);
          setUploadedFileContent(null);
          return;
        }

        setUploadedFileContent(json);
        // Automatically check options if they are present in file
        setRestoreStaff(!!(json.data?.staff && json.data.staff.length > 0));
        setRestoreProcedures(!!(json.data?.procedures && json.data.procedures.length > 0));
        setRestoreAttendance(!!(json.data?.attendance && json.data.attendance.length > 0));
        setRestoreAppointments(!!(json.data?.appointments && json.data.appointments.length > 0));
      } catch (err) {
        console.error(err);
        alert('Lỗi đọc file JSON: File không hợp lệ.');
        setUploadedFileContent(null);
      }
    };
    reader.readAsText(file);
  };

  // Handle Restore execution
  const handleExecuteRestore = async () => {
    if (!hasPermission) {
      alert(`Lỗi: Tài khoản của bạn không được phân quyền khôi phục ở khoa "${currentDept.name}".`);
      return;
    }

    if (!uploadedFileContent) {
      alert('Vui lòng tải lên file JSON sao lưu hợp lệ trước.');
      return;
    }

    if (uploadedFileContent.deptId !== currentDept.id) {
      alert(`Lỗi: File sao lưu thuộc về khoa "${uploadedFileContent.deptName || uploadedFileContent.deptId}", không trùng với khoa hiện tại "${currentDept.name}".`);
      return;
    }

    if (!restoreStaff && !restoreProcedures && !restoreAttendance && !restoreAppointments) {
      alert('Vui lòng chọn ít nhất một loại dữ liệu để khôi phục.');
      return;
    }

    const { deptName, fromDate, toDate } = uploadedFileContent;
    const confirmMsg = `CẢNH BÁO: Dữ liệu đã chọn của khoa ${deptName || currentDept.name} từ ngày ${fromDate} đến ngày ${toDate} sẽ bị THAY THẾ toàn bộ bằng dữ liệu từ file sao lưu.\n\nBạn có chắc chắn muốn tiếp tục?`;

    if (window.confirm(confirmMsg)) {
      setIsRestoring(true);
      try {
        const restorePayload: any = {};
        if (restoreStaff) restorePayload.staff = uploadedFileContent.data.staff || [];
        if (restoreProcedures) restorePayload.procedures = uploadedFileContent.data.procedures || [];
        if (restoreAttendance) restorePayload.attendance = uploadedFileContent.data.attendance || [];
        if (restoreAppointments) {
          restorePayload.appointments = uploadedFileContent.data.appointments || [];
          restorePayload.patients = uploadedFileContent.data.patients || [];
          restorePayload.machineShifts = uploadedFileContent.data.machineShifts || [];
        }

        await onRestoreDepartmentData(restorePayload);
        alert('Khôi phục dữ liệu thành công!');
        onClose();
      } catch (error) {
        console.error(error);
        alert('Lỗi khi khôi phục dữ liệu.');
      } finally {
        setIsRestoring(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Database size={22} />
            </div>
            <div>
              <h3 className="font-black text-lg uppercase tracking-tight">Sao lưu & Khôi phục Dữ liệu Khoa</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{currentDept.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Permission warning banner if not authorized */}
        {!hasPermission && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3 text-amber-800 text-xs font-bold">
            <ShieldAlert size={18} className="shrink-0 text-amber-600" />
            <span>Tài khoản của bạn hiện không có quyền chỉnh sửa/sao lưu cho khoa này. Bạn chỉ có thể xem.</span>
          </div>
        )}

        {/* Sub-tabs toggle */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2">
          <button
            onClick={() => setActiveSubTab('BACKUP')}
            className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeSubTab === 'BACKUP'
                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Download size={16} /> Tạo Sao lưu
          </button>
          <button
            onClick={() => setActiveSubTab('RESTORE')}
            className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeSubTab === 'RESTORE'
                ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Upload size={16} /> Khôi phục dữ liệu
          </button>
        </div>

        {/* Content body */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1">
          {activeSubTab === 'BACKUP' ? (
            <div className="space-y-6">
              <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 text-xs text-sky-800 space-y-1">
                <p className="font-black uppercase tracking-wider">Thông tin gói sao lưu khoa:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-sky-700">
                  <li>Sao lưu linh hoạt theo các mục dữ liệu lựa chọn dưới đây</li>
                  <li>Không giới hạn khoảng thời gian sao lưu</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={14} /> Từ ngày
                  </label>
                  <DateInput 
                    value={fromDate}
                    onChange={setFromDate}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={14} /> Đến ngày
                  </label>
                  <DateInput 
                    value={toDate}
                    onChange={setToDate}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Checkboxes for Backup options */}
              <div className="space-y-3 bg-slate-50/50 p-5 rounded-3xl border border-slate-150">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chọn loại dữ liệu muốn sao lưu:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl hover:border-sky-300 transition-all cursor-pointer shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={backupStaff} 
                      onChange={e => setBackupStaff(e.target.checked)}
                      className="w-4.5 h-4.5 text-sky-500 border-slate-300 rounded focus:ring-sky-400 cursor-pointer"
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800">Nhân sự & Kỹ năng</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{deptStaff.length} nhân sự</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl hover:border-sky-300 transition-all cursor-pointer shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={backupProcedures} 
                      onChange={e => setBackupProcedures(e.target.checked)}
                      className="w-4.5 h-4.5 text-sky-500 border-slate-300 rounded focus:ring-sky-400 cursor-pointer"
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800">Danh mục thủ thuật</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{deptProcedures.length} thủ thuật</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl hover:border-sky-300 transition-all cursor-pointer shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={backupAttendance} 
                      onChange={e => setBackupAttendance(e.target.checked)}
                      className="w-4.5 h-4.5 text-sky-500 border-slate-300 rounded focus:ring-sky-400 cursor-pointer"
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800">Chấm công các tháng</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{filteredAttendance.length} lượt chấm công</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl hover:border-sky-300 transition-all cursor-pointer shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={backupAppointments} 
                      onChange={e => setBackupAppointments(e.target.checked)}
                      className="w-4.5 h-4.5 text-sky-500 border-slate-300 rounded focus:ring-sky-400 cursor-pointer"
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-800">Lịch hẹn & Bệnh nhân</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{filteredAppointments.length} chỉ định, {relevantPatients.length} BN</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú bản sao lưu (Tùy chọn)</label>
                <input 
                  type="text"
                  value={backupNote}
                  onChange={e => setBackupNote(e.target.value)}
                  placeholder="VD: Sao lưu ca trực tuần 1 tháng 8..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-sky-500"
                />
              </div>

              <Button
                onClick={handleExecuteBackup}
                disabled={isBackingUp || !hasPermission}
                className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2"
              >
                <Download size={18} /> {isBackingUp ? 'Đang tạo file...' : 'Tải xuống File Sao lưu (.json)'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 space-y-1">
                <p className="font-black uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-amber-600" /> Lưu ý quan trọng khi khôi phục:
                </p>
                <p>Tải lên file JSON sao lưu hợp lệ của khoa để thay thế dữ liệu từ ngày bắt đầu đến ngày kết thúc tương ứng trong file.</p>
              </div>

              <div className="space-y-3">
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json"
                  className="hidden"
                />
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 rounded-3xl p-8 text-center cursor-pointer transition-all group"
                >
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-3 text-emerald-500 group-hover:scale-110 transition-transform">
                    <Upload size={26} />
                  </div>
                  <p className="font-bold text-slate-700 text-sm">{uploadFileName ? `Đã chọn: ${uploadFileName}` : 'Nhấn để chọn file JSON sao lưu'}</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-extrabold">Hỗ trợ định dạng .json</p>
                </div>
              </div>

              {uploadedFileContent && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-800 font-black text-sm uppercase tracking-tight">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span>Thông tin file sao lưu đã tải lên</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pb-3 border-b border-emerald-100">
                    <div><strong>Khoa:</strong> {uploadedFileContent.deptName || uploadedFileContent.deptId}</div>
                    <div><strong>Ngày tạo:</strong> {uploadedFileContent.createdAt ? new Date(uploadedFileContent.createdAt).toLocaleString('vi-VN') : 'Không rõ'}</div>
                    <div><strong>Khoảng thời gian:</strong> Từ {uploadedFileContent.fromDate} đến {uploadedFileContent.toDate}</div>
                    <div><strong>Người tạo:</strong> {uploadedFileContent.createdBy || 'Hệ thống'}</div>
                  </div>
                  {uploadedFileContent.note && (
                    <p className="text-xs text-slate-600 italic pb-2 border-b border-emerald-100">Ghi chú: "{uploadedFileContent.note}"</p>
                  )}

                  {/* Selective Restore Checkboxes */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Chọn loại dữ liệu muốn khôi phục từ file:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {uploadedFileContent.data?.staff && (
                        <label className="flex items-center gap-3 p-3 bg-white border border-emerald-250 rounded-2xl hover:border-emerald-400 transition-all cursor-pointer shadow-sm">
                          <input 
                            type="checkbox" 
                            checked={restoreStaff} 
                            onChange={e => setRestoreStaff(e.target.checked)}
                            className="w-4.5 h-4.5 text-emerald-600 border-emerald-300 rounded focus:ring-emerald-400 cursor-pointer"
                          />
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-800">Nhân sự & Kỹ năng</p>
                            <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">{uploadedFileContent.data.staff.length} nhân sự</p>
                          </div>
                        </label>
                      )}

                      {uploadedFileContent.data?.procedures && (
                        <label className="flex items-center gap-3 p-3 bg-white border border-emerald-250 rounded-2xl hover:border-emerald-400 transition-all cursor-pointer shadow-sm">
                          <input 
                            type="checkbox" 
                            checked={restoreProcedures} 
                            onChange={e => setRestoreProcedures(e.target.checked)}
                            className="w-4.5 h-4.5 text-emerald-600 border-emerald-300 rounded focus:ring-emerald-400 cursor-pointer"
                          />
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-800">Danh mục thủ thuật</p>
                            <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">{uploadedFileContent.data.procedures.length} thủ thuật</p>
                          </div>
                        </label>
                      )}

                      {uploadedFileContent.data?.attendance && (
                        <label className="flex items-center gap-3 p-3 bg-white border border-emerald-250 rounded-2xl hover:border-emerald-400 transition-all cursor-pointer shadow-sm">
                          <input 
                            type="checkbox" 
                            checked={restoreAttendance} 
                            onChange={e => setRestoreAttendance(e.target.checked)}
                            className="w-4.5 h-4.5 text-emerald-600 border-emerald-300 rounded focus:ring-emerald-400 cursor-pointer"
                          />
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-800">Chấm công các tháng</p>
                            <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">{uploadedFileContent.data.attendance.length} lượt</p>
                          </div>
                        </label>
                      )}

                      {uploadedFileContent.data?.appointments && (
                        <label className="flex items-center gap-3 p-3 bg-white border border-emerald-250 rounded-2xl hover:border-emerald-400 transition-all cursor-pointer shadow-sm">
                          <input 
                            type="checkbox" 
                            checked={restoreAppointments} 
                            onChange={e => setRestoreAppointments(e.target.checked)}
                            className="w-4.5 h-4.5 text-emerald-600 border-emerald-300 rounded focus:ring-emerald-400 cursor-pointer"
                          />
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-800">Lịch hẹn & Bệnh nhân</p>
                            <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">{uploadedFileContent.data.appointments.length} chỉ định</p>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={handleExecuteRestore}
                      disabled={isRestoring || !hasPermission}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                      <Upload size={16} /> {isRestoring ? 'Đang khôi phục...' : `Bắt đầu khôi phục`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <Button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider"
          >
            Đóng
          </Button>
        </div>

      </div>
    </div>
  );
};
