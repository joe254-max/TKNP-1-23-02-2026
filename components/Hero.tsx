import React, { useState } from 'react';
import { User } from '../types';
import { School, Library as LibraryIcon } from 'lucide-react';

interface HeroProps {
  user: User;
  onSearch: (q: string) => void;
  onBrowse: () => void;
  onViewDashboard: (tab?: 'PHYSICAL' | 'ONLINE') => void;
}

const Hero: React.FC<HeroProps> = ({ user, onSearch, onBrowse, onViewDashboard }) => {
  const [val, setVal] = useState('');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(val);
    onBrowse();
  };

  return (
    <div className="relative bg-slate-950 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[3rem] overflow-hidden p-4 sm:p-8 md:p-16 lg:p-24 text-center text-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)]">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-0 left-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-rose-950 rounded-full blur-[100px] sm:blur-[160px] -ml-20 sm:-ml-40 -mt-20 sm:-mt-40 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-red-950 rounded-full blur-[100px] sm:blur-[160px] -mr-20 sm:-mr-40 -mb-20 sm:-mb-40"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 mb-4 sm:mb-8 rounded-full bg-white/10 border border-white/20 backdrop-blur-md">
           <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-rose-300">Institutional Digital Hub</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-black mb-4 sm:mb-8 leading-[1.1] tracking-tighter uppercase">
          {getGreeting()}, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-red-600 break-words">
            {user.name}
          </span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base md:text-lg lg:text-xl mb-6 sm:mb-12 max-w-2xl mx-auto font-medium leading-relaxed px-2">
          The ultimate repository of lecture notes, past exams, and technical manuals specifically curated for the polytechnic community.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 mb-6 sm:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <button 
            className="group px-6 sm:px-10 py-4 sm:py-5 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl sm:rounded-[2rem] flex items-center justify-center gap-3 sm:gap-4 hover:bg-rose-900/20 hover:border-rose-500/30 transition-all duration-500 shadow-2xl active:scale-95"
            onClick={() => onViewDashboard('PHYSICAL')}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <School size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white">My Class</span>
          </button>

          <button 
            className="group px-6 sm:px-10 py-4 sm:py-5 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl sm:rounded-[2rem] flex items-center justify-center gap-3 sm:gap-4 hover:bg-rose-900/20 hover:border-rose-500/30 transition-all duration-500 shadow-2xl active:scale-95"
            onClick={onBrowse}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <LibraryIcon size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white">Library</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto group">
          <input
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-4 sm:pl-8 pr-4 sm:pr-28 md:pr-40 py-4 sm:py-6 rounded-xl sm:rounded-[1.5rem] bg-white/10 backdrop-blur-xl border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-4 focus:ring-rose-950/30 transition shadow-2xl font-medium text-sm sm:text-base"
          />
          <button 
            type="submit"
            className="hidden sm:block absolute right-3 top-3 bottom-3 px-6 md:px-10 bg-rose-950 hover:bg-black rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black tracking-[0.1em] sm:tracking-[0.2em] uppercase transition shadow-xl active:scale-95 border border-white/10"
          >
            Explore
          </button>
          <button 
            type="submit"
            className="sm:hidden w-full mt-3 py-4 bg-rose-950 hover:bg-black rounded-xl text-xs font-black tracking-[0.2em] uppercase transition shadow-xl active:scale-95 border border-white/10"
          >
            Explore Resources
          </button>
        </form>

        <div className="mt-6 sm:mt-12 flex flex-wrap justify-center gap-3 sm:gap-8 text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em]">
          <span className="text-slate-600 w-full sm:w-auto mb-1 sm:mb-0">Trending:</span>
          <button onClick={() => { setVal('ICT-201'); onSearch('ICT-201'); onBrowse(); }} className="hover:text-rose-500 transition">#ICT-201</button>
          <button onClick={() => { setVal('EE-302'); onSearch('EE-302'); onBrowse(); }} className="hover:text-rose-500 transition">#EE-302</button>
          <button onClick={() => { setVal('Past Papers'); onSearch('Past Papers'); onBrowse(); }} className="hover:text-rose-500 transition">#Exams</button>
        </div>
      </div>
    </div>
  );
};

export default Hero;