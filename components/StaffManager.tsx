
import React, { useState, useMemo } from 'react';
import { Staff, Procedure, ProcedureCategory, PROCEDURE_CATEGORIES, ProcedureDurationOption, AttendanceRecord, AttendanceStatus, Department, Patient, Appointment, UserAccount, UserRole } from '../types';
import { 
  UserCog, Check, X, Settings2, CalendarOff, Save, Briefcase, Plus, Trash2, User, Stethoscope, Pencil, 
  UserPlus, Users, Search, ArrowLeft, Bed, Clock, LogOut, Activity, Zap, Lock, Info, Printer, ChevronDown,
  Sun, Dumbbell, Waves, Droplet, FlaskConical, HeartPulse, Thermometer, Syringe, Pill, Microscope, Bone, Brain, Eye, Ear, Wind, HandHelping,
  Star
} from 'lucide-react';
import { Button } from './Button';
import { getDaysInMonth, getDayOfWeek, getRoleLabel } from '../utils/timeUtils';
import { ManagerTab } from '../App';

interface StaffManagerProps {
  activeTab: ManagerTab;
  staff: Staff[];
  procedures: Procedure[];
  department: Department;
  attendanceRecords: AttendanceRecord[];
  appointments: Appointment[];
  currentUser: UserAccount;
  onEditStaff: (s?: Staff) => void;
  onDeleteStaff: (id: string) => void;
  onUpdateAttendance: (record: AttendanceRecord) => void;
  onUpdateBulkAttendance?: (records: AttendanceRecord[]) => void;
  onUpdateProcedures: (procedures: Procedure[]) => void;
  onUpdateAppointments: (appointments: Appointment[]) => void;
}

import { getAbbreviation } from '../utils/timeUtils';

export const StaffManager: React.FC<StaffManagerProps> = ({
  activeTab,
  staff,
  procedures,
  department,
  attendanceRecords,
  appointments,
  currentUser,
  onEditStaff,
  onDeleteStaff,
  onUpdateAttendance,
  onUpdateBulkAttendance,
  onUpdateProcedures,
  onUpdateAppointments,
}) => {
  
  // Attendance State
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Personnel Management State
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [staffSortBy, setStaffSortBy] = useState<'NAME' | 'ROLE'>('NAME');
  const [staffSortDir, setStaffSortDir] = useState<'ASC' | 'DESC'>('ASC');

  // Machine Config State
  const [machineGen, setMachineGen] = useState({ prefix: '', start: 1, end: 10, suffix: '' });
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [showOptForm, setShowOptForm] = useState(false);
  const [editingOptId, setEditingOptId] = useState<string | null>(null);
  const [procCategoryFilter, setProcCategoryFilter] = useState<string>('ALL');
  const [procSearchTerm, setProcSearchTerm] = useState<string>('');

  // Trạng thái cấu hình thêm thời lượng lựa chọn cho thủ thuật
  const [newOpt, setNewOpt] = useState<{
    name: string;
    durationMinutes: number;
    restMinutes: number;
    mainBusyStart: number;
    mainBusyEnd: number;
    asst1BusyStart: number;
    asst1BusyEnd: number;
    asst2BusyStart: number;
    asst2BusyEnd: number;
    asst1Enabled: boolean;
    asst2Enabled: boolean;
  }>({
    name: '',
    durationMinutes: 30,
    restMinutes: 0,
    mainBusyStart: 0,
    mainBusyEnd: 30,
    asst1BusyStart: 0,
    asst1BusyEnd: 0,
    asst2BusyStart: 0,
    asst2BusyEnd: 0,
    asst1Enabled: false,
    asst2Enabled: false,
  });

  React.useEffect(() => {
    if (editingProcedure) {
      setNewOpt({
        name: '',
        durationMinutes: editingProcedure.durationMinutes || 30,
        restMinutes: editingProcedure.restMinutes || 0,
        mainBusyStart: 0,
        mainBusyEnd: editingProcedure.durationMinutes || 30,
        asst1BusyStart: 0,
        asst1BusyEnd: 0,
        asst2BusyStart: 0,
        asst2BusyEnd: 0,
        asst1Enabled: false,
        asst2Enabled: false,
      });
      setShowOptForm(false);
      setEditingOptId(null);
    }
  }, [editingProcedure?.id]);

  const departmentStaff = staff.filter(s => s.deptId === department.id);

  const sortedDepartmentStaff = useMemo(() => {
    const getFirstName = (fullName: string) => {
      const parts = fullName.trim().split(/\s+/);
      return parts.length > 0 ? parts[parts.length - 1] : fullName;
    };

    return [...departmentStaff].sort((a, b) => {
      let cmp = 0;
      if (staffSortBy === 'NAME') {
        const firstNameA = getFirstName(a.name);
        const firstNameB = getFirstName(b.name);
        cmp = firstNameA.localeCompare(firstNameB, 'vi');
        if (cmp === 0) {
          cmp = a.name.localeCompare(b.name, 'vi');
        }
      } else {
        const roleA = getRoleLabel(a.role);
        const roleB = getRoleLabel(b.role);
        cmp = roleA.localeCompare(roleB, 'vi');
      }
      return staffSortDir === 'ASC' ? cmp : -cmp;
    });
  }, [departmentStaff, staffSortBy, staffSortDir]);

  // --- Procedure Logic ---
  const handleAddProcedure = () => {
    const defaultOptId = `opt_${Math.random().toString(36).substr(2, 9)}`;
    const newProc: Procedure = {
        id: `pr_${Math.random().toString(36).substr(2, 9)}`,
        name: 'Thủ thuật mới',
        category: (procCategoryFilter !== 'ALL' && PROCEDURE_CATEGORIES.includes(procCategoryFilter as any)) ? (procCategoryFilter as ProcedureCategory) : 'Lâm sàng',
        durationMinutes: 30,
        restMinutes: 0,
        deptId: department.id,
        requireMachine: false,
        machineCapacity: 1,
        availableMachines: [],
        isPreRequisite: false,
        isPostRequisite: false,
        isIndependent: false,
        mainBusyStart: 0,
        mainBusyEnd: 30,
        asst1BusyStart: 0,
        asst1BusyEnd: 0,
        asst2BusyStart: 0,
        asst2BusyEnd: 0,
        durationOptions: [{
            id: defaultOptId,
            name: 'Mặc định',
            durationMinutes: 30,
            restMinutes: 0,
            mainBusyStart: 0,
            mainBusyEnd: 30,
            isDefault: true
        }]
    };
    setEditingProcedure(newProc);
  };

  const handleUpdateProcedure = (id: string, field: keyof Procedure, value: any) => {
    const proc = procedures.find(p => p.id === id);
    if (!proc || proc.deptId !== department.id) return;

    if (field === 'requireMachine' && value === false) {
        onUpdateProcedures(procedures.map(p => p.id === id ? { ...p, [field]: value, availableMachines: [] } : p));
    } else {
        onUpdateProcedures(procedures.map(p => p.id === id ? { ...p, [field]: value } : p));
    }
  };

  const handleDeleteProcedure = (id: string) => {
      const proc = procedures.find(p => p.id === id);
      if (!proc || proc.deptId !== department.id) return;

      if (confirm('Bạn có chắc muốn xóa thủ thuật này?')) {
          onUpdateProcedures(procedures.filter(p => p.id !== id));
      }
  };

  const updateDurationOptionsAndSyncDefault = (opts: ProcedureDurationOption[]) => {
    if (!editingProcedure) return;
    
    // Đảm bảo có ít nhất 1 phương án mặc định nếu danh sách không rỗng
    let updatedOpts = opts.map(o => ({ ...o }));
    if (updatedOpts.length > 0) {
        const hasDefault = updatedOpts.some(o => o.isDefault);
        if (!hasDefault) {
            updatedOpts[0].isDefault = true;
        }
    }
    
    // Tìm phương án mặc định
    const defaultOpt = updatedOpts.find(o => o.isDefault);
    
    if (defaultOpt) {
        setEditingProcedure({
            ...editingProcedure,
            durationOptions: updatedOpts,
            durationMinutes: defaultOpt.durationMinutes,
            restMinutes: defaultOpt.restMinutes || 0,
            mainBusyStart: defaultOpt.mainBusyStart ?? 0,
            mainBusyEnd: defaultOpt.mainBusyEnd ?? defaultOpt.durationMinutes,
            asst1BusyStart: defaultOpt.asst1BusyStart,
            asst1BusyEnd: defaultOpt.asst1BusyEnd,
            asst2BusyStart: defaultOpt.asst2BusyStart,
            asst2BusyEnd: defaultOpt.asst2BusyEnd,
        });
    } else {
        setEditingProcedure({
            ...editingProcedure,
            durationOptions: updatedOpts
        });
    }
  };

  const handleGenerateMachines = () => {
      if (!editingProcedure) return;
      
      const newCodes: string[] = [];
      const { prefix, start, end, suffix } = machineGen;
      
      for (let i = start; i <= end; i++) {
          const code = `${prefix}${i.toString().padStart(2, '0')}${suffix}`;
          if (!editingProcedure.availableMachines?.includes(code)) {
              newCodes.push(code);
          }
      }

      if (newCodes.length === 0) return;

      setEditingProcedure({
          ...editingProcedure,
          availableMachines: [...(editingProcedure.availableMachines || []), ...newCodes]
      });
  };

  const handleRemoveMachine = (code: string) => {
      if (!editingProcedure) return;
      setEditingProcedure({
          ...editingProcedure,
          availableMachines: editingProcedure.availableMachines?.filter(c => c !== code) || []
      });
  };

  // --- Attendance Logic ---
  const isHoliday = (day: number) => {
    const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const holidayRecord = attendanceRecords.find(r => (r.staffId === `holiday_dept_${department.id}` || r.staffId === `holiday_${department.id}`) && r.date === dateStr);
    return !!holidayRecord && holidayRecord.status === AttendanceStatus.OFF_FULL;
  };

  const getAttendanceStatus = (staffId: string, day: number) => {
    const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const record = attendanceRecords.find(r => r.staffId === staffId && r.date === dateStr);
    if (record) {
      return record.status;
    }
    return isHoliday(day) ? AttendanceStatus.OFF_FULL : AttendanceStatus.PRESENT;
  };

  const handleCellClick = (staffId: string, day: number) => {
    const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const holidayActive = isHoliday(day);
    const currentStatus = getAttendanceStatus(staffId, day);
    let nextStatus: AttendanceStatus;
    
    if (holidayActive) {
      if (currentStatus === AttendanceStatus.DUTY) {
        nextStatus = AttendanceStatus.OFF_FULL;
      } else {
        nextStatus = AttendanceStatus.DUTY;
      }
    } else {
      switch (currentStatus) {
        case AttendanceStatus.PRESENT: nextStatus = AttendanceStatus.OFF_FULL; break;
        case AttendanceStatus.OFF_FULL: nextStatus = AttendanceStatus.OFF_MORNING; break;
        case AttendanceStatus.OFF_MORNING: nextStatus = AttendanceStatus.OFF_AFTERNOON; break;
        case AttendanceStatus.OFF_AFTERNOON: nextStatus = AttendanceStatus.PRESENT; break;
        case AttendanceStatus.DUTY: nextStatus = AttendanceStatus.PRESENT; break;
        default: nextStatus = AttendanceStatus.OFF_FULL;
      }
    }

    const existing = attendanceRecords.find(r => r.staffId === staffId && r.date === dateStr);
    
    const newRecord: AttendanceRecord = {
        id: existing ? existing.id : `att_${Math.random().toString(36).substr(2,9)}`,
        staffId,
        date: dateStr,
        status: nextStatus
    };

    onUpdateAttendance(newRecord);
  };

  const handleStaffNameClick = (s: Staff) => {
    // Collect the current state of days in the month
    const staffRecordsInMonth = attendanceRecords.filter(r => 
      r.staffId === s.id && 
      r.date.startsWith(`${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-`)
    );

    const offFullDays = staffRecordsInMonth.filter(r => r.status === AttendanceStatus.OFF_FULL).length;
    const offMorningDays = staffRecordsInMonth.filter(r => r.status === AttendanceStatus.OFF_MORNING).length;
    const offAfternoonDays = staffRecordsInMonth.filter(r => r.status === AttendanceStatus.OFF_AFTERNOON).length;

    let targetStatus: AttendanceStatus;

    if (offFullDays > daysInMonth / 2) {
      // 2nd click state: Morning off
      targetStatus = AttendanceStatus.OFF_MORNING;
    } else if (offMorningDays > daysInMonth / 2) {
      // 3rd click state: Afternoon off
      targetStatus = AttendanceStatus.OFF_AFTERNOON;
    } else if (offAfternoonDays > daysInMonth / 2) {
      // 4th click state: Present (no off)
      targetStatus = AttendanceStatus.PRESENT;
    } else {
      // 1st click state: Off full
      targetStatus = AttendanceStatus.OFF_FULL;
    }

    const recordsToUpdate: AttendanceRecord[] = [];
    for (const day of daysArray) {
      const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const existing = attendanceRecords.find(r => r.staffId === s.id && r.date === dateStr);
      recordsToUpdate.push({
        id: existing ? existing.id : `att_${Math.random().toString(36).substr(2, 9)}`,
        staffId: s.id,
        date: dateStr,
        status: targetStatus
      });
    }

    if (onUpdateBulkAttendance) {
      onUpdateBulkAttendance(recordsToUpdate);
    } else {
      for (const record of recordsToUpdate) {
        onUpdateAttendance(record);
      }
    }
  };

  const getCellColor = (status: AttendanceStatus, dayIsHoliday?: boolean) => {
      switch(status) {
          case AttendanceStatus.OFF_FULL: 
              return dayIsHoliday 
                  ? 'bg-rose-100 text-rose-700 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.2)]'
                  : 'bg-yellow-100 text-yellow-700 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.2)]';
          case AttendanceStatus.OFF_MORNING: return 'bg-orange-100/70 text-orange-700 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.2)]';
          case AttendanceStatus.OFF_AFTERNOON: return 'bg-purple-100/70 text-purple-700 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.2)]';
          case AttendanceStatus.DUTY: return 'bg-emerald-500 text-white shadow-md rounded border border-emerald-600 scale-[0.8] font-bold';
          default: return '';
      }
  };

  const getCellLabel = (status: AttendanceStatus) => {
    switch(status) {
        case AttendanceStatus.OFF_FULL: return 'N'; // Nghỉ
        case AttendanceStatus.OFF_MORNING: return 'S'; // Nghỉ Sáng
        case AttendanceStatus.OFF_AFTERNOON: return 'C'; // Nghỉ Chiều
        case AttendanceStatus.DUTY: return 'T'; // Trực
        default: return ''; // Đi làm
    }
  };

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrintAttendance = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bảng chấm công Tháng ${selectedMonth}/${selectedYear}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 18px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #ccc; padding: 4px; text-align: center; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .weekend { background-color: #fff3e0; color: #ea580c; }
            .off-full { background-color: #fef08a; } 
            .off-morning { background-color: #ffedd5; } 
            .off-afternoon { background-color: #f3e8ff; } 
            .holiday-off { background-color: #ffe4e6; } 
            .duty { background-color: #d1fae5; font-weight: bold; } 
            .name-col { text-align: left; padding-left: 8px; white-space: nowrap; }
            @media print {
              @page { size: landscape; margin: 10mm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Bảng chấm công Tháng ${selectedMonth} năm ${selectedYear} - ${department.name}</h1>
          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 30px;">STT</th>
                <th rowspan="2" style="width: 150px;">Họ và tên</th>
                <th rowspan="2" style="width: 80px;">Chức vụ</th>
                ${daysArray.map(d => `<th>${d}</th>`).join('')}
              </tr>
              <tr>
                ${daysArray.map(d => {
                  const dow = getDayOfWeek(d, selectedMonth, selectedYear);
                  const isWeekend = dow === 'CN' || dow === 'T7';
                  const dayIsHoliday = isHoliday(d);
                  return `<th class="${isWeekend ? 'weekend' : ''}" style="${dayIsHoliday ? 'background-color: #ffe4e6;' : ''}">${dow}${dayIsHoliday ? ' (OFF)' : ''}</th>`;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${sortedDepartmentStaff.map((s, idx) => {
                  let rowHtml = `<tr>
                      <td>${idx + 1}</td>
                      <td class="name-col">${s.name}</td>
                      <td>${getRoleLabel(s.role)}</td>`;
                  
                  daysArray.forEach(d => {
                    const status = getAttendanceStatus(s.id, d);
                    const dayIsHoliday = isHoliday(d);
                    let className = '';
                    let label = '';
                    if (status === AttendanceStatus.OFF_FULL) { 
                      className = dayIsHoliday ? 'holiday-off' : 'off-full'; 
                      label = 'N'; 
                    }
                    else if (status === AttendanceStatus.OFF_MORNING) { className = 'off-morning'; label = 'S'; }
                    else if (status === AttendanceStatus.OFF_AFTERNOON) { className = 'off-afternoon'; label = 'C'; }
                    else if (status === AttendanceStatus.DUTY) { className = 'duty'; label = 'T'; }
                    
                    rowHtml += `<td class="${className}">${label}</td>`;
                  });
                  
                  rowHtml += `</tr>`;
                  return rowHtml;
              }).join('')}
            </tbody>
          </table>
          <div style="margin-top: 20px; font-size: 11px;">
            <strong>Ghi chú:</strong> N: Nghỉ cả ngày/Nghỉ lễ | S: Nghỉ sáng | C: Nghỉ chiều | T: Trực ngày nghỉ
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };



  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full relative">
      <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
        
        {activeTab === 'PERSONNEL' && (
            <div className="flex-1 overflow-y-auto p-6">
                 <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 w-72 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">
                            <Search size={18} className="text-slate-400" />
                            <input 
                                placeholder="Tìm kiếm nhân sự..." 
                                className="bg-transparent border-none outline-none text-sm w-full font-medium text-slate-700 placeholder-slate-400"
                                value={personnelSearch}
                                onChange={(e) => setPersonnelSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-100/50 border border-slate-200/60 rounded-xl p-1 shadow-sm">
                           <button
                              onClick={() => {
                                if (staffSortBy === 'NAME') setStaffSortDir(prev => prev === 'ASC' ? 'DESC' : 'ASC');
                                else { setStaffSortBy('NAME'); setStaffSortDir('ASC'); }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${staffSortBy === 'NAME' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'}`}
                           >
                             Tên nhân sự
                             {staffSortBy === 'NAME' && (
                                <ChevronDown size={14} className={`transition-transform duration-200 ${staffSortDir === 'ASC' ? 'rotate-180' : ''}`} />
                             )}
                           </button>
                           <button
                              onClick={() => {
                                if (staffSortBy === 'ROLE') setStaffSortDir(prev => prev === 'ASC' ? 'DESC' : 'ASC');
                                else { setStaffSortBy('ROLE'); setStaffSortDir('ASC'); }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${staffSortBy === 'ROLE' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'}`}
                           >
                             Chức danh
                             {staffSortBy === 'ROLE' && (
                                <ChevronDown size={14} className={`transition-transform duration-200 ${staffSortDir === 'ASC' ? 'rotate-180' : ''}`} />
                             )}
                           </button>
                        </div>
                    </div>
                    <Button onClick={() => onEditStaff()} className="shadow-sm">
                        <UserPlus size={18} /> Thêm nhân sự
                    </Button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedDepartmentStaff.filter(s => s.name.toLowerCase().includes(personnelSearch.toLowerCase())).map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => onEditStaff(s)}
                            className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl hover:border-primary/20 transition-all cursor-pointer group"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${s.role === 'Doctor' ? 'bg-indigo-50 text-indigo-600' : s.role === 'Pharmacist' ? 'bg-emerald-50 text-emerald-600' : 'bg-teal-50 text-teal-600'}`}>
                                    {s.name.charAt(0)}
                                </div>
                                <div className="flex gap-2">
                                    <div 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteStaff(s.id);
                                        }}
                                        className="p-3 bg-slate-50 rounded-2xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                        title="Xóa nhân sự"
                                    >
                                        <Trash2 size={18} />
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-300 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                        <Pencil size={18} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-xl mb-1 tracking-tight">{s.name}</h3>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                                    {s.role === 'Doctor' ? <Stethoscope size={14} className="text-primary/60" /> : <User size={14} className="text-primary/60" />}
                                    <span>
                                        {s.role === 'Doctor' ? 'Bác sĩ' : 
                                         s.role === 'Technician' ? 'Kỹ thuật viên' : 
                                         s.role === 'Nurse' ? 'Điều dưỡng' : 
                                         s.role === 'PhysicianAssistant' ? 'Y sĩ' : 
                                         s.role === 'Pharmacist' ? 'Dược sĩ' : s.role}
                                    </span>
                                </div>
                                <div className="pt-4 border-t border-slate-50 flex items-center gap-2">
                                    <span className="text-[10px] font-black bg-blue-50 px-3 py-1 rounded-lg text-blue-600 uppercase tracking-widest">
                                        {s.mainCapabilityIds?.filter(id => procedures.some(p => p.id === id)).length || 0} chính
                                    </span>
                                    <span className="text-[10px] font-black bg-emerald-50 px-3 py-1 rounded-lg text-emerald-600 uppercase tracking-widest">
                                        {s.assistantCapabilityIds?.filter(id => procedures.some(p => p.id === id)).length || 0} phụ
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        )}

        {activeTab === 'ATTENDANCE' && (
            <div className="flex flex-col h-full">
                <div className="p-4 bg-white border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-bold text-gray-700">Tháng:</label>
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="border border-gray-300 rounded px-2 py-1 text-sm bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                {Array.from({length: 12}, (_, i) => i+1).map(m => (
                                    <option key={m} value={m}>Tháng {m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-bold text-gray-700">Năm:</label>
                            <select 
                                 value={selectedYear} 
                                 onChange={(e) => setSelectedYear(Number(e.target.value))}
                                 className="border border-gray-300 rounded px-2 py-1 text-sm bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <Button size="sm" variant="secondary" onClick={handlePrintAttendance} className="ml-2 bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100">
                            <Printer size={16} /> In bảng công
                        </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-sm bg-rose-500 shadow-sm"></div> <span className="font-semibold text-slate-700">Ngày nghỉ toàn khoa (OFF)</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-sm bg-rose-100 border border-rose-250 shadow-sm"></div> <span className="font-semibold text-slate-700">Nghỉ lễ mặc định (N)</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-md bg-emerald-500 border border-emerald-600 shadow-sm"></div> <span className="font-semibold text-slate-700">Trực ngày nghỉ (T)</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-sm bg-yellow-400 border border-yellow-500 shadow-sm"></div> <span className="font-semibold text-slate-700">Nghỉ cả ngày (N)</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-sm bg-orange-200 border border-orange-300 shadow-sm"></div> <span className="font-semibold text-slate-700">Nghỉ sáng (S)</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-sm bg-purple-200 border border-purple-300 shadow-sm"></div> <span className="font-semibold text-slate-700">Nghỉ chiều (C)</span></div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-gray-50/50">
                    <div className="bg-white shadow-sm border border-gray-200 w-max rounded-t-xl overflow-visible">
                        <div className="bg-slate-800 text-center font-bold py-3 border-b border-slate-700 text-white uppercase tracking-wider text-sm shadow-sm relative overflow-hidden rounded-t-xl">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
                            Bảng chấm công Tháng {selectedMonth} năm {selectedYear}
                        </div>

                        <div className="grid" style={{ gridTemplateColumns: `50px 220px 140px repeat(${daysInMonth}, 38px)` }}>
                            <div className="sticky left-0 z-30 bg-slate-100 border-r border-b border-slate-200 p-2 text-xs font-black text-slate-600 text-center flex items-center justify-center row-span-2 shadow-[inset_0_-2px_0_rgba(0,0,0,0.02)]">STT</div>
                            <div 
                                className="sticky left-[50px] z-30 bg-slate-100 border-r border-b border-slate-200 p-2 text-xs font-black text-slate-600 flex items-center justify-between row-span-2 cursor-pointer hover:bg-slate-200 transition-colors shadow-[inset_0_-2px_0_rgba(0,0,0,0.02)] group select-none"
                                onClick={() => {
                                    if (staffSortBy === 'NAME') setStaffSortDir(prev => prev === 'ASC' ? 'DESC' : 'ASC');
                                    else { setStaffSortBy('NAME'); setStaffSortDir('ASC'); }
                                }}
                            >
                                <span>HỌ VÀ TÊN</span>
                                <div className="text-slate-400 group-hover:text-primary transition-colors">
                                    {staffSortBy === 'NAME' ? (
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${staffSortDir === 'ASC' ? 'rotate-180' : ''}`} />
                                    ) : (
                                        <ChevronDown size={14} className="opacity-0 group-hover:opacity-50" />
                                    )}
                                </div>
                            </div>
                            <div 
                                className="sticky left-[270px] z-30 bg-slate-100 border-r border-b border-slate-200 p-2 text-xs font-black text-slate-600 flex items-center justify-between row-span-2 cursor-pointer hover:bg-slate-200 transition-colors shadow-[inset_0_-2px_0_rgba(0,0,0,0.02)] group select-none"
                                onClick={() => {
                                    if (staffSortBy === 'ROLE') setStaffSortDir(prev => prev === 'ASC' ? 'DESC' : 'ASC');
                                    else { setStaffSortBy('ROLE'); setStaffSortDir('ASC'); }
                                }}
                            >
                                <span>CHỨC DANH</span>
                                <div className="text-slate-400 group-hover:text-primary transition-colors">
                                    {staffSortBy === 'ROLE' ? (
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${staffSortDir === 'ASC' ? 'rotate-180' : ''}`} />
                                    ) : (
                                        <ChevronDown size={14} className="opacity-0 group-hover:opacity-50" />
                                    )}
                                </div>
                            </div>
                            
                            {daysArray.map(day => (
                                <div key={day} className="bg-slate-50 border-r border-b border-slate-200 text-[10px] font-bold text-slate-500 text-center h-8 flex items-center justify-center uppercase shadow-[inset_0_-1px_0_rgba(0,0,0,0.02)]">
                                    {day}
                                </div>
                            ))}

                            {daysArray.map(day => {
                                const dow = getDayOfWeek(day, selectedMonth, selectedYear);
                                const isWeekend = dow === 'CN' || dow === 'T7';
                                return (
                                    <div key={`dow-${day}`} className={`border-r border-b border-slate-200 text-[9px] font-bold text-center h-6 flex items-center justify-center uppercase tracking-widest ${isWeekend ? 'bg-orange-50 text-orange-600' : 'bg-slate-100/50 text-slate-500'}`}>
                                        {dow}
                                    </div>
                                );
                            })}

                            {/* Row thiết lập ngày nghỉ toàn khoa */}
                            <div className="sticky left-0 z-20 border-r border-b border-rose-200 p-2 text-center text-[10px] font-black text-rose-600 bg-rose-50 flex items-center justify-center">LỄ/NGHỈ</div>
                            <div className="sticky left-[50px] z-20 border-r border-b border-rose-200 p-2 text-xs font-black text-rose-700 bg-rose-50 flex items-center justify-between">
                                <span className="uppercase tracking-wider">NGÀY NGHỈ TOÀN KHOA</span>
                                <CalendarOff size={13} className="text-rose-500 animate-pulse" />
                            </div>
                            <div className="sticky left-[270px] z-20 border-r border-b border-rose-200 p-2 text-center text-[9px] font-black text-rose-500 bg-rose-50 uppercase tracking-widest flex items-center justify-center">CHỌN NGÀY NGHỈ</div>
                            
                            {daysArray.map(day => {
                                const holidayActive = isHoliday(day);
                                return (
                                    <button
                                        key={`holiday-toggle-${day}`}
                                        onClick={() => {
                                            const dateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                            const holidayId = `holiday_${department.id}_${dateStr}`;
                                            
                                            const record: AttendanceRecord = {
                                                id: holidayId,
                                                staffId: `holiday_dept_${department.id}`,
                                                date: dateStr,
                                                status: holidayActive ? AttendanceStatus.PRESENT : AttendanceStatus.OFF_FULL
                                            };
                                            onUpdateAttendance(record);
                                        }}
                                        className={`border-r border-b border-rose-200 text-center flex items-center justify-center transition-all cursor-pointer h-10 hover:brightness-95 text-[10px] font-black
                                            ${holidayActive 
                                                ? 'bg-rose-500 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]' 
                                                : 'bg-rose-50/40 text-rose-300 hover:bg-rose-100 hover:text-rose-500'
                                            }
                                        `}
                                        title={holidayActive ? "Đang là ngày nghỉ toàn khoa. Nhấp để hủy." : "Đặt ngày này làm ngày nghỉ toàn khoa."}
                                    >
                                        {holidayActive ? 'OFF' : '-'}
                                    </button>
                                );
                            })}
                            
                            {sortedDepartmentStaff.map((s, index) => (
                                <React.Fragment key={s.id}>
                                    <div className="sticky left-0 z-10 border-r border-b border-slate-200 p-2 text-center text-sm font-bold text-slate-400 bg-white">{index + 1}</div>
                                    <div className="sticky left-[50px] z-10 border-r border-b border-slate-200 p-2 text-sm font-bold text-slate-700 bg-white truncate hover:bg-blue-50 hover:text-primary transition-colors cursor-pointer select-none" title={`Nhấp để chấm nhanh nghỉ/đi làm cả tháng cho ${s.name}`} onClick={() => handleStaffNameClick(s)}>{s.name}</div>
                                    <div className="sticky left-[270px] z-10 border-r border-b border-slate-200 p-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-white truncate">{getRoleLabel(s.role)}</div>
                                    
                                    {daysArray.map(day => {
                                        const status = getAttendanceStatus(s.id, day);
                                        const dow = getDayOfWeek(day, selectedMonth, selectedYear);
                                        const isWeekend = dow === 'CN';
                                        const dayIsHoliday = isHoliday(day);

                                        return (
                                            <button 
                                                key={`${s.id}-${day}`}
                                                onClick={() => handleCellClick(s.id, day)}
                                                className={`border-r border-b border-slate-200 text-center text-[10px] font-bold hover:brightness-95 transition-all flex items-center justify-center h-10
                                                    ${getCellColor(status, dayIsHoliday)} 
                                                    ${status === AttendanceStatus.PRESENT && isWeekend && !dayIsHoliday ? 'bg-slate-50 text-slate-300' : ''}
                                                    ${status === AttendanceStatus.PRESENT && !isWeekend && !dayIsHoliday ? 'bg-white text-slate-300 hover:text-slate-400' : ''}
                                                    ${status === AttendanceStatus.PRESENT && dayIsHoliday ? 'bg-rose-50/20 text-rose-400/50' : ''}
                                                `}
                                                title={`Ngày ${day}: ${status === AttendanceStatus.OFF_FULL && dayIsHoliday ? 'Nghỉ lễ toàn khoa' : status}`}
                                            >
                                                {getCellLabel(status)}
                                            </button>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'PROCEDURES' && (
            <div className="p-6 overflow-y-auto space-y-6">
                 {/* Header controls & tips */}
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Danh mục thủ thuật ({procedures.filter(p => p.deptId === department.id).length})</h3>
                        <p className="text-gray-500 text-xs mt-0.5 italic">Mẹo: "Chặn trước" chặn các thủ thuật trước nó. "Chặn sau" chặn các thủ thuật sau nó.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="danger" onClick={() => {
                            if (window.confirm('Bạn có chắc chắn muốn xóa TẤT CẢ thủ thuật của khoa này? Hành động này không thể hoàn tác.')) {
                                onUpdateProcedures(procedures.filter(p => p.deptId !== department.id));
                            }
                        }}>
                            <Trash2 size={16} /> Xóa tất cả
                        </Button>
                        <Button size="sm" onClick={handleAddProcedure} className="shadow-sm">
                            <Plus size={16} /> Thêm thủ thuật
                        </Button>
                    </div>
                 </div>

                 {/* Search & Category Filter Pills */}
                 <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên thủ thuật..."
                            value={procSearchTerm}
                            onChange={e => setProcSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                        />
                        {procSearchTerm && (
                            <button onClick={() => setProcSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-3">
                        <button
                            type="button"
                            onClick={() => setProcCategoryFilter('ALL')}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${
                                procCategoryFilter === 'ALL'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <span>Tất cả</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${procCategoryFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {procedures.filter(p => p.deptId === department.id).length}
                            </span>
                        </button>
                        {PROCEDURE_CATEGORIES.map(cat => {
                            const count = procedures.filter(p => p.deptId === department.id && (p.category || 'Lâm sàng') === cat).length;
                            const isSelected = procCategoryFilter === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setProcCategoryFilter(cat)}
                                    className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${
                                        isSelected
                                            ? cat === 'Lâm sàng' ? 'bg-blue-600 text-white shadow-sm'
                                            : cat === 'Cận lâm sàng' ? 'bg-purple-600 text-white shadow-sm'
                                            : cat === 'Hành chính' ? 'bg-amber-600 text-white shadow-sm'
                                            : 'bg-slate-700 text-white shadow-sm'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <span>{cat}</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                 </div>

                 {/* Procedure Cards Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {procedures
                        .filter(proc => proc.deptId === department.id)
                        .filter(proc => {
                            if (procCategoryFilter === 'ALL') return true;
                            return (proc.category || 'Lâm sàng') === procCategoryFilter;
                        })
                        .filter(proc => {
                            if (!procSearchTerm.trim()) return true;
                            return proc.name.toLowerCase().includes(procSearchTerm.toLowerCase());
                        })
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(proc => {
                            const procCat = proc.category || 'Lâm sàng';
                            return (
                            <div 
                                key={proc.id} 
                                onClick={() => {
                                    let updatedProc = { ...proc };
                                    if (!updatedProc.durationOptions || updatedProc.durationOptions.length === 0) {
                                        updatedProc.durationOptions = [{
                                            id: `opt_${Math.random().toString(36).substr(2, 9)}`,
                                            name: 'Mặc định',
                                            durationMinutes: updatedProc.durationMinutes || 30,
                                            restMinutes: updatedProc.restMinutes || 0,
                                            mainBusyStart: updatedProc.mainBusyStart ?? 0,
                                            mainBusyEnd: updatedProc.mainBusyEnd ?? (updatedProc.durationMinutes || 30),
                                            asst1BusyStart: updatedProc.asst1BusyStart,
                                            asst1BusyEnd: updatedProc.asst1BusyEnd,
                                            asst2BusyStart: updatedProc.asst2BusyStart,
                                            asst2BusyEnd: updatedProc.asst2BusyEnd,
                                            isDefault: true
                                        }];
                                    } else {
                                        // Đảm bảo có ít nhất một phương án được đặt làm mặc định
                                        const hasDefault = updatedProc.durationOptions.some(o => o.isDefault);
                                        if (!hasDefault && updatedProc.durationOptions.length > 0) {
                                            updatedProc.durationOptions = updatedProc.durationOptions.map((o, idx) => ({
                                                ...o,
                                                isDefault: idx === 0
                                            }));
                                        }
                                    }
                                    setEditingProcedure(updatedProc);
                                }} 
                                className={`bg-white border rounded-2xl p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group flex flex-col gap-3 ${proc.deptId === department.id ? 'border-blue-500/80 shadow-sm shadow-blue-50' : 'border-slate-200 opacity-40 grayscale-[0.5]'}`}
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors font-black text-xs shrink-0">
                                            {getAbbreviation(proc.name)}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-slate-800 text-sm group-hover:text-primary transition-colors truncate">{proc.name}</h4>
                                            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                procCat === 'Lâm sàng' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                procCat === 'Cận lâm sàng' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                                procCat === 'Hành chính' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}>
                                                {procCat}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5 shrink-0 items-center">
                                        {proc.isPreRequisite && <span title="Chặn trước" className="flex items-center"><Lock size={14} className="text-amber-500" /></span>}
                                        {proc.isPostRequisite && <span title="Chặn sau" className="flex items-center"><Lock size={14} className="text-rose-500" /></span>}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProcedure(proc.id);
                                            }}
                                            className="p-1.5 bg-slate-50 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                            title="Xóa thủ thuật"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <Clock size={14} className="text-slate-400" /> {proc.durationMinutes} phút
                                    {proc.restMinutes ? (
                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 ml-1">
                                            + {proc.restMinutes}p nghỉ
                                        </span>
                                    ) : null}
                                </div>
                                
                                <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-slate-100">
                                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase">
                                        <User size={12} /> Chính
                                    </div>
                                    {(proc.asst1BusyEnd || 0) > 0 && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase">
                                            <Users size={12} /> Phụ 1
                                        </div>
                                    )}
                                    {(proc.asst2BusyEnd || 0) > 0 && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase">
                                            <Users size={12} /> Phụ 2
                                        </div>
                                    )}
                                    {proc.isIndependent && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-black uppercase">
                                            Độc lập
                                        </div>
                                    )}
                                    {proc.requireMachine && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase ml-auto">
                                            <Zap size={12} /> Máy ({proc.availableMachines?.length || 0})
                                        </div>
                                    )}
                                </div>
                            </div>
                        )})}
                 </div>
                 {procedures.filter(p => p.deptId === department.id).length === 0 && (
                     <div className="p-8 text-center text-gray-400">Chưa có thủ thuật nào.</div>
                 )}
                 {procedures.filter(p => p.deptId === department.id).length > 0 && 
                  procedures.filter(p => p.deptId === department.id && (procCategoryFilter === 'ALL' || (p.category || 'Lâm sàng') === procCategoryFilter) && (!procSearchTerm.trim() || p.name.toLowerCase().includes(procSearchTerm.toLowerCase()))).length === 0 && (
                     <div className="p-8 text-center text-gray-400">Không tìm thấy thủ thuật nào phù hợp với bộ lọc.</div>
                 )}
            </div>
        )}

      </div>

      {editingProcedure && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          <Settings2 className="text-primary" /> 
                          {procedures.some(p => p.id === editingProcedure.id) ? 'Chỉnh sửa thủ thuật' : 'Thêm thủ thuật mới'}
                      </h3>
                      <button onClick={() => setEditingProcedure(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                          <X size={24} />
                      </button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 space-y-6 scrollbar-thin">
                      {/* --- PHẦN TRÊN: THÔNG TIN CHUNG --- */}
                      <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-200/80 space-y-4">
                          <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
                              <Settings2 className="text-primary" size={16} />
                              1. Thông tin chung
                          </h4>
                          <div className="space-y-1.5">
                              <label className="text-xs font-black text-slate-500 uppercase tracking-wide">Tên thủ thuật</label>
                              <input 
                                  className="w-full p-3.5 border-2 border-slate-200 rounded-xl text-base font-bold text-slate-850 focus:border-primary outline-none transition-all focus:bg-white bg-white"
                                  value={editingProcedure.name}
                                  onChange={e => setEditingProcedure({...editingProcedure, name: e.target.value})}
                                  placeholder="Nhập tên thủ thuật..."
                              />
                          </div>

                          <div className="space-y-1.5">
                              <label className="text-xs font-black text-slate-500 uppercase tracking-wide">Nhóm danh mục</label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {PROCEDURE_CATEGORIES.map(cat => {
                                      const isSelected = (editingProcedure.category || 'Lâm sàng') === cat;
                                      return (
                                          <button
                                              key={cat}
                                              type="button"
                                              onClick={() => setEditingProcedure({ ...editingProcedure, category: cat })}
                                              className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border-2 ${
                                                  isSelected
                                                      ? cat === 'Lâm sàng' ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm'
                                                      : cat === 'Cận lâm sàng' ? 'bg-purple-50 border-purple-600 text-purple-700 shadow-sm'
                                                      : cat === 'Hành chính' ? 'bg-amber-50 border-amber-600 text-amber-700 shadow-sm'
                                                      : 'bg-slate-100 border-slate-700 text-slate-800 shadow-sm'
                                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                              }`}
                                          >
                                              {isSelected && <Check size={14} strokeWidth={3} className="shrink-0" />}
                                              <span>{cat}</span>
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>

                          {/* Tích chọn thủ thuật chặn trước, chặn sau, độc lập */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                              <label className="flex items-center gap-3 cursor-pointer group select-none p-3 bg-white border border-slate-200 rounded-xl hover:border-amber-400 transition-all">
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editingProcedure.isPreRequisite ? 'bg-amber-500 border-amber-500 shadow-sm' : 'border-slate-350 group-hover:border-amber-400'}`}>
                                      {editingProcedure.isPreRequisite && <Check size={14} className="text-white" strokeWidth={4} />}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={editingProcedure.isPreRequisite || false} onChange={e => setEditingProcedure({...editingProcedure, isPreRequisite: e.target.checked})} />
                                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Chặn trước (Bắt buộc làm trước)</span>
                              </label>

                              <label className="flex items-center gap-3 cursor-pointer group select-none p-3 bg-white border border-slate-200 rounded-xl hover:border-rose-400 transition-all">
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editingProcedure.isPostRequisite ? 'bg-rose-500 border-rose-500 shadow-sm' : 'border-slate-350 group-hover:border-rose-400'}`}>
                                      {editingProcedure.isPostRequisite && <Check size={14} className="text-white" strokeWidth={4} />}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={editingProcedure.isPostRequisite || false} onChange={e => setEditingProcedure({...editingProcedure, isPostRequisite: e.target.checked})} />
                                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Chặn sau (Làm sau cùng)</span>
                              </label>

                              <label className="flex items-center gap-3 cursor-pointer group select-none p-3 bg-white border border-slate-200 rounded-xl hover:border-purple-400 transition-all">
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editingProcedure.isIndependent ? 'bg-purple-500 border-purple-500 shadow-sm' : 'border-slate-350 group-hover:border-purple-400'}`}>
                                      {editingProcedure.isIndependent && <Check size={14} className="text-white" strokeWidth={4} />}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={editingProcedure.isIndependent || false} onChange={e => setEditingProcedure({...editingProcedure, isIndependent: e.target.checked})} />
                                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Thủ thuật độc lập (Vd: Sắc thuốc)</span>
                              </label>
                          </div>

                          {/* Sử dụng máy móc nằm gọn gàng trong Thông tin chung */}
                          <div className="pt-2 border-t border-slate-200">
                              <label className="flex items-center gap-3 cursor-pointer group select-none">
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editingProcedure.requireMachine ? 'bg-indigo-500 border-indigo-500 shadow-sm' : 'border-slate-350 group-hover:border-indigo-400'}`}>
                                      {editingProcedure.requireMachine && <Check size={14} className="text-white" strokeWidth={4} />}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={editingProcedure.requireMachine || false} onChange={e => setEditingProcedure({...editingProcedure, requireMachine: e.target.checked})} />
                                  <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Có sử dụng máy móc / thiết bị chuyên dụng</span>
                              </label>

                              {editingProcedure.requireMachine && (
                                  <div className="mt-4 p-4 bg-white rounded-2xl border-2 border-indigo-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                                      <div className="space-y-1.5">
                                          <label className="text-xs font-black text-slate-600 uppercase tracking-wide">Sức chứa (Số BN/máy cùng lúc)</label>
                                          <input 
                                              type="number" min="1"
                                              className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-850 focus:border-indigo-400 focus:bg-white bg-slate-50/20 outline-none transition-all"
                                              value={editingProcedure.machineCapacity || 1}
                                              onChange={e => setEditingProcedure({...editingProcedure, machineCapacity: Number(e.target.value)})}
                                          />
                                      </div>

                                      <div className="pt-4 border-t border-slate-100">
                                          <h4 className="text-xs font-black text-indigo-850 uppercase tracking-wider mb-3">Tạo hàng loạt mã máy</h4>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                              <div>
                                                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Tiền tố</label>
                                                  <input 
                                                      className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-indigo-400 outline-none transition-all bg-white" 
                                                      placeholder="VD: M"
                                                      value={machineGen.prefix}
                                                      onChange={e => setMachineGen({ ...machineGen, prefix: e.target.value })}
                                                  />
                                              </div>
                                              <div>
                                                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Hậu tố</label>
                                                  <input 
                                                      className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-indigo-400 outline-none transition-all bg-white" 
                                                      placeholder="VD: YDCT"
                                                      value={machineGen.suffix}
                                                      onChange={e => setMachineGen({ ...machineGen, suffix: e.target.value })}
                                                  />
                                              </div>
                                              <div>
                                                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Từ số</label>
                                                  <input 
                                                      type="number"
                                                      className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-indigo-400 outline-none transition-all bg-white" 
                                                      value={machineGen.start}
                                                      onChange={e => setMachineGen({ ...machineGen, start: Number(e.target.value) })}
                                                  />
                                              </div>
                                              <div>
                                                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Đến số</label>
                                                  <input 
                                                      type="number"
                                                      className="w-full border-2 border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:border-indigo-400 outline-none transition-all bg-white" 
                                                      value={machineGen.end}
                                                      onChange={e => setMachineGen({ ...machineGen, end: Number(e.target.value) })}
                                                  />
                                              </div>
                                          </div>
                                          <Button size="sm" onClick={handleGenerateMachines} className="w-full py-2.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors">
                                              Tạo danh sách máy
                                          </Button>
                                      </div>

                                      <div className="pt-4 border-t border-slate-100">
                                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3 flex justify-between items-center">
                                              Danh sách máy hiện có
                                              <span className="text-indigo-700 bg-indigo-100 px-2.5 py-0.5 text-[10px] font-extrabold rounded-full">
                                                  {editingProcedure.availableMachines?.length || 0} máy
                                              </span>
                                          </h4>
                                          <div className="bg-white border-2 border-indigo-50 rounded-xl max-h-40 overflow-y-auto divide-y divide-indigo-50 scrollbar-thin">
                                              {(!editingProcedure.availableMachines || editingProcedure.availableMachines.length === 0) && (
                                                  <div className="p-4 text-center text-xs font-medium text-slate-400">Chưa có máy nào</div>
                                              )}
                                              {editingProcedure.availableMachines?.map((code, idx) => (
                                                  <div key={idx} className="p-2.5 flex justify-between items-center hover:bg-indigo-50/50 transition-colors">
                                                      <span className="text-xs font-extrabold text-slate-700">{code}</span>
                                                      <button 
                                                          type="button"
                                                          onClick={() => handleRemoveMachine(code)}
                                                          className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-50"
                                                      >
                                                          <X size={14} />
                                                      </button>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* --- PHẦN DƯỚI: THỜI LƯỢNG --- */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 space-y-5 shadow-sm">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                              <div className="space-y-0.5">
                                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                      <Clock size={16} className="text-primary" />
                                      2. Các phương án thời lượng
                                  </h4>
                                  <p className="text-[11px] text-slate-400 font-bold">Thủ thuật của bạn có thể chứa nhiều phương án thời gian chạy khác nhau.</p>
                              </div>
                              {!showOptForm && (
                                  <button
                                      type="button"
                                      onClick={() => {
                                          setNewOpt({
                                              name: '',
                                              durationMinutes: 30,
                                              restMinutes: 0,
                                              mainBusyStart: 0,
                                              mainBusyEnd: 30,
                                              asst1BusyStart: 0,
                                              asst1BusyEnd: 0,
                                              asst2BusyStart: 0,
                                              asst2BusyEnd: 0,
                                              asst1Enabled: false,
                                              asst2Enabled: false,
                                          });
                                          setEditingOptId(null);
                                          setShowOptForm(true);
                                      }}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/95 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm shadow-primary/20"
                                  >
                                      <Plus size={14} strokeWidth={3} /> Thêm thời lượng
                                  </button>
                              )}
                          </div>

                          {/* Form chọn thời lượng đầy đủ khi bấm thêm/sửa */}
                          {showOptForm && (
                              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 animate-in fade-in zoom-in-95 duration-155">
                                  <h5 className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-1.5">
                                      {editingOptId ? 'Chỉnh sửa phương án thời lượng' : 'Cấu hình phương án thời lượng mới'}
                                  </h5>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div className="space-y-1">
                                          <label className="text-xs font-black text-slate-500 uppercase ml-1">Tên nhãn phương án</label>
                                          <input 
                                              type="text"
                                              placeholder="Vd: Chuẩn 30p, Kéo dài 45p..."
                                              className="w-full p-3 border border-slate-200 bg-white rounded-xl text-sm font-bold focus:border-primary outline-none transition-colors"
                                              value={newOpt.name}
                                              onChange={e => setNewOpt({...newOpt, name: e.target.value})}
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-xs font-black text-slate-500 uppercase ml-1">Thời gian thực hiện (phút)</label>
                                          <input 
                                              type="number"
                                              min="1"
                                              className="w-full p-3 border border-slate-200 bg-white rounded-xl text-sm font-bold focus:border-primary outline-none transition-colors"
                                              value={newOpt.durationMinutes}
                                              onChange={e => {
                                                  const dm = Number(e.target.value);
                                                  setNewOpt({...newOpt, durationMinutes: dm, mainBusyEnd: dm});
                                              }}
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-xs font-black text-slate-500 uppercase ml-1">Thời gian nghỉ sau TT (phút)</label>
                                          <input 
                                              type="number"
                                              min="0"
                                              className="w-full p-3 border border-slate-200 bg-white rounded-xl text-sm font-bold focus:border-primary outline-none transition-colors"
                                              value={newOpt.restMinutes}
                                              onChange={e => setNewOpt({...newOpt, restMinutes: Number(e.target.value)})}
                                          />
                                      </div>
                                  </div>

                                  {/* Nhân sự & Thời gian bận của phương án */}
                                  <div className="space-y-2.5">
                                      <label className="text-xs font-black text-slate-600 uppercase block tracking-wider mb-1">Cấu hình nhân sự & thời gian bận</label>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                          {/* Nhân sự chính */}
                                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-sm">
                                              <span className="text-xs font-black text-blue-700 uppercase block tracking-wide">Nhân sự chính</span>
                                              <div className="grid grid-cols-2 gap-2 text-xs">
                                                  <div>
                                                      <span className="text-[10px] text-slate-400 font-bold block mb-1">Từ phút</span>
                                                      <input 
                                                          type="number" min="0" max={newOpt.durationMinutes}
                                                          className="w-full p-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs font-bold text-slate-800 focus:border-primary outline-none"
                                                          value={newOpt.mainBusyStart}
                                                          onChange={e => setNewOpt({...newOpt, mainBusyStart: Number(e.target.value)})}
                                                      />
                                                  </div>
                                                  <div>
                                                      <span className="text-[10px] text-slate-400 font-bold block mb-1">Đến phút</span>
                                                      <input 
                                                          type="number" min="0" max={newOpt.durationMinutes}
                                                          className="w-full p-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs font-bold text-slate-800 focus:border-primary outline-none"
                                                          value={newOpt.mainBusyEnd}
                                                          onChange={e => setNewOpt({...newOpt, mainBusyEnd: Number(e.target.value)})}
                                                      />
                                                  </div>
                                              </div>
                                          </div>

                                          {/* Nhân sự phụ 1 */}
                                          <div className={`p-3 border rounded-xl space-y-2 transition-all shadow-sm ${newOpt.asst1Enabled ? 'bg-emerald-50/20 border-emerald-250' : 'bg-white border-slate-200'}`}>
                                              <div className="flex justify-between items-center">
                                                  <span className="text-xs font-black text-emerald-700 uppercase tracking-wide">Nhân sự phụ 1</span>
                                                  <input 
                                                      type="checkbox" 
                                                      checked={newOpt.asst1Enabled} 
                                                      onChange={e => {
                                                          setNewOpt({
                                                              ...newOpt, 
                                                              asst1Enabled: e.target.checked,
                                                              asst1BusyEnd: e.target.checked ? newOpt.durationMinutes : 0
                                                          });
                                                      }} 
                                                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                  />
                                              </div>
                                              {newOpt.asst1Enabled ? (
                                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                                      <div>
                                                          <span className="text-[10px] text-slate-400 font-bold block mb-1">Từ phút</span>
                                                          <input 
                                                              type="number" min="0" max={newOpt.durationMinutes}
                                                              className="w-full p-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs font-bold text-slate-800 focus:border-emerald-400 outline-none"
                                                              value={newOpt.asst1BusyStart}
                                                              onChange={e => setNewOpt({...newOpt, asst1BusyStart: Number(e.target.value)})}
                                                          />
                                                      </div>
                                                      <div>
                                                          <span className="text-[10px] text-slate-400 font-bold block mb-1">Đến phút</span>
                                                          <input 
                                                              type="number" min="0" max={newOpt.durationMinutes}
                                                              className="w-full p-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs font-bold text-slate-800 focus:border-emerald-400 outline-none"
                                                              value={newOpt.asst1BusyEnd}
                                                              onChange={e => setNewOpt({...newOpt, asst1BusyEnd: Number(e.target.value)})}
                                                          />
                                                      </div>
                                                  </div>
                                              ) : (
                                                  <div className="text-[11px] text-slate-400 italic font-medium pt-2">Không yêu cầu người phụ 1</div>
                                              )}
                                          </div>

                                          {/* Nhân sự phụ 2 */}
                                          <div className={`p-3 border rounded-xl space-y-2 transition-all shadow-sm ${newOpt.asst2Enabled ? 'bg-sky-50/20 border-sky-250' : 'bg-white border-slate-200'}`}>
                                              <div className="flex justify-between items-center">
                                                  <span className="text-xs font-black text-sky-700 uppercase tracking-wide">Nhân sự phụ 2</span>
                                                  <input 
                                                      type="checkbox" 
                                                      checked={newOpt.asst2Enabled} 
                                                      onChange={e => {
                                                          setNewOpt({
                                                              ...newOpt, 
                                                              asst2Enabled: e.target.checked,
                                                              asst2BusyEnd: e.target.checked ? newOpt.durationMinutes : 0
                                                          });
                                                      }} 
                                                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                  />
                                              </div>
                                              {newOpt.asst2Enabled ? (
                                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                                      <div>
                                                          <span className="text-[10px] text-slate-400 font-bold block mb-1">Từ phút</span>
                                                          <input 
                                                              type="number" min="0" max={newOpt.durationMinutes}
                                                              className="w-full p-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs font-bold text-slate-800 focus:border-sky-400 outline-none"
                                                              value={newOpt.asst2BusyStart}
                                                              onChange={e => setNewOpt({...newOpt, asst2BusyStart: Number(e.target.value)})}
                                                          />
                                                      </div>
                                                      <div>
                                                          <span className="text-[10px] text-slate-400 font-bold block mb-1">Đến phút</span>
                                                          <input 
                                                              type="number" min="0" max={newOpt.durationMinutes}
                                                              className="w-full p-2 border border-slate-200 bg-slate-50/50 rounded-lg text-xs font-bold text-slate-800 focus:border-sky-400 outline-none"
                                                              value={newOpt.asst2BusyEnd}
                                                              onChange={e => setNewOpt({...newOpt, asst2BusyEnd: Number(e.target.value)})}
                                                          />
                                                      </div>
                                                  </div>
                                              ) : (
                                                  <div className="text-[11px] text-slate-400 italic font-medium pt-2">Không yêu cầu người phụ 2</div>
                                              )}
                                          </div>
                                      </div>
                                  </div>

                                  {/* Buttons cho form cấu hình */}
                                  <div className="flex justify-end gap-3 pt-2">
                                      <button
                                          type="button"
                                          onClick={() => {
                                              setShowOptForm(false);
                                              setEditingOptId(null);
                                          }}
                                          className="px-4 py-2 border border-slate-350 bg-white text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors"
                                      >
                                          Hủy bỏ
                                      </button>
                                      <button
                                          type="button"
                                          onClick={() => {
                                              if (!newOpt.name.trim()) {
                                                  alert("Vui lòng nhập tên nhãn cho phương án thời lượng!");
                                                  return;
                                              }
                                              if (newOpt.durationMinutes <= 0) {
                                                  alert("Thời lượng phải lớn hơn 0 phút!");
                                                  return;
                                              }

                                              // Tạo/Cập nhật phương án thời lượng
                                              const updatedOption: ProcedureDurationOption = {
                                                  id: editingOptId || `opt_${Math.random().toString(36).substr(2, 9)}`,
                                                  name: newOpt.name.trim(),
                                                  durationMinutes: newOpt.durationMinutes,
                                                  restMinutes: newOpt.restMinutes,
                                                  mainBusyStart: newOpt.mainBusyStart,
                                                  mainBusyEnd: newOpt.mainBusyEnd,
                                                  asst1BusyStart: newOpt.asst1Enabled ? newOpt.asst1BusyStart : undefined,
                                                  asst1BusyEnd: newOpt.asst1Enabled ? newOpt.asst1BusyEnd : undefined,
                                                  asst2BusyStart: newOpt.asst2Enabled ? newOpt.asst2BusyStart : undefined,
                                                  asst2BusyEnd: newOpt.asst2Enabled ? newOpt.asst2BusyEnd : undefined,
                                                  isDefault: false, // Để hàm helper xử lý đánh dấu mặc định nếu rỗng
                                              };

                                              let updatedOptions = [...(editingProcedure.durationOptions || [])].map(o => ({ ...o }));
                                              
                                              if (editingOptId) {
                                                  // Đang sửa: tìm và cập nhật
                                                  const idx = updatedOptions.findIndex(o => o.id === editingOptId);
                                                  if (idx !== -1) {
                                                      const oldOpt = updatedOptions[idx];
                                                      updatedOption.isDefault = oldOpt.isDefault; // Bảo toàn thuộc tính mặc định
                                                      updatedOptions[idx] = updatedOption;
                                                  }
                                              } else {
                                                  // Thêm mới
                                                  // "nếu thời lượng đầu tiên thêm sẽ được đặt làm mặc định"
                                                  if (updatedOptions.length === 0) {
                                                      updatedOption.isDefault = true;
                                                  }
                                                  updatedOptions.push(updatedOption);
                                              }

                                              updateDurationOptionsAndSyncDefault(updatedOptions);
                                              setShowOptForm(false);
                                              setEditingOptId(null);
                                          }}
                                          className="px-4 py-2 bg-primary text-white hover:bg-primary/95 rounded-xl font-extrabold text-xs transition-colors shadow-sm"
                                      >
                                          {editingOptId ? 'Cập nhật' : 'Xác nhận & Thêm'}
                                      </button>
                                  </div>
                              </div>
                          )}

                          {/* Danh sách các phương án thời lượng đã cấu hình */}
                          <div className="space-y-3">
                              <label className="text-xs font-black text-slate-500 uppercase tracking-wide">Danh sách các phương án đã cấu hình</label>
                              {editingProcedure.durationOptions && editingProcedure.durationOptions.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {editingProcedure.durationOptions.map((opt) => (
                                          <div 
                                              key={opt.id} 
                                              onClick={() => {
                                                  // Bấm vào thẻ để sửa phương án
                                                  setNewOpt({
                                                      name: opt.name,
                                                      durationMinutes: opt.durationMinutes,
                                                      restMinutes: opt.restMinutes || 0,
                                                      mainBusyStart: opt.mainBusyStart ?? 0,
                                                      mainBusyEnd: opt.mainBusyEnd ?? opt.durationMinutes,
                                                      asst1BusyStart: opt.asst1BusyStart ?? 0,
                                                      asst1BusyEnd: opt.asst1BusyEnd ?? 0,
                                                      asst1Enabled: (opt.asst1BusyEnd || 0) > 0,
                                                      asst2BusyStart: opt.asst2BusyStart ?? 0,
                                                      asst2BusyEnd: opt.asst2BusyEnd ?? 0,
                                                      asst2Enabled: (opt.asst2BusyEnd || 0) > 0,
                                                  });
                                                  setEditingOptId(opt.id);
                                                  setShowOptForm(true);
                                              }}
                                              className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between hover:border-primary/40 cursor-pointer group relative bg-white ${opt.isDefault ? 'border-primary shadow-sm bg-primary/5' : 'border-slate-200 shadow-xs'}`}
                                          >
                                              <div className="flex justify-between items-start gap-4">
                                                  <div className="space-y-1">
                                                      <div className="flex items-center gap-2">
                                                          <span className="font-extrabold text-sm text-slate-800 uppercase">{opt.name}</span>
                                                          {opt.isDefault && (
                                                              <span className="text-[10px] bg-primary text-white font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                                                  <Star size={8} fill="currentColor" /> Mặc định
                                                              </span>
                                                          )}
                                                      </div>
                                                      <div className="flex flex-wrap gap-2 pt-0.5">
                                                          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1 font-mono">
                                                              <Clock size={12} className="text-slate-400" /> {opt.durationMinutes}p
                                                          </span>
                                                          {opt.restMinutes ? (
                                                              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-mono">
                                                                  + {opt.restMinutes}p nghỉ
                                                              </span>
                                                          ) : null}
                                                      </div>
                                                  </div>

                                                  <div className="flex items-center gap-1">
                                                      {/* Switch chọn làm mặc định */}
                                                      <button
                                                          type="button"
                                                          onClick={(e) => {
                                                              e.stopPropagation();
                                                              if (opt.isDefault) return; // Đã là mặc định rồi thì không bỏ chọn được, phải chọn cái khác
                                                              
                                                              const updatedOpts = editingProcedure.durationOptions?.map(o => ({
                                                                  ...o,
                                                                  isDefault: o.id === opt.id
                                                              })) || [];
                                                              updateDurationOptionsAndSyncDefault(updatedOpts);
                                                          }}
                                                          className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg transition-colors border ${opt.isDefault ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200'}`}
                                                          title="Đặt làm phương án mặc định"
                                                      >
                                                          {opt.isDefault ? 'Mặc định' : 'Chọn mặc định'}
                                                      </button>

                                                      {/* Nút xóa phương án */}
                                                      <button 
                                                          type="button"
                                                          onClick={(e) => {
                                                              e.stopPropagation();
                                                              const opts = editingProcedure.durationOptions || [];
                                                              if (opts.length <= 1) {
                                                                  alert("Thủ thuật cần có ít nhất một phương án thời lượng!");
                                                                  return;
                                                              }
                                                              if (confirm("Bạn có chắc muốn xóa phương án thời lượng này?")) {
                                                                  let remainingOpts = opts.filter(o => o.id !== opt.id).map(o => ({ ...o }));
                                                                  // Nếu xóa phương án đang mặc định, gán cái đầu tiên làm mặc định
                                                                  if (opt.isDefault && remainingOpts.length > 0) {
                                                                      remainingOpts[0].isDefault = true;
                                                                  }
                                                                  updateDurationOptionsAndSyncDefault(remainingOpts);
                                                                  
                                                                  // Nếu đang sửa chính phương án bị xóa, đóng form sửa
                                                                  if (editingOptId === opt.id) {
                                                                      setShowOptForm(false);
                                                                      setEditingOptId(null);
                                                                  }
                                                              }
                                                          }}
                                                          className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                                          title="Xóa phương án này"
                                                      >
                                                          <Trash2 size={14} />
                                                      </button>
                                                  </div>
                                              </div>

                                              {/* Hiển thị chi tiết nhân sự bận của phương án */}
                                              <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-1 gap-1 text-[11px] font-bold text-slate-500">
                                                  <div className="flex justify-between items-center bg-blue-50/40 text-blue-900 px-2.5 py-1 rounded-lg">
                                                      <span>Chính bận:</span>
                                                      <span className="font-mono text-slate-700">{opt.mainBusyStart ?? 0} - {opt.mainBusyEnd ?? opt.durationMinutes}p</span>
                                                  </div>
                                                  {opt.asst1BusyEnd && opt.asst1BusyEnd > 0 ? (
                                                      <div className="flex justify-between items-center bg-emerald-50/40 text-emerald-900 px-2.5 py-1 rounded-lg">
                                                          <span>Phụ 1 bận:</span>
                                                          <span className="font-mono text-slate-700">{opt.asst1BusyStart ?? 0} - {opt.asst1BusyEnd}p</span>
                                                      </div>
                                                  ) : null}
                                                  {opt.asst2BusyEnd && opt.asst2BusyEnd > 0 ? (
                                                      <div className="flex justify-between items-center bg-sky-50/40 text-sky-900 px-2.5 py-1 rounded-lg">
                                                          <span>Phụ 2 bận:</span>
                                                          <span className="font-mono text-slate-700">{opt.asst2BusyStart ?? 0} - {opt.asst2BusyEnd}p</span>
                                                      </div>
                                                  ) : null}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="p-5 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-semibold bg-slate-50/50">
                                      Chưa cấu hình phương án thời lượng nào. Hãy bấm "Thêm thời lượng" để thiết lập!
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end items-center shrink-0">
                      <div className="flex gap-4">
                          <button onClick={() => setEditingProcedure(null)} className="px-6 py-3.5 text-slate-500 font-black text-sm uppercase tracking-wider hover:bg-slate-200 rounded-xl transition-colors">HỦY BỎ</button>
                          <Button onClick={() => {
                              let finalProc = { ...editingProcedure };
                              if (finalProc.durationOptions && finalProc.durationOptions.length > 0) {
                                  let hasDefault = finalProc.durationOptions.some(o => o.isDefault);
                                  if (!hasDefault) {
                                      finalProc.durationOptions = finalProc.durationOptions.map((o, idx) => ({
                                          ...o,
                                          isDefault: idx === 0
                                      }));
                                  }
                                  const defaultOpt = finalProc.durationOptions.find(o => o.isDefault) || finalProc.durationOptions[0];
                                  finalProc.durationMinutes = defaultOpt.durationMinutes;
                                  finalProc.restMinutes = defaultOpt.restMinutes || 0;
                                  finalProc.mainBusyStart = defaultOpt.mainBusyStart ?? 0;
                                  finalProc.mainBusyEnd = defaultOpt.mainBusyEnd ?? defaultOpt.durationMinutes;
                                  finalProc.asst1BusyStart = defaultOpt.asst1BusyStart;
                                  finalProc.asst1BusyEnd = defaultOpt.asst1BusyEnd;
                                  finalProc.asst2BusyStart = defaultOpt.asst2BusyStart;
                                  finalProc.asst2BusyEnd = defaultOpt.asst2BusyEnd;
                              }
                              finalProc.category = finalProc.category || 'Lâm sàng';
                              if (procedures.some(p => p.id === finalProc.id)) {
                                  onUpdateProcedures(procedures.map(p => p.id === finalProc.id ? finalProc : p));
                              } else {
                                  onUpdateProcedures([...procedures, finalProc]);
                              }
                              setEditingProcedure(null);
                          }} className="px-8 py-3.5 rounded-xl shadow-lg shadow-primary/30 text-base font-black tracking-wide">
                              <Save size={18} /> LƯU THỦ THUẬT
                          </Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
