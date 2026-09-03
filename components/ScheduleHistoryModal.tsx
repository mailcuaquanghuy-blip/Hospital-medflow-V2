import React from 'react';
import { History, X, CheckCircle2, RotateCcw, Check, Sparkles, ShieldCheck } from 'lucide-react';
import { Department, Appointment, ScheduleSnapshot } from '../types';
import { DeviationItem } from '../utils/scheduleHistoryUtils';

interface ScheduleHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  currentDept: Department;
  deviations: DeviationItem[];
  isExplicitSnapshot: boolean;
  snapshotInfo?: ScheduleSnapshot;
  onSaveSnapshot?: () => Promise<void> | void;
  isSavingSnapshot?: boolean;
  onUndoChange?: (apptId: string, type: 'NEW' | 'MODIFIED' | 'DELETED', originalAppt?: Appointment) => Promise<void> | void;
}

export const ScheduleHistoryModal: React.FC<ScheduleHistoryModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  currentDept,
  deviations,
  isExplicitSnapshot,
  snapshotInfo,
  onSaveSnapshot,
  isSavingSnapshot = false,
  onUndoChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <History size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Nhật ký biến động lịch trình</h3>
                {isExplicitSnapshot ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck size={12} /> Bản chốt chuẩn
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    <Sparkles size={12} /> Mốc phiên làm việc
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                Ngày {currentDate} - {currentDept.name}
                {snapshotInfo?.createdAt && (
                  <span className="normal-case font-medium ml-1">
                    (Chốt: {new Date(snapshotInfo.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            title="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {deviations.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-800">Không có biến động nào!</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {isExplicitSnapshot 
                    ? 'Lịch trình ngày này đang hoàn toàn khớp với phiên bản chốt mẫu' 
                    : 'Chưa có sự thay đổi nào kể từ khi bắt đầu phiên làm việc'}
                </p>
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Mọi sửa đổi, dời giờ, đổi bác sĩ chính, người phụ hoặc xóa/thêm mới lịch trình sẽ tự động xuất hiện tại đây để theo dõi và hoàn tác bất cứ lúc nào.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                <span>Lịch trình bị biến động ({deviations.length})</span>
                <span>Hành động khôi phục</span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200/60 rounded-3xl overflow-hidden bg-slate-50/20 shadow-sm">
                {deviations.map((dev) => {
                  let badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
                  let badgeText = "✎ Chỉnh sửa";
                  if (dev.type === 'NEW') {
                    badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    badgeText = "+ Thêm mới";
                  } else if (dev.type === 'DELETED') {
                    badgeBg = "bg-rose-50 text-rose-700 border-rose-200";
                    badgeText = "✗ Đã xóa";
                  }

                  return (
                    <div key={dev.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1.5 flex-1 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-800">{dev.patientName}</span>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeBg}`}>
                            {badgeText}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-500">
                          Lịch trình: <span className="font-extrabold text-slate-700">{dev.procedureName}</span>
                        </div>
                        <div className="text-xs font-bold text-amber-600 bg-amber-50/40 px-2.5 py-1 rounded-xl inline-block border border-amber-100">
                          {dev.changeDetails}
                        </div>
                      </div>
                      
                      {onUndoChange && (
                        <button
                          onClick={() => onUndoChange(dev.id, dev.type, dev.originalAppt)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-slate-700 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-300 shadow-sm border border-slate-200/40 shrink-0"
                          title="Khôi phục lịch trình về trạng thái mốc ban đầu"
                        >
                          <RotateCcw size={12} />
                          Hoàn tác
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs font-bold uppercase tracking-wide">
            {deviations.length > 0 ? (
              <span className="text-amber-600 font-bold">
                Có {deviations.length} lịch trình biến động so với bản chốt
              </span>
            ) : (
              <span className="text-slate-400">
                Lịch trình khớp hoàn toàn với phiên bản chốt
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {onSaveSnapshot && (
              <button
                onClick={onSaveSnapshot}
                disabled={isSavingSnapshot}
                className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-sky-200 disabled:opacity-50"
                title="Lưu lại toàn bộ lịch trình hiện tại làm mốc chốt chuẩn mới"
              >
                <Check size={15} />
                <span>{isSavingSnapshot ? "Đang lưu..." : "Lưu phiên bản chốt"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-800 text-white hover:bg-slate-900 active:scale-95 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
