import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Resource, ResourceType } from './types.ts';
import { MOCK_RESOURCES, DEPARTMENTS } from './constants.ts';
import Navbar from './components/Navbar.tsx';
import Sidebar from './components/Sidebar.tsx';
import ResourceGrid from './components/ResourceGrid.tsx';
import Hero from './components/Hero.tsx';
import StaffDashboardHome from './components/Dashboard.tsx';
import Login from './components/Login.tsx';
import StudentClasses from './components/StudentClasses.tsx';
import Profile from './components/Profile.tsx';
import RecordedClassesLibrary from './components/RecordedClassesLibrary.tsx';
import Classnet from './components/Classnet.tsx';
import { BookOpen, Search, X } from 'lucide-react';
import { requireSupabaseAuth } from './lib/supabaseAuthClient';
import { getStoredProfile, isProfileComplete, primeProfileCache } from './lib/profile';

const getLecturerPreview = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('lecturer_preview') === '1';
};

const App: React.FC = () => {
  const MESS_URL = 'http://127.0.0.1:3000';
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoadingMessage, setAuthLoadingMessage] = useState('Loading portal...');
  const [resources, setResources] = useState<Resource[]>(MOCK_RESOURCES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ResourceType | 'ALL'>('ALL');
  const [view, setView] = useState<'home' | 'browse' | 'dashboard' | 'classes' | 'profile' | 'recordings' | 'classnet' | 'mess'>('home');
  const [studentDashTab, setStudentDashTab] = useState<'PHYSICAL' | 'ONLINE'>('PHYSICAL');
  const [messFrameLoaded, setMessFrameLoaded] = useState(false);
  const [messFrameTimedOut, setMessFrameTimedOut] = useState(false);
  const [mustCompleteProfile, setMustCompleteProfile] = useState(false);
  const [profileCheckPending, setProfileCheckPending] = useState(false);
  const [staffDashboardForceView, setStaffDashboardForceView] = useState<'HOME' | 'EREPOSITORY' | null>(null);
  const isLecturerPreview = getLecturerPreview();

  const refreshProfileGate = async (portalUser: User) => {
    setProfileCheckPending(true);
    try {
      await primeProfileCache(portalUser.id, portalUser.name);
      const cachedProfile = getStoredProfile(portalUser.id);
      const profileIsComplete = isProfileComplete(cachedProfile, portalUser.role);
      setMustCompleteProfile(!profileIsComplete);
    } finally {
      setProfileCheckPending(false);
    }
  };

  // Supabase session detection (supports OAuth redirect + refresh)
  useEffect(() => {
    let mounted = true;
    const authGuardTimer = window.setTimeout(() => {
      if (!mounted) return;
      setAuthLoadingMessage('Auth check is taking longer than expected. Showing login...');
      setAuthReady(true);
    }, 8000);

    const loadPortalUser = async (authUserId: string) => {
      const supabase = requireSupabaseAuth();

      const { data: row, error } = await supabase
        .from('tknp_users')
        .select('user_id,name,email,role,department,admission_no')
        .eq('user_id', authUserId)
        .single();

      if (error || !row) return null;

      return {
        id: row.user_id,
        name: row.name,
        email: row.email,
        role: row.role as UserRole,
        department: row.department ?? undefined,
        admissionNo: row.admission_no ?? undefined,
      } satisfies User;
    };

    const ensurePortalUser = async (session: any) => {
      const supabase = requireSupabaseAuth();
      const authUserId = session.user.id as string;

      const pendingRole = sessionStorage.getItem('poly_google_oauth_role') as UserRole | null;
      if (pendingRole) sessionStorage.removeItem('poly_google_oauth_role');

      const derivedName =
        (session.user.user_metadata?.name as string | undefined) ||
        (session.user.user_metadata?.full_name as string | undefined) ||
        session.user.email?.split('@')[0] ||
        'Institutional User';

      // If the portal row doesn't exist (fresh OAuth signup), create it.
      const existing = await loadPortalUser(authUserId);
      if (existing) return existing;

      const role = pendingRole ?? UserRole.LECTURER;

      const { error: upsertError } = await supabase.from('tknp_users').upsert(
        {
          user_id: authUserId,
          name: derivedName,
          email: session.user.email,
          role,
          department: null,
          admission_no: null,
        },
        { onConflict: 'user_id' },
      );

      if (upsertError) throw upsertError;

      const created = await loadPortalUser(authUserId);
      return created;
    };

    (async () => {
      try {
        const supabase = requireSupabaseAuth();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!mounted) return;
          setUser(null);
          setAuthReady(true);
          setView('home');
          return;
        }

        const portalUser = await ensurePortalUser(session);
        if (!mounted) return;

        if (portalUser) {
          handleLogin(portalUser, true);
          void refreshProfileGate(portalUser);
        } else {
          setUser(null);
          setView('home');
        }
      } catch (e) {
        console.error('Supabase auth load failed', e);
        if (!mounted) return;
        setUser(null);
        setView('home');
      } finally {
        if (mounted) setAuthReady(true);
      }
    })();

    const supabase = requireSupabaseAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (!session) {
          setUser(null);
          setView('home');
          return;
        }

        const portalUser = await ensurePortalUser(session);
        if (portalUser) {
          handleLogin(portalUser, true);
          void refreshProfileGate(portalUser);
        }
      } catch (err) {
        console.error('Supabase auth state change failed', err);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(authGuardTimer);
      void subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredResources = useMemo(() => {
    return resources.filter(res => {
      const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           res.unitCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           res.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = !selectedDept || res.department === selectedDept;
      
      let matchesType = true;
      if (selectedType !== 'ALL') {
        matchesType = res.type === selectedType;
      }

      return matchesSearch && matchesDept && matchesType;
    });
  }, [resources, searchQuery, selectedDept, selectedType]);

  const handleLogin = (u: User, remember: boolean) => {
    setUser(u);
    setMustCompleteProfile(false);
    const userStr = JSON.stringify(u);

    sessionStorage.setItem('poly_library_user_current', userStr);

    if (u.role !== UserRole.STUDENT) {
      setView('dashboard');
    } else {
      setView('home');
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = requireSupabaseAuth();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setMustCompleteProfile(false);
    setProfileCheckPending(false);
    sessionStorage.removeItem('poly_library_user_current');
    sessionStorage.removeItem('poly_google_oauth_role');
    setView('home');
  };

  const navigateToStudentDashboard = (tab: 'PHYSICAL' | 'ONLINE' = 'PHYSICAL') => {
    setStudentDashTab(tab);
    setView('classes');
  };

  useEffect(() => {
    if (view !== 'mess') return;
    setMessFrameLoaded(false);
    setMessFrameTimedOut(false);
    const timer = window.setTimeout(() => {
      setMessFrameTimedOut(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [view]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center px-6">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#3d0413]" />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">{authLoadingMessage}</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.role !== UserRole.STUDENT && (view === 'dashboard' || view === 'home')) {
    if (isLecturerPreview) {
      return (
        <div className="min-h-screen bg-white">
          <Navbar user={user} onLogout={handleLogout} setView={setView} currentView={view} profileComplete={!mustCompleteProfile} />
          <main className="flex-1 p-4 md:p-10 overflow-y-auto bg-slate-50/50 max-w-screen-2xl mx-auto w-full">
            <StudentClasses initialTab="ONLINE" isLecturerPreview />
          </main>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white">
        <Navbar user={user} onLogout={handleLogout} setView={setView} currentView={view} profileComplete={!mustCompleteProfile} />
        <StaffDashboardHome
          user={user}
          resources={resources}
          onOpenRepository={() => setView('browse')}
          forceView={staffDashboardForceView}
          onForceViewHandled={() => setStaffDashboardForceView(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-[#3d0413] selection:text-white">
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        setView={(v) => {
          if (v === 'classes') navigateToStudentDashboard('PHYSICAL');
          else setView(v as any);
        }} 
        currentView={view}
        profileComplete={!mustCompleteProfile}
      />
      {profileCheckPending && (
        <div className="bg-[#3d0413] text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 text-center">
          Verifying profile...
        </div>
      )}
      
      <main className="flex-1 flex flex-col md:flex-row">
        {view === 'browse' && (
          <Sidebar 
            selectedDept={selectedDept} 
            onSelectDept={setSelectedDept} 
            userRole={user.role}
            onOpenLibraryManager={() => {
              if (user.role === UserRole.LECTURER || user.role === UserRole.ADMIN) {
                setStaffDashboardForceView('EREPOSITORY');
                setView('dashboard');
              }
            }}
          />
        )}
        
        <div
          className={`flex-1 overflow-y-auto bg-slate-50/50 ${
            view === 'classnet' || view === 'mess' ? 'p-0' : 'p-4 md:p-10'
          } ${view === 'dashboard' || view === 'classes' ? 'max-w-screen-2xl mx-auto w-full' : ''}`}
        >
          {(view === 'home' || view === 'dashboard') && (
            <>
              <Hero 
                user={user} 
                onSearch={setSearchQuery} 
                onBrowse={() => setView('browse')} 
                onViewDashboard={() => navigateToStudentDashboard('PHYSICAL')}
                onOpenClassnet={() => setView('classnet')}
                onOpenMess={() => setView('mess')}
              />
              <div className="mt-8 sm:mt-16">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-6 sm:mb-8">
                   <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2 sm:gap-3">
                    <span className="w-1.5 sm:w-2 h-6 sm:h-8 bg-[#3d0413] rounded-full"></span>
                    Knowledge Stream
                  </h2>
                  <button onClick={() => setView('browse')} className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#3d0413] hover:underline self-start sm:self-auto">View All Repository</button>
                </div>
                <ResourceGrid resources={resources.slice(0, 4)} />
              </div>
            </>
          )}

          {view === 'browse' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-6 sm:mb-10 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex gap-2 p-2 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 min-w-max sm:min-w-0 sm:flex-wrap">
                  {[
                    { label: 'All', type: 'ALL', icon: '📁' },
                    { label: 'Notes', type: ResourceType.LECTURE_NOTE, icon: '📄' },
                    { label: 'Exams', type: ResourceType.PAST_PAPER, icon: '📝' },
                    { label: 'Manuals', type: ResourceType.TECHNICAL_MANUAL, icon: '⚙️' },
                    { label: 'E-Books', type: ResourceType.EBOOK, icon: '📚' },
                    { label: 'Videos', type: ResourceType.VIDEO, icon: '🎥' },
                  ].map((cat) => (
                    <button
                      key={cat.label}
                      onClick={() => setSelectedType(cat.type as any)}
                      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap ${
                        selectedType === cat.type 
                          ? 'bg-[#3d0413] text-white shadow-xl shadow-[#3d0413]/20' 
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6 sm:mb-12 relative group">
                <input
                  type="text"
                  placeholder="Search catalog..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 sm:pl-14 pr-10 sm:pr-14 py-4 sm:py-5 bg-white border border-slate-200 rounded-xl sm:rounded-[2rem] text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-[#3d0413]/5 transition-all"
                />
                <Search size={18} className="sm:w-[22px] sm:h-[22px] absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#3d0413] transition-colors" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-600 transition-colors"
                  >
                    <X size={18} className="sm:w-5 sm:h-5" />
                  </button>
                )}
              </div>

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-12">
                <div>
                  <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none mb-2 sm:mb-4">
                    {selectedDept || 'Institutional Catalog'}
                  </h2>
                  <p className="text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.4em] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3d0413]"></span>
                    {selectedType === 'ALL' ? 'Unfiltered Access' : `Viewing ${selectedType.replace('_', ' ')}`}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-3 sm:gap-4 self-start md:self-auto">
                   <span className="text-xl sm:text-2xl font-black text-[#3d0413] leading-none">{filteredResources.length}</span>
                   <div className="h-5 sm:h-6 w-px bg-slate-100"></div>
                   <span className="text-slate-400 font-black text-[9px] sm:text-[10px] uppercase tracking-widest leading-none">Items</span>
                </div>
              </div>
              <ResourceGrid resources={filteredResources} />
            </div>
          )}

          {view === 'classes' && user.role === UserRole.STUDENT && (
            <StudentClasses initialTab={studentDashTab} onNavigateToProfile={() => setView('profile')} />
          )}

          {view === 'profile' && (
            <Profile
              user={user}
              forceComplete={mustCompleteProfile}
              onClose={() => setView(user.role === UserRole.STUDENT ? 'home' : 'dashboard')}
              onSaved={() => {
                setMustCompleteProfile(false);
                setView(user.role === UserRole.STUDENT ? 'home' : 'dashboard');
              }}
            />
          )}

          {view === 'recordings' && (
            <RecordedClassesLibrary />
          )}

          {view === 'classnet' && (
            <Classnet user={user} onExit={() => setView('home')} />
          )}

          {view === 'mess' && (
            <div className="h-full min-h-[75vh] bg-slate-950 p-2 sm:p-3">
              {!messFrameLoaded && (
                <div className="mb-2 rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-200">
                  {messFrameTimedOut
                    ? `Mess app is not reachable on ${MESS_URL}. Start it in the Mess folder with npm run dev.`
                    : 'Loading Mess app...'}
                </div>
              )}
              <iframe
                title="Mess"
                src={MESS_URL}
                onLoad={() => setMessFrameLoaded(true)}
                className="w-full h-[78vh] rounded-xl border border-slate-800 bg-white"
              />
            </div>
          )}

        </div>
      </main>

      <footer className="bg-slate-950 text-white p-6 sm:p-12 md:p-20 mt-auto relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-[#3d0413]/10 rounded-full blur-[60px] sm:blur-[100px] -mr-24 sm:-mr-48 -mt-24 sm:-mt-48"></div>
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 md:gap-16 relative z-10">
          <div className="col-span-1 sm:col-span-2">
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 shadow-2xl border border-white/10 overflow-hidden">
                <img
                  src="/tknp-logo.png"
                  alt="TKNP Logo"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
               <div className="flex flex-col">
                  <h3 className="text-sm sm:text-lg font-black leading-none uppercase tracking-tight text-white">The Kitale National</h3>
                  <h3 className="text-sm sm:text-lg font-black leading-none uppercase tracking-tight text-rose-600 mt-0.5 sm:mt-1">Polytechnic E-Learning</h3>
               </div>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm max-w-sm leading-relaxed font-medium">
              The official digital asset gateway for TKNP. Designed for excellence in technical vocational education and training.
            </p>
          </div>
          <div>
            <h4 className="font-black text-[9px] sm:text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.4em] text-rose-600 mb-4 sm:mb-8">E-Learning Portal</h4>
            <ul className="text-slate-400 text-[10px] sm:text-xs space-y-3 sm:space-y-4 font-bold uppercase tracking-wider sm:tracking-widest">
              <li><button onClick={() => setView('browse')} className="hover:text-white transition">Repository</button></li>
              <li><button onClick={() => navigateToStudentDashboard('PHYSICAL')} className="hover:text-white transition">My Workspace</button></li>
              <li><a href="#" className="hover:text-white transition">Audit Logs</a></li>
              <li><a href="#" className="hover:text-white transition">Legal & IP</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-[9px] sm:text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.4em] text-rose-600 mb-4 sm:mb-8">Help Desk</h4>
            <p className="text-slate-400 text-[10px] sm:text-xs space-y-3 font-medium">
              Kapenguria Road, Kitale, Kenya<br />
              <span className="block mt-3 sm:mt-4 font-black text-white break-all">library@polytechnic.ac.ke</span>
              <span className="block font-black text-white">+254 700 000 000</span>
            </p>
          </div>
        </div>
        <div className="border-t border-white/5 mt-10 sm:mt-20 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-slate-500 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-center md:text-left">
          <span>&copy; 2024 TKNP Digital Library System.</span>
          <div className="flex gap-4 sm:gap-8">
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Terms</a>
            <a href="#" className="hover:text-white">Status: Live</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
