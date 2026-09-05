import React, { useMemo } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { vi } from 'date-fns/locale';
import { format, parseISO, isValid, addDays, subDays } from 'date-fns';
import { 
  Calendar, 
  CalendarCheck, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';

// Đăng ký ngôn ngữ Tiếng Việt cho react-datepicker
registerLocale('vi', vi);

const VI_MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const SHORT_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const FULL_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  containerClassName?: string;
  showNavigation?: boolean; // Hiển thị các nút điều hướng: << (-7 ngày), < (-1 ngày), > (+1 ngày), >> (+7 ngày), Hôm nay
  showWeekday?: boolean; // Hiển thị thứ trong tuần (CN, T2, T3...)
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  id?: string;
}

export const DateInput: React.FC<DateInputProps> = ({ 
  value, 
  onChange, 
  className,
  containerClassName,
  showNavigation = false,
  showWeekday = false,
  disabled = false,
  minDate,
  maxDate,
  placeholder = 'dd/mm/yyyy',
  id,
}) => {
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
  }, [value]);

  const weekdayInfo = useMemo(() => {
    if (!selectedDate) return null;
    const day = selectedDate.getDay();
    return {
      short: SHORT_WEEKDAYS[day],
      full: FULL_WEEKDAYS[day]
    };
  }, [selectedDate]);

  const isToday = useMemo(() => {
    if (!value) return false;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return value === todayStr;
  }, [value]);

  // Tạo danh sách các năm lựa chọn từ 2020 đến 2035 (hoặc bao quanh năm hiện tại)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = Math.min(2020, currentYear - 3);
    const endYear = Math.max(2035, currentYear + 6);
    const list: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const handleChange = (date: Date | null) => {
    if (disabled) return;
    if (date && isValid(date)) {
      const formatted = format(date, 'yyyy-MM-dd');
      onChange(formatted);
    } else {
      onChange('');
    }
  };

  const handlePrevWeek = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const cur = selectedDate || new Date();
    onChange(format(subDays(cur, 7), 'yyyy-MM-dd'));
  };

  const handlePrevDay = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const cur = selectedDate || new Date();
    onChange(format(subDays(cur, 1), 'yyyy-MM-dd'));
  };

  const handleNextDay = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const cur = selectedDate || new Date();
    onChange(format(addDays(cur, 1), 'yyyy-MM-dd'));
  };

  const handleNextWeek = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const cur = selectedDate || new Date();
    onChange(format(addDays(cur, 7), 'yyyy-MM-dd'));
  };

  const handleToday = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    onChange(format(new Date(), 'yyyy-MM-dd'));
  };

  // Custom Header trực quan và hoàn toàn bằng Tiếng Việt
  const renderCustomHeader = ({
    date,
    changeYear,
    changeMonth,
    decreaseMonth,
    increaseMonth,
    prevMonthButtonDisabled,
    nextMonthButtonDisabled,
  }: any) => (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 gap-1 select-none">
      <button
        type="button"
        onClick={decreaseMonth}
        disabled={prevMonthButtonDisabled}
        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        title="Tháng trước"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex items-center gap-1.5 font-bold text-xs">
        <select
          value={date.getMonth()}
          onChange={({ target: { value } }) => changeMonth(Number(value))}
          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-2xs"
        >
          {VI_MONTHS.map((m, idx) => (
            <option key={idx} value={idx}>{m}</option>
          ))}
        </select>

        <select
          value={date.getFullYear()}
          onChange={({ target: { value } }) => changeYear(Number(value))}
          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-2xs"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={increaseMonth}
        disabled={nextMonthButtonDisabled}
        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        title="Tháng sau"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );

  // Khối các nút thao tác nhanh ở chân lịch (Hôm nay, Hôm qua, Ngày mai)
  const renderCalendarFooter = () => (
    <div className="flex items-center justify-between p-2.5 bg-slate-50 border-t border-slate-200 gap-2 select-none">
      <button
        type="button"
        onClick={() => {
          onChange(format(new Date(), 'yyyy-MM-dd'));
        }}
        className="px-3 py-1 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
      >
        <CalendarCheck size={13} />
        <span>Hôm nay</span>
      </button>

      <div className="flex items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => {
            const cur = selectedDate || new Date();
            onChange(format(subDays(cur, 1), 'yyyy-MM-dd'));
          }}
          className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded font-medium transition-colors cursor-pointer"
          title="Lùi 1 ngày"
        >
          Hôm qua
        </button>
        <button
          type="button"
          onClick={() => {
            const cur = selectedDate || new Date();
            onChange(format(addDays(cur, 1), 'yyyy-MM-dd'));
          }}
          className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded font-medium transition-colors cursor-pointer"
          title="Tiến 1 ngày"
        >
          Ngày mai
        </button>
      </div>
    </div>
  );

  // Nếu showNavigation = true, hiển thị cụm điều hướng đầy đủ (<<, <, Date, >, >>, Hôm nay)
  if (showNavigation) {
    return (
      <div className={`inline-flex items-center gap-1 ${containerClassName || ''}`}>
        {/* Nút lùi 1 tuần (-7 ngày) */}
        <button
          type="button"
          onClick={handlePrevWeek}
          disabled={disabled}
          title="Lùi 1 tuần (-7 ngày)"
          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-sky-50 hover:border-sky-300 transition-all shadow-2xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Nút lùi 1 ngày (-1 ngày) */}
        <button
          type="button"
          onClick={handlePrevDay}
          disabled={disabled}
          title="Lùi 1 ngày (-1 ngày)"
          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-sky-50 hover:border-sky-300 transition-all shadow-2xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Ô chọn ngày */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs hover:border-sky-300 transition-all focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
          <Calendar size={14} className="text-sky-500 mr-1.5 shrink-0" />
          <DatePicker
            id={id}
            selected={selectedDate}
            onChange={handleChange}
            dateFormat="dd/MM/yyyy"
            locale="vi"
            disabled={disabled}
            minDate={minDate}
            maxDate={maxDate}
            placeholderText={placeholder}
            className={`w-[90px] bg-transparent text-sm font-black text-slate-800 outline-none p-0 border-none cursor-pointer tracking-tight ${className || ''}`}
            portalId="portal-datepicker"
            popperClassName="z-[9999]"
            renderCustomHeader={renderCustomHeader}
          >
            {renderCalendarFooter()}
          </DatePicker>

          {showWeekday && weekdayInfo && (
            <span 
              className="ml-1.5 px-1.5 py-0.5 text-[10px] font-black rounded-md bg-sky-50 text-sky-700 border border-sky-100 uppercase tracking-wider shrink-0 select-none"
              title={weekdayInfo.full}
            >
              {weekdayInfo.short}
            </span>
          )}
        </div>

        {/* Nút tiến 1 ngày (+1 ngày) */}
        <button
          type="button"
          onClick={handleNextDay}
          disabled={disabled}
          title="Tiến 1 ngày (+1 ngày)"
          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-sky-50 hover:border-sky-300 transition-all shadow-2xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>

        {/* Nút tiến 1 tuần (+7 ngày) */}
        <button
          type="button"
          onClick={handleNextWeek}
          disabled={disabled}
          title="Tiến 1 tuần (+7 ngày)"
          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-sky-50 hover:border-sky-300 transition-all shadow-2xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronsRight size={16} />
        </button>

        {/* Nút Hôm nay */}
        <button
          type="button"
          onClick={handleToday}
          disabled={disabled}
          title={isToday ? 'Đang ở ngày hôm nay' : 'Chuyển nhanh về hôm nay'}
          className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer ${
            isToday
              ? 'bg-sky-50 text-sky-700 border-sky-200 font-extrabold'
              : 'bg-white border-slate-200 text-slate-600 hover:text-sky-600 hover:bg-sky-50 hover:border-sky-300'
          }`}
        >
          <CalendarCheck size={13} className={isToday ? 'text-sky-500' : 'text-slate-400'} />
          <span className="hidden sm:inline">Hôm nay</span>
        </button>
      </div>
    );
  }

  // Chế độ tiêu chuẩn (Không kèm thanh điều hướng xung quanh)
  const isCustomClass = className && (className.includes('p-') || className.includes('bg-') || className.includes('border-'));

  return (
    <div className={`relative inline-flex items-center ${containerClassName || ''}`}>
      <DatePicker
        id={id}
        selected={selectedDate}
        onChange={handleChange}
        dateFormat="dd/MM/yyyy"
        locale="vi"
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        placeholderText={placeholder}
        className={
          isCustomClass 
            ? className 
            : `w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 shadow-2xs hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all cursor-pointer ${className || ''}`
        }
        portalId="portal-datepicker"
        popperClassName="z-[9999]"
        renderCustomHeader={renderCustomHeader}
      >
        {renderCalendarFooter()}
      </DatePicker>

      {!isCustomClass && (
        <Calendar size={15} className="absolute left-3 text-sky-500 pointer-events-none z-10 shrink-0" />
      )}

      {showWeekday && weekdayInfo && (
        <span 
          className="ml-1.5 px-1.5 py-0.5 text-[10px] font-black rounded-md bg-sky-50 text-sky-700 border border-sky-100 uppercase tracking-wider shrink-0 select-none"
          title={weekdayInfo.full}
        >
          {weekdayInfo.short}
        </span>
      )}
    </div>
  );
};
