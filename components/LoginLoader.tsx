import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ShieldCheck, Database, Check, RefreshCw } from 'lucide-react';

interface LoginLoaderProps {
  loadedCollections: Record<string, boolean>;
  onComplete: () => void;
}

export const LoginLoader: React.FC<LoginLoaderProps> = ({ loadedCollections, onComplete }) => {
  const [dots, setDots] = useState('');
  
  // Staged loading status text matching the firebase collection keys
  const stages = [
    { key: 'procedures', label: 'Cập nhật danh mục 47 lịch trình lâm sàng', progress: 15 },
    { key: 'staff', label: 'Đồng bộ thông tin nhân sự & phân quyền khoa', progress: 30 },
    { key: 'patients', label: 'Đồng bộ hồ sơ bệnh án & tiến trình điều trị', progress: 50 },
    { key: 'attendance', label: 'Tải sơ đồ lịch trực & timeline rảnh bận nhân sự', progress: 65 },
    { key: 'machineShifts', label: 'Khởi tạo sơ đồ vận hành ca máy kỹ thuật', progress: 80 },
    { key: 'appointments', label: 'Nạp danh sách chỉ định & giải quyết xung đột lịch', progress: 95 },
  ];

  // Calculate actual progress based on loaded collections
  const totalItems = stages.length;
  const loadedCount = stages.filter(s => loadedCollections[s.key]).length;
  const rawProgress = Math.round((loadedCount / totalItems) * 100);
  
  // Smooth progressive animation for the loading bar
  const [progress, setProgress] = useState(0);
  
  // Dots animation
  useEffect(() => {
    const timer = setInterval(() => {
      setDots(d => d.length < 3 ? d + '.' : '');
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Animate the bar progressively so it doesn't jump abruptly
  useEffect(() => {
    const target = rawProgress === 100 ? 100 : Math.max(rawProgress, 10);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev < target) {
          const next = prev + 5;
          return next > target ? target : next;
        }
        clearInterval(interval);
        return prev;
      });
    }, 30);
    
    return () => clearInterval(interval);
  }, [rawProgress]);

  // Handle completion check with a resilient timeout of 3.5s max
  useEffect(() => {
    let completedTimer: NodeJS.Timeout;
    let fallbackTimer: NodeJS.Timeout;
    
    const finish = () => {
      setProgress(100);
      completedTimer = setTimeout(() => {
        onComplete();
      }, 500); // short delay for visual completion
    };

    if (loadedCount === totalItems) {
      finish();
    }

    // Safety fallback: dismiss loading screen after 3.2 seconds max to never lock user out
    fallbackTimer = setTimeout(() => {
      console.log("Loading completed via safety timeout");
      finish();
    }, 3200);

    return () => {
      clearTimeout(completedTimer);
      clearTimeout(fallbackTimer);
    };
  }, [loadedCount, totalItems, onComplete]);

  // Determine current active loading text
  const currentLoadingStage = stages.find(s => !loadedCollections[s.key]) || stages[stages.length - 1];

  return (
    <AnimatePresence>
      <motion.div 
        id="login-loader-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[9999] overflow-hidden"
      >
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-xl w-full px-6 space-y-10 z-10 text-center">
          {/* Top Branding / Logo */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <div className="inline-flex p-4 bg-sky-500/10 border border-sky-500/20 rounded-[2rem] text-sky-400 shadow-lg shadow-sky-500/5 animate-pulse mb-2">
              <Database size={40} className="text-sky-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-widest uppercase">Hospital medflow</h1>
              <p className="text-xs font-black text-sky-400/80 uppercase tracking-widest mt-1">Lập và quản lý lịch trình y tế</p>
            </div>
          </motion.div>

          {/* Loader circle & progress percentage */}
          <div className="relative flex justify-center py-4">
            <svg className="w-36 h-36 transform -rotate-90">
              {/* Outer ring path */}
              <circle 
                cx="72" 
                cy="72" 
                r="64" 
                className="stroke-slate-900 fill-transparent" 
                strokeWidth="6" 
              />
              {/* Progress ring path */}
              <motion.circle 
                cx="72" 
                cy="72" 
                r="64" 
                className="stroke-sky-500 fill-transparent" 
                strokeWidth="6" 
                strokeDasharray={2 * Math.PI * 64}
                strokeDashoffset={2 * Math.PI * 64 * (1 - progress / 100)}
                strokeLinecap="round"
                transition={{ type: "tween", ease: "easeInOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span 
                key={progress} 
                initial={{ scale: 0.8 }} 
                animate={{ scale: 1 }} 
                className="text-3xl font-extrabold text-white font-mono"
              >
                {progress}%
              </motion.span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ĐANG XỬ LÝ</span>
            </div>
          </div>

          {/* Core Load Checklist Status */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-[2rem] p-6 text-left max-w-lg mx-auto shadow-2xl relative backdrop-blur-md">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <RefreshCw size={14} className="text-sky-400 animate-spin" />
              Tiến trình đồng bộ cơ sở dữ liệu
            </h3>
            
            <div className="space-y-3">
              {stages.map((stage) => {
                const isLoaded = loadedCollections[stage.key];
                return (
                  <div key={stage.key} className="flex items-center justify-between text-xs gap-3">
                    <span className={`font-semibold truncate flex-1 ${isLoaded ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {stage.label}
                    </span>
                    <div className="shrink-0">
                      {isLoaded ? (
                        <span className="flex items-center justify-center w-5 h-5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      ) : (
                        <div className="w-5 h-5 flex items-center justify-center">
                          <Loader2 size={12} className="text-sky-400 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current system message */}
          <div className="h-6 flex items-center justify-center">
            <p className="text-xs font-bold text-slate-400 italic">
              {progress === 100 
                ? 'Đồng bộ hoàn tất! Xin chào..' 
                : `${currentLoadingStage?.label}${dots}`}
            </p>
          </div>
        </div>

        {/* Footer info decoration */}
        <div className="absolute bottom-8 left-12 right-12 flex justify-between text-[10px] text-slate-500 font-extrabold tracking-widest uppercase">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>KẾT NỐI AN TOÀN SSL / AES-256</span>
          </div>
          <div>
            <span>MEDFLOW V2.5</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
