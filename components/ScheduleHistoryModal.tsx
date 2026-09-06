import React, { useState } from 'react';
import { History, X, CheckCircle2, RotateCcw, Check, Sparkles, ShieldCheck, Calendar, Globe } from 'lucide-react';
import { Department, Appointment, ScheduleSnapshot } from '../types';
import { DeviationItem, formatDateVi } from '../utils/scheduleHistoryUtils';

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
  const [dateFilterMode, setDateFilterMode] = useState<'CURRENT' | 'ALL'>('CURRENT');
  const [showAllItems, setShowAllItems] = useState(false);

  if (!isOpen) return null;

  const currentDateDeviations = deviations.filter(d => d.date === currentDate);
  const displayedDeviations = dateFilterMode === 'CURRENT' ? currentDateDeviations : deviations;
  const isOver1000 = deviations.length >= 1000;

  const RENDER_LIMIT = 150;
  const renderedList = showAllItems ? displayedDeviations : displayedDeviations.slice(0, RENDER_LIMIT);

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
                Khoa: <span className="text-slate-700 font-extrabold">{currentDept.name}</span>
                {snapshotInfo?.createdAt && (
                  <span className="normal-case font-medium ml-2 text-slate-500">
                    (Chốt gần nhất: {new Date(snapshotInfo.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
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

        {/* Filter Bar */}
        <div className="px-6 pt-4 pb-2 bg-slate-50/30 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl border border-slate-200">
            <button
              onClick={() => setDateFilterMode('CURRENT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                dateFilterMode === 'CURRENT'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar size={14} className={dateFilterMode === 'CURRENT' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>Ngày hiện tại ({formatDateVi(currentDate)})</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                dateFilterMode === 'CURRENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300 text-slate-700'
              }`}>
                {currentDateDeviations.length}
              </span>
            </button>

            <button
              onClick={() => setDateFilterMode('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                dateFilterMode === 'ALL'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe size={14} className={dateFilterMode === 'ALL' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>Tất cả các ngày</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                dateFilterMode === 'ALL' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300 text-slate-700'
              }`}>
                {deviations.length}
              </span>
            </button>
          </div>

          <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            {dateFilterMode === 'CURRENT' ? `Lọc ngày ${formatDateVi(currentDate)}` : 'Hiển thị tất cả ngày'}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {isOver1000 && onSaveSnapshot && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500 text-white rounded-xl font-black text-xs">
                  ⚡ 1000+
                </div>
                <div>
                  <p className="text-xs font-black text-amber-900">
                    Phát hiện {deviations.length} biến động trên toàn hệ thống!
                  </p>
                  <p className="text-[11px] font-bold text-amber-700 mt-0.5">
                    Hãy bấm chốt để làm sạch nhật ký và tăng tốc tải dữ liệu.
                  </p>
                </div>
              </div>
              <button
                onClick={onSaveSnapshot}
                disabled={isSavingSnapshot}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
              >
                {isSavingSnapshot ? "Đang tự động chốt..." : "Chốt mốc ngay"}
              </button>
            </div>
          )}

          {displayedDeviations.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-800">
                  {dateFilterMode === 'CURRENT' 
                    ? `Không có biến động nào trong ngày ${formatDateVi(currentDate)}!`
                    : 'Không có biến động nào ở tất cả các ngày!'}
                </h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {isExplicitSnapshot 
                    ? 'Lịch trình hoàn toàn khớp với phiên bản chốt mẫu' 
                    : 'Chưa có sự thay đổi nào kể từ khi bắt đầu phiên làm việc'}
                </p>
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Mọi sửa đổi, dời giờ, dời ngày, đổi bác sĩ chính, người phụ hoặc copy/thêm mới lịch trình sang các ngày sẽ tự động được ghi nhận đầy đủ tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-widest px-1">
                <span>
                  Lịch trình bị biến động ({displayedDeviations.length})
                  {displayedDeviations.length > RENDER_LIMIT && !showAllItems && (
                    <span className="normal-case font-extrabold text-amber-600 ml-2">
                      (Đang hiển thị {RENDER_LIMIT} mục đầu tiên)
                    </span>
                  )}
                </span>
                <span>Hành động khôi phục</span>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200/60 rounded-3xl overflow-hidden bg-slate-50/20 shadow-sm">
                {renderedList.map((dev) => {
                  let badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
                  let badgeText = "✎ Chỉnh sửa";
                  if (dev.type === 'NEW') {
                    badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    badgeText = "+ Thêm / Copy mới";
                  } else if (dev.type === 'DELETED') {
                    badgeBg = "bg-rose-50 text-rose-700 border-rose-200";
                    badgeText = "✗ Đã xóa";
                  }

                  const isCurrentDay = dev.date === currentDate;

                  return (
                    <div key={dev.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1.5 flex-1 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-800">{dev.patientName}</span>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeBg}`}>
                            {badgeText}
                          </span>
                          <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            isCurrentDay 
                              ? 'bg-emerald-100/90 text-emerald-800 border-emerald-300' 
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            <Calendar size={11} /> Ngày: {formatDateVi(dev.date)} {isCurrentDay ? '(Hiện tại)' : ''}
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

              {displayedDeviations.length > RENDER_LIMIT && !showAllItems && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => setShowAllItems(true)}
                    className="px-4 py-2 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
                  >
                    Xem tất cả {displayedDeviations.length} biến động
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs font-bold uppercase tracking-wide">
            {displayedDeviations.length > 0 ? (
              <span className="text-amber-600 font-bold">
                {dateFilterMode === 'CURRENT'
                  ? `Có ${currentDateDeviations.length} lịch trình biến động ở ngày hiện tại (Tổng ${deviations.length} ở tất cả ngày)`
                  : `Có ${deviations.length} lịch trình biến động trên toàn bộ các ngày`}
              </span>
            ) : (
              <span className="text-slate-400">
                {dateFilterMode === 'CURRENT'
                  ? `Ngày hiện tại ${formatDateVi(currentDate)} khớp hoàn toàn với bản chốt`
                  : 'Tất cả các ngày khớp hoàn toàn với phiên bản chốt'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {onSaveSnapshot && (
              <button
                onClick={onSaveSnapshot}
                disabled={isSavingSnapshot}
                className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-sky-200 disabled:opacity-50"
                title="Lưu lại toàn bộ lịch trình hiện tại của tất cả các ngày làm mốc chốt chuẩn mới"
              >
                <Check size={15} />
                <span>{isSavingSnapshot ? "Đang lưu..." : "Lưu chốt tất cả các ngày"}</span>
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
