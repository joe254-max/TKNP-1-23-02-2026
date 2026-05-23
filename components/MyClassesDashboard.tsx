import React, { useMemo } from 'react';
import { User } from '../types';
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  ChartPie,
  Compass,
  MessageSquare,
  Sparkles,
  Trophy,
  Users,
  Zap,
  Clock,
  BookOpen,
  LayoutDashboard,
  Settings,
  Certificate,
  GraduationCap,
} from 'lucide-react';

interface MyClassesDashboardProps {
  user: User;
  onNavigateToProfile: () => void;
}

const continueLearning = [
  {
    id: 'c1',
    title: 'Advanced OOP Patterns',
    course: 'Object Oriented Programming',
    lesson: 'Inheritance & Dependency Injection',
    progress: 0.56,
    eta: '18 min',
    thumbnail: '/myclasslogo.jpg',
  },
  {
    id: 'c2',
    title: 'Live Teams Lab',
    course: 'Programming Basics',
    lesson: 'Debugging Real-Time Peer Code',
    progress: 0.38,
    eta: '24 min',
    thumbnail: '/myclasslogo.jpg',
  },
];

const classCards = [
  {
    id: 's1',
    title: 'Power Systems II',
    instructor: 'Dr. Kamau',
    progress: 0.72,
    module: 'Transformers & Grid Stability',
    deadline: 'May 18',
    difficulty: 'Intermediate',
    engagement: 84,
    badge: 'Focus',
    type: 'PHYSICAL',
    color: 'from-rose-500 to-pink-500',
  },
  {
    id: 's2',
    title: 'Object Oriented Programming',
    instructor: 'Dr. Wangari',
    progress: 0.48,
    module: 'Class Design Patterns',
    deadline: 'May 20',
    difficulty: 'Advanced',
    engagement: 91,
    badge: 'Recommended',
    type: 'ONLINE',
    color: 'from-sky-500 to-cyan-500',
  },
  {
    id: 's3',
    title: 'Entrepreneurship',
    instructor: 'Mrs. Njeri',
    progress: 0.23,
    module: 'Market Research Sprint',
    deadline: 'May 22',
    difficulty: 'Beginner',
    engagement: 68,
    badge: 'Boost',
    type: 'ONLINE',
    color: 'from-emerald-500 to-lime-500',
  },
];

const recommendations = [
  {
    id: 'r1',
    title: 'Revision: Circuit Design',
    subtitle: 'Recommended for your next lab session',
    tag: 'Revision',
  },
  {
    id: 'r2',
    title: 'AI-Picked Project',
    subtitle: 'Build a campus automation dashboard',
    tag: 'Project',
  },
  {
    id: 'r3',
    title: 'Certification Track',
    subtitle: 'Earn a Digital Systems badge',
    tag: 'Certification',
  },
];

const notifications = [
  { id: 'n1', text: 'Assignment due tomorrow for Power Systems II.', time: '1h ago' },
  { id: 'n2', text: 'New AI study path generated for OOP.', time: '3h ago' },
  { id: 'n3', text: 'Live class reminder: Entrepreneurship starts in 20 min.', time: '5h ago' },
];

const analyticsCards = [
  { id: 'a1', label: 'Learning Streak', value: '7 days', icon: Sparkles },
  { id: 'a2', label: 'XP Earned', value: '1,420', icon: Zap },
  { id: 'a3', label: 'Completion Rate', value: '68%', icon: Trophy },
];

const sidebarLinks = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'classes', label: 'My Classes', icon: GraduationCap },
  { id: 'assignments', label: 'Assignments', icon: CalendarCheck },
  { id: 'ai', label: 'AI Tutor', icon: MessageSquare },
  { id: 'notes', label: 'Notes', icon: BookOpen },
  { id: 'certificates', label: 'Certificates', icon: Certificate },
  { id: 'analytics', label: 'Analytics', icon: ChartPie },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const MyClassesDashboard: React.FC<MyClassesDashboardProps> = ({ user, onNavigateToProfile }) => {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_380px]">
      <aside className="hidden xl:block rounded-[2rem] border border-slate-200/60 bg-white/80 backdrop-blur-xl p-6 shadow-lg shadow-slate-900/5 sticky top-6 h-fit">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-400 font-black mb-3">Workspace</div>
          <div className="text-2xl font-black text-slate-950">My Classes</div>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">Futuristic learning dashboard with AI-guided workstreams and progress insights.</p>
        </div>

        <nav className="space-y-2">
          {sidebarLinks.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'classes';
            return (
              <button
                key={item.id}
                className={`w-full flex items-center gap-3 rounded-3xl px-4 py-3 text-left text-sm font-semibold transition ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon size={18} />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-8 rounded-[2rem] border border-slate-200/70 bg-slate-950/95 p-5 text-white shadow-xl shadow-slate-950/10">
          <div className="text-xs uppercase tracking-[0.35em] text-slate-400 mb-3">Your next milestone</div>
          <div className="text-lg font-black">Course mastery in 4 weeks</div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">Complete the current project path to unlock a new certification and AI mentor badge.</p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-3xl bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-[0.4em] text-slate-500 mb-2">Current streak</div>
              <div className="text-3xl font-black">7</div>
              <div className="text-xs text-slate-400 mt-1">days of continuous learning</div>
            </div>
            <div className="rounded-3xl bg-white/5 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Level</div>
                <div className="text-2xl font-black">12</div>
              </div>
              <Sparkles size={24} className="text-amber-300" />
            </div>
          </div>
        </div>
      </aside>

      <section className="space-y-6">
        <div className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-xl shadow-slate-900/5">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400 font-black">{greeting}, {user.name.split(' ')[0]}.</p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black text-slate-950 leading-tight">Your adaptive learning command center</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-500">Monday is a perfect day to finish your current lesson, revise a weak topic, and ask the AI tutor for a summary.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {analyticsCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.id} className="rounded-3xl border border-slate-200/80 bg-slate-950/95 p-4 text-white">
                    <div className="flex items-center gap-2 text-slate-300 text-xs uppercase tracking-[0.35em] font-black mb-3">
                      <Icon size={14} />
                      {stat.label}
                    </div>
                    <div className="text-2xl font-black">{stat.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#111827] to-[#151f3f] text-white p-6 shadow-2xl shadow-slate-950/20 border border-white/10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400 font-black">Continue learning</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">Pick up where you left off</h2>
                </div>
                <button className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.35em] text-white hover:bg-white/15 transition">
                  <ArrowRight size={16} /> Continue
                </button>
              </div>
              <div className="mt-6 space-y-4">
                {continueLearning.map((item) => (
                  <div key={item.id} className="group rounded-[2rem] border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-3xl border border-white/10 bg-slate-900 overflow-hidden">
                          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm uppercase tracking-[0.25em] text-slate-400 font-black">{item.course}</p>
                          <h3 className="text-xl font-black text-white">{item.title}</h3>
                          <p className="text-sm text-slate-300">{item.lesson} · {item.eta} remaining</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-400 font-black">Progress</p>
                        <p className="mt-1 text-2xl font-black">{Math.round(item.progress * 100)}%</p>
                      </div>
                    </div>
                    <div className="mt-5 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500" style={{ width: `${item.progress * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {classCards.map((card) => (
                <div key={card.id} className="rounded-[2rem] border border-slate-200/70 bg-white p-5 shadow-lg shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500 font-black">{card.type}</p>
                      <h3 className="mt-3 text-xl font-black text-slate-950">{card.title}</h3>
                      <p className="mt-2 text-sm text-slate-500">{card.module}</p>
                    </div>
                    <div className={`rounded-3xl bg-gradient-to-br ${card.color} p-3 text-white text-xs font-black uppercase tracking-[0.35em]`}>{card.badge}</div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>{card.instructor}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                    <span>Due {card.deadline}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                    <span>{card.difficulty}</span>
                  </div>
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] font-black text-slate-400 mb-2">
                      <span>Engagement</span>
                      <span>{card.engagement}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${card.engagement}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-900/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500 font-black">Recommendation Engine</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">AI Study Path</h2>
                </div>
                <button className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.35em] text-white hover:bg-slate-800 transition">
                  <Compass size={16} /> Refresh
                </button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {recommendations.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-slate-200/80 bg-slate-950/5 p-4 hover:border-slate-300 transition">
                    <div className="text-[10px] uppercase tracking-[0.4em] text-slate-400 font-black mb-3">{item.tag}</div>
                    <h3 className="text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{item.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-900/5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400 font-black">AI Tutor</p>
                  <h2 className="text-2xl font-black text-slate-950">Ask your study assistant</h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.35em] text-emerald-700">
                  <Sparkles size={14} /> Live
                </span>
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl bg-slate-950/95 p-4 text-white">
                  <p className="text-sm leading-relaxed">"It looks like you are progressing well in OOP. Review the last quiz and then ask me to generate a mini flashcard set for transformers."</p>
                </div>
                <div className="space-y-3">
                  {['Explain the last class summary', 'Generate a mini quiz', 'Show weak topics', 'Create flashcards'].map((label) => (
                    <button key={label} className="w-full rounded-3xl border border-slate-200/80 bg-white/95 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 transition">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-900/5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400 font-black">Notifications</p>
                  <h2 className="text-2xl font-black text-slate-950">Live alerts</h2>
                </div>
                <Bell size={20} className="text-slate-500" />
              </div>
              <div className="space-y-3">
                {notifications.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-slate-200/80 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">{item.text}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.35em] text-slate-400">{item.time}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-900/5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400 font-black">Quick Actions</p>
                  <h2 className="text-xl font-black text-slate-950">Momentum tools</h2>
                </div>
                <Clock size={20} className="text-slate-500" />
              </div>
              <div className="grid gap-3">
                <button className="rounded-3xl border border-slate-200/80 bg-slate-950/95 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-slate-900 transition">Resume last lesson</button>
                <button className="rounded-3xl border border-slate-200/80 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-950 hover:bg-slate-50 transition">Review weak topics</button>
                <button onClick={onNavigateToProfile} className="rounded-3xl border border-slate-200/80 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-950 hover:bg-slate-50 transition">Open profile & goals</button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default MyClassesDashboard;
