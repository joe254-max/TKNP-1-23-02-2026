
import React from 'react';
import { DEPARTMENTS } from '../constants';

interface SidebarProps {
  selectedDept: string | null;
  onSelectDept: (dept: string | null) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedDept, onSelectDept }) => {
  return (
    <aside className="w-full md:w-64 lg:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200 h-auto md:h-[calc(100vh-73px)] overflow-y-auto p-4 sm:p-6 flex-shrink-0">
      <h3 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-3 sm:mb-6 px-2 sm:px-4">Departments</h3>
      <div className="flex md:flex-col gap-2 md:gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 -mx-2 px-2 md:mx-0 md:px-0">
        <button
          onClick={() => onSelectDept(null)}
          className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all ${
            selectedDept === null 
              ? 'bg-rose-50 text-rose-950 shadow-sm border border-rose-100' 
              : 'text-slate-600 hover:bg-slate-50 border border-transparent'
          }`}
        >
          All Departments
        </button>
        {DEPARTMENTS.map((dept) => (
          <button
            key={dept.id}
            onClick={() => onSelectDept(dept.name)}
            className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all ${
              selectedDept === dept.name 
                ? 'bg-rose-50 text-rose-950 shadow-sm border border-rose-100' 
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
          >
            {dept.name}
          </button>
        ))}
      </div>

      <div className="mt-6 sm:mt-12 hidden md:block">
        <h3 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-4 sm:mb-6 px-2 sm:px-4">Discovery Tools</h3>
        <div className="space-y-3 sm:space-y-4 px-2 sm:px-4">
          <label className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
            <input type="checkbox" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-950 border-slate-300 rounded focus:ring-rose-950" />
            <span className="text-xs sm:text-sm text-slate-600 font-bold group-hover:text-slate-900 transition">Newest Materials</span>
          </label>
          <label className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
            <input type="checkbox" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-950 border-slate-300 rounded focus:ring-rose-950" />
            <span className="text-xs sm:text-sm text-slate-600 font-bold group-hover:text-slate-900 transition">Most Downloaded</span>
          </label>
          <label className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
            <input type="checkbox" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-950 border-slate-300 rounded focus:ring-rose-950" />
            <span className="text-xs sm:text-sm text-slate-600 font-bold group-hover:text-slate-900 transition">Peer Recommended</span>
          </label>
        </div>
      </div>

      <div className="mt-6 sm:mt-12 pt-4 sm:pt-10 hidden md:block">
        <div className="bg-rose-950 rounded-xl sm:rounded-[2rem] p-4 sm:p-8 text-white overflow-hidden relative group shadow-2xl shadow-rose-950/20">
          <div className="relative z-10">
            <h4 className="font-black mb-2 text-base sm:text-lg leading-tight">Need Access Help?</h4>
            <p className="text-[10px] sm:text-xs text-rose-100 mb-4 sm:mb-6 leading-relaxed opacity-80">Our librarians are online to assist with credentials and physical catalog queries.</p>
            <button className="w-full bg-white text-rose-950 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest hover:bg-rose-50 transition shadow-lg active:scale-95">
              Chat Assistance
            </button>
          </div>
          <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-white/10 rounded-full -mr-8 sm:-mr-12 -mt-8 sm:-mt-12 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
