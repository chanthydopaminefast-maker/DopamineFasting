import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, User, Lock, Users } from 'lucide-react';
import { UserRole } from '../types';

interface Props {
  onLogin: (name: string, role: UserRole, pin: string) => void;
}

export const LandingPage: React.FC<Props> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>('Admin');

  const handleGoogleLogin = () => {
    onLogin('', role, ''); // PIN and Name not needed here
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20">
        <div className="bg-orange-500/10 p-10 text-center border-b border-orange-500/10">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-[4px] border border-white/10">
            <ShieldCheck className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-1 uppercase tracking-tighter shadow-sm">Peak Performance</h1>
          <p className="text-slate-700 text-[10px] font-black uppercase tracking-[4px]">Growth Portal Login</p>
        </div>
        
        <div className="p-8">
            {/* Role Selection */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Select Your Role</label>
              <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('Teacher')}
                    className={`text-sm py-3 px-4 rounded-lg border transition-all flex items-center justify-center gap-2 font-medium ${
                      role === 'Teacher' 
                      ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Users size={16} /> Teacher / Assistant
                  </button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setRole('Finance')}
                        className={`text-sm py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                        role === 'Finance' 
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Finance
                    </button>
                    <button
                        type="button"
                        onClick={() => setRole('Admin')}
                        className={`text-sm py-2 px-3 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                        role === 'Admin' 
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Admin
                    </button>
                  </div>
              </div>
            </div>
            
            <button 
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary-500/30 font-black tracking-wider"
            >
              Sign In with Google <ArrowRight size={18} />
            </button>
        </div>
      </div>
    </div>
  );
};