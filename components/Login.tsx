
import React, { useState } from 'react';
import { UserAccount } from '../types';
import { DEFAULT_ADMIN } from '../constants';
import { Lock, User, AlertCircle, Loader2, ShieldCheck, KeyRound, Database } from 'lucide-react';
import { db, auth } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';

interface LoginProps {
  onLogin: (user: UserAccount) => void;
  users: UserAccount[];
}

export const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleQuickAdminLogin = async () => {
    setUsername(DEFAULT_ADMIN.username);
    setPassword(DEFAULT_ADMIN.password);
    setError('');
    setLoading(true);

    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      onLogin(DEFAULT_ADMIN);
    } catch (err: any) {
      console.warn('Anonymous auth warning during quick login:', err);
      onLogin(DEFAULT_ADMIN);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      // Direct Firestore fetch to guarantee latest users data
      let dbUsers: UserAccount[] = [];
      if (db) {
        try {
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
          const snap = await getDocs(collection(db, 'users'));
          dbUsers = snap.docs.map(doc => doc.data() as UserAccount);
        } catch (dbErr) {
          console.warn('Direct user query fallback:', dbErr);
        }
      }

      // Combine default admin, prop users, and db users
      const allUsersMap = new Map<string, UserAccount>();
      allUsersMap.set(DEFAULT_ADMIN.username.toLowerCase(), DEFAULT_ADMIN);
      users.forEach(u => allUsersMap.set(u.username.trim().toLowerCase(), u));
      dbUsers.forEach(u => allUsersMap.set(u.username.trim().toLowerCase(), u));

      const matchedUser = Array.from(allUsersMap.values()).find(
        u => u.username.trim().toLowerCase() === cleanUsername && u.password.trim() === cleanPassword
      );

      if (matchedUser) {
        try {
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
          onLogin(matchedUser);
        } catch (authErr: any) {
          console.error('Firebase Auth Error:', authErr);
          // Fallback login if account credentials matched
          onLogin(matchedUser);
        }
      } else {
        setError('Tên đăng nhập hoặc mật khẩu không đúng!');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Lỗi hệ thống: ' + (err.message || 'Không thể đăng nhập'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
      <div className="max-w-md w-full space-y-4">
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 p-8 md:p-10 space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 bg-sky-50 text-sky-500 rounded-2xl mb-1">
              <Database size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Hospital medflow</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Lập và quản lý lịch trình y tế</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên đăng nhập</label>
              <div className="relative">
                <input 
                  required
                  type="text" 
                  className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-sky-500 focus:bg-white transition-all font-bold text-slate-800 text-sm"
                  placeholder="Tên đăng nhập (ví dụ: admin)"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mật khẩu</label>
              <div className="relative">
                <input 
                  required
                  type="password" 
                  className="w-full p-4 pl-12 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none focus:border-sky-500 focus:bg-white transition-all font-bold text-slate-800 text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 animate-in slide-in-from-top-2">
                <AlertCircle size={18} className="shrink-0" />
                <span className="text-xs font-bold">{error}</span>
              </div>
            )}

            <button 
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-2xl shadow-xl shadow-sky-100 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'ĐĂNG NHẬP HỆ THỐNG'}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 text-[10px] text-slate-400 font-black uppercase tracking-widest text-center space-y-1">
        <p>Tác giả: Nguyễn Quang Huy | MedFlow V2.5</p>
      </div>
    </div>
  );
};

