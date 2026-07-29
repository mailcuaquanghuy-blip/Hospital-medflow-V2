
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, X, Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (password: string) => void;
  title?: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  isOpen,
  onClose,
  onVerify,
  title = "XÁC MINH DANH TÍNH",
  description = "Bệnh nhân này đã ra viện. Vui lòng nhập mật khẩu tài khoản của bạn để tiếp tục thay đổi này.",
  isLoading = false,
  error = null
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    onVerify(password);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-100"
          >
            <div className="p-8 text-center space-y-6">
              <div className="mx-auto w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center shadow-inner relative overflow-hidden group">
                <motion.div 
                  className="absolute inset-0 bg-rose-100 opacity-0 group-hover:opacity-100 transition-opacity"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <ShieldAlert size={40} className="relative z-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{title}</h3>
                <p className="text-sm text-slate-500 font-bold leading-relaxed px-4">
                  {description}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                    <Lock size={18} />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-12 pr-12 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-primary focus:bg-white outline-none transition-all placeholder:text-slate-300"
                    placeholder="Nhập mật khẩu của bạn"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoFocus
                    autoComplete="current-password"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-black text-rose-50 text-rose-600 uppercase tracking-tight flex items-center justify-center gap-2"
                  >
                    <X size={14} /> {error}
                  </motion.div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    onClick={onClose} 
                    variant="secondary" 
                    className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs"
                  >
                    HỦY BỎ
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!password.trim() || isLoading}
                    className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <div className="flex items-center gap-2">
                        XÁC NHẬN <CheckCircle2 size={16} />
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </div>
            
            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
              <p className="text-[10px] items-center justify-center font-black text-slate-400 uppercase tracking-widest flex gap-1.5">
                <ShieldAlert size={12} className="text-slate-300" /> 
                Giao thức bảo mật hệ thống Hospital medflow
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
