
import React, { useState } from 'react';
import { X, Calendar, Check, AlertCircle, Clock, Users, Zap, RefreshCw, Copy } from 'lucide-react';
import { Button } from './Button';
import { DateInput } from './DateInput';
import { Patient, Appointment, Procedure, Staff, AttendanceRecord, MachineShift, AppointmentStatus } from '../types';
import { timeStringToMinutes, minutesToTimeString, checkConflict } from '../utils/timeUtils';

interface BatchLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: BatchLoadOptions) => void;
  currentDate: string;
  patients: Patient[];
  staff: Staff[];
  procedures: Procedure[];
  attendanceRecords: AttendanceRecord[];
  machineShifts: MachineShift[];
}

export interface BatchLoadOptions {
  sourceDate: string;
  overwrite: boolean;
  useTodayStaff: boolean;
  skipExistingPatients: boolean;
  prioritizeDischarge: boolean;
  simpleCopy: boolean;
}

export const BatchLoadModal: React.FC<BatchLoadModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentDate,
}) => {
  const [sourceDate, setSourceDate] = useState(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [overwrite, setOverwrite] = useState(false);
  const [useTodayStaff, setUseTodayStaff] = useState(true);
  const [skipExistingPatients, setSkipExistingPatients] = useState(true);
  const [prioritizeDischarge, setPrioritizeDischarge] = useState(true);
  const [simpleCopy, setSimpleCopy] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <RefreshCw size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Cài đặt lịch hàng loạt</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tự động sao chép lịch cho TẤT CẢ bệnh nhân trong khoa</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 rounded-xl">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Chọn ngày nguồn (Copy từ ngày)</label>
            <div className="relative group">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <DateInput
                value={sourceDate}
                onChange={setSourceDate}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              />
            </div>
            <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl mt-2">
              <AlertCircle size={16} className="text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-indigo-700 font-bold leading-relaxed">
                Hệ thống sao chép đơn thuần toàn bộ lịch trình từ ngày nguồn sang ngày hiện tại.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
             <div 
              onClick={() => setOverwrite(!overwrite)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${overwrite ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100 hover:border-slate-200 group'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${overwrite ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className={`text-[11px] font-black uppercase tracking-widest ${overwrite ? 'text-rose-700' : 'text-slate-700'}`}>Ghi đè tất cả</span>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${overwrite ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-200 bg-white'}`}>
                    {overwrite && <Check size={12} strokeWidth={4} />}
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tight">Xóa tất cả chỉ định cũ của ngày hôm nay trước khi load</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Tùy chọn nâng cao</span>
               
               <OptionItem 
                  icon={<Users size={18}/>}
                  title="Load theo nhân sự ngày hôm nay"
                  subtitle="Tự động khớp nhân sự đang đi làm"
                  checked={useTodayStaff}
                  onChange={setUseTodayStaff}
                  activeColor="text-blue-600"
                  activeBg="bg-blue-50"
                  activeBorder="border-blue-200"
                  iconBg="bg-blue-500"
               />

               <OptionItem 
                  icon={<Clock size={18}/>}
                  title="Bỏ qua BN đã có chỉ định"
                  subtitle="Chỉ load cho bệnh nhân chưa có lịch"
                  checked={skipExistingPatients}
                  onChange={setSkipExistingPatients}
                  activeColor="text-emerald-600"
                  activeBg="bg-emerald-50"
                  activeBorder="border-emerald-200"
                  iconBg="bg-emerald-500"
               />

               <OptionItem 
                  icon={<Zap size={18}/>}
                  title="Ưu tiên bệnh nhân ra viện"
                  subtitle="Sắp xếp thời gian thực hiện trong buổi sáng"
                  checked={prioritizeDischarge}
                  onChange={setPrioritizeDischarge}
                  activeColor="text-amber-600"
                  activeBg="bg-amber-50"
                  activeBorder="border-amber-200"
                  iconBg="bg-amber-500"
               />

               <OptionItem 
                  icon={<Copy size={18}/>}
                  title="Chỉ copy đơn thuần"
                  subtitle="Giữ nguyên toàn bộ cấu hình cũ"
                  checked={simpleCopy}
                  onChange={setSimpleCopy}
                  activeColor="text-slate-600"
                  activeBg="bg-slate-50"
                  activeBorder="border-slate-200"
                  iconBg="bg-slate-500"
               />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1 py-4 bg-white border-2 border-slate-200">
            Hủy bỏ
          </Button>
          <Button 
            onClick={() => onConfirm({ sourceDate, overwrite, useTodayStaff, skipExistingPatients, prioritizeDischarge, simpleCopy })} 
            className="flex-1 py-4 shadow-xl shadow-primary/20"
          >
            Bắt đầu xử lý
          </Button>
        </div>
      </div>
    </div>
  );
};

interface OptionItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
  iconBg: string;
}

const OptionItem: React.FC<OptionItemProps> = ({ icon, title, subtitle, checked, onChange, activeColor, activeBg, activeBorder, iconBg }) => (
  <div 
    onClick={() => onChange(!checked)}
    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 ${checked ? `${activeBg} ${activeBorder}` : 'bg-white border-slate-50 hover:border-slate-100 group'}`}
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${checked ? `${iconBg} text-white shadow-md shadow-black/10` : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex justify-between items-center">
        <span className={`text-[10px] font-black uppercase tracking-widest ${checked ? activeColor : 'text-slate-700'}`}>{title}</span>
        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${checked ? `${iconBg} border-transparent text-white` : 'border-slate-200 bg-white'}`}>
          {checked && <Check size={10} strokeWidth={4} />}
        </div>
      </div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{subtitle}</p>
    </div>
  </div>
);
