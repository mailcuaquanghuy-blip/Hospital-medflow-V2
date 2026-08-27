import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Staff, Procedure, Department, TemplateProcedure } from '../types';
import { Button } from './Button';
import { TimeInput } from './TimeInput';
import { User, Search, Monitor, Clock, X, Save, AlertTriangle } from 'lucide-react';
import { timeStringToMinutes, minutesToTimeString, addMinutesToTime, getRoleLabel } from '../utils/timeUtils';

interface TemplateProcModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (proc: TemplateProcedure) => void;
  staff: Staff[];
  procedures: Procedure[];
  currentDept: Department;
  initialData?: Partial<TemplateProcedure>;
}

export const TemplateProcModal: React.FC<TemplateProcModalProps> = ({
  isOpen,
  onClose,
  onSave,
  staff,
  procedures,
  currentDept,
  initialData
}) => {
  const [formData, setFormData] = useState<Partial<TemplateProcedure>>({
    startTime: '08:00',
    endTime: '08:30',
    ...initialData
  });

  const [isProcDropdownOpen, setIsProcDropdownOpen] = useState(false);
  const [procSearchTerm, setProcSearchTerm] = useState('');

  const currentProc = useMemo(() => procedures.find(p => p.id === formData.procedureId), [formData.procedureId, procedures]);

  // Handle defaults when clicking a procedure
  useEffect(() => {
    if (formData.procedureId && formData.startTime && currentProc && !initialData?.procedureId) {
      // Setup default times when procedure changes
      const startMin = timeStringToMinutes(formData.startTime);
      const endMin = startMin + currentProc.durationMinutes;
      setFormData(prev => ({
        ...prev,
        endTime: minutesToTimeString(endMin),
        staffId: '', assistant1Id: '', assistant2Id: '', assignedMachineId: ''
      }));
    }
  }, [formData.procedureId]);

  const eligibleMainStaff = useMemo(() => {
    return staff.filter(s => s.deptId === currentDept.id && s.mainCapabilityIds?.includes(formData.procedureId || ''));
  }, [staff, currentDept, formData.procedureId]);

  const eligibleAssistants = useMemo(() => {
    return staff.filter(s => s.deptId === currentDept.id && s.assistantCapabilityIds?.includes(formData.procedureId || ''));
  }, [staff, currentDept, formData.procedureId]);
  const availableMachines = useMemo(() => currentProc?.availableMachines || [], [currentProc]);

  const needsAssistant1 = useMemo(() => {
    return (currentProc?.asst1BusyEnd && currentProc.asst1BusyEnd > 0) || (currentProc?.assistant1BusyMinutes && currentProc.assistant1BusyMinutes > 0);
  }, [currentProc]);

  const needsAssistant2 = useMemo(() => {
    return (currentProc?.asst2BusyEnd && currentProc.asst2BusyEnd > 0) || (currentProc?.assistant2BusyMinutes && currentProc.assistant2BusyMinutes > 0);
  }, [currentProc]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-slate-50 w-full max-w-4xl h-[700px] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Thêm Mẫu Chỉ Định Thủ Thuật</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Cấu hình thời gian và nhân sự cho mẫu</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-colors text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-8 space-y-6">
              <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-3 block flex items-center gap-1.5"><Search size={14} className="text-primary" /> Chọn thủ thuật</label>
                <div className="relative">
                  <div className={`w-full p-4 border rounded-2xl flex items-center justify-between cursor-pointer transition-all ${isProcDropdownOpen ? 'border-primary ring-2 ring-primary/20 bg-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`} onClick={() => setIsProcDropdownOpen(!isProcDropdownOpen)}>
                    {currentProc ? (
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{currentProc.name}</span>
                        <span className="text-xs font-medium text-slate-400">{currentProc.durationMinutes} phút</span>
                      </div>
                    ) : (
                      <span className="font-semibold text-slate-400">-- Tìm và chọn thủ thuật --</span>
                    )}
                  </div>
                  {isProcDropdownOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden">
                      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input type="text" placeholder="Tìm tên thủ thuật..." value={procSearchTerm} onChange={e => setProcSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium text-sm" autoFocus />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto scrollbar-thin">
                        {procedures.filter(p => p.deptId === currentDept.id && p.name.toLowerCase().includes(procSearchTerm.toLowerCase())).map(p => (
                          <button key={p.id} type="button" onClick={() => { setFormData({ ...formData, procedureId: p.id, staffId: '', assistant1Id: '', assistant2Id: '', assignedMachineId: '' }); setIsProcDropdownOpen(false); setProcSearchTerm(''); }} className={`w-full p-4 text-left hover:bg-primary/5 flex flex-col gap-1 transition-all ${formData.procedureId === p.id ? 'bg-primary/5 text-primary' : 'text-slate-700'}`}>
                            <span className="font-bold text-sm">{p.name}</span><span className="text-xs font-medium opacity-60">{p.durationMinutes} phút</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {currentProc && (
                <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100 space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><User size={14} className="text-primary" /> Người thực hiện chính</label>
                      <select className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm transition-all" value={formData.staffId || ''} onChange={e => setFormData({ ...formData, staffId: e.target.value })}>
                        <option value="">-- Chọn bác sĩ/KTV --</option>
                        {eligibleMainStaff.map(s => <option key={s.id} value={s.id}>{s.name} ({getRoleLabel(s.role)})</option>)}
                      </select>
                    </div>
                    {currentProc?.requireMachine && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Monitor size={14} className="text-primary" /> Máy thực hiện (dự kiến)</label>
                        <select className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm transition-all" value={formData.assignedMachineId || ''} onChange={e => setFormData({ ...formData, assignedMachineId: e.target.value })}>
                          <option value="">-- Chọn máy (Không bắt buộc) --</option>
                          {availableMachines.map(mCode => <option key={mCode} value={mCode}>{mCode}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    {needsAssistant1 && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><User size={14} className="text-primary" /> Người phụ 1</label>
                        <select className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm transition-all" value={formData.assistant1Id || ''} onChange={e => setFormData({ ...formData, assistant1Id: e.target.value })}>
                          <option value="">-- Chọn người phụ 1 --</option>
                          {eligibleAssistants.filter(s => s.id !== formData.staffId && s.id !== formData.assistant2Id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                    {needsAssistant2 && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><User size={14} className="text-primary" /> Người phụ 2</label>
                        <select className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-semibold text-sm transition-all" value={formData.assistant2Id || ''} onChange={e => setFormData({ ...formData, assistant2Id: e.target.value })}>
                          <option value="">-- Chọn người phụ 2 --</option>
                          {eligibleAssistants.filter(s => s.id !== formData.staffId && s.id !== formData.assistant1Id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest ml-1 flex items-center gap-1.5"><AlertTriangle size={14} /> Tùy chỉnh chi tiết lịch bận (Nếu cần thiết)</label>
                    
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold text-slate-400 w-16 uppercase tracking-widest">CHÍNH:</span>
                      <div className="flex-1 flex gap-4">
                        <div className="flex-1 space-y-1.5">
                          <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Từ (phút thứ)</p>
                          <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white" placeholder="0" value={formData.mainBusyStart ?? currentProc.mainBusyStart ?? 0} onChange={e => setFormData({...formData, mainBusyStart: Number(e.target.value)})} />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Đến (phút thứ)</p>
                          <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white" placeholder={currentProc.durationMinutes.toString()} value={formData.mainBusyEnd ?? currentProc.mainBusyEnd ?? currentProc.durationMinutes} onChange={e => setFormData({...formData, mainBusyEnd: Number(e.target.value)})} />
                        </div>
                      </div>
                    </div>

                    {needsAssistant1 && (
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-400 w-16 uppercase tracking-widest">PHỤ 1:</span>
                        <div className="flex-1 flex gap-4">
                          <div className="flex-1 space-y-1.5">
                            <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white" placeholder="0" value={formData.asst1BusyStart ?? currentProc.asst1BusyStart ?? 0} onChange={e => setFormData({...formData, asst1BusyStart: Number(e.target.value)})} />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white" placeholder="0" value={formData.asst1BusyEnd ?? currentProc.asst1BusyEnd ?? 0} onChange={e => setFormData({...formData, asst1BusyEnd: Number(e.target.value)})} />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {needsAssistant2 && (
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-400 w-16 uppercase tracking-widest">PHỤ 2:</span>
                        <div className="flex-1 flex gap-4">
                          <div className="flex-1 space-y-1.5">
                            <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white" placeholder="0" value={formData.asst2BusyStart ?? currentProc.asst2BusyStart ?? 0} onChange={e => setFormData({...formData, asst2BusyStart: Number(e.target.value)})} />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <input type="number" className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white" placeholder="0" value={formData.asst2BusyEnd ?? currentProc.asst2BusyEnd ?? 0} onChange={e => setFormData({...formData, asst2BusyEnd: Number(e.target.value)})} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-4 space-y-6">
              <div className="p-6 bg-slate-100 rounded-3xl border border-slate-200">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-4 flex items-center gap-1.5"><Clock size={16} className="text-slate-400" /> Thời gian cấu hình</label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Giờ bắt đầu</label>
                    <TimeInput className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-lg text-slate-800 transition-all font-mono shadow-sm" value={formData.startTime || ''} onChange={val => {
                        if (val && currentProc) {
                          const startMin = timeStringToMinutes(val);
                          const endMin = startMin + currentProc.durationMinutes;
                          setFormData({...formData, startTime: val, endTime: minutesToTimeString(endMin)});
                        } else {
                          setFormData({...formData, startTime: val});
                        }
                    }} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Giờ kết thúc</label>
                    <TimeInput className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-lg text-slate-800 transition-all font-mono shadow-sm" value={formData.endTime || ''} onChange={val => setFormData({...formData, endTime: val})} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <Button variant="secondary" onClick={onClose} className="px-6 h-12 rounded-xl text-sm font-bold">Hủy bỏ</Button>
          <Button disabled={!formData.procedureId || !formData.staffId || !formData.startTime || !formData.endTime} onClick={() => {
            if (currentProc) {
              const finalData = { ...formData };
              if (finalData.mainBusyStart === undefined) finalData.mainBusyStart = currentProc.mainBusyStart ?? 0;
              if (finalData.mainBusyEnd === undefined) finalData.mainBusyEnd = currentProc.mainBusyEnd ?? currentProc.durationMinutes;
              if (finalData.asst1BusyStart === undefined) finalData.asst1BusyStart = currentProc.asst1BusyStart ?? 0;
              if (finalData.asst1BusyEnd === undefined) finalData.asst1BusyEnd = currentProc.asst1BusyEnd ?? 0;
              if (finalData.asst2BusyStart === undefined) finalData.asst2BusyStart = currentProc.asst2BusyStart ?? 0;
              if (finalData.asst2BusyEnd === undefined) finalData.asst2BusyEnd = currentProc.asst2BusyEnd ?? 0;
              onSave(finalData as TemplateProcedure);
            }
          }} className="px-8 h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20">
            <Save size={18} className="mr-2" /> Lưu thủ thuật
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
