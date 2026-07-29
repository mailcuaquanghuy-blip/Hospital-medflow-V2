
import React, { useState, useEffect } from 'react';
import { Patient, Department, PatientStatus, BedType, InsuranceLevel } from '../types';
import { Button } from './Button';
import { DateTimePicker } from './DateTimePicker';
import { TimeInput } from './TimeInput';
import { X, User, Calendar, Bed, Building2, Save, Users, Clock, Info, LogOut, Shield, StickyNote } from 'lucide-react';
import { generatePatientCode, calculateAge } from '../utils/timeUtils';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patient: Patient) => void;
  initialData: Partial<Patient> | null;
  currentDept: Department;
  patients: Patient[];
}

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  currentDept,
  patients,
}) => {
  const [formData, setFormData] = useState<Partial<Patient>>({
    name: '',
    dob: '',
    gender: 'Nam',
    bedNumber: '',
    roomNumber: '',
    status: PatientStatus.TREATING,
    admissionDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  });

  useEffect(() => {
    if (initialData) {
        setFormData({
            ...initialData,
            admissionDate: initialData.admissionDate ? new Date(new Date(initialData.admissionDate).getTime() - new Date(initialData.admissionDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
            dischargeDate: initialData.dischargeDate ? new Date(new Date(initialData.dischargeDate).getTime() - new Date(initialData.dischargeDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : undefined
        });
    } else {
        setFormData({
            name: '',
            dob: '',
            gender: 'Nam',
            bedNumber: '',
            roomNumber: '',
            status: PatientStatus.TREATING,
            admissionDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
            dischargeDate: undefined
        });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.dob) return;

    if (formData.bedNumber && formData.status === PatientStatus.TREATING) {
        const duplicate = patients.find(p => 
            p.bedNumber === formData.bedNumber && 
            p.roomNumber === formData.roomNumber && 
            p.id !== formData.id && 
            p.status === PatientStatus.TREATING && 
            p.admittedByDeptId === currentDept.id
        );
        if (duplicate) {
            alert(`Giường ${formData.bedNumber}${formData.roomNumber ? ` phòng ${formData.roomNumber}` : ''} đang có bệnh nhân ${duplicate.name} nằm. Vui lòng chọn giường khác!`);
            return;
        }
    }

    // Giữ nguyên ID cũ nếu sửa, hoặc tạo ID mới nếu thêm
    const patientId = formData.id || `p_${Math.random().toString(36).substr(2, 9)}`;
    const admissionDateIso = new Date(formData.admissionDate || new Date()).toISOString();
    const dischargeDateIso = formData.status === PatientStatus.TREATING ? null : (formData.dischargeDate ? new Date(formData.dischargeDate).toISOString() : null);
    
    // Mã bệnh nhân vẫn sinh ra để lưu trữ hệ thống, nhưng không hiển thị nặng nề
    const code = formData.code || generatePatientCode(formData.name, admissionDateIso, currentDept.id);

    const newPatient: Patient = {
      id: patientId,
      name: formData.name,
      dob: formData.dob!,
      gender: formData.gender as 'Nam' | 'Nữ',
      code: code,
      bedNumber: formData.bedNumber || '',
      roomNumber: formData.roomNumber || '',
      admissionDate: admissionDateIso,
      dischargeDate: dischargeDateIso,
      bedType: (formData.bedType as BedType) || 'Nội trú',
      status: formData.status as PatientStatus || PatientStatus.TREATING,
      admittedByDeptId: formData.admittedByDeptId || currentDept.id,
      referrals: formData.referrals || [],
      insuranceLevel: formData.insuranceLevel || '100%',
      note: formData.note || ''
    };

    onSave(newPatient);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="bg-primary p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              {initialData?.id ? <User /> : <Users />}
              {initialData?.id ? 'Cập nhật hồ sơ' : 'Tiếp nhận bệnh nhân'}
            </h2>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Khoa: {currentDept.name}</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
             <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
            <div className="space-y-4">
                {/* Họ tên & Giới tính */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ và tên</label>
                        <input 
                            required
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none transition-colors"
                            placeholder="VD: Nguyễn Văn A"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giới tính</label>
                        <select 
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none bg-white"
                            value={formData.gender}
                            onChange={e => setFormData({...formData, gender: e.target.value as any})}
                        >
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                        </select>
                    </div>
                </div>

                {/* Tuổi & Năm sinh & Ngày vào viện */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={12}/> Tuổi & Năm sinh</label>
                         <div className="flex gap-2">
                             <div className="relative w-24 shrink-0">
                               <input 
                                  type="number"
                                  className="w-full p-3 pr-8 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none"
                                  placeholder="Tuổi"
                                  value={formData.dob ? calculateAge(formData.dob) : ''}
                                  onChange={e => {
                                      const ageStr = e.target.value;
                                      const ageNum = parseInt(ageStr, 10);
                                      if (!isNaN(ageNum) && ageNum >= 0 && ageNum <= 150) {
                                          const currentYear = new Date().getFullYear();
                                          const dobYear = currentYear - ageNum;
                                          setFormData(prev => ({ ...prev, dob: `${dobYear}-01-01` }));
                                      } else if (ageStr === '') {
                                          setFormData(prev => ({ ...prev, dob: '' }));
                                      }
                                  }}
                               />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">tuổi</span>
                             </div>
                             <div className="relative flex-1">
                                <input 
                                   type="number"
                                   className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none placeholder:text-slate-300"
                                   placeholder="Năm sinh"
                                   value={formData.dob ? formData.dob.split('-')[0] : ''}
                                   onChange={e => {
                                       const yearStr = e.target.value;
                                       const year = parseInt(yearStr, 10);
                                       if (yearStr.length === 4 && !isNaN(year)) {
                                           setFormData(prev => ({ ...prev, dob: `${year}-01-01` }));
                                       } else if (yearStr === '') {
                                           setFormData(prev => ({ ...prev, dob: '' }));
                                       } else if (yearStr.length < 4) {
                                           if (year > 0) {
                                             setFormData(prev => ({ ...prev, dob: `${year}-01-01` }));
                                           }
                                       }
                                   }}
                                />
                             </div>
                         </div>
                    </div>
                     <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={12}/> Ngày vào viện</label>
                         <input 
                            type="date"
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none transition-colors"
                            value={formData.admissionDate?.split('T')[0] || ''}
                            onChange={e => {
                                const time = formData.admissionDate?.split('T')[1] || '08:00';
                                setFormData({...formData, admissionDate: `${e.target.value}T${time}`});
                            }}
                         />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> Giờ vào viện</label>
                         <TimeInput 
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none transition-colors"
                            value={formData.admissionDate?.split('T')[1] || '08:00'}
                            onChange={val => {
                                const date = formData.admissionDate?.split('T')[0] || new Date().toISOString().split('T')[0];
                                setFormData({...formData, admissionDate: `${date}T${val}`});
                            }}
                         />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Shield size={12}/> Mức hưởng BHYT</label>
                        <select 
                            className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-slate-800 focus:border-primary outline-none bg-white"
                            value={formData.insuranceLevel || '100%'}
                            onChange={e => setFormData({...formData, insuranceLevel: e.target.value as InsuranceLevel})}
                        >
                            <option value="0%">0%</option>
                            <option value="80%">80%</option>
                            <option value="95%">95%</option>
                            <option value="100%">100%</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Info size={12}/> Trạng thái bệnh nhân</label>
                    <select 
                        className={`w-full p-3 border-2 border-slate-100 rounded-xl font-bold outline-none bg-white ${formData.status === PatientStatus.DISCHARGED ? 'text-rose-600 border-rose-100' : 'text-slate-800'}`}
                        value={formData.status || PatientStatus.TREATING}
                        onChange={e => setFormData({...formData, status: e.target.value as PatientStatus})}
                    >
                        <option value={PatientStatus.TREATING}>Đang điều trị</option>
                        <option value={PatientStatus.DISCHARGED}>Đã ra viện</option>
                    </select>
                </div>

                {formData.status === PatientStatus.DISCHARGED && (
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 text-rose-600 font-black text-[10px] uppercase tracking-widest">
                            <LogOut size={14} /> Thông tin ra viện
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={12}/> Ngày ra viện</label>
                                <input 
                                    type="date"
                                    className="w-full p-3 border-2 border-white rounded-xl font-bold text-rose-700 focus:border-rose-300 outline-none transition-colors shadow-sm"
                                    value={formData.dischargeDate?.split('T')[0] || ''}
                                    onChange={e => {
                                        const time = formData.dischargeDate?.split('T')[1] || '08:00';
                                        setFormData({...formData, dischargeDate: `${e.target.value}T${time}`});
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> Giờ ra viện</label>
                                <TimeInput 
                                    className="w-full p-3 border-2 border-white rounded-xl font-bold text-rose-700 focus:border-rose-300 outline-none transition-colors shadow-sm"
                                    value={formData.dischargeDate?.split('T')[1] || '08:00'}
                                    onChange={val => {
                                        const date = formData.dischargeDate?.split('T')[0] || new Date().toISOString().split('T')[0];
                                        setFormData({...formData, dischargeDate: `${date}T${val}`});
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Giường & Phòng */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Bed size={12}/> Loại giường</label>
                            <select 
                                className="w-full p-3 border-2 border-white rounded-xl font-bold text-slate-800 focus:border-primary outline-none bg-white shadow-sm"
                                value={formData.bedType || 'Nội trú'}
                                onChange={e => setFormData({...formData, bedType: e.target.value as any})}
                            >
                                <option value="Nội trú">Nội trú</option>
                                <option value="Nội trú ban ngày">Nội trú ban ngày</option>
                                <option value="Ngoại trú">Ngoại trú</option>
                                <option value="Khác">Khác</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Bed size={12}/> Số giường</label>
                             <input 
                                className="w-full p-3 border-2 border-white rounded-xl font-bold text-indigo-600 focus:border-indigo-400 outline-none shadow-sm placeholder:text-indigo-200"
                                placeholder="VD: 105"
                                value={formData.bedNumber}
                                onChange={e => setFormData({...formData, bedNumber: e.target.value})}
                             />
                        </div>
                    </div>
                    <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Building2 size={12}/> Số phòng</label>
                         <input 
                            className="w-full p-3 border-2 border-white rounded-xl font-bold text-slate-700 focus:border-slate-300 outline-none shadow-sm"
                            placeholder="VD: P.402"
                            value={formData.roomNumber}
                            onChange={e => setFormData({...formData, roomNumber: e.target.value})}
                         />
                    </div>
                    <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><StickyNote size={12}/> Ghi chú</label>
                         <textarea 
                            className="w-full p-3 border-2 border-white rounded-xl font-bold text-slate-700 focus:border-slate-300 outline-none shadow-sm min-h-[80px]"
                            placeholder="Nhập ghi chú đặc biệt về bệnh nhân..."
                            value={formData.note || ''}
                            onChange={e => setFormData({...formData, note: e.target.value})}
                         />
                    </div>
                </div>

                {initialData?.code && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-2 rounded-lg justify-center">
                        <Info size={14} /> Mã hồ sơ hệ thống: <span className="font-mono font-bold text-slate-500">{initialData.code}</span>
                    </div>
                )}
            </div>

            <div className="pt-4 flex gap-3">
                <Button type="button" variant="secondary" onClick={onClose} className="flex-1 h-12 rounded-xl">Hủy bỏ</Button>
                <Button type="submit" className="flex-[2] h-12 rounded-xl shadow-lg shadow-primary/20">
                    <Save size={18} /> Lưu hồ sơ
                </Button>
            </div>
        </form>
      </div>
    </div>
  );
};
