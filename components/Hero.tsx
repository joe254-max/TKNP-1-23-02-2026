import React, { useEffect, useMemo, useState } from 'react';
import { User } from '../types';

interface HeroProps {
  user: User;
  onSearch: (q: string) => void;
  onBrowse: () => void;
  onViewDashboard: (tab?: 'PHYSICAL' | 'ONLINE') => void;
  onOpenClassnet: () => void;
}

const Hero: React.FC<HeroProps> = ({ user, onSearch, onBrowse, onViewDashboard, onOpenClassnet }) => {
  const [val, setVal] = useState('');
  const firstName = useMemo(() => (user.name || '').trim().split(/\s+/)[0] || 'Friend', [user.name]);
  const targetTyped = useMemo(() => `Hello, ${firstName}`, [firstName]);
  const [typed, setTyped] = useState('');
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    setTyped('');
    setTypingDone(false);

    const totalMs = 3000;
    const len = Math.max(1, targetTyped.length);
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / totalMs);
      const i = Math.floor(t * len);
      setTyped(targetTyped.slice(0, i));
      if (t >= 1) {
        setTyped(targetTyped);
        setTypingDone(true);
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [targetTyped]);

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
          <span className="crt-hero">
            <span className={`crt-scanline ${typed.length > 0 ? 'crt-scanline--run' : ''}`} aria-hidden="true" />
            <span className="text-white break-words">
              {typed.split(firstName)[0]}
              <span className={typingDone ? 'crt-underline crt-underline--pulse' : 'crt-underline'}>
                {typed.endsWith(firstName) ? firstName : typed.includes(firstName) ? firstName : ''}
              </span>
              {typed.includes(firstName) ? typed.slice(typed.indexOf(firstName) + firstName.length) : ''}
            </span>
            {!typingDone && <span className="crt-cursor" aria-hidden="true">▍</span>}
          </span>
          <span className="wave-hand" aria-hidden="true">👋</span>
        </h1>
        <p className="crt-subtext text-slate-400 text-sm sm:text-base md:text-lg lg:text-xl mb-6 sm:mb-12 max-w-2xl mx-auto font-medium leading-relaxed px-2">
          The ultimate repository of lecture notes, past exams, and technical manuals specifically curated for the polytechnic community.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 mb-6 sm:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 bg-[rgba(196,186,189,0.2)]">
          <button 
            className="group w-full sm:w-[240px] md:w-[260px] h-[72px] sm:h-[80px] p-0 bg-white/5 border border-white/10 backdrop-blur-xl rounded-none flex items-center justify-center overflow-hidden hover:bg-rose-900/20 hover:border-rose-500/30 transition-all duration-500 shadow-2xl active:scale-95"
            onClick={() => onViewDashboard('PHYSICAL')}
          >
            <img
              src="/myclasslogo.jpg"
              alt="My Class"
              className="w-full h-full object-contain"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                margin: 0,
                overflow: 'visible',
                borderRadius: 0,
                boxSizing: 'border-box',
                backgroundColor: 'rgba(0, 0, 0, 1)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'rgba(0, 0, 0, 1)',
                borderImage: 'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 1) 0%, rgba(255, 255, 255, 1) 100%) 1',
                boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
                padding: 0,
                color: 'rgba(255, 255, 255, 1)',
              }}
            />
          </button>

          <div className="flex flex-col gap-3 sm:gap-4">
            <button 
              className="group w-full sm:w-[240px] md:w-[260px] h-[72px] sm:h-[80px] p-0 bg-white/5 border border-[rgba(252,252,252,0.1)] text-[rgba(63,13,13,1)] font-thin backdrop-blur-xl rounded-none flex items-center justify-center gap-0 overflow-hidden hover:bg-rose-900/20 hover:border-rose-500/30 transition-all duration-500 shadow-2xl active:scale-95"
              onClick={onBrowse}
            >
              <img
                src="/e-library.jpg"
                alt="Library"
                className="w-full h-full object-cover"
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  margin: 0,
                  overflow: 'visible',
                  borderRadius: 0,
                  boxSizing: 'border-box',
                  backgroundColor: 'rgba(255, 255, 255, 1)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: 'rgba(255, 255, 255, 1)',
                  boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                }}
              />
            </button>

            <button 
              className="group w-full sm:w-[240px] md:w-[260px] h-[72px] sm:h-[80px] p-0 bg-[rgba(79,17,17,0.05)] border border-[rgba(92,16,16,0.1)] text-[#521414] backdrop-blur-xl rounded-none flex items-center justify-center gap-0 overflow-hidden hover:bg-rose-900/20 hover:border-rose-500/30 transition-all duration-500 shadow-2xl active:scale-95"
              onClick={onOpenClassnet}
              style={{ backgroundClip: 'unset', WebkitBackgroundClip: 'unset' }}
            >
              <span className="shine-wrap">
                <img
                  src="/bondify.png"
                  alt="Bondify"
                  className="w-full h-full object-contain"
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    margin: 0,
                    overflow: 'hidden',
                    borderRadius: 0,
                    boxSizing: 'content-box',
                    backgroundColor: 'rgba(255, 255, 255, 1)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: 'rgba(0, 0, 0, 1)',
                    borderImage: 'linear-gradient(90deg, rgba(223, 216, 216, 1) 0%, rgba(0, 0, 0, 1) 100%) 1',
                    boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
                    padding: 0,
                    display: 'flex',
                    flexWrap: 'wrap',
                    color: 'rgba(118, 25, 25, 1)',
                  }}
                />
              </span>
            </button>
          </div>
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