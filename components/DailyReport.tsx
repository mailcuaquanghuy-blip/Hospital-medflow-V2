import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, ComposedChart, LabelList } from 'recharts';
import { Appointment, Procedure, Staff, Department, DepartmentType, Patient, AttendanceRecord, AttendanceStatus, AppointmentStatus } from '../types';
import { timeStringToMinutes, minutesToTimeString, getRoleLabel } from '../utils/timeUtils';
import { downloadCSV } from '../utils/csvUtils';
import { Clock, User, Zap, Filter, Building2, CalendarDays, Calendar, TrendingUp, Bed, Activity, Award, FileSpreadsheet, Printer, Download, Search, RotateCcw, FileText, CheckCircle2 } from 'lucide-react';
import { DateInput } from './DateInput';

interface DailyReportProps {
  appointments: Appointment[];
  activeDate: string;
  onChangeDate?: (date: string) => void;
  procedures: Procedure[];
  staff: Staff[]; // All staff
  patients: Patient[];
  onNavigateToTimeline: (procedureId?: string, staffId?: string) => void;
  currentDept: Department;
  allDepts: Department[];
  attendanceRecords?: AttendanceRecord[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];
const OVERTIME_COLOR = '#ef4444'; // red-500
const REMAINING_COLOR = '#e2e8f0'; // slate-200
const WORK_HOURS_MINUTES = 8 * 60; // 480 minutes

const getTimelineSegments = (
  rangeStart: number,
  rangeEnd: number,
  busyIntervals: { start: number; end: number }[] | undefined
) => {
  const intervals = busyIntervals || [];
  // 1. Filter and crop busy intervals to [rangeStart, rangeEnd]
  const cropped = intervals
    .map(intl => ({
      start: Math.max(intl.start, rangeStart),
      end: Math.min(intl.end, rangeEnd)
    }))
    .filter(intl => intl.start < intl.end);

  // 2. Merge overlapping busy intervals
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

  // 3. Build the full timeline of segments (busy or free)
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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-md text-xs font-semibold text-slate-800">
        {payload[0].payload.name} {payload[0].value}
      </div>
    );
  }
  return null;
};

export const DailyReport: React.FC<DailyReportProps> = ({
  appointments,
  activeDate,
  onChangeDate,
  procedures,
  staff,
  patients,
  onNavigateToTimeline,
  currentDept,
  allDepts,
  attendanceRecords = []
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [filterDeptId, setFilterDeptId] = useState<string>(currentDept.id);
  const [activeReportTab, setActiveReportTab] = useState<'daily' | 'monthly'>('daily');

  // States cho báo cáo theo tháng và lọc nhân sự
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    // Mặc định là tháng hiện tại dựa trên ngày làm việc hoạt động (activeDate)
    if (activeDate) {
      const parts = activeDate.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        if (!isNaN(m) && m >= 1 && m <= 12) return m;
      }
    }
    return new Date().getMonth() + 1;
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (activeDate) {
      const parts = activeDate.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        if (!isNaN(y)) return y;
      }
    }
    return new Date().getFullYear();
  });
  const [selectedTimelineStaff, setSelectedTimelineStaff] = useState<string[]>([]);

  // States cho Bảng chấm công lịch trình
  const [tcFromDate, setTcFromDate] = useState<string>(() => {
    const m = String(selectedMonth).padStart(2, '0');
    return `${selectedYear}-${m}-01`;
  });
  const [tcToDate, setTcToDate] = useState<string>(() => {
    const daysInM = new Date(selectedYear, selectedMonth, 0).getDate();
    const m = String(selectedMonth).padStart(2, '0');
    return `${selectedYear}-${m}-${String(daysInM).padStart(2, '0')}`;
  });
  const [tcSearchTerm, setTcSearchTerm] = useState<string>('');

  // Tự động cập nhật khoảng ngày khi chọn tháng/năm ở header báo cáo
  React.useEffect(() => {
    const m = String(selectedMonth).padStart(2, '0');
    const daysInM = new Date(selectedYear, selectedMonth, 0).getDate();
    setTcFromDate(`${selectedYear}-${m}-01`);
    setTcToDate(`${selectedYear}-${m}-${String(daysInM).padStart(2, '0')}`);
  }, [selectedMonth, selectedYear]);

  // Tự động tìm các năm có dữ liệu trong danh sách lịch hẹn
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(selectedYear); // Luôn bao gồm năm đang chọn
    years.add(new Date().getFullYear()); // Luôn bao gồm năm hiện tại của thiết bị
    years.add(2026); // Mặc định có 2026
    appointments.forEach(a => {
      const parts = a.date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [appointments]);

  // Lọc lịch hẹn của cả tháng đang chọn dựa trên khoa đang xem/chỉ định
  const monthlyAppointments = useMemo(() => {
    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    return appointments.filter(a => {
      if (!a.date.startsWith(monthStr)) return false;
      
      const patient = patients.find(p => p.id === a.patientId);
      const proc = procedures.find(p => p.id === a.procedureId);
      const procedureDeptId = proc?.deptId || a.deptId;
      
      if (currentDept.type === DepartmentType.CLINICAL) {
        return patient?.admittedByDeptId === currentDept.id && procedureDeptId === filterDeptId;
      } else {
        if (filterDeptId === currentDept.id) {
          return procedureDeptId === currentDept.id;
        } else {
          return procedureDeptId === currentDept.id && patient?.admittedByDeptId === filterDeptId;
        }
      }
    });
  }, [appointments, selectedMonth, selectedYear, currentDept, filterDeptId, patients, procedures]);

  // Thống kê số lượng lịch trình và số lượng bệnh nhân theo từng ngày trong tháng
  const dailyStats = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const statsList = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAppts = monthlyAppointments.filter(a => a.date === dayStr);
      
      // Số lượng lịch trình
      const procedureCount = dayAppts.length;
      
      // Số lượng bệnh nhân độc nhất nhận lịch trình trong ngày
      const uniquePatientIds = Array.from(new Set(dayAppts.map(a => a.patientId)));
      const patientCount = uniquePatientIds.length;

      // Đếm số lượng bệnh nhân theo từng loại giường bệnh thực hiện trong ngày
      let inpatientCount = 0;
      let dayInpatientCount = 0;
      let otherCount = 0;

      uniquePatientIds.forEach(pId => {
        const patient = patients.find(p => p.id === pId);
        const bType = patient?.bedType || 'Nội trú';
        if (bType === 'Nội trú') {
          inpatientCount++;
        } else if (bType === 'Nội trú ban ngày') {
          dayInpatientCount++;
        } else {
          otherCount++;
        }
      });
      
      statsList.push({
        dayLabel: `${String(day).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}`,
        day: day,
        "Lịch trình": procedureCount,
        "Bệnh nhân": patientCount,
        "BN Nội trú": inpatientCount,
        "BN Nội trú ban ngày": dayInpatientCount,
        "BN Khác": otherCount,
        "totalPatientsDummy": 0,
      });
    }
    
    return statsList;
  }, [monthlyAppointments, selectedMonth, selectedYear, patients]);

  // Tổng số lượng lịch trình và bệnh nhân trong tháng phục vụ hiển thị tổng quan
  const totalMonthlyProcedures = useMemo(() => {
    return monthlyAppointments.length;
  }, [monthlyAppointments]);

  const totalMonthlyPatients = useMemo(() => {
    const uniquePatients = new Set(monthlyAppointments.map(a => a.patientId));
    return uniquePatients.size;
  }, [monthlyAppointments]);

  // Thống kê cơ cấu các loại giường (Nội trú, Nội trú ban ngày, Ngoại trú, Khác) trong các ca lịch trình của tháng
  const bedTypeStats = useMemo(() => {
    const counts: Record<string, number> = {
      'Nội trú': 0,
      'Nội trú ban ngày': 0,
      'Ngoại trú': 0,
      'Khác': 0
    };
    
    monthlyAppointments.forEach(appt => {
      const patient = patients.find(p => p.id === appt.patientId);
      const bedType = patient?.bedType || 'Khác';
      counts[bedType] = (counts[bedType] || 0) + 1;
    });
    
    return [
      { name: 'Nội trú', value: counts['Nội trú'], color: '#3b82f6' },
      { name: 'Nội trú ban ngày', value: counts['Nội trú ban ngày'], color: '#10b981' },
      { name: 'Ngoại trú', value: counts['Ngoại trú'], color: '#f59e0b' },
      { name: 'Khác', value: counts['Khác'], color: '#64748b' }
    ].filter(item => item.value > 0);
  }, [monthlyAppointments, patients]);
 
  // Thống kê khối lượng công việc theo Bác sĩ Điều trị trong tháng
  const doctorStats = useMemo(() => {
    // Lọc ra tất cả các nhân sự là Bác sĩ
    const allDoctors = staff.filter(s => s.role === 'Doctor');
    
    // Lọc bác sĩ thuộc khoa đang xem hoặc có lịch hẹn trong tháng
    const filteredDocs = allDoctors.filter(doc => {
      const belongsToDept = doc.deptId === filterDeptId;
      const hasMonthlyAppt = monthlyAppointments.some(a => 
        a.staffId === doc.id || a.assistant1Id === doc.id || a.assistant2Id === doc.id
      );
      return belongsToDept || hasMonthlyAppt;
    });

    return filteredDocs.map(doc => {
      // Tìm các appointments trong tháng mà bác sĩ này phụ trách (làm chính hoặc làm phụ)
      const docAppts = monthlyAppointments.filter(a => 
        a.staffId === doc.id || a.assistant1Id === doc.id || a.assistant2Id === doc.id
      );
      
      const procedureCount = docAppts.length;
      const uniquePatients = new Set(docAppts.map(a => a.patientId));
      const patientCount = uniquePatients.size;
      const ratio = patientCount > 0 ? (procedureCount / patientCount).toFixed(1) : '0';
      
      return {
        id: doc.id,
        name: doc.name,
        procedureCount,
        patientCount,
        ratio: Number(ratio)
      };
    }).sort((a, b) => b.procedureCount - a.procedureCount || b.patientCount - a.patientCount);
  }, [staff, monthlyAppointments, filterDeptId]);

  // Thống kê bệnh nhân Vào viện và Ra viện (Hàng ngày & Hàng tháng)
  const admissionDischargeStats = useMemo(() => {
    const targetDept = allDepts.find(d => d.id === filterDeptId);
    const isClinical = targetDept?.type === DepartmentType.CLINICAL;

    // Lọc ra các bệnh nhân thuộc khoa này để tính toán chính xác
    const relevantPatients = patients.filter(p => {
      if (isClinical) {
        return p.admittedByDeptId === filterDeptId;
      } else {
        // Đối với khoa cận lâm sàng/chuyên khoa, lấy bệnh nhân của các lịch hẹn hoặc có liên quan
        const hasApt = appointments.some(a => a.patientId === p.id && a.deptId === filterDeptId);
        return hasApt || p.admittedByDeptId === filterDeptId;
      }
    });

    // 1. Thống kê theo Ngày (activeDate)
    const dailyAdmissions = relevantPatients.filter(p => p.admissionDate?.split('T')[0] === activeDate);
    const dailyDischarges = relevantPatients.filter(p => p.dischargeDate?.split('T')[0] === activeDate);

    // 2. Thống kê theo Tháng
    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const monthlyAdmissions = relevantPatients.filter(p => p.admissionDate?.startsWith(monthStr));
    const monthlyDischarges = relevantPatients.filter(p => p.dischargeDate?.startsWith(monthStr));

    // Thống kê phân rã theo ngày trong tháng để vẽ biểu đồ
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const monthlyDailyStats = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const admissions = monthlyAdmissions.filter(p => p.admissionDate?.split('T')[0] === dayStr).length;
      const discharges = monthlyDischarges.filter(p => p.dischargeDate?.split('T')[0] === dayStr).length;
      monthlyDailyStats.push({
        day,
        dayLabel: `${String(day).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}`,
        "Vào viện": admissions,
        "Ra viện": discharges
      });
    }

    return {
      daily: {
        admissions: dailyAdmissions,
        discharges: dailyDischarges,
        admissionsCount: dailyAdmissions.length,
        dischargesCount: dailyDischarges.length
      },
      monthly: {
        admissions: monthlyAdmissions,
        discharges: monthlyDischarges,
        admissionsCount: monthlyAdmissions.length,
        dischargesCount: monthlyDischarges.length,
        dailyStats: monthlyDailyStats
      }
    };
  }, [patients, appointments, filterDeptId, activeDate, selectedMonth, selectedYear, allDepts]);

  // Lọc danh sách khoa để hiển thị trong bộ lọc
  const filterOptions = useMemo(() => {
    if (currentDept.type === DepartmentType.CLINICAL) {
      // Khoa lâm sàng: Có thể xem chính mình hoặc các khoa chuyên khoa (SUPPORT)
      return [
        currentDept,
        ...allDepts.filter(d => d.type === DepartmentType.SUPPORT)
      ];
    } else {
      // Khoa chuyên khoa: Có thể xem chính mình hoặc các khoa lâm sàng (CLINICAL)
      return [
        currentDept,
        ...allDepts.filter(d => d.type === DepartmentType.CLINICAL)
      ];
    }
  }, [currentDept, allDepts]);

  // Lọc appointments dựa trên bộ lọc khoa và ngày hiện hành
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (a.date !== activeDate) return false;
      const patient = patients.find(p => p.id === a.patientId);
      const proc = procedures.find(p => p.id === a.procedureId);
      const procedureDeptId = proc?.deptId || a.deptId;
      
      if (currentDept.type === DepartmentType.CLINICAL) {
        // Khoa lâm sàng: Chỉ xem báo cáo các lịch trình thực hiện trên bệnh nhân của khoa mình
        // Có thể là lịch trình của chính khoa mình hoặc của khoa chuyên khoa được gửi khám
        return patient?.admittedByDeptId === currentDept.id && procedureDeptId === filterDeptId;
      } else {
        // Khoa chuyên khoa (SUPPORT)
        // Luôn chỉ xem báo cáo các lịch trình thuộc về chuyên khoa mình
        if (filterDeptId === currentDept.id) {
          // Xem toàn bộ báo cáo của chuyên khoa mình (tất cả các khoa lâm sàng gửi đến)
          return procedureDeptId === currentDept.id;
        } else {
          // Xem báo cáo chuyên khoa mình thực hiện cho bệnh nhân của một khoa lâm sàng cụ thể
          return procedureDeptId === currentDept.id && patient?.admittedByDeptId === filterDeptId;
        }
      }
    });
  }, [appointments, activeDate, filterDeptId, currentDept, patients, procedures]);

  // Lọc nhân sự tương ứng với khoa đang xem
  const relevantStaff = useMemo(() => {
    let baseStaff = [];
    const deptIdToCheck = filterDeptId === currentDept.id ? currentDept.id : (currentDept.type === DepartmentType.CLINICAL ? filterDeptId : currentDept.id);
    if (filterDeptId === currentDept.id) {
      baseStaff = staff.filter(s => s.deptId === currentDept.id);
    } else {
      // Nếu đang xem báo cáo của khoa khác (đối với lâm sàng) hoặc cho khoa khác (đối với chuyên khoa)
      // thì nhân sự thực hiện vẫn là nhân sự của khoa thực hiện (SUPPORT)
      const targetDeptId = currentDept.type === DepartmentType.CLINICAL ? filterDeptId : currentDept.id;
      baseStaff = staff.filter(s => s.deptId === targetDeptId);
    }

    const dateObj = new Date(activeDate);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday
    const isSunday = dayOfWeek === 0;

    // Kiểm tra ngày nghỉ toàn khoa (department-wide holiday)
    const isDeptHoliday = attendanceRecords.some(r => (r.staffId === `holiday_dept_${deptIdToCheck}` || r.staffId === `holiday_${deptIdToCheck}`) && r.date === activeDate && r.status === AttendanceStatus.OFF_FULL);

    // Lọc nhân sự theo lịch trực và đi làm
    return baseStaff.filter(s => {
      const att = attendanceRecords.find(r => r.staffId === s.id && r.date === activeDate);
      
      // Nếu là ngày nghỉ toàn khoa (department-wide holiday)
      if (isDeptHoliday) {
        // Chỉ hiện những người có lịch TRỰC (DUTY) cụ thể trong ngày nghỉ toàn khoa
        return !!att && att.status === AttendanceStatus.DUTY;
      }

      // Nếu có bản ghi điểm danh
      if (att) {
        // Loại bỏ nếu nghỉ cả ngày
        if (att.status === AttendanceStatus.OFF_FULL) return false;
        
        // Các ngày khác, có đi làm (PRESENT) hoặc trực (DUTY) hoặc nghỉ nửa buổi thì vẫn hiện
        return true;
      }
      
      // Nếu không có bản ghi điểm danh và không phải ngày nghỉ toàn khoa: Mặc định là đi làm, hiện lên
      return true;
    });
  }, [staff, filterDeptId, currentDept, activeDate, attendanceRecords]);

  // 1. Thống kê số lượng lịch trình
  const procedureStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredAppointments.forEach(appt => {
      stats[appt.procedureId] = (stats[appt.procedureId] || 0) + 1;
    });

    return Object.entries(stats)
      .map(([procedureId, count]) => {
        const proc = procedures.find(p => p.id === procedureId);
        return {
          procedureId,
          name: proc?.name || 'Lịch trình đã xóa',
          count
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredAppointments, procedures]);

  // 2. Thống kê giờ làm việc của nhân sự
  const staffStats = useMemo(() => {
    const stats = relevantStaff.map(s => {
      const staffAppts = filteredAppointments.filter(a => a.staffId === s.id || a.assistant1Id === s.id || a.assistant2Id === s.id);
      
      let totalMinutes = 0;
      const procCounts: Record<string, number> = {};
      const intervals: {start: number, end: number}[] = [];

      staffAppts.forEach(appt => {
        const start = timeStringToMinutes(appt.startTime);
        const end = timeStringToMinutes(appt.endTime);
        const proc = procedures.find(p => p.id === appt.procedureId);
        
        let busyStart = start;
        let busyEnd = end;

        if (appt.staffId === s.id) {
          const startOffset = appt.mainBusyStart ?? proc?.mainBusyStart ?? 0;
          const endOffset = appt.mainBusyEnd ?? proc?.mainBusyEnd ?? proc?.busyMinutes ?? proc?.durationMinutes ?? (end - start);
          busyStart = start + startOffset;
          busyEnd = start + endOffset;
        } else if (appt.assistant1Id === s.id) {
          const startOffset = appt.asst1BusyStart ?? proc?.asst1BusyStart ?? 0;
          const endOffset = appt.asst1BusyEnd ?? proc?.asst1BusyEnd ?? proc?.assistant1BusyMinutes ?? 0;
          busyStart = start + startOffset;
          busyEnd = start + endOffset;
        } else if (appt.assistant2Id === s.id) {
          const startOffset = appt.asst2BusyStart ?? proc?.asst2BusyStart ?? 0;
          const endOffset = appt.asst2BusyEnd ?? proc?.asst2BusyEnd ?? proc?.assistant2BusyMinutes ?? 0;
          busyStart = start + startOffset;
          busyEnd = start + endOffset;
        }

        if (busyEnd > busyStart) {
          intervals.push({ start: busyStart, end: busyEnd });
        }

        procCounts[appt.procedureId] = (procCounts[appt.procedureId] || 0) + 1;
      });

      // Merge overlapping intervals
      intervals.sort((a, b) => a.start - b.start);
      let mergedIntervals: {start: number, end: number}[] = [];
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
        busyIntervals: mergedIntervals
      };
    });

    return stats.sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [relevantStaff, filteredAppointments, procedures]);

  const displayedStaffStats = useMemo(() => {
    if (selectedTimelineStaff.length === 0) return staffStats;
    return staffStats.filter(s => selectedTimelineStaff.includes(s.id));
  }, [staffStats, selectedTimelineStaff]);

  const selectedStaffData = useMemo(() => {
    if (!selectedStaffId) return null;
    return staffStats.find(s => s.id === selectedStaffId);
  }, [selectedStaffId, staffStats]);

  // Danh sách các ngày trong khoảng [tcFromDate, tcToDate]
  const dateList = useMemo(() => {
    if (!tcFromDate || !tcToDate || tcFromDate > tcToDate) return [];
    const list: string[] = [];
    const [sY, sM, sD] = tcFromDate.split('-').map(Number);
    const [eY, eM, eD] = tcToDate.split('-').map(Number);
    if (isNaN(sY) || isNaN(eY)) return [];

    let curr = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);

    let count = 0;
    while (curr <= end && count < 62) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      list.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return list;
  }, [tcFromDate, tcToDate]);

  // Lịch hẹn thuộc khoảng ngày chấm công lịch trình
  const timecardAppointments = useMemo(() => {
    if (!tcFromDate || !tcToDate) return [];
    return appointments.filter(a => {
      if (a.date < tcFromDate || a.date > tcToDate) return false;

      const patient = patients.find(p => p.id === a.patientId);
      const proc = procedures.find(p => p.id === a.procedureId);
      const procedureDeptId = proc?.deptId || a.deptId;

      if (currentDept.type === DepartmentType.CLINICAL) {
        return patient?.admittedByDeptId === currentDept.id && (filterDeptId === 'ALL' || procedureDeptId === filterDeptId);
      } else {
        if (filterDeptId === currentDept.id || filterDeptId === 'ALL') {
          return procedureDeptId === currentDept.id;
        } else {
          return procedureDeptId === currentDept.id && patient?.admittedByDeptId === filterDeptId;
        }
      }
    });
  }, [appointments, tcFromDate, tcToDate, currentDept, filterDeptId, patients, procedures]);

  // Ma trận chấm công lịch trình theo từng bệnh nhân
  const timecardMatrix = useMemo(() => {
    const patientMap = new Map<string, {
      patient: Patient;
      proceduresMap: Map<string, {
        procedure: Procedure;
        datesSet: Set<string>;
        countByDate: Map<string, number>;
      }>;
    }>();

    timecardAppointments.forEach(a => {
      const p = patients.find(patient => patient.id === a.patientId);
      if (!p) return;

      if (tcSearchTerm) {
        const term = tcSearchTerm.trim().toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(term);
        const matchCode = (p.code || '').toLowerCase().includes(term);
        const matchBed = (p.bedNumber || '').toLowerCase().includes(term);
        const matchRoom = (p.roomNumber || '').toLowerCase().includes(term);
        if (!matchName && !matchCode && !matchBed && !matchRoom) return;
      }

      const proc = procedures.find(pr => pr.id === a.procedureId);
      const procName = proc ? proc.name : 'Lịch trình khác';
      const procId = proc ? proc.id : a.procedureId;

      if (!patientMap.has(p.id)) {
        patientMap.set(p.id, {
          patient: p,
          proceduresMap: new Map()
        });
      }

      const pEntry = patientMap.get(p.id)!;
      if (!pEntry.proceduresMap.has(procId)) {
        pEntry.proceduresMap.set(procId, {
          procedure: proc || ({ id: procId, name: procName, deptId: a.deptId, durationMinutes: 30 } as Procedure),
          datesSet: new Set(),
          countByDate: new Map()
        });
      }

      const procEntry = pEntry.proceduresMap.get(procId)!;
      procEntry.datesSet.add(a.date);
      procEntry.countByDate.set(a.date, (procEntry.countByDate.get(a.date) || 0) + 1);
    });

    const result = Array.from(patientMap.values()).map(pEntry => {
      const procsList = Array.from(pEntry.proceduresMap.values()).map(pProc => ({
        procedure: pProc.procedure,
        datesSet: pProc.datesSet,
        countByDate: pProc.countByDate,
        totalExecutions: pProc.datesSet.size
      }));

      procsList.sort((a, b) => a.procedure.name.localeCompare(b.procedure.name, 'vi'));

      return {
        patient: pEntry.patient,
        procedures: procsList
      };
    });

    result.sort((a, b) => {
      const bedA = parseInt(a.patient.bedNumber || '9999', 10);
      const bedB = parseInt(b.patient.bedNumber || '9999', 10);
      if (!isNaN(bedA) && !isNaN(bedB) && bedA !== bedB) return bedA - bedB;
      return a.patient.name.localeCompare(b.patient.name, 'vi');
    });

    return result;
  }, [timecardAppointments, patients, procedures, tcSearchTerm]);

  // Xuất CSV Bảng chấm công lịch trình
  const handleExportTimecardCSV = () => {
    if (timecardMatrix.length === 0 || dateList.length === 0) {
      alert("Không có dữ liệu chấm công lịch trình để xuất CSV.");
      return;
    }

    const headers = [
      { label: 'Họ tên bệnh nhân', key: 'patientName' },
      { label: 'Mã BN', key: 'patientCode' },
      { label: 'Phòng', key: 'roomNumber' },
      { label: 'Giường', key: 'bedNumber' },
      { label: 'Tên lịch trình', key: 'procedureName' },
      ...dateList.map(d => {
        const [y, m, day] = d.split('-');
        return { label: `${parseInt(day, 10)}/${parseInt(m, 10)}`, key: `d_${d}` };
      }),
      { label: 'Tổng số lượt', key: 'total' }
    ];

    const csvRows: any[] = [];
    timecardMatrix.forEach(pItem => {
      if (pItem.procedures.length === 0) {
        const rowObj: any = {
          patientName: pItem.patient.name,
          patientCode: pItem.patient.code,
          roomNumber: pItem.patient.roomNumber || '',
          bedNumber: pItem.patient.bedNumber || '',
          procedureName: 'Chưa có lịch trình',
          total: 0
        };
        dateList.forEach(d => {
          rowObj[`d_${d}`] = '';
        });
        csvRows.push(rowObj);
      } else {
        pItem.procedures.forEach((procItem, idx) => {
          const rowObj: any = {
            patientName: idx === 0 ? pItem.patient.name : '',
            patientCode: idx === 0 ? pItem.patient.code : '',
            roomNumber: idx === 0 ? (pItem.patient.roomNumber || '') : '',
            bedNumber: idx === 0 ? (pItem.patient.bedNumber || '') : '',
            procedureName: procItem.procedure.name,
            total: procItem.totalExecutions
          };
          dateList.forEach(d => {
            rowObj[`d_${d}`] = procItem.datesSet.has(d) ? 'x' : '';
          });
          csvRows.push(rowObj);
        });
      }
    });

    const filename = `Bang_Cham_Cong_Lich_Trinh_${tcFromDate}_den_${tcToDate}.csv`;
    downloadCSV(csvRows, filename, headers);
  };

  // In / Xuất PDF Bảng chấm công lịch trình
  const handlePrintTimecard = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Vui lòng cho phép mở cửa sổ bật lên (popup) trên trình duyệt để in báo cáo.");
      return;
    }

    const formatDateVi = (dStr: string) => {
      if (!dStr) return '';
      const parts = dStr.split('-');
      if (parts.length !== 3) return dStr;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    let matrixRowsHTML = '';
    if (timecardMatrix.length === 0) {
      matrixRowsHTML = `
        <tr>
          <td colSpan="${dateList.length + 3}" style="text-align: center; padding: 25px; font-style: italic; color: #666;">
            Không có dữ liệu lịch trình trong khoảng thời gian từ ${formatDateVi(tcFromDate)} đến ${formatDateVi(tcToDate)}
          </td>
        </tr>
      `;
    } else {
      timecardMatrix.forEach(pItem => {
        if (pItem.procedures.length === 0) {
          matrixRowsHTML += `
            <tr>
              <td style="font-weight: bold; vertical-align: top;">
                ${pItem.patient.name}<br/>
                <small style="font-weight: normal; color: #555;">Mã: ${pItem.patient.code} | G: ${pItem.patient.bedNumber || '-'}</small>
              </td>
              <td style="color: #888; font-style: italic;">Chưa thực hiện lịch trình nào</td>
              ${dateList.map(() => `<td class="text-center"></td>`).join('')}
              <td class="text-center">0</td>
            </tr>
          `;
        } else {
          pItem.procedures.forEach((procItem, idx) => {
            matrixRowsHTML += '<tr>';
            if (idx === 0) {
              matrixRowsHTML += `
                <td rowspan="${pItem.procedures.length}" style="font-weight: bold; vertical-align: top; background-color: #fafafa;">
                  ${pItem.patient.name}<br/>
                  <small style="font-weight: normal; color: #444; font-family: monospace;">Mã: ${pItem.patient.code}</small><br/>
                  <small style="font-weight: bold; color: #1e40af;">G: ${pItem.patient.bedNumber || '-'} | P: ${pItem.patient.roomNumber || '-'}</small>
                </td>
              `;
            }
            matrixRowsHTML += `<td>${procItem.procedure.name}</td>`;
            dateList.forEach(d => {
              const hasAppt = procItem.datesSet.has(d);
              matrixRowsHTML += `<td class="text-center" style="font-weight: bold; font-size: 11pt; color: ${hasAppt ? '#000' : '#ccc'};">${hasAppt ? 'x' : ''}</td>`;
            });
            matrixRowsHTML += `<td class="text-center" style="font-weight: bold; background-color: #f9fafb;">${procItem.totalExecutions}</td>`;
            matrixRowsHTML += '</tr>';
          });
        }
      });
    }

    const html = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Bảng chấm công lịch trình - ${currentDept.name}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10.5pt;
            color: #000;
            margin: 0;
            padding: 10px;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          .header-table td {
            border: none !important;
            padding: 2px 0;
            font-size: 10pt;
          }
          .title {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 10px 0 3px 0;
          }
          .subtitle {
            text-align: center;
            font-size: 10pt;
            font-style: italic;
            margin-bottom: 12px;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
          }
          .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 5px 6px;
            font-size: 9.5pt;
          }
          .data-table th {
            background-color: #f2f2f2 !important;
            text-align: center;
            font-weight: bold;
          }
          .text-center { text-align: center !important; }
          .signature-section {
            margin-top: 25px;
            width: 100%;
            page-break-inside: avoid;
          }
          .sig-table {
            width: 100%;
            border-collapse: collapse;
          }
          .sig-table td {
            border: none !important;
            text-align: center;
            vertical-align: top;
            width: 33%;
            font-size: 10pt;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 50%; font-weight: bold; text-transform: uppercase; vertical-align: top;">
              BỆNH VIỆN / ĐƠN VỊ Y TẾ<br/>
              KHOA: ${currentDept.name.toUpperCase()}
            </td>
            <td style="width: 50%; text-align: right; font-style: italic; vertical-align: top;">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>
              <b>Độc lập - Tự do - Hạnh phúc</b>
            </td>
          </tr>
        </table>

        <div class="title">BẢNG CHẤM CÔNG LỊCH TRÌNH BỆNH NHÂN</div>
        <div class="subtitle">(Từ ngày ${formatDateVi(tcFromDate)} đến ngày ${formatDateVi(tcToDate)})</div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 160px;">Họ và tên bệnh nhân</th>
              <th style="width: 150px;">Tên lịch trình</th>
              ${dateList.map(d => {
                const [y, m, day] = d.split('-');
                return `<th class="text-center">${parseInt(day, 10)}/${parseInt(m, 10)}</th>`;
              }).join('')}
              <th class="text-center" style="width: 45px;">Tổng</th>
            </tr>
          </thead>
          <tbody>
            ${matrixRowsHTML}
          </tbody>
        </table>

        <div class="signature-section">
          <table class="sig-table">
            <tr>
              <td>
                <b>TRƯỞNG KHOA</b><br/>
                <i style="font-size: 8.5pt;">(Ký, ghi rõ họ tên)</i>
                <div style="height: 60px;"></div>
              </td>
              <td>
                <b>ĐIỀU DƯỠNG TRƯỞNG</b><br/>
                <i style="font-size: 8.5pt;">(Ký, ghi rõ họ tên)</i>
                <div style="height: 60px;"></div>
              </td>
              <td>
                <b>NGƯỜI LẬP BẢNG</b><br/>
                <i style="font-size: 8.5pt;">(Ký, ghi rõ họ tên)</i>
                <div style="height: 60px;"></div>
              </td>
            </tr>
          </table>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'Doctor': return 'Bác sĩ';
      case 'Technician': return 'Kỹ thuật viên';
      case 'Nurse': return 'Điều dưỡng';
      case 'PhysicianAssistant': return 'Y sĩ';
      case 'Pharmacist': return 'Dược sĩ';
      default: return role || 'Nhân viên';
    }
  };

  return (
    <div className="report-container flex flex-col gap-6 h-full overflow-y-auto bg-slate-50 p-2">
      {/* Bộ lọc khoa và Switcher Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Filter size={18} />
            <span className="text-xs font-black uppercase tracking-wider">
              {currentDept.type === DepartmentType.CLINICAL ? 'Lọc theo khoa thực hiện:' : 'Lọc theo khoa chỉ định:'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map(dept => (
              <button
                key={dept.id}
                onClick={() => {
                  setFilterDeptId(dept.id);
                  setSelectedStaffId(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  filterDeptId === dept.id
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Building2 size={14} />
                {dept.id === currentDept.id 
                  ? (currentDept.type === DepartmentType.CLINICAL ? currentDept.name : 'Toàn bộ chuyên khoa')
                  : dept.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab switchers & Daily Date Navigator */}
        <div className="flex flex-wrap items-center gap-3">
          {activeReportTab === 'daily' && onChangeDate && (
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] font-black text-slate-500 uppercase px-1.5 tracking-wider hidden sm:inline">Xem ngày:</span>
              <DateInput
                value={activeDate}
                onChange={onChangeDate}
                showNavigation={true}
                showWeekday={true}
              />
            </div>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 self-start md:self-auto uppercase tracking-wide">
            <button
              onClick={() => setActiveReportTab('daily')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 select-none ${
                activeReportTab === 'daily'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Activity size={14} className={activeReportTab === 'daily' ? 'text-blue-500' : 'text-slate-400'} />
              Báo cáo ngày & Timeline
            </button>
            <button
              onClick={() => setActiveReportTab('monthly')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 select-none ${
                activeReportTab === 'monthly'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar size={14} className={activeReportTab === 'monthly' ? 'text-indigo-600' : 'text-slate-400'} />
              Báo cáo tháng của khoa
            </button>
          </div>
        </div>
      </div>

      {activeReportTab === 'daily' && (
        <>
        {/* Hàng chỉ số trong ngày */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Zap size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Lịch trình trong ngày</span>
              <span className="text-xl font-black text-slate-800 block">
                {filteredAppointments.length} <span className="text-xs font-semibold text-slate-400">ca</span>
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <User size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">BN nhận lịch trình</span>
              <span className="text-xl font-black text-slate-800 block">
                {new Set(filteredAppointments.map(a => a.patientId)).size} <span className="text-xs font-semibold text-slate-400">người</span>
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Building2 size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Bệnh nhân Vào viện</span>
              <span className="text-xl font-black text-slate-850 block text-emerald-600">
                + {admissionDischargeStats.daily.admissionsCount} <span className="text-xs font-semibold text-slate-400">người</span>
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Bệnh nhân Ra viện</span>
              <span className="text-xl font-black text-slate-850 block text-rose-600">
                - {admissionDischargeStats.daily.dischargesCount} <span className="text-xs font-semibold text-slate-400">người</span>
              </span>
            </div>
          </div>
        </div>

        {/* Danh sách người vào viện/ra viện hôm nay */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vào viện hôm nay */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Danh sách người vào viện hôm nay ({admissionDischargeStats.daily.admissionsCount})
              </h4>
            </div>
            <div className="flex-1 max-h-[220px] overflow-y-auto pr-2 divide-y divide-slate-50">
              {admissionDischargeStats.daily.admissions.length > 0 ? (
                admissionDischargeStats.daily.admissions.map(p => (
                  <div key={p.id} className="py-2 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-slate-700 uppercase tracking-wide truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Mã BN: {p.code} | Giường: {p.bedNumber} {p.roomNumber ? `(Buồng ${p.roomNumber})` : ''}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-650 rounded-md font-bold text-[9px]">{p.gender} - {new Date().getFullYear() - Number(p.dob.split('-')[0])} T</span>
                      <div className="text-[9px] text-emerald-600 font-extrabold mt-1">Giờ vào: {p.admissionDate ? new Date(p.admissionDate).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'}) : '--:--'}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs">
                  Không ghi nhận bệnh nhân nhập viện hôm nay
                </div>
              )}
            </div>
          </div>

          {/* Ra viện hôm nay */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                Danh sách người ra viện hôm nay ({admissionDischargeStats.daily.dischargesCount})
              </h4>
            </div>
            <div className="flex-1 max-h-[220px] overflow-y-auto pr-2 divide-y divide-slate-50">
              {admissionDischargeStats.daily.discharges.length > 0 ? (
                admissionDischargeStats.daily.discharges.map(p => (
                  <div key={p.id} className="py-2 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-slate-700 uppercase tracking-wide truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Mã BN: {p.code} | Giường: {p.bedNumber} {p.roomNumber ? `(Buồng ${p.roomNumber})` : ''}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-650 rounded-md font-bold text-[9px]">{p.gender} - {new Date().getFullYear() - Number(p.dob.split('-')[0])} T</span>
                      <div className="text-[9px] text-rose-500 font-extrabold mt-1">Giờ ra: {p.dischargeDate ? new Date(p.dischargeDate).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'}) : '--:--'}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs">
                  Không ghi nhận bệnh nhân xuất viện hôm nay
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Biểu đồ tổng quan lịch trình */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Zap className="text-amber-500" size={20} />
            Thống kê lịch trình thực hiện
          </h3>
          <p className="text-xs text-slate-500 mb-4 -mt-4">
            {currentDept.type === DepartmentType.CLINICAL ? 'Khoa thực hiện: ' : 'Khoa chỉ định: '}
            <span className="font-bold text-primary">
              {filterDeptId === currentDept.id 
                ? (currentDept.type === DepartmentType.CLINICAL ? currentDept.name : 'Tất cả các khoa')
                : allDepts.find(d => d.id === filterDeptId)?.name}
            </span>
          </p>
          <div className="flex-1 min-h-[300px]">
            {procedureStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={procedureStats} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    content={<CustomTooltip />}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    onClick={(data: any) => onNavigateToTimeline(data.procedureId, undefined)}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {procedureStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">Không có dữ liệu lịch trình</div>
            )}
          </div>
        </div>

        {/* Chi tiết lịch trình của nhân sự được chọn */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <User className="text-indigo-500" size={20} />
            {selectedStaffData ? `Chi tiết nhân sự: ${selectedStaffData.name}` : 'Chọn nhân sự để xem chi tiết'}
          </h3>
          <p className="text-xs text-slate-500 mb-4 -mt-4">
            {selectedStaffData 
              ? (currentDept.type === DepartmentType.CLINICAL
                  ? `Các lịch trình thực hiện tại ${allDepts.find(d => d.id === filterDeptId)?.name}`
                  : `Các lịch trình thực hiện cho bệnh nhân khoa ${filterDeptId === currentDept.id ? 'tất cả' : allDepts.find(d => d.id === filterDeptId)?.name}`)
              : 'Nhấn vào hàng nhân sự trong bảng bên dưới'}
          </p>
          <div className="flex-1 min-h-[300px]">
            {selectedStaffData ? (
              selectedStaffData.procedureDetails.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedStaffData.procedureDetails} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      content={<CustomTooltip />}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#6366f1" 
                      radius={[4, 4, 0, 0]}
                      onClick={(data: any) => onNavigateToTimeline(data.procedureId, selectedStaffData.id)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">Nhân sự này chưa thực hiện lịch trình nào</div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Nhấn vào hàng nhân sự trong bảng bên dưới để xem biểu đồ chi tiết
              </div>
            )}
          </div>
        </div>
      </div>
      </>)}

      {/* SECTION BÁO CÁO CHI TIẾT THEO THÁNG CỦA KHOA */}
      {activeReportTab === 'monthly' && (
      <>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
        {/* Header của báo cáo tháng */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="text-indigo-600" size={22} />
              Báo cáo Chi tiết theo Tháng của Khoa
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Thống kê tổng hợp số lượng lịch trình, số bệnh nhân và cơ cấu giường bệnh trong tháng {selectedMonth}/{selectedYear}
            </p>
          </div>

          {/* Bộ chọn Tháng/Năm */}
          <div className="flex items-center gap-3 self-start md:self-auto uppercase tracking-wide">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
              <span className="text-[10px] font-black text-slate-500">Tháng:</span>
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
              <span className="text-[10px] font-black text-slate-400">Năm:</span>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>Năm {year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Khối chỉ số tổng quan (Metric cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border border-blue-100/50 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500 text-white rounded-xl">
              <Activity size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Tổng số lịch trình</span>
              <span className="text-2xl font-black text-slate-800">{totalMonthlyProcedures}</span>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">lượt thực hiện</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-rose-500/5 to-rose-500/10 border border-rose-100/50 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-rose-500 text-white rounded-xl">
              <User size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Tổng số bệnh nhân</span>
              <span className="text-2xl font-black text-slate-800">{totalMonthlyPatients}</span>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">nhận lịch trình</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-100/50 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500 text-white rounded-xl">
              <TrendingUp size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Hiệu suất hoạt động</span>
              <span className="text-lg font-black text-slate-800">
                {totalMonthlyProcedures > 0 ? (totalMonthlyProcedures / (new Date(selectedYear, selectedMonth, 0).getDate())).toFixed(1) : 0} ca/ngày
              </span>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">trung bình/ngày</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-500/5 to-teal-500/10 border border-teal-100/50 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-teal-500 text-white rounded-xl">
              <Building2 size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">BN Vào viện</span>
              <span className="text-2xl font-black text-teal-600">+{admissionDischargeStats.monthly.admissionsCount}</span>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">người trong tháng</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-100/50 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-500 text-white rounded-xl">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">BN Ra viện</span>
              <span className="text-2xl font-black text-amber-600">-{admissionDischargeStats.monthly.dischargesCount}</span>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">người trong tháng</span>
            </div>
          </div>
        </div>

        {/* Section biểu đồ chi tiết của tháng */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Biểu đồ đường (LineChart) thể hiện số lượng lịch trình và số lượng bệnh nhân theo ngày */}
          <div className="xl:col-span-2 border border-slate-100 p-4 rounded-xl flex flex-col">
            <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              Diễn biến số lượt lịch trình & bệnh nhân theo các ngày trong tháng
            </h4>
            <div className="h-[320px] w-full flex-1">
              {totalMonthlyProcedures > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyStats} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="day" 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <YAxis 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Legend 
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                    />
                    {/* Các loại bệnh nhân chồng cột (stacked Bar) */}
                    <Bar 
                      dataKey="BN Nội trú" 
                      stackId="patients" 
                      fill="#9333ea" 
                      name="BN Nội trú" 
                    />
                    <Bar 
                      dataKey="BN Nội trú ban ngày" 
                      stackId="patients" 
                      fill="#10b981" 
                      name="BN Nội trú ban ngày" 
                    />
                    <Bar 
                      dataKey="BN Khác" 
                      stackId="patients" 
                      fill="#f97316" 
                      name="Bệnh nhân khác" 
                    />
                    {/* Dummy bar to render stacked bar totals on top of the stack */}
                    <Bar 
                      dataKey="totalPatientsDummy" 
                      stackId="patients" 
                      fill="transparent" 
                      legendType="none"
                    >
                      <LabelList 
                        dataKey="Bệnh nhân" 
                        position="top" 
                        formatter={(value: any) => value > 0 ? String(value) : ''} 
                        style={{ fill: '#475569', fontSize: '10px', fontWeight: '900' }} 
                      />
                    </Bar>
                    {/* Đường biểu diễn số lịch trình */}
                    <Line 
                      type="monotone" 
                      dataKey="Lịch trình" 
                      stroke="#2563eb" 
                      strokeWidth={3} 
                      activeDot={{ r: 6 }} 
                      name="Số lịch trình"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                  <Activity size={32} className="text-slate-300 animate-pulse" />
                  <span className="text-xs">Không có dữ liệu lịch hẹn của khoa trong tháng {selectedMonth}/{selectedYear}</span>
                </div>
              )}
            </div>
          </div>

          {/* Báo cáo theo các loại giường (Bed Type) */}
          <div className="border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider mb-4 flex items-center gap-2">
                <Bed size={16} className="text-emerald-500" />
                Cơ cấu lịch trình theo loại giường bệnh (%)
              </h4>
              <div className="h-[200px] w-full flex items-center justify-center relative">
                {bedTypeStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bedTypeStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {bedTypeStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ fontSize: '11px', fontWeight: 'bold', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-slate-400 text-xs">Không có dữ liệu cơ cấu loại giường</div>
                )}
                {bedTypeStats.length > 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-slate-400 font-bold">Tháng {selectedMonth}</span>
                    <span className="text-lg font-black text-slate-800">{totalMonthlyProcedures} lượt</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chi tiết thống kê cơ cấu loại giường */}
            <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col gap-2">
              {bedTypeStats.map((item, index) => {
                const percentage = totalMonthlyProcedures > 0 ? Math.round((item.value / totalMonthlyProcedures) * 100) : 0;
                return (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                      <span>{item.name}</span>
                    </div>
                    <div className="font-extrabold text-slate-700">
                      <span>{item.value} ca</span>
                      <span className="text-slate-400 font-bold ml-2">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
              {bedTypeStats.length === 0 && (
                <div className="text-xs text-center text-slate-400">Không có lượt lịch trình nào trong tháng này để phân tích loại giường</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BÁO CÁO TIẾP NHẬN & RA VIỆN THEO THÁNG */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col mt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-sans">
              <Building2 className="text-teal-600 animate-pulse" size={22} />
              Báo cáo Tiếp nhận & Ra viện theo Tháng
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Phân tích xu hướng bệnh nhân vào viện (nhập viện) và ra viện (xuất viện) hàng ngày trong tháng {selectedMonth}/{selectedYear}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Biểu đồ xu hướng */}
          <div className="xl:col-span-3 border border-slate-100 p-4 rounded-xl flex flex-col">
            <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-teal-500" />
              Biểu đồ trực quan so lượng Vào viện & Ra viện theo ngày
            </h4>
            <div className="h-[320px] w-full flex-1">
              {admissionDischargeStats.monthly.admissionsCount > 0 || admissionDischargeStats.monthly.dischargesCount > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={admissionDischargeStats.monthly.dailyStats}
                    margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="day" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10 }} 
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10 }} 
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="rect"
                      wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="Vào viện" name="Nhập viện (+)" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Ra viện" name="Xuất viện (-)" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                  <Building2 size={32} className="text-slate-300 animate-pulse" />
                  <span className="text-xs">Không ghi nhận lượt vào hoặc ra viện trong tháng này</span>
                </div>
              )}
            </div>
          </div>

          {/* Bảng tổng hợp chi tiết */}
          <div className="xl:col-span-2 border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider mb-3 flex items-center gap-2">
                <User size={16} className="text-indigo-500" />
                Danh sách biến động điều trị trong tháng
              </h4>
              <p className="text-[10px] text-slate-400 mb-4">
                Danh sách chi tiết các bệnh nhân có ngày vào viện hoặc ra viện thuộc tháng {selectedMonth}/{selectedYear}.
              </p>
              
              <div className="overflow-y-auto max-h-[260px] pr-1 divide-y divide-slate-100">
                {/* Ghép chung danh sách Admissions & Discharges của tháng */}
                {[
                  ...admissionDischargeStats.monthly.admissions.map(p => ({ p, type: 'IN' as const, date: p.admissionDate })),
                  ...admissionDischargeStats.monthly.discharges.map(p => ({ p, type: 'OUT' as const, date: p.dischargeDate! }))
                ]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 50) // Giới hạn hiển thị 50 dòng mới nhất
                .map((row, idx) => (
                  <div key={`${row.p.id}-${row.type}-${idx}`} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/70 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-700 uppercase truncate max-w-[140px] sm:max-w-none">
                        {row.p.name}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                        Mã: {row.p.code} | Giường {row.p.bedNumber}
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      {row.type === 'IN' ? (
                        <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[9px] rounded border border-emerald-100">
                          VÀO VIỆN
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold text-[9px] rounded border border-rose-100">
                          RA VIỆN
                        </span>
                      )}
                      <div className="text-[9px] text-slate-500 font-semibold mt-1">
                        {new Date(row.date).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})} {new Date(row.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}
                      </div>
                    </div>
                  </div>
                ))}

                {(admissionDischargeStats.monthly.admissions.length === 0 && admissionDischargeStats.monthly.discharges.length === 0) && (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium">
                    Không tìm thấy thông tin bệnh nhân vào/ra viện trong tháng này.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BÁO CÁO KHỐI LƯỢNG CÔNG VIỆC THEO BÁC SĨ ĐIỀU TRỊ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col mt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-sans">
              <Award className="text-indigo-600 animate-pulse" size={22} />
              Báo cáo khối lượng công việc theo Bác sĩ Điều trị
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tổng hợp sản lượng bệnh nhân và số chỉ định lịch trình tương ứng thuộc sự kiểm soát của từng Bác sĩ Điều trị trong tháng.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Biểu đồ so sánh cột ngang */}
          <div className="xl:col-span-2 border border-slate-100 p-4 rounded-xl flex flex-col">
            <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-500" />
              Biểu đồ trực quan so sánh sản lượng & lịch trình
            </h4>
            <div className="h-[320px] w-full flex-1">
              {doctorStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={doctorStats}
                    layout="vertical"
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="patientCount" name="Số bệnh nhân" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={10} />
                    <Bar dataKey="procedureCount" name="Số lịch trình" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                  <User size={32} className="text-slate-300 animate-pulse" />
                  <span className="text-xs">Không có dữ liệu bác sĩ trong khoa</span>
                </div>
              )}
            </div>
          </div>

          {/* Bảng tổng hợp chi tiết */}
          <div className="xl:col-span-3 border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 select-none">
                    <th className="text-[10px] font-black uppercase tracking-wider pb-3 ps-3">Tên Bác sĩ</th>
                    <th className="text-[10px] font-black uppercase tracking-wider pb-3 text-center">Số bệnh nhân</th>
                    <th className="text-[10px] font-black uppercase tracking-wider pb-3 text-center">Số lịch trình</th>
                    <th className="text-[10px] font-black uppercase tracking-wider pb-3 text-center pe-3">Tỷ lệ lịch trình / BN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {doctorStats.map((doc, idx) => (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 ps-3 flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black shrink-0 border border-slate-200 shadow-sm">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide truncate max-w-[150px] sm:max-w-none">
                          {doc.name}
                        </span>
                      </td>
                      <td className="py-3 text-center text-xs font-black text-slate-600">
                        {doc.patientCount}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                          doc.procedureCount > 0 
                            ? 'bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-100 shadow-sm' 
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {doc.procedureCount}
                        </span>
                      </td>
                      <td className="py-3 text-center text-xs font-bold text-slate-500 pe-3">
                        {doc.ratio}
                      </td>
                    </tr>
                  ))}
                  {doctorStats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-slate-400 font-bold">
                        Không tìm thấy danh sách Bác sĩ Điều trị nào cho khoa này
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/* BẢNG CHẤM CÔNG LỊCH TRÌNH BỆNH NHÂN (MATRIX TIMECARD REPORT) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col mt-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-sans">
              <FileSpreadsheet className="text-emerald-600" size={22} />
              Bảng Chấm Công Lịch Trình Bệnh Nhân
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Theo dõi ma trận chấm công chi tiết các lịch trình thực hiện theo từng ngày cho bệnh nhân (Đánh dấu 'x' ngày có thực hiện).
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportTimecardCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95"
              title="Tải bảng chấm công dưới dạng file CSV Excel"
            >
              <Download size={15} />
              Xuất CSV
            </button>
            <button
              onClick={handlePrintTimecard}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95"
              title="In hoặc xuất file PDF chuẩn trang ngang A4"
            >
              <Printer size={15} />
              In / Xuất PDF
            </button>
          </div>
        </div>

        {/* Thanh công cụ lọc Từ ngày - Đến ngày & Tìm kiếm */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1 shadow-xs">
              <span className="text-[11px] font-black text-slate-500 uppercase">Từ ngày:</span>
              <DateInput
                value={tcFromDate}
                onChange={(val) => setTcFromDate(val)}
                className="bg-transparent text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer p-0 border-none w-[88px]"
              />
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1 shadow-xs">
              <span className="text-[11px] font-black text-slate-500 uppercase">Đến ngày:</span>
              <DateInput
                value={tcToDate}
                onChange={(val) => setTcToDate(val)}
                className="bg-transparent text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer p-0 border-none w-[88px]"
              />
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const m = String(selectedMonth).padStart(2, '0');
                  const daysInM = new Date(selectedYear, selectedMonth, 0).getDate();
                  setTcFromDate(`${selectedYear}-${m}-01`);
                  setTcToDate(`${selectedYear}-${m}-${String(daysInM).padStart(2, '0')}`);
                }}
                className="px-2.5 py-1.5 text-[10px] font-bold bg-white text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                Cả tháng {selectedMonth}/{selectedYear}
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const past7 = new Date(today);
                  past7.setDate(today.getDate() - 6);
                  setTcFromDate(past7.toISOString().split('T')[0]);
                  setTcToDate(today.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1.5 text-[10px] font-bold bg-white text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                7 ngày gần nhất
              </button>
            </div>
          </div>

          {/* Ô tìm kiếm bệnh nhân */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Tìm theo tên, mã BN, giường..."
              value={tcSearchTerm}
              onChange={(e) => setTcSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Bảng ma trận chấm công */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider border-b border-slate-200">
                <th className="p-3 border-r border-slate-200 min-w-[180px] text-slate-800">Họ tên bệnh nhân</th>
                <th className="p-3 border-r border-slate-200 min-w-[170px] text-slate-800">Tên lịch trình</th>
                {dateList.map(d => {
                  const [y, m, day] = d.split('-');
                  return (
                    <th key={d} className="p-2 border-r border-slate-200 text-center min-w-[42px] bg-slate-100/90 text-slate-700">
                      {parseInt(day, 10)}/{parseInt(m, 10)}
                    </th>
                  );
                })}
                <th className="p-3 text-center min-w-[60px] bg-slate-200/60 text-slate-800">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {timecardMatrix.map((pItem) => {
                if (pItem.procedures.length === 0) {
                  return (
                    <tr key={pItem.patient.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 border-r border-slate-200 bg-slate-50/50 align-top">
                        <div className="font-bold text-slate-800 text-xs uppercase">{pItem.patient.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Mã: {pItem.patient.code}</div>
                        <div className="text-[10px] text-indigo-600 font-bold mt-0.5">
                          G: {pItem.patient.bedNumber || '-'} | P: {pItem.patient.roomNumber || '-'}
                        </div>
                      </td>
                      <td className="p-3 border-r border-slate-200 text-xs italic text-slate-400">
                        Chưa có lịch trình
                      </td>
                      {dateList.map(d => (
                        <td key={d} className="p-2 border-r border-slate-200 text-center text-slate-300 font-light text-xs">-</td>
                      ))}
                      <td className="p-3 text-center font-black text-xs text-slate-400 bg-slate-50/50">0</td>
                    </tr>
                  );
                }

                return pItem.procedures.map((procItem, procIdx) => (
                  <tr key={`${pItem.patient.id}-${procItem.procedure.id}`} className="hover:bg-amber-50/30 transition-colors">
                    {procIdx === 0 && (
                      <td
                        rowSpan={pItem.procedures.length}
                        className="p-3 border-r border-b border-slate-200 bg-slate-50/60 align-top"
                      >
                        <div className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                          {pItem.patient.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Mã: {pItem.patient.code}
                        </div>
                        <div className="text-[10px] text-indigo-700 font-extrabold mt-0.5 bg-indigo-50 inline-block px-1.5 py-0.5 rounded border border-indigo-100">
                          G: {pItem.patient.bedNumber || '-'} | P: {pItem.patient.roomNumber || '-'}
                        </div>
                      </td>
                    )}
                    <td className="p-2.5 border-r border-slate-200 text-xs font-extrabold text-slate-700">
                      {procItem.procedure.name}
                    </td>
                    {dateList.map(d => {
                      const hasExec = procItem.datesSet.has(d);
                      return (
                        <td key={d} className="p-1 border-r border-slate-200 text-center">
                          {hasExec ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 font-black text-xs border border-emerald-200 shadow-2xs">
                              x
                            </span>
                          ) : (
                            <span className="text-slate-200 text-xs font-light">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2.5 text-center font-black text-xs text-slate-800 bg-slate-50/50">
                      {procItem.totalExecutions}
                    </td>
                  </tr>
                ));
              })}

              {timecardMatrix.length === 0 && (
                <tr>
                  <td
                    colSpan={dateList.length + 3}
                    className="p-12 text-center text-xs text-slate-400 font-bold bg-slate-50/30"
                  >
                    <FileSpreadsheet size={32} className="mx-auto mb-2 text-slate-300 animate-pulse" />
                    Không tìm thấy dữ liệu lịch trình phù hợp trong khoảng thời gian {tcFromDate} - {tcToDate}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      </>
      )}

      {/* Bảng Phân Bổ Thời Gian & Timeline Bận/Rảnh Nhân Sự */}
      {activeReportTab === 'daily' && (
      <div id="staff-busy-free-timeline-table" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="text-blue-500" size={20} />
              Bảng Phân Bổ Thời Gian & Timeline Bận/Rảnh Nhân Sự
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Chi tiết các khoảng thời gian bận (thực hiện lịch trình) và rảnh của từng nhân sự (Nhấn vào hàng nhân sự để xem biểu đồ chi tiết phía trên)
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-semibold bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg shrink-0 self-start sm:self-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#f1b44c] inline-block"></span>
              <span className="text-slate-600">Bận (Làm lịch trình)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#34c38f] inline-block"></span>
              <span className="text-slate-600">Rảnh</span>
            </div>
          </div>
        </div>

        {/* Bộ lọc nhân sự cho timeline bận rảnh */}
        <div className="mb-6 p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5 font-sans">
              <Filter size={14} className="text-blue-500" />
              Lọc hiển thị nhân sự ({relevantStaff.length} nhân sự):
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedTimelineStaff([])}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  selectedTimelineStaff.length === 0 
                    ? 'bg-blue-600 text-white border border-blue-600' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Hiện tất cả ({relevantStaff.length})
              </button>
              {selectedTimelineStaff.length > 0 && (
                <button 
                  onClick={() => setSelectedTimelineStaff([])}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all"
                >
                  Xóa lọc chuyên sâu
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-2 pb-1 pt-1">
            {relevantStaff.map(staffMember => {
              const isSelected = selectedTimelineStaff.includes(staffMember.id);
              const staffAppts = filteredAppointments.filter(a => a.staffId === staffMember.id || a.assistant1Id === staffMember.id || a.assistant2Id === staffMember.id);
              const apptCount = staffAppts.length;
              
              return (
                <button
                  key={staffMember.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedTimelineStaff(selectedTimelineStaff.filter(id => id !== staffMember.id));
                    } else {
                      setSelectedTimelineStaff([...selectedTimelineStaff, staffMember.id]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all outline-none border ${
                    isSelected 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
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

        <div className="flex flex-col gap-4">
          {displayedStaffStats.map(staffMember => {
            const att = attendanceRecords.find(r => r.staffId === staffMember.id && r.date === activeDate);
            const isOffMorning = att?.status === AttendanceStatus.OFF_MORNING;
            const isOffAfternoon = att?.status === AttendanceStatus.OFF_AFTERNOON;

            const staffWorkHoursMinutes = (isOffMorning || isOffAfternoon) ? 4 * 60 : 8 * 60;
            const standardHoursString = (isOffMorning || isOffAfternoon) ? '4h' : '8h';

            const formatTotalBusyTime = (mins: number) => {
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              if (h === 0) return `${m}m`;
              return `${h}h${m > 0 ? `${m}m` : ''}`;
            };

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

            return (
              <div 
                key={staffMember.id} 
                onClick={() => setSelectedStaffId(selectedStaffId === staffMember.id ? null : staffMember.id)}
                className={`grid grid-cols-1 xl:grid-cols-4 gap-6 items-center p-5 rounded-xl border transition-all cursor-pointer bg-white ${
                  selectedStaffId === staffMember.id 
                    ? 'border-indigo-500 bg-indigo-50/10 shadow-md ring-2 ring-indigo-500/20' 
                    : 'border-slate-100 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Personnel Info */}
                <div className="flex items-center gap-4">
                  {/* Progress Ring Chart */}
                  <div className="w-16 h-16 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={20}
                          outerRadius={28}
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
                    <h4 className="font-extrabold text-slate-800 text-[14px] tracking-wide uppercase truncate" title={staffMember.name}>
                      {staffMember.name}
                    </h4>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5 truncate">
                      {getRoleDisplayName(staffMember.role)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        isOvertime ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-sky-50 text-sky-600 border border-sky-100'
                      }`}>
                        <Clock size={10} strokeWidth={2.5} />
                        {timeString} / {standardHoursString}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timelines morning & afternoon */}
                <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Sáng */}
                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        Sáng (07:30 - 11:30)
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {isOffMorning ? 'Nghỉ' : 'Thời lượng: 4h'}
                      </span>
                    </div>

                    {isOffMorning ? (
                      <div className="flex items-center justify-center h-[54px] bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-extrabold gap-1.5 select-none">
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
                                  {/* Arrow */}
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
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                        Chiều (13:30 - 17:30)
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {isOffAfternoon ? 'Nghỉ' : 'Thời lượng: 4h'}
                      </span>
                    </div>

                    {isOffAfternoon ? (
                      <div className="flex items-center justify-center h-[54px] bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-extrabold gap-1.5 select-none">
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
                                  {/* Arrow */}
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
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
};
