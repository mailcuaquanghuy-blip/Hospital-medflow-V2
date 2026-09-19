import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Department, Staff, Appointment, Procedure, Patient, AttendanceRecord, AttendanceStatus } from '../types';
import { timeStringToMinutes, minutesToTimeString, formatDate } from '../utils/timeUtils';
import { CalendarDays, Clock, Filter, X, Search, CheckCircle2, User, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Button } from './Button';

interface StaffTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDept: Department;
  activeDate: string;
  staff: Staff[];
  appointments: Appointment[];
  procedures: Procedure[];
  attendanceRecords?: AttendanceRecord[];
  patients: Patient[];
}

const OVERTIME_COLOR = '#ef4444'; // red-500
const REMAINING_COLOR = '#e2e8f0'; // slate-200

const getTimelineSegments = (
  rangeStart: number,
  rangeEnd: number,
  busyIntervals: { start: number; end: number }[] | undefined
) => {
  const intervals = busyIntervals || [];
  const cropped = intervals
    .map(intl => ({
      start: Math.max(intl.start, rangeStart),
      end: Math.min(intl.end, rangeEnd)
    }))
    .filter(intl => intl.start < intl.end);

  cropped.sort((a, b) => a.start - b.start);
  const mergedBusy: { start: number; end: number }[] = [];
  if (cropped.length > 0) {
    let current = { ...cropped[0] };
    for (let i = 1; i < cropped.length; i++) {
      if (cropped[i].start <= current.end) {
        current.end = Math.max(current.end, cropped[i].end);
      } else {
        mergedBusy.push(current);
        current = { ...cropped[i] };
      }
    }
    mergedBusy.push(current);
  }

  const segments: { start: number; end: number; type: 'busy' | 'free' }[] = [];
  let lastEnd = rangeStart;

  for (const b of mergedBusy) {
    if (b.start > lastEnd) {
      segments.push({
        start: lastEnd,
        end: b.start,
        type: 'free'
      });
    }
    segments.push({
      start: b.start,
      end: b.end,
      type: 'busy'
    });
    lastEnd = b.end;
  }

  if (lastEnd < rangeEnd) {
    segments.push({
      start: lastEnd,
      end: rangeEnd,
      type: 'free'
    });
  }

  return segments;
};

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case 'Doctor': return 'Bác sĩ';
    case 'Technician': return 'Kỹ thuật viên';
    case 'Nurse': return 'Điều dưỡng';
    case 'PhysicianAssistant': return 'Y sĩ';
    default: return role;
  }
};

export const StaffTimelineModal: React.FC<StaffTimelineModalProps> = ({
  isOpen,
  onClose,
  currentDept,
  activeDate,
  staff,
  appointments,
  procedures,
  attendanceRecords = [],
  patients
}) => {
  const [selectedTimelineStaff, setSelectedTimelineStaff] = useState<string[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchStaffTerm, setSearchStaffTerm] = useState('');

  // 1. Relevant staff for this department on activeDate
  const relevantStaff = useMemo(() => {
    const baseStaff = staff.filter(s => s.deptId === currentDept.id);

    const isDeptHoliday = (attendanceRecords || []).some(
      r => (r.staffId === `holiday_dept_${currentDept.id}` || r.staffId === `holiday_${currentDept.id}`) &&
           r.date === activeDate &&
           r.status === AttendanceStatus.OFF_FULL
    );

    return baseStaff.filter(s => {
      const att = (attendanceRecords || []).find(r => r.staffId === s.id && r.date === activeDate);
      if (isDeptHoliday) {
        return !!att && att.status === AttendanceStatus.DUTY;
      }
      if (att) {
        if (att.status === AttendanceStatus.OFF_FULL) return false;
        return true;
      }
      return true;
    });
  }, [staff, currentDept.id, activeDate, attendanceRecords]);

  // 2. Appointments on activeDate
  const relevantAppointments = useMemo(() => {
    const deptStaffIds = new Set(staff.filter(s => s.deptId === currentDept.id).map(s => s.id));
    return appointments.filter(a => {
      if (a.date !== activeDate) return false;
      const proc = procedures.find(p => p.id === a.procedureId);
      const procedureDeptId = proc?.deptId || a.deptId;
      return (
        procedureDeptId === currentDept.id ||
        a.deptId === currentDept.id ||
        deptStaffIds.has(a.staffId || '') ||
        deptStaffIds.has(a.assistant1Id || '') ||
        deptStaffIds.has(a.assistant2Id || '')
      );
    });
  }, [appointments, activeDate, currentDept.id, procedures, staff]);

  // 3. Staff stats (hours worked & busy intervals)
  const staffStats = useMemo(() => {
    const stats = relevantStaff.map(s => {
      const staffAppts = relevantAppointments.filter(
        a => a.staffId === s.id || a.assistant1Id === s.id || a.assistant2Id === s.id
      );

      let totalMinutes = 0;
      const procCounts: Record<string, number> = {};
      const intervals: { start: number; end: number }[] = [];

      staffAppts.forEach(appt => {
        const start = timeStringToMinutes(appt.startTime);
        const end = timeStringToMinutes(appt.endTime);
        const proc = procedures.find(p => p.id === appt.procedureId);

        let busyStart = start;
        let busyEnd = end;

        if (appt.staffId === s.id) {
          const startOffset = (appt.mainBusyStart !== undefined && appt.mainBusyStart !== null) ? appt.mainBusyStart : (proc?.mainBusyStart ?? 0);
          const endOffset = (appt.mainBusyEnd !== undefined && appt.mainBusyEnd !== null) ? appt.mainBusyEnd : (proc?.mainBusyEnd ?? proc?.busyMinutes ?? proc?.durationMinutes ?? (end - start));
          busyStart = start + startOffset;
          busyEnd = start + endOffset;
        } else if (appt.assistant1Id === s.id) {
          const startOffset = (appt.asst1BusyStart !== undefined && appt.asst1BusyStart !== null) ? appt.asst1BusyStart : (proc?.asst1BusyStart ?? 0);
          const endOffset = (appt.asst1BusyEnd !== undefined && appt.asst1BusyEnd !== null) ? appt.asst1BusyEnd : (proc?.asst1BusyEnd ?? proc?.assistant1BusyMinutes ?? 0);
          busyStart = start + startOffset;
          busyEnd = start + endOffset;
        } else if (appt.assistant2Id === s.id) {
          const startOffset = (appt.asst2BusyStart !== undefined && appt.asst2BusyStart !== null) ? appt.asst2BusyStart : (proc?.asst2BusyStart ?? 0);
          const endOffset = (appt.asst2BusyEnd !== undefined && appt.asst2BusyEnd !== null) ? appt.asst2BusyEnd : (proc?.asst2BusyEnd ?? proc?.assistant2BusyMinutes ?? 0);
          busyStart = start + startOffset;
          busyEnd = start + endOffset;
        }

        if (busyEnd > busyStart) {
          intervals.push({ start: busyStart, end: busyEnd });
        }

        procCounts[appt.procedureId] = (procCounts[appt.procedureId] || 0) + 1;
      });

      intervals.sort((a, b) => a.start - b.start);
      const mergedIntervals: { start: number; end: number }[] = [];
      if (intervals.length > 0) {
        let current = { ...intervals[0] };
        for (let i = 1; i < intervals.length; i++) {
          if (intervals[i].start <= current.end) {
            current.end = Math.max(current.end, intervals[i].end);
          } else {
            mergedIntervals.push(current);
            current = { ...intervals[i] };
          }
        }
        mergedIntervals.push(current);
      }

      totalMinutes = mergedIntervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);

      const procedureDetails = Object.entries(procCounts).map(([procedureId, count]) => {
        const proc = procedures.find(p => p.id === procedureId);
        return {
          procedureId,
          name: proc?.name || 'Lịch trình đã xóa',
          count
        };
      }).sort((a, b) => b.count - a.count);

      return {
        ...s,
        totalMinutes,
        procedureDetails,
        busyIntervals: mergedIntervals,
        appts: staffAppts
      };
    });

    return stats.sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [relevantStaff, relevantAppointments, procedures]);

  // Filtered by selected chips and search text
  const displayedStaffStats = useMemo(() => {
    let result = staffStats;
    if (selectedTimelineStaff.length > 0) {
      result = result.filter(s => selectedTimelineStaff.includes(s.id));
    }
    if (searchStaffTerm.trim()) {
      const term = searchStaffTerm.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(term) || 
        getRoleDisplayName(s.role).toLowerCase().includes(term)
      );
    }
    return result;
  }, [staffStats, selectedTimelineStaff, searchStaffTerm]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[200] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
              <CalendarDays size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                Bảng Phân Bổ Thời Gian & Timeline Bận/Rảnh Nhân Sự
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-2">
                <span className="font-bold text-slate-700">{currentDept.name}</span>
                <span>•</span>
                <span>Ngày: <span className="font-bold text-blue-600">{formatDate(activeDate)}</span></span>
                <span>•</span>
                <span>Tổng: <span className="font-bold text-slate-700">{relevantStaff.length} nhân sự</span></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Legend (desktop) */}
            <div className="hidden md:flex items-center gap-4 text-xs font-bold bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-2xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#f1b44c] inline-block shadow-2xs"></span>
                <span className="text-slate-600">Bận (Làm lịch trình)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#34c38f] inline-block shadow-2xs"></span>
                <span className="text-slate-600">Rảnh</span>
              </div>
            </div>

            {/* Close button */}
            <button 
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Đóng cửa sổ"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Legend for small screens */}
          <div className="flex md:hidden items-center justify-between gap-4 text-xs font-bold bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#f1b44c] inline-block"></span>
              <span className="text-slate-600">Bận (Làm lịch trình)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#34c38f] inline-block"></span>
              <span className="text-slate-600">Rảnh</span>
            </div>
          </div>

          {/* Bộ lọc nhân sự */}
          <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-blue-500" />
                <span className="text-xs font-black uppercase text-slate-600 tracking-wider">
                  Lọc hiển thị nhân sự ({relevantStaff.length} nhân sự):
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Search input */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchStaffTerm}
                    onChange={(e) => setSearchStaffTerm(e.target.value)}
                    placeholder="Tìm nhân sự..."
                    className="w-36 sm:w-44 pl-7 pr-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  />
                  {searchStaffTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchStaffTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button 
                  type="button"
                  onClick={() => setSelectedTimelineStaff([])}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                    selectedTimelineStaff.length === 0 
                      ? 'bg-blue-600 text-white border border-blue-600' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Hiện tất cả ({relevantStaff.length})
                </button>
                {selectedTimelineStaff.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setSelectedTimelineStaff([])}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all cursor-pointer"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>

            {/* Staff Chips */}
            <div className="flex flex-wrap gap-2 max-h-[130px] overflow-y-auto pr-1 pb-0.5 pt-0.5">
              {relevantStaff.map(staffMember => {
                const isSelected = selectedTimelineStaff.includes(staffMember.id);
                const staffAppts = relevantAppointments.filter(
                  a => a.staffId === staffMember.id || a.assistant1Id === staffMember.id || a.assistant2Id === staffMember.id
                );
                const apptCount = staffAppts.length;
                
                return (
                  <button
                    key={staffMember.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTimelineStaff(selectedTimelineStaff.filter(id => id !== staffMember.id));
                      } else {
                        setSelectedTimelineStaff([...selectedTimelineStaff, staffMember.id]);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all outline-none border cursor-pointer ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`}></span>
                    <span className="truncate">{staffMember.name}</span>
                    <span className={`px-1.5 py-0.25 text-[9px] rounded-md font-black ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {apptCount} ca
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timeline list */}
          <div className="flex flex-col gap-3.5">
            {displayedStaffStats.map(staffMember => {
              const att = attendanceRecords.find(r => r.staffId === staffMember.id && r.date === activeDate);
              const isOffMorning = att?.status === AttendanceStatus.OFF_MORNING;
              const isOffAfternoon = att?.status === AttendanceStatus.OFF_AFTERNOON;

              const staffWorkHoursMinutes = (isOffMorning || isOffAfternoon) ? 4 * 60 : 8 * 60;
              const standardHoursString = (isOffMorning || isOffAfternoon) ? '4h' : '8h';

              const isOvertime = staffMember.totalMinutes > staffWorkHoursMinutes;
              const pieData = isOvertime 
                ? [
                    { name: 'Hành chính', value: staffWorkHoursMinutes, color: '#3b82f6' },
                    { name: 'Làm thêm', value: staffMember.totalMinutes - staffWorkHoursMinutes, color: OVERTIME_COLOR }
                  ]
                : [
                    { name: 'Đã làm', value: staffMember.totalMinutes, color: '#3b82f6' },
                    { name: 'Còn lại', value: staffWorkHoursMinutes - staffMember.totalMinutes, color: REMAINING_COLOR }
                  ];

              const hours = Math.floor(staffMember.totalMinutes / 60);
              const minutes = staffMember.totalMinutes % 60;
              const timeString = `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
              const percentage = Math.round((staffMember.totalMinutes / staffWorkHoursMinutes) * 100);
              const isSelected = selectedStaffId === staffMember.id;

              return (
                <div 
                  key={staffMember.id} 
                  onClick={() => setSelectedStaffId(isSelected ? null : staffMember.id)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer bg-white ${
                    isSelected 
                      ? 'border-indigo-500 bg-indigo-50/10 shadow-md ring-2 ring-indigo-500/20' 
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6 items-center">
                    {/* Personnel Info */}
                    <div className="flex items-center gap-3.5">
                      {/* Progress Ring Chart */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={18}
                              outerRadius={26}
                              startAngle={90}
                              endAngle={-270}
                              dataKey="value"
                              stroke="none"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <span className={`text-[10px] font-black ${isOvertime ? 'text-red-500' : 'text-slate-700'}`}>
                            {percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Info text details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-slate-800 text-sm tracking-wide uppercase truncate" title={staffMember.name}>
                          {staffMember.name}
                        </h4>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5 truncate">
                          {getRoleDisplayName(staffMember.role)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isOvertime ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-sky-50 text-sky-600 border border-sky-100'
                          }`}>
                            <Clock size={10} strokeWidth={2.5} />
                            {timeString} / {standardHoursString}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timelines morning & afternoon */}
                    <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {/* Sáng */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                            Sáng (07:30 - 11:30)
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            {isOffMorning ? 'Nghỉ' : 'Thời lượng: 4h'}
                          </span>
                        </div>

                        {isOffMorning ? (
                          <div className="flex items-center justify-center h-12 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-extrabold gap-1.5 select-none">
                            <Clock size={14} className="text-slate-300" />
                            Nghỉ sáng (Theo bảng chấm công)
                          </div>
                        ) : (
                          <>
                            <div className="relative flex h-6 bg-slate-100 rounded-lg">
                              {getTimelineSegments(450, 690, staffMember.busyIntervals).map((seg, idx, arr) => (
                                <div
                                  key={idx}
                                  className={`h-full relative group cursor-pointer transition-all hover:brightness-95 ${
                                    seg.type === 'busy' ? 'bg-[#f1b44c]' : 'bg-[#34c38f]'
                                  } ${idx === 0 ? 'rounded-l-lg' : ''} ${idx === arr.length - 1 ? 'rounded-r-lg' : ''}`}
                                  style={{ width: `${((seg.end - seg.start) / 240) * 100}%` }}
                                >
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:flex flex-col items-center z-50 pointer-events-none whitespace-nowrap">
                                    <div className="bg-[#111827] text-white px-3.5 py-2.5 rounded-xl shadow-2xl text-center border border-slate-700 min-w-[150px] relative">
                                      <div className="flex items-center justify-center gap-1.5 mb-1.5">
                                        <span className={`w-2 h-2 rounded-full ${seg.type === 'busy' ? 'bg-[#f1b44c]' : 'bg-[#34c38f]'}`}></span>
                                        <span className="text-[9px] font-black tracking-widest text-slate-300 uppercase">
                                          {seg.type === 'busy' ? 'THỜI GIAN BẬN' : 'THỜI GIAN RẢNH'}
                                        </span>
                                      </div>
                                      <div className="text-sm font-extrabold tracking-tight">
                                        {minutesToTimeString(seg.start)} - {minutesToTimeString(seg.end)}
                                      </div>
                                      <div className="text-[10px] font-bold text-slate-400 mt-1">
                                        Thời lượng: {seg.end - seg.start} phút
                                      </div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2.5 h-2.5 bg-[#111827] rotate-45 border-r border-b border-slate-700"></div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Tick Ruler */}
                            <div className="relative h-5 mt-1.5 text-[11px] text-slate-400 font-bold font-mono">
                              <div className="absolute left-0">07:30</div>
                              <div className="absolute left-[25%] -translate-x-1/2">08:30</div>
                              <div className="absolute left-[50%] -translate-x-1/2">09:30</div>
                              <div className="absolute left-[75%] -translate-x-1/2">10:30</div>
                              <div className="absolute right-0">11:30</div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Chiều */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                            Chiều (13:30 - 17:30)
                          </span>
                          <span className="text-[11px] font-bold text-slate-400">
                            {isOffAfternoon ? 'Nghỉ' : 'Thời lượng: 4h'}
                          </span>
                        </div>

                        {isOffAfternoon ? (
                          <div className="flex items-center justify-center h-12 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-extrabold gap-1.5 select-none">
                            <Clock size={14} className="text-slate-300" />
                            Nghỉ chiều (Theo bảng chấm công)
                          </div>
                        ) : (
                          <>
                            <div className="relative flex h-6 bg-slate-100 rounded-lg">
                              {getTimelineSegments(810, 1050, staffMember.busyIntervals).map((seg, idx, arr) => (
                                <div
                                  key={idx}
                                  className={`h-full relative group cursor-pointer transition-all hover:brightness-95 ${
                                    seg.type === 'busy' ? 'bg-[#f1b44c]' : 'bg-[#34c38f]'
                                  } ${idx === 0 ? 'rounded-l-lg' : ''} ${idx === arr.length - 1 ? 'rounded-r-lg' : ''}`}
                                  style={{ width: `${((seg.end - seg.start) / 240) * 100}%` }}
                                >
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:flex flex-col items-center z-50 pointer-events-none whitespace-nowrap">
                                    <div className="bg-[#111827] text-white px-3.5 py-2.5 rounded-xl shadow-2xl text-center border border-slate-700 min-w-[150px] relative">
                                      <div className="flex items-center justify-center gap-1.5 mb-1.5">
                                        <span className={`w-2 h-2 rounded-full ${seg.type === 'busy' ? 'bg-[#f1b44c]' : 'bg-[#34c38f]'}`}></span>
                                        <span className="text-[9px] font-black tracking-widest text-slate-300 uppercase">
                                          {seg.type === 'busy' ? 'THỜI GIAN BẬN' : 'THỜI GIAN RẢNH'}
                                        </span>
                                      </div>
                                      <div className="text-sm font-extrabold tracking-tight">
                                        {minutesToTimeString(seg.start)} - {minutesToTimeString(seg.end)}
                                      </div>
                                      <div className="text-[10px] font-bold text-slate-400 mt-1">
                                        Thời lượng: {seg.end - seg.start} phút
                                      </div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2.5 h-2.5 bg-[#111827] rotate-45 border-r border-b border-slate-700"></div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Tick Ruler */}
                            <div className="relative h-5 mt-1.5 text-[11px] text-slate-400 font-bold font-mono">
                              <div className="absolute left-0">13:30</div>
                              <div className="absolute left-[25%] -translate-x-1/2">14:30</div>
                              <div className="absolute left-[50%] -translate-x-1/2">15:30</div>
                              <div className="absolute left-[75%] -translate-x-1/2">16:30</div>
                              <div className="absolute right-0">17:30</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Chi tiết các kỹ thuật phụ trách khi nhấn vào hàng */}
                  {isSelected && (
                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-2 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-indigo-600" />
                        <span className="text-xs font-bold text-slate-700">
                          Chi tiết kỹ thuật & phân công của {staffMember.name}:
                        </span>
                      </div>
                      
                      {staffMember.procedureDetails && staffMember.procedureDetails.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {staffMember.procedureDetails.map(pd => (
                            <span 
                              key={pd.procedureId} 
                              className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 flex items-center gap-1.5"
                            >
                              <span>{pd.name}</span>
                              <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black">
                                {pd.count} ca
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Chưa có ca kỹ thuật nào được phân công trong ngày này.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {displayedStaffStats.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <User size={36} className="text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-600">Không tìm thấy nhân sự phù hợp</p>
                <p className="text-xs text-slate-400 mt-1">Vui lòng chọn lại bộ lọc hoặc tìm kiếm theo tên khác.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Hiển thị <span className="font-bold text-slate-700">{displayedStaffStats.length}</span> / {relevantStaff.length} nhân sự
          </div>
          <Button 
            variant="secondary" 
            onClick={onClose}
            className="px-5 py-2 font-bold cursor-pointer hover:bg-slate-200"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};
