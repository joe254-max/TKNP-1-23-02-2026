import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { LayoutDashboard, GraduationCap, Library, LogOut, Menu, X, UserCircle, PlayCircle } from 'lucide-react';

type ViewType = 'home' | 'browse' | 'dashboard' | 'profile' | 'recordings';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  setView: (v: ViewType) => void;
  currentView: string;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, setView, currentView }) => {
  const isStudent = user.role === UserRole.STUDENT;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (view: ViewType) => {
    setView(view);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-100 px-4 md:px-12 py-3">
      <div className="flex items-center justify-between">
        <div 
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group" 
          onClick={() => handleNavClick(isStudent ? 'home' : 'dashboard')}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-md border border-slate-200 overflow-hidden">
            <img
              src="/tknp-logo.png"
              alt="TKNP Logo"
              className="w-full h-full object-contain"
              draggable={false}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-[8px] sm:text-[10px] tracking-tight text-[#1a202c] uppercase leading-none">
              The Kitale National
            </span>
            <span className="font-black text-[8px] sm:text-[10px] tracking-tight text-[#1a202c] uppercase leading-none mt-0.5 sm:mt-1">
              Polytechnic E-Learning
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <button 
            onClick={() => handleNavClick(isStudent ? 'home' : 'dashboard')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              (isStudent && currentView === 'home') || (!isStudent && currentView === 'dashboard') 
                ? 'bg-[#fdf2f2] text-[#3d0413]' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard size={14} />
            Dashboard
          </button>
          
          <button 
            onClick={() => handleNavClick('dashboard')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                currentView === 'dashboard' ? 'bg-[#fdf2f2] text-[#3d0413]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <GraduationCap size={14} />
            My Classes
          </button>

          <button 
            onClick={() => handleNavClick('browse')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              currentView === 'browse' ? 'text-[#3d0413]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Library size={14} />
            E-Repository
          </button>
          <button 
            onClick={() => handleNavClick('recordings')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              currentView === 'recordings' ? 'bg-[#fdf2f2] text-[#3d0413]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlayCircle size={14} />
            Recordings
          </button>
          <button 
            onClick={() => handleNavClick('profile')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              currentView === 'profile' ? 'bg-[#fdf2f2] text-[#3d0413]' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCircle size={14} />
            My Profile
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-right hidden sm:block pr-2 sm:pr-4">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-900 leading-none truncate max-w-[80px] sm:max-w-[120px]">{user.name.toUpperCase()}</p>
            <p className="text-[7px] sm:text-[8px] text-slate-400 uppercase font-black tracking-widest mt-1">{user.role}</p>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 bg-slate-100 text-slate-400 hover:text-rose-950 hover:bg-slate-200 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => handleNavClick(isStudent ? 'home' : 'dashboard')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                (isStudent && currentView === 'home') || (!isStudent && currentView === 'dashboard') 
                  ? 'bg-[#fdf2f2] text-[#3d0413]' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard size={16} />
              Dashboard
            </button>
            
            <button 
              onClick={() => handleNavClick('dashboard')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  currentView === 'dashboard' ? 'bg-[#fdf2f2] text-[#3d0413]' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <GraduationCap size={16} />
              My Classes
            </button>

            <button 
              onClick={() => handleNavClick('browse')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                currentView === 'browse' ? 'bg-[#fdf2f2] text-[#3d0413]' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Library size={16} />
              E-Repository
            </button>
            <button onClick={() => handleNavClick('recordings')} className="flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all text-slate-500 hover:bg-slate-50">
              <PlayCircle size={16} />
              Recordings
            </button>
            <button onClick={() => handleNavClick('profile')} className="flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all text-slate-500 hover:bg-slate-50">
              <UserCircle size={16} />
              My Profile
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;