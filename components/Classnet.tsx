import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../types';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import {
  Bell,
  Bookmark,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Globe,
  Grid3X3,
  HeartHandshake,
  MapPin,
  MonitorPlay,
  Package,
  SmilePlus,
  Store,
  UsersRound,
  Gamepad2,
  Heart,
  Home,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  Settings,
  Share2,
  ThumbsUp,
  Users,
  UserCircle,
  UserPlus,
  Video,
  X,
} from 'lucide-react';

type Visibility = 'PUBLIC' | 'SCHOOL' | 'CLASS_ONLY';
type ClassnetTab = 'HOME' | 'VIDEO' | 'LIVE' | 'MARKET' | 'GROUPS' | 'EVENTS' | 'MESSAGES' | 'PROFILE' | 'SETTINGS';

type ClassnetProfile = {
  displayName: string;
  headline: string;
  department?: string;
  avatarDataUrl?: string | null;
};

type Reaction = { userId: string; type: 'LIKE' | 'HEART' };
type Comment = { id: string; authorId: string; authorName: string; message: string; createdAt: string };
type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  createdAt: string;
  visibility: Visibility;
  text: string;
  imageDataUrl?: string | null;
  reactions: Reaction[];
  comments: Comment[];
};

type MarketplaceListing = {
  id: string;
  title: string;
  priceKsh: number;
  category: 'Books' | 'Electronics' | 'Services' | 'Hostel' | 'Other';
  description: string;
  imageDataUrl?: string | null;
  sellerId: string;
  sellerName: string;
  createdAt: string;
};

type ClassnetGroup = {
  id: string;
  name: string;
  description: string;
  isJoined: boolean;
  memberCount: number;
};

type ClassnetEvent = {
  id: string;
  title: string;
  location: string;
  startAt: string;
  endAt?: string;
  description: string;
  rsvp: 'GOING' | 'INTERESTED' | 'NONE';
};

type MessageThread = {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
};

type LiveAudience = 'SCHOOL' | 'DEPARTMENT' | 'CLASS_ONLY';
type LiveType = 'CLASS' | 'EVENT' | 'CLUB' | 'ANNOUNCEMENT';
type LiveSession = {
  id: string;
  title: string;
  hostId?: string;
  hostName: string;
  type: LiveType;
  audience: LiveAudience;
  viewerCount: number;
  startedAt: string;
  isLive: boolean;
  scheduledAt?: string;
  inviteCode?: string;
  passkey?: string;
};

type Story = {
  id: string;
  authorName: string;
  imageDataUrl?: string | null;
  isMine?: boolean;
};

type Reel = {
  id: string;
  authorName: string;
  caption: string;
  audio: string;
  topic?: string;
  takeaways?: string[];
  likes: number;
  comments: number;
  shares: number;
};

type ReelAlgoProfile = {
  topicAffinity: Record<string, number>;
  creatorAffinity: Record<string, number>;
  seen: Record<string, number>; // reelId -> lastSeenTs
};

type ReelAggregateStats = Record<
  string,
  {
    views: number;
    viewMs: number;
    likes: number;
    saves: number;
    shares: number;
    lastEventTs: number;
  }
>;

type FeedMode = 'RANKED' | 'RECENT';

const STORAGE = {
  PROFILE: 'classnet_profile_v1',
  POSTS: 'classnet_posts_v1',
  NOTIFS: 'classnet_notifs_v1',
  LISTINGS: 'classnet_market_listings_v1',
  GROUPS: 'classnet_groups_v1',
  EVENTS: 'classnet_events_v1',
  REEL_DECK: 'classnet_reel_study_deck_v1',
  REEL_PROFILE: 'classnet_reel_algo_profile_v1',
  REEL_STATS: 'classnet_reel_aggregate_stats_v1',
  LIVE_CHAT: 'classnet_live_chat_v1',
};

function userScopedKey(base: string, userId?: string) {
  return userId ? `${base}:${userId}` : base;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatTime(ts: string) {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

function moneyKsh(n: number) {
  try {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `KES ${Math.round(n)}`;
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function nowTs() {
  return Date.now();
}

async function fileToDataUrl(file: File): Promise<string> {
  const maxSize = 1_800_000; // ~1.8MB
  if (file.size > maxSize) throw new Error('Image too large. Please use a smaller image.');
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

const seedPosts = (user: User): Post[] => {
  const now = new Date().toISOString();
  return [
    {
      id: `seed-${Date.now()}-1`,
      authorId: 'tknp-admin',
      authorName: 'TKNP Classnet',
      authorAvatar: null,
      createdAt: now,
      visibility: 'SCHOOL',
      text:
        'Welcome to Classnet. This is the official campus social feed for announcements, class updates, and community posts.',
      imageDataUrl: null,
      reactions: [{ userId: user.id, type: 'LIKE' }],
      comments: [
        {
          id: `c-${Date.now()}-1`,
          authorId: user.id,
          authorName: user.name,
          message: 'Glad to be here.',
          createdAt: now,
        },
      ],
    },
  ];
};

const seedGroups = (): ClassnetGroup[] => [
  { id: 'g-ict', name: 'ICT Department', description: 'Updates, help, and peer learning for ICT students.', isJoined: true, memberCount: 842 },
  { id: 'g-elec', name: 'Electrical Engineering', description: 'Labs, projects, wiring tips and class announcements.', isJoined: false, memberCount: 512 },
  { id: 'g-market', name: 'Hostel Marketplace', description: 'Buy/sell within campus. Keep it safe and respectful.', isJoined: true, memberCount: 1290 },
  { id: 'g-sports', name: 'Sports & Fitness', description: 'Fixtures, tryouts and training schedules.', isJoined: false, memberCount: 376 },
];

const seedEvents = (): ClassnetEvent[] => {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 16, 0).toISOString();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 18, 0).toISOString();
  return [
    {
      id: 'e-1',
      title: 'Library Orientation: Research & Referencing',
      location: 'Main Library Hall',
      startAt: start,
      endAt: end,
      description: 'Learn how to find credible sources, use citations, and avoid plagiarism.',
      rsvp: 'NONE',
    },
    {
      id: 'e-2',
      title: 'Department Meetup: ICT Project Showcase',
      location: 'ICT Lab 2',
      startAt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3, 14, 0).toISOString(),
      endAt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3, 16, 30).toISOString(),
      description: 'Show your mini-project, get feedback, and find teammates.',
      rsvp: 'INTERESTED',
    },
  ];
};

const seedListings = (user: User): MarketplaceListing[] => [
  {
    id: `l-${Date.now()}-1`,
    title: 'Calculus II Handbook (Clean)',
    priceKsh: 350,
    category: 'Books',
    description: 'Gently used, no missing pages. Pickup near library.',
    imageDataUrl: null,
    sellerId: user.id,
    sellerName: user.name,
    createdAt: new Date().toISOString(),
  },
];

const seedLives = (): LiveSession[] => {
  // Start with no demo sessions; only show lives created in this browser.
  return [];
};

const Classnet: React.FC<{ user: User; onExit: () => void }> = ({ user, onExit }) => {
  const [tab, setTab] = useState<ClassnetTab>('HOME');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedMode, setFeedMode] = useState<FeedMode>('RANKED');
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerVisibility, setComposerVisibility] = useState<Visibility>('SCHOOL');
  const [composerImage, setComposerImage] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [appsOpen, setAppsOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);

  const reduceMotion = useReducedMotion();

  const profileKey = userScopedKey(STORAGE.PROFILE, user.id);
  const [profile, setProfile] = useState<ClassnetProfile>(() => {
    const p = safeParse<ClassnetProfile | null>(localStorage.getItem(profileKey), null);
    return (
      p ?? {
        displayName: user.name,
        headline: 'Student · TKNP',
        avatarDataUrl: null,
      }
    );
  });
  const [peopleResults, setPeopleResults] = useState<{ userId: string; displayName: string; headline?: string | null; avatarUrl?: string | null }[]>([]);
  const [peopleSearchOpen, setPeopleSearchOpen] = useState(false);
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>(() => {
    const loaded = safeParse<Post[]>(localStorage.getItem(STORAGE.POSTS), []);
    if (loaded.length > 0) return loaded;
    return seedPosts(user);
  });

  const [listings, setListings] = useState<MarketplaceListing[]>(() => {
    const loaded = safeParse<MarketplaceListing[]>(localStorage.getItem(STORAGE.LISTINGS), []);
    if (loaded.length > 0) return loaded;
    return seedListings(user);
  });

  const [groups, setGroups] = useState<ClassnetGroup[]>(() => {
    const loaded = safeParse<ClassnetGroup[]>(localStorage.getItem(STORAGE.GROUPS), []);
    if (loaded.length > 0) return loaded;
    return seedGroups();
  });

  const [events, setEvents] = useState<ClassnetEvent[]>(() => {
    const loaded = safeParse<ClassnetEvent[]>(localStorage.getItem(STORAGE.EVENTS), []);
    if (loaded.length > 0) return loaded;
    return seedEvents();
  });

  const [notifs, setNotifs] = useState<{ id: string; text: string; createdAt: string }[]>(() =>
    safeParse(localStorage.getItem(STORAGE.NOTIFS), [])
  );

  const [liveSessions, setLiveSessions] = useState<LiveSession[]>(() => seedLives());

  useEffect(() => {
    localStorage.setItem(profileKey, JSON.stringify(profile));
  }, [profile, profileKey]);

  // Supabase: upsert my profile for search + profile pages
  useEffect(() => {
    if (!supabase) return;
    const doUpsert = async () => {
      await supabase.from('classnet_profiles').upsert({
        user_id: user.id,
        display_name: profile.displayName || user.name,
        headline: profile.headline || null,
        department: profile.department || null,
        avatar_url: profile.avatarDataUrl || null,
        last_seen_at: new Date().toISOString(),
      });
    };
    void doUpsert();
  }, [user.id, user.name, profile.displayName, profile.headline, profile.department, profile.avatarDataUrl]);

  // Supabase: people search results for query
  useEffect(() => {
    if (!supabase) return;
    const q = query.trim();
    if (q.length < 2) {
      setPeopleResults([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const { data, error } = await supabase
        .from('classnet_profiles')
        .select('user_id,display_name,headline,avatar_url')
        .ilike('display_name', `%${q}%`)
        .limit(8);
      if (cancelled) return;
      if (error) return;
      setPeopleResults(
        (data || []).map((r: any) => ({
          userId: r.user_id,
          displayName: r.display_name,
          headline: r.headline,
          avatarUrl: r.avatar_url,
        }))
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    localStorage.setItem(STORAGE.POSTS, JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem(STORAGE.LISTINGS, JSON.stringify(listings));
  }, [listings]);

  useEffect(() => {
    localStorage.setItem(STORAGE.GROUPS, JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem(STORAGE.EVENTS, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem(STORAGE.NOTIFS, JSON.stringify(notifs));
  }, [notifs]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? posts
      : posts.filter((p) => (p.text || '').toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q));

    if (feedMode === 'RECENT') {
      return [...base].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }

    const score = (p: Post) => {
      const ageHrs = Math.max(0.1, (Date.now() - new Date(p.createdAt).getTime()) / 36e5);
      const likes = p.reactions.filter((r) => r.type === 'LIKE').length;
      const hearts = p.reactions.filter((r) => r.type === 'HEART').length;
      const comments = p.comments.length;
      const engagement = likes * 1.0 + hearts * 1.1 + comments * 1.6;
      const recency = 1 / Math.pow(ageHrs + 1, 0.85);
      const mediaBoost = p.imageDataUrl ? 0.15 : 0;
      return recency * (1 + engagement * 0.18) + mediaBoost;
    };

    return [...base].sort((a, b) => score(b) - score(a));
  }, [posts, query, feedMode]);

  const addNotif = (text: string) => {
    setNotifs((prev) => [{ id: `n-${Date.now()}`, text, createdAt: new Date().toISOString() }, ...prev].slice(0, 20));
  };

  const navigate = (next: ClassnetTab) => {
    setTab(next);
    setAppsOpen(false);
    setNotifsOpen(false);
    setSearchOpen(false);
    try {
      const scroller = document.querySelector('main > div.overflow-y-auto') as HTMLElement | null;
      (scroller ?? window).scrollTo({ top: 0, behavior: 'smooth' as ScrollBehavior });
    } catch {
      // ignore
    }
  };

  const toggleReaction = (postId: string, type: Reaction['type']) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const has = p.reactions.some((r) => r.userId === user.id && r.type === type);
        const nextReactions = has ? p.reactions.filter((r) => !(r.userId === user.id && r.type === type)) : [...p.reactions, { userId: user.id, type }];
        return { ...p, reactions: nextReactions };
      })
    );
  };

  const addComment = (postId: string, message: string) => {
    const msg = message.trim();
    if (!msg) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const c: Comment = {
          id: `cm-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          authorId: user.id,
          authorName: profile.displayName || user.name,
          message: msg,
          createdAt: new Date().toISOString(),
        };
        return { ...p, comments: [...p.comments, c] };
      })
    );
  };

  const createPost = () => {
    const text = composerText.trim();
    if (!text && !composerImage) {
      setComposerError('Write something or add an image.');
      return;
    }
    const p: Post = {
      id: `p-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      authorId: user.id,
      authorName: profile.displayName || user.name,
      authorAvatar: profile.avatarDataUrl ?? null,
      createdAt: new Date().toISOString(),
      visibility: composerVisibility,
      text,
      imageDataUrl: composerImage,
      reactions: [],
      comments: [],
    };
    setPosts((prev) => [p, ...prev]);
    setComposerText('');
    setComposerImage(null);
    setComposerVisibility('SCHOOL');
    setComposerError(null);
    setComposerOpen(false);
    addNotif('Your post is live on Classnet.');
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const appsRef = useRef<HTMLDivElement | null>(null);
  const notifsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (appsRef.current && !appsRef.current.contains(t)) setAppsOpen(false);
      if (notifsRef.current && !notifsRef.current.contains(t)) setNotifsOpen(false);
      if (searchRef.current && !searchRef.current.contains(t)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const id = window.setTimeout(() => {
      try {
        searchInputRef.current?.focus();
      } catch {
        // ignore
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [searchOpen]);

  return (
    <div className="min-h-full bg-[#f0f2f5]">
      {/* Top bar (Facebook-like) */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 py-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-3 min-w-0">
          {/* Left */}
          <div className="flex items-center gap-3 pr-2 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              <img src="/classnet-logo.png" alt="Classnet" className="w-full h-full object-contain" draggable={false} />
            </div>

            {/* Desktop search (Facebook-style) */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 border border-slate-200 w-[360px] max-w-[40vw] min-w-0">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setPeopleSearchOpen(true)}
                placeholder="Search Classnet"
                className="bg-transparent outline-none w-full text-sm font-bold text-slate-700 placeholder:text-slate-400"
              />
            </div>

          {/* People search dropdown (desktop) */}
          {peopleSearchOpen && query.trim().length >= 2 && (
            <div className="hidden md:block absolute left-0 top-full mt-2 w-[420px] max-w-[60vw] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">People</p>
                <button type="button" onClick={() => setPeopleSearchOpen(false)} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200">
                  <X size={16} />
                </button>
              </div>
              {peopleResults.length === 0 ? (
                <div className="p-4">
                  <p className="text-sm font-bold text-slate-500">No matches yet.</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">Tip: users appear after they open Classnet at least once.</p>
                </div>
              ) : (
                <div className="p-2">
                  {peopleResults.map((p) => (
                    <button
                      key={p.userId}
                      type="button"
                      onClick={() => {
                        setViewedUserId(p.userId);
                        setPeopleSearchOpen(false);
                        setTab('PROFILE');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition text-left"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" draggable={false} />
                        ) : (
                          <span className="text-slate-700 font-black">{p.displayName.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900 truncate">{p.displayName}</p>
                        <p className="text-xs font-bold text-slate-500 truncate">{p.headline || 'Classnet user'}</p>
                      </div>
                      <span className="text-xs font-black text-[#2563eb]">View</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>

          {/* Center nav icons (Facebook-style) */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="flex items-center gap-2 px-2">
            {[
              { key: 'HOME' as const, icon: <Home size={20} />, label: 'Home' },
              { key: 'VIDEO' as const, icon: <MonitorPlay size={20} />, label: 'Video' },
              { key: 'MARKET' as const, icon: <Store size={20} />, label: 'Marketplace' },
              { key: 'GROUPS' as const, icon: <UsersRound size={20} />, label: 'Groups' },
              { key: 'EVENTS' as const, icon: <Calendar size={20} />, label: 'Events' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.key)}
                className={`relative w-14 h-10 rounded-2xl flex items-center justify-center transition-all ${
                  tab === item.key ? 'text-[#2563eb]' : 'text-slate-500 hover:text-slate-800'
                } hover:bg-slate-100 active:scale-95`}
                title={item.label}
              >
                {item.icon}
                {tab === item.key && <span className="absolute -bottom-2 left-2 right-2 h-1.5 rounded-full bg-[#2563eb]" />}
              </button>
            ))}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Mobile search (icon -> popover) */}
            <div className="relative shrink-0" ref={searchRef}>
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="md:hidden p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition"
                title="Search"
              >
                <Search size={18} />
              </button>
              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-[min(520px,calc(100vw-2rem))] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
                  >
                    <div className="p-3 flex items-center gap-2 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-slate-200 flex-1 min-w-0 shadow-sm focus-within:ring-4 focus-within:ring-[#3d0413]/5 focus-within:border-[#3d0413]/20 transition">
                        <Search size={16} className="text-slate-400 shrink-0" />
                        <input
                          ref={searchInputRef}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search Classnet..."
                          className="bg-transparent outline-none w-full text-sm font-bold text-slate-800 placeholder:text-slate-400"
                        />
                      </div>
                      <button
                        type="button"
                        className="p-2.5 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 active:scale-95 transition"
                        title="Close"
                        onClick={() => setSearchOpen(false)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">Search scope</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['Posts', 'Groups', 'Listings', 'Events', 'People'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative" ref={appsRef}>
              <button
                type="button"
                className="hidden sm:inline-flex p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition"
                title="Apps"
                onClick={() => setAppsOpen((v) => !v)}
              >
                <Grid3X3 size={18} />
              </button>
              {appsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-[1.5rem] border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">Classnet</p>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Shortcuts</p>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-2">
                    {[
                      { key: 'HOME' as const, label: 'Feed', icon: <Home size={18} /> },
                      { key: 'VIDEO' as const, label: 'Watch', icon: <MonitorPlay size={18} /> },
                      { key: 'LIVE' as const, label: 'Live', icon: <Video size={18} /> },
                      { key: 'MARKET' as const, label: 'Market', icon: <Store size={18} /> },
                      { key: 'GROUPS' as const, label: 'Groups', icon: <UsersRound size={18} /> },
                      { key: 'EVENTS' as const, label: 'Events', icon: <Calendar size={18} /> },
                      { key: 'MESSAGES' as const, label: 'Messages', icon: <MessageCircle size={18} /> },
                      { key: 'PROFILE' as const, label: 'Profile', icon: <UserCircle size={18} /> },
                      { key: 'SETTINGS' as const, label: 'Settings', icon: <Settings size={18} /> },
                    ].map((it) => (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => navigate(it.key)}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          tab === it.key ? 'bg-[#fdf2f2] border-rose-200 text-[#3d0413]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                            {it.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-tight">{it.label}</p>
                            <p className="text-[10px] font-bold text-slate-500 truncate">{it.key}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              className="hidden sm:inline-flex p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition"
              title="Messenger"
              onClick={() => navigate('MESSAGES')}
            >
              <MessageCircle size={18} />
            </button>
            <div className="relative" ref={notifsRef}>
              <button
                type="button"
                className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition relative"
                title="Notifications"
                onClick={() => setNotifsOpen((v) => !v)}
              >
                <Bell size={18} />
                {notifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">
                    {Math.min(notifs.length, 99)}
                  </span>
                )}
              </button>
              {notifsOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-[1.5rem] border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">Inbox</p>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Notifications</p>
                    </div>
                    <button type="button" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setNotifs([])} title="Clear">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto p-3 space-y-2">
                    {notifs.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No notifications yet.</p>
                      </div>
                    ) : (
                      notifs.map((n) => (
                        <div key={n.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <p className="text-sm font-bold text-slate-800">{n.text}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{formatTime(n.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="hidden sm:inline-flex p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition" title="Create post" onClick={() => setComposerOpen(true)}>
              <Send size={18} />
            </button>
            <button type="button" className="hidden sm:inline-flex p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition" title="Settings" onClick={() => navigate('SETTINGS')}>
              <Settings size={18} />
            </button>
            <button type="button" className="hidden sm:inline-flex p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition" title="Profile" onClick={() => navigate('PROFILE')}>
              <UserCircle size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Page */}
      <AnimatePresence mode="wait">
      {tab === 'HOME' ? (
      <motion.div
        key="home"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4"
      >
        {/* Left nav */}
        <aside className="lg:col-span-3 space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                {profile.avatarDataUrl ? (
                  <img src={profile.avatarDataUrl} alt="Avatar" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <span className="text-slate-600 font-black text-sm">{(profile.displayName || user.name).slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-slate-900 font-black truncate">{profile.displayName || user.name}</p>
                <p className="text-[11px] font-bold text-slate-500 truncate">{profile.headline}</p>
              </div>
              <button
                type="button"
                className="ml-auto p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition"
                title="Edit avatar"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera size={16} />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await fileToDataUrl(f);
                    setProfile((p) => ({ ...p, avatarDataUrl: url }));
                    addNotif('Profile photo updated.');
                  } catch (err) {
                    addNotif(err instanceof Error ? err.message : 'Could not update profile photo.');
                  } finally {
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>

            <div className="mt-4 space-y-1">
              {[
                { key: 'HOME' as const, label: 'Home', icon: <Home size={18} />, onClick: () => navigate('HOME') },
                { key: 'VIDEO' as const, label: 'Watch', icon: <MonitorPlay size={18} />, onClick: () => navigate('VIDEO') },
                { key: 'LIVE' as const, label: 'Live', icon: <Video size={18} />, onClick: () => navigate('LIVE') },
                { key: 'MARKET' as const, label: 'Marketplace', icon: <Store size={18} />, onClick: () => navigate('MARKET') },
                { key: 'GROUPS' as const, label: 'Groups', icon: <UsersRound size={18} />, onClick: () => navigate('GROUPS') },
                { key: 'EVENTS' as const, label: 'Events', icon: <Calendar size={18} />, onClick: () => navigate('EVENTS') },
              ].map((it) => {
                const active = tab === it.key;
                return (
                <button
                  key={it.key}
                  type="button"
                  onClick={it.onClick}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition font-bold border ${
                    active
                      ? 'bg-[#e7f3ff] border-[#2563eb]/20 text-slate-900'
                      : 'bg-transparent border-transparent text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                      active
                        ? 'bg-[#2563eb] border-[#2563eb] text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    {it.icon}
                  </span>
                  <span className="text-sm">{it.label}</span>
                </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black text-slate-900">Notifications</p>
              <button type="button" className="text-sm font-bold text-[#2563eb] hover:underline" onClick={() => setNotifsOpen(true)}>See all</button>
            </div>
            {notifs.length === 0 ? (
              <p className="text-sm font-bold text-slate-400">No notifications yet.</p>
            ) : (
              <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {notifs.map((n) => (
                  <li key={n.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-sm font-bold text-slate-800">{n.text}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">{formatTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Feed */}
        <section className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-black text-slate-900">Feed</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFeedMode('RANKED')}
                className={`px-3 py-2 rounded-full text-xs font-black transition ${
                  feedMode === 'RANKED' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
                title="Ranked for you"
              >
                For you
              </button>
              <button
                type="button"
                onClick={() => setFeedMode('RECENT')}
                className={`px-3 py-2 rounded-full text-xs font-black transition ${
                  feedMode === 'RECENT' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
                title="Most recent"
              >
                Recent
              </button>
            </div>
          </div>

          {/* Composer */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                {profile.avatarDataUrl ? (
                  <img src={profile.avatarDataUrl} alt="Me" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <span className="text-slate-600 font-black text-sm">{(profile.displayName || user.name).slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="flex-1 text-left px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition"
              >
                What’s happening on campus, {profile.displayName?.split(' ')[0] || user.name.split(' ')[0]}?
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(true);
                  setTimeout(() => fileInputRef.current?.click(), 0);
                }}
                className="px-3 py-2.5 rounded-xl hover:bg-slate-100 text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                <ImageIcon size={18} className="text-emerald-600" /> Photo
              </button>
              <button
                type="button"
                onClick={() => navigate('LIVE')}
                className="px-3 py-2.5 rounded-xl hover:bg-slate-100 text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                <Video size={18} className="text-rose-600" /> Live
              </button>
              <button type="button" className="px-3 py-2.5 rounded-xl hover:bg-slate-100 text-sm font-bold flex items-center justify-center gap-2 transition">
                <Users size={18} className="text-indigo-600" /> Tag
              </button>
            </div>
          </div>

          {/* Stories */}
          <StoriesRow
            user={user}
            profile={profile}
            onCreateStory={() => addNotif('Story creation will be enabled when backend is connected.')}
          />

          {filteredPosts.map((p) => {
            const likes = p.reactions.filter((r) => r.type === 'LIKE').length;
            const hearts = p.reactions.filter((r) => r.type === 'HEART').length;
            const myLike = p.reactions.some((r) => r.userId === user.id && r.type === 'LIKE');
            const myHeart = p.reactions.some((r) => r.userId === user.id && r.type === 'HEART');

            return (
              <article
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      {p.authorAvatar ? (
                        <img src={p.authorAvatar} alt={p.authorName} className="w-full h-full object-cover" draggable={false} />
                      ) : (
                        <span className="text-slate-600 font-black text-sm">{p.authorName.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-900 truncate">{p.authorName}</p>
                        <span className="text-xs font-bold text-slate-400">· {formatTime(p.createdAt)}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-2">
                        <Globe size={12} /> {p.visibility.toLowerCase()}
                      </p>
                    </div>
                    <button type="button" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>

                  {p.text && <p className="mt-4 text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{p.text}</p>}
                </div>

                {p.imageDataUrl && (
                  <div className="bg-slate-950">
                    <img
                      src={p.imageDataUrl}
                      alt="Post"
                      className="w-full max-h-[520px] object-contain"
                      draggable={false}
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="px-5 py-4 border-t border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5">
                        <ThumbsUp size={14} className="text-blue-600" /> {likes}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Heart size={14} className="text-rose-600" /> {hearts}
                      </span>
                    </div>
                    <span>{p.comments.length} comments</span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleReaction(p.id, 'LIKE')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${
                        myLike ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <ThumbsUp size={14} /> Like
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleReaction(p.id, 'HEART')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${
                        myHeart ? 'bg-rose-50 text-rose-700' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Heart size={14} /> Love
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-100 text-slate-700 transition"
                      onClick={() => addNotif('Sharing is coming next.')}
                    >
                      <Share2 size={14} /> Share
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {p.comments.slice(-3).map((c) => (
                      <div key={c.id} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <span className="text-slate-600 font-black text-xs">{c.authorName.slice(0, 1).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest truncate">{c.authorName}</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatTime(c.createdAt)}</p>
                          </div>
                          <p className="text-sm text-slate-700 font-medium mt-1 whitespace-pre-wrap">{c.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <CommentComposer onSubmit={(msg) => addComment(p.id, msg)} />
                </div>
              </article>
            );
          })}
        </section>

        {/* Right rail */}
        <aside className="lg:col-span-3 space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black text-slate-900">Friend requests</p>
              <button type="button" className="text-sm font-bold text-[#2563eb] hover:underline" onClick={() => addNotif('Friend requests need backend.')}>See all</button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-700">A</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900 truncate">Edith Ajwang</p>
                <p className="text-xs font-bold text-slate-500">16 mutual friends</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="px-3 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-black">Confirm</button>
                <button type="button" className="px-3 py-2 rounded-lg bg-slate-200 text-slate-800 text-xs font-black">Delete</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm font-black text-slate-900 mb-3">Birthdays</p>
            <p className="text-sm font-bold text-slate-700">Kang Kang Cephas and 4 others have birthdays today.</p>
          </div>
        </aside>
      </motion.div>
      ) : (
        <motion.div
          key={tab}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="max-w-screen-2xl mx-auto px-4 md:px-10 py-8"
        >
          <ClassnetPageHeader tab={tab} />
          {tab === 'VIDEO' && <VideoPage />}
          {tab === 'LIVE' && (
            <LiveHubPage
              userName={user.name}
              sessions={liveSessions}
              setSessions={setLiveSessions}
              addNotif={addNotif}
            />
          )}
          {tab === 'MARKET' && (
            <MarketplacePage
              user={user}
              listings={listings}
              setListings={setListings}
              addNotif={addNotif}
            />
          )}
          {tab === 'GROUPS' && <GroupsPage groups={groups} setGroups={setGroups} />}
          {tab === 'EVENTS' && <EventsPage events={events} setEvents={setEvents} />}
          {tab === 'MESSAGES' && <MessagesPage user={user} addNotif={addNotif} />}
          {tab === 'PROFILE' && (
            <ProfilePage
              user={user}
              profile={profile}
              setProfile={setProfile}
              addNotif={addNotif}
              viewedUserId={viewedUserId}
              onBackToMe={() => setViewedUserId(null)}
            />
          )}
          {tab === 'SETTINGS' && <SettingsPage addNotif={addNotif} />}
        </motion.div>
      )}
      </AnimatePresence>

      {/* Composer modal */}
      {composerOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setComposerOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-slate-900 uppercase tracking-tight">Create post</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">Classnet · {composerVisibility}</p>
              </div>
              <button type="button" onClick={() => setComposerOpen(false)} className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {composerError && (
                <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-widest">
                  {composerError}
                </div>
              )}

              <textarea
                value={composerText}
                onChange={(e) => {
                  setComposerText(e.target.value);
                  setComposerError(null);
                }}
                placeholder="Share an update with your school community..."
                className="w-full min-h-[140px] px-5 py-4 rounded-[1.5rem] bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-[#3d0413]/5 font-medium text-slate-800"
              />

              {composerImage && (
                <div className="rounded-[1.5rem] overflow-hidden border border-slate-200 bg-slate-950">
                  <img src={composerImage} alt="Selected" className="w-full max-h-[380px] object-contain" />
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                  >
                    <ImageIcon size={14} /> Add image
                  </button>
                  <button
                    type="button"
                    onClick={() => addNotif('Video uploads are coming next.')}
                    className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                  >
                    <Video size={14} /> Video
                  </button>
                  <button
                    type="button"
                    onClick={() => addNotif('Events are coming next.')}
                    className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                  >
                    <Calendar size={14} /> Event
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={composerVisibility}
                    onChange={(e) => setComposerVisibility(e.target.value as Visibility)}
                    className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700"
                  >
                    <option value="SCHOOL">School</option>
                    <option value="PUBLIC">Public</option>
                    <option value="CLASS_ONLY">Class only</option>
                  </select>
                  <button
                    type="button"
                    onClick={createPost}
                    className="px-6 py-3 rounded-2xl bg-[#3d0413] hover:bg-black text-white text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 border-black active:scale-95 transition flex items-center gap-2"
                  >
                    <Send size={14} /> Post
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await fileToDataUrl(f);
                    setComposerImage(url);
                    setComposerError(null);
                  } catch (err) {
                    setComposerError(err instanceof Error ? err.message : 'Could not load image.');
                  } finally {
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>

            <div className="p-5 border-t border-slate-200 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
              <span>Campus-safe community rules apply</span>
              <span className="flex items-center gap-2">
                <MoreHorizontal size={14} /> <span>More</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ClassnetPageHeader: React.FC<{ tab: ClassnetTab }> = ({ tab }) => {
  const title =
    tab === 'VIDEO'
      ? 'Watch'
      : tab === 'LIVE'
        ? 'Live'
      : tab === 'MARKET'
        ? 'Marketplace'
        : tab === 'GROUPS'
          ? 'Groups'
          : tab === 'EVENTS'
            ? 'Events'
            : tab === 'MESSAGES'
              ? 'Messages'
              : tab === 'PROFILE'
                ? 'Profile'
                : tab === 'SETTINGS'
                  ? 'Settings'
                  : 'Classnet';

  const subtitle =
    tab === 'VIDEO'
      ? 'Campus clips and class highlights'
      : tab === 'LIVE'
        ? 'Join live sessions and campus broadcasts'
      : tab === 'MARKET'
        ? 'Buy and sell safely within campus'
        : tab === 'GROUPS'
          ? 'Communities for departments, classes and clubs'
          : tab === 'EVENTS'
            ? 'RSVP and stay synced with campus life'
            : tab === 'MESSAGES'
              ? 'Direct messages and group chats'
              : tab === 'PROFILE'
                ? 'Your identity on Classnet'
                : tab === 'SETTINGS'
                  ? 'Privacy, notifications and preferences'
                  : '';

  return (
    <div className="mb-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-[1.25rem] bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center">
          <img src="/classnet-logo.png" alt="Classnet" className="w-full h-full object-contain" draggable={false} />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight truncate">{title}</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mt-1 truncate">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

const LiveHubPage: React.FC<{
  userName: string;
  sessions: LiveSession[];
  setSessions: React.Dispatch<React.SetStateAction<LiveSession[]>>;
  addNotif: (t: string) => void;
}> = ({ userName, sessions, setSessions, addNotif }) => {
  const liveNowAll = sessions.filter((s) => s.isLive);
  // show only the most recent session per host to avoid clutter
  const liveNow = React.useMemo(() => {
    const byHost = new Map<string, LiveSession>();
    for (const s of liveNowAll) {
      const existing = byHost.get(s.hostName);
      if (!existing || new Date(s.startedAt) > new Date(existing.startedAt)) {
        byHost.set(s.hostName, s);
      }
    }
    return Array.from(byHost.values()).sort(
      (a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)
    );
  }, [liveNowAll]);
  const scheduled = sessions.filter((s) => !s.isLive).sort((a, b) => +new Date(a.scheduledAt || a.startedAt) - +new Date(b.scheduledAt || b.startedAt));

  const [view, setView] = useState<'HUB' | 'THEATER'>('HUB');
  const [active, setActive] = useState<LiveSession | null>(null);
  const [goLiveOpen, setGoLiveOpen] = useState(false);

  // Supabase realtime: live sessions list
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('classnet_live_sessions')
        .select('*')
        .eq('status', 'LIVE')
        .order('started_at', { ascending: false });
      if (!mounted) return;
      if (error) return;
      setSessions(
        (data || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          hostId: r.host_id,
          hostName: r.host_name,
          type: r.type,
          audience: r.audience,
          viewerCount: 1,
          startedAt: r.started_at,
          isLive: r.status === 'LIVE',
          inviteCode: r.invite_code,
          passkey: r.passkey,
        }))
      );
    };

    void load();

    const channel = supabase
      .channel('classnet_live_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classnet_live_sessions' },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [setSessions]);

  if (view === 'THEATER' && active) {
    return (
      <LiveTheater
        session={active}
        userName={userName}
        onExit={() => { setView('HUB'); setActive(null); }}
        addNotif={addNotif}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-900">Live Hub</p>
            <p className="text-xs font-bold text-slate-500 mt-1">Campus-safe live sessions for classes, events and announcements.</p>
          </div>
          <button
            type="button"
            onClick={() => setGoLiveOpen(true)}
            className="px-5 py-3 rounded-xl bg-[#3d0413] hover:bg-black text-white text-xs font-black uppercase tracking-widest shadow-xl border-b-4 border-black/90 active:scale-95 transition"
          >
            Go Live
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black text-slate-900">Live now</p>
              <span className="text-xs font-black text-rose-600">{liveNow.length} live</span>
            </div>
            {liveNow.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">No live sessions right now.</p>
            ) : (
              <div className="space-y-3">
                {liveNow.map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{s.title}</p>
                      <p className="text-xs font-bold text-slate-500 mt-1 truncate">
                        Host: {s.hostName} · {s.type} · {s.audience.toLowerCase()} · {s.viewerCount} watching
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setActive(s); setView('THEATER'); }}
                      className="px-5 py-3 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest shadow-xl border-b-4 border-black/70 active:scale-95 transition"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black text-slate-900">Scheduled</p>
              <button type="button" className="text-sm font-bold text-[#2563eb] hover:underline" onClick={() => addNotif('Calendar integration can be added next.')}>
                Add reminder
              </button>
            </div>
            {scheduled.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">No scheduled sessions.</p>
            ) : (
              <div className="space-y-3">
                {scheduled.map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{s.title}</p>
                      <p className="text-xs font-bold text-slate-500 mt-1 truncate">
                        {new Date(s.scheduledAt || s.startedAt).toLocaleString()} · Host: {s.hostName} · {s.type} · {s.audience.toLowerCase()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addNotif('Reminder set (mock).')}
                      className="px-5 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs font-black uppercase tracking-widest shadow-sm active:scale-95 transition"
                    >
                      Remind me
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm font-black text-slate-900">Rules & Safety</p>
            <ul className="mt-3 space-y-2 text-sm font-bold text-slate-700">
              <li>• Be respectful; no harassment or hate.</li>
              <li>• No exam leaks or impersonation.</li>
              <li>• Report abuse; moderators can remove users.</li>
              <li>• Chat may be slow-mode during large sessions.</li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm font-black text-slate-900">Suggested lives</p>
            <p className="text-xs font-bold text-slate-500 mt-1">Based on your activity (next: connect backend for real).</p>
            <div className="mt-3 space-y-2">
              {['Study Q&A', 'Department Updates', 'Career Talk'].map((x) => (
                <button key={x} type="button" onClick={() => addNotif('Personalized recommendations will improve with more data.')} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 text-left hover:bg-slate-100 transition">
                  <p className="text-sm font-black text-slate-900">{x}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">Tap to explore</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {goLiveOpen && (
        <GoLiveModal
          userName={userName}
          onClose={() => setGoLiveOpen(false)}
          onGoLive={(session) => {
            setSessions((prev) => [session, ...prev]);
            setActive(session);
            setView('THEATER');
          }}
          addNotif={addNotif}
        />
      )}
    </div>
  );
};

const GoLiveModal: React.FC<{
  userName: string;
  onClose: () => void;
  onGoLive: (s: LiveSession) => void;
  addNotif: (t: string) => void;
}> = ({ userName, onClose, onGoLive, addNotif }) => {
  const [type, setType] = useState<LiveType>('CLASS');
  const [aud, setAud] = useState<LiveAudience>('SCHOOL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState('');
  const [feeling, setFeeling] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [openPicker, setOpenPicker] = useState<null | 'TAG' | 'PLACE' | 'FEELING'>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-lg font-black text-slate-900">Go Live</p>
            <p className="text-xs font-bold text-slate-500 mt-1">Agree to safety terms before starting.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Type</p>
              <select value={type} onChange={(e) => setType(e.target.value as LiveType)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold">
                <option value="CLASS">Class</option>
                <option value="EVENT">Event</option>
                <option value="CLUB">Club</option>
                <option value="ANNOUNCEMENT">Announcement</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Audience</p>
              <select value={aud} onChange={(e) => setAud(e.target.value as LiveAudience)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold">
                <option value="SCHOOL">School</option>
                <option value="DEPARTMENT">Department</option>
                <option value="CLASS_ONLY">Class only</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Title (optional)</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Description</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-medium resize-none"
                placeholder="What is this live about?"
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Add to your live (optional)</p>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setOpenPicker(openPicker === 'TAG' ? null : 'TAG'); setPickerQuery(''); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-black tracking-widest"
                  >
                    <UserPlus size={16} /> Tag people
                  </button>
                  {openPicker === 'TAG' && (
                    <div className="absolute z-10 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 space-y-2">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                        <Search size={14} className="text-slate-400" />
                        <input
                          value={pickerQuery}
                          onChange={(e) => setPickerQuery(e.target.value)}
                          placeholder="Search friends..."
                          className="bg-transparent outline-none text-xs font-bold flex-1"
                        />
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {['Class Rep', 'Lab Partner', 'Mentor', 'ICT Friend', 'Electrical Friend'].filter((n) =>
                          n.toLowerCase().includes(pickerQuery.toLowerCase())
                        ).map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              const handle = `@${name.replace(/\s+/g, '')}`;
                              setTags((prev) => (prev ? `${prev}, ${handle}` : handle));
                              setOpenPicker(null);
                            }}
                            className="w-full px-2 py-1.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 text-left"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      {tags && (
                        <p className="text-[11px] font-bold text-slate-500">Tagged: {tags}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setOpenPicker(openPicker === 'PLACE' ? null : 'PLACE'); setPickerQuery(''); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-black tracking-widest"
                  >
                    <MapPin size={16} /> Check in
                  </button>
                  {openPicker === 'PLACE' && (
                    <div className="absolute z-10 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 space-y-2">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                        <Search size={14} className="text-slate-400" />
                        <input
                          value={pickerQuery}
                          onChange={(e) => setPickerQuery(e.target.value)}
                          placeholder="Search places..."
                          className="bg-transparent outline-none text-xs font-bold flex-1"
                        />
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {['Library', 'Lab 2', 'Main Hall', 'Workshop 4', 'ICT Block'].filter((p) =>
                          p.toLowerCase().includes(pickerQuery.toLowerCase())
                        ).map((place) => (
                          <button
                            key={place}
                            type="button"
                            onClick={() => { setLocation(place); setOpenPicker(null); }}
                            className="w-full px-2 py-1.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 text-left"
                          >
                            {place}
                          </button>
                        ))}
                      </div>
                      {location && (
                        <p className="text-[11px] font-bold text-slate-500">Checked in at {location}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setOpenPicker(openPicker === 'FEELING' ? null : 'FEELING'); setPickerQuery(''); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-black tracking-widest"
                  >
                    <SmilePlus size={16} /> Feeling / activity
                  </button>
                  {openPicker === 'FEELING' && (
                    <div className="absolute z-10 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 space-y-2">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                        <Search size={14} className="text-slate-400" />
                        <input
                          value={pickerQuery}
                          onChange={(e) => setPickerQuery(e.target.value)}
                          placeholder="Search feelings..."
                          className="bg-transparent outline-none text-xs font-bold flex-1"
                        />
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {['Confident', 'Revising', 'Presenting', 'Nervous', 'Celebrating'].filter((f) =>
                          f.toLowerCase().includes(pickerQuery.toLowerCase())
                        ).map((feel) => (
                          <button
                            key={feel}
                            type="button"
                            onClick={() => { setFeeling(feel); setOpenPicker(null); }}
                            className="w-full px-2 py-1.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 text-left"
                          >
                            {feel}
                          </button>
                        ))}
                      </div>
                      {feeling && (
                        <p className="text-[11px] font-bold text-slate-500">Feeling {feeling.toLowerCase()}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">Safety & Terms</p>
            <ul className="mt-2 space-y-1 text-sm font-bold text-slate-700">
              <li>• No harassment, hate, or explicit content.</li>
              <li>• No exam leaks or impersonation.</li>
              <li>• Respect privacy (no recording without consent).</li>
              <li>• Violations may lead to suspension.</li>
            </ul>
            <label className="mt-3 flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 w-4 h-4"
              />
              <span className="text-sm font-bold text-slate-800">
                I agree to the safety rules and terms for Classnet Live.
              </span>
            </label>
          </div>

          <button
            type="button"
            disabled={!accepted}
            onClick={() => {
              if (!accepted) return;
              const doStart = async () => {
                const code = `L${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
                const key = Math.random().toString(36).slice(2, 8).toUpperCase();
                const startedAt = new Date().toISOString();

                if (supabase) {
                  const { data, error } = await supabase
                    .from('classnet_live_sessions')
                    .insert({
                      host_id: (window as any)?.poly_current_user_id || userName.toLowerCase(),
                      host_name: userName,
                      title: (title || description || `${type} Live`).trim(),
                      type,
                      audience: aud,
                      status: 'LIVE',
                      invite_code: code,
                      passkey: key,
                      started_at: startedAt,
                    })
                    .select('*')
                    .single();
                  if (!error && data) {
                    const session: LiveSession = {
                      id: data.id,
                      title: data.title,
                      hostId: data.host_id,
                      hostName: data.host_name,
                      type: data.type,
                      audience: data.audience,
                      viewerCount: 1,
                      startedAt: data.started_at,
                      isLive: true,
                      inviteCode: data.invite_code,
                      passkey: data.passkey,
                    };
                    addNotif('You are now live.');
                    onGoLive(session);
                    onClose();
                    return;
                  }
                }

                // fallback (no supabase configured)
                const session: LiveSession = {
                  id: `live-${Date.now()}`,
                  title: (title || description || `${type} Live`).trim(),
                  hostName: userName,
                  type,
                  audience: aud,
                  viewerCount: 1,
                  startedAt,
                  isLive: true,
                  inviteCode: code,
                  passkey: key,
                };
                addNotif('You are now live.');
                onGoLive(session);
                onClose();
              };
              void doStart();
            }}
            className={`w-full px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl border-b-4 active:scale-95 transition ${
              accepted ? 'bg-[#3d0413] hover:bg-black text-white border-black/90' : 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed'
            }`}
          >
            Start live
          </button>
        </div>
      </div>
    </div>
  );
};

const LiveTheater: React.FC<{
  session: LiveSession;
  userName: string;
  onExit: () => void;
  addNotif: (t: string) => void;
}> = ({ session, userName, onExit, addNotif }) => {
  const [msg, setMsg] = useState('');
  const [chat, setChat] = useState<{ id: string; author: string; text: string; at: string }[]>(() =>
    safeParse(localStorage.getItem(STORAGE.LIVE_CHAT), [
      { id: 'm1', author: session.hostName, text: 'Welcome. Please keep chat respectful.', at: new Date().toISOString() },
      { id: 'm2', author: 'Moderator', text: 'Slow-mode may be enabled if chat gets busy.', at: new Date().toISOString() },
    ])
  );
  const [reaction, setReaction] = useState<{ likes: number; hearts: number }>({ likes: 0, hearts: 0 });
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const isHost = session.hostName === userName;
  const [guestRequests, setGuestRequests] = useState<
    { id: string; name: string; note?: string; approved: boolean; muted: boolean; videoOff: boolean }[]
  >([]);

  useEffect(() => {
    localStorage.setItem(STORAGE.LIVE_CHAT, JSON.stringify(chat.slice(-40)));
  }, [chat]);

  useEffect(() => {
    const mainEl = mainVideoRef.current;
    if (!mainEl) return;
    const source: MediaStream | null = screenStream || (cameraOn ? localStream : null);
    mainEl.srcObject = source;
    if (source) {
      mainEl
        .play()
        .catch(() => {
          // ignore autoplay restrictions
        });
    }
  }, [cameraOn, localStream, screenStream]);

  useEffect(() => {
    const pipEl = pipVideoRef.current;
    if (!pipEl) return;
    const pipSource: MediaStream | null = cameraOn ? localStream : null;
    pipEl.srcObject = pipSource;
    if (pipSource) {
      pipEl
        .play()
        .catch(() => {
          // ignore autoplay restrictions
        });
    }
  }, [cameraOn, localStream]);

  const toggleCamera = async () => {
    if (cameraOn) {
      localStream?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      setCameraOn(false);
      return;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addNotif('Camera not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: micOn });
      setLocalStream(stream);
      setCameraOn(true);
    } catch {
      addNotif('Could not access camera. Check permissions.');
    }
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = next;
      });
    }
  };

  const toggleScreenShare = async () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      return;
    }
    try {
      const navAny = navigator as any;
      const getDisplay = navAny.mediaDevices?.getDisplayMedia?.bind(navAny.mediaDevices);
      if (!getDisplay) {
        addNotif('Screen sharing is not supported in this browser.');
        return;
      }
      const stream: MediaStream = await getDisplay({ video: true, audio: false });
      if (!stream) return;
      setScreenStream(stream);
      const [track] = stream.getVideoTracks();
      if (track) {
        track.onended = () => {
          setScreenStream(null);
        };
      }
    } catch {
      addNotif('Screen share was cancelled or blocked.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 truncate">{session.title}</p>
          <p className="text-xs font-bold text-slate-500 mt-1 truncate">
            LIVE · Host: {session.hostName} · {session.viewerCount} watching · {session.audience.toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <>
              <button
                type="button"
                onClick={toggleCamera}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black active:scale-95 transition"
              >
                {cameraOn ? 'Turn camera off' : 'Enable camera'}
              </button>
              <button
                type="button"
                onClick={toggleMic}
                className={`px-4 py-2 rounded-xl text-xs font-black active:scale-95 transition ${
                  micOn ? 'bg-slate-100 text-slate-800 hover:bg-slate-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                Mic {micOn ? 'on' : 'muted'}
              </button>
              <button
                type="button"
                onClick={toggleScreenShare}
                className={`px-4 py-2 rounded-xl text-xs font-black active:scale-95 transition ${
                  screenStream ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                {screenStream ? 'Stop share' : 'Share screen'}
              </button>
              {session.inviteCode && session.passkey && (
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/live/${session.inviteCode}`;
                    const info = `Link: ${url}\nPasskey: ${session.passkey}`;
                    try {
                      void navigator.clipboard.writeText(info);
                      addNotif('Invite link and passkey copied to clipboard.');
                    } catch {
                      addNotif('Copy failed. You can share the link and passkey manually.');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black active:scale-95 transition"
                >
                  Copy guest link
                </button>
              )}
            </>
          )}
          <button type="button" onClick={() => addNotif('Reported (mock).')} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black active:scale-95 transition">
            Report
          </button>
          <button type="button" onClick={onExit} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black active:scale-95 transition">
            Exit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 bg-black aspect-video flex items-center justify-center text-white/40 relative">
          <video
            ref={mainVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-contain ${screenStream || (cameraOn && localStream) ? 'block' : 'hidden'}`}
          />
          {!screenStream && !(cameraOn && localStream) && <MonitorPlay size={44} />}

          {/* Camera PiP: show when screen sharing and camera enabled */}
          {screenStream && cameraOn && localStream && (
            <div className="absolute bottom-4 left-4 w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white/80 shadow-2xl bg-slate-900">
              <video
                ref={pipVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <button type="button" onClick={() => setReaction((r) => ({ ...r, likes: r.likes + 1 }))} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-black">
              Like · {reaction.likes}
            </button>
            <button type="button" onClick={() => setReaction((r) => ({ ...r, hearts: r.hearts + 1 }))} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-black">
              Heart · {reaction.hearts}
            </button>
            <button type="button" onClick={() => addNotif('Raise hand (next: real class mode).')} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-black">
              Raise hand
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 border-l border-slate-100">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-900">Live chat</p>
              <p className="text-xs font-bold text-slate-500 mt-1">Be respectful. Messages may be moderated.</p>
            </div>
            {isHost && (
              <button
                type="button"
                onClick={() => {
                  // add a mock join request
                  const id = `g-${Date.now()}`;
                  setGuestRequests((prev) => [
                    ...prev,
                    {
                      id,
                      name: `Student ${prev.length + 1}`,
                      note: 'Request to join live as guest.',
                      approved: false,
                      muted: false,
                      videoOff: false,
                    },
                  ]);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest"
              >
                Mock join request
              </button>
            )}
          </div>
          <div className="px-4 pb-4 max-h-[360px] lg:max-h-[520px] overflow-y-auto space-y-2">
            {chat.map((c) => (
              <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-slate-900 truncate">{c.author}</p>
                  <p className="text-[11px] font-bold text-slate-400">{formatTime(c.at)}</p>
                </div>
                <p className="text-sm font-bold text-slate-700 mt-1">{c.text}</p>
              </div>
            ))}
          </div>
          <form
            className="p-4 border-t border-slate-100 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = msg.trim();
              if (!t) return;
              setChat((prev) => [...prev, { id: `m-${Date.now()}`, author: userName, text: t, at: new Date().toISOString() }]);
              setMsg('');
            }}
          >
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a message..." className="flex-1 px-4 py-3 rounded-full bg-slate-100 border border-slate-200 font-bold outline-none" />
            <button type="submit" className="px-5 py-3 rounded-full bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-black active:scale-95 transition">
              Send
            </button>
          </form>
          {isHost && guestRequests.length > 0 && (
            <div className="border-t border-slate-100 p-4 space-y-3">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Guest controls</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {guestRequests.map((g) => (
                  <div key={g.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-black text-slate-700">
                      {g.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-900 truncate">{g.name}</p>
                      <p className="text-[11px] font-bold text-slate-500 truncate">
                        {g.note} {g.approved ? '(on stage)' : '(requesting)'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!g.approved ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setGuestRequests((prev) =>
                                prev.map((x) => (x.id === g.id ? { ...x, approved: true } : x))
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setGuestRequests((prev) => prev.filter((x) => x.id !== g.id))
                            }
                            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-800 text-[10px] font-black"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setGuestRequests((prev) =>
                                prev.map((x) => (x.id === g.id ? { ...x, muted: !x.muted } : x))
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-800 text-[10px] font-black"
                          >
                            {g.muted ? 'Unmute' : 'Mute'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setGuestRequests((prev) =>
                                prev.map((x) => (x.id === g.id ? { ...x, videoOff: !x.videoOff } : x))
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-800 text-[10px] font-black"
                          >
                            {g.videoOff ? 'Show video' : 'Hide video'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setGuestRequests((prev) => prev.filter((x) => x.id !== g.id))
                            }
                            className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const VideoPage: React.FC = () => {
  const reels: Reel[] = useMemo(
    () => [
      {
        id: 'r1',
        authorName: 'ICT Dept',
        caption: 'Quick tip: How to structure your React components cleanly.',
        audio: 'Original audio · Classnet',
        topic: 'Software Engineering',
        takeaways: [
          'Keep components small and single-purpose.',
          'Lift state only when needed; prefer local state.',
          'Extract repeated UI into reusable components.',
        ],
        likes: 786,
        comments: 32,
        shares: 12,
      },
      {
        id: 'r2',
        authorName: 'Library Helpdesk',
        caption: 'Past papers strategy: solve → mark → repeat.',
        audio: 'Study beats · Classnet',
        topic: 'Study Skills',
        takeaways: [
          'Simulate exam timing for realistic practice.',
          'Mark immediately and track weak topics.',
          'Repeat with spaced intervals for retention.',
        ],
        likes: 512,
        comments: 18,
        shares: 9,
      },
      {
        id: 'r3',
        authorName: 'Electrical Workshop',
        caption: 'Safety first: lockout & PPE basics in the lab.',
        audio: 'Workshop audio · Classnet',
        topic: 'Lab Safety',
        takeaways: [
          'Use PPE: goggles, gloves, boots where required.',
          'Lockout/tagout before working on circuits.',
          'Keep workspace dry, tidy, and cable-managed.',
        ],
        likes: 1043,
        comments: 67,
        shares: 21,
      },
    ],
    []
  );

  return <ReelsViewer reels={reels} />;
};

const ReelsViewer: React.FC<{ reels: Reel[] }> = ({ reels }) => {
  const reduceMotion = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<'FOR_YOU' | 'FOLLOWING' | 'TRENDING'>('FOR_YOU');
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [deck, setDeck] = useState<{ reelId: string; savedAt: string; topic?: string; caption: string }[]>(() =>
    safeParse(localStorage.getItem(STORAGE.REEL_DECK), [])
  );
  const [queue, setQueue] = useState<string[]>(() => reels.map((r) => r.id));
  const [profile, setProfile] = useState<ReelAlgoProfile>(() =>
    safeParse(localStorage.getItem(STORAGE.REEL_PROFILE), {
      topicAffinity: {},
      creatorAffinity: {},
      seen: {},
    })
  );
  const [stats, setStats] = useState<ReelAggregateStats>(() =>
    safeParse(localStorage.getItem(STORAGE.REEL_STATS), {})
  );

  const reelById = useMemo(() => new Map(reels.map((r) => [r.id, r])), [reels]);
  const curId = queue[idx] ?? queue[0] ?? reels[0]?.id;
  const cur = (curId && reelById.get(curId)) || reels[0];
  const touchRef = useRef<{ y: number; t: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const viewStartRef = useRef<number>(nowTs());
  const lastReelIdRef = useRef<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') setIdx((v) => Math.min(v + 1, reels.length - 1));
      if (e.key === 'ArrowUp' || e.key === 'PageUp') setIdx((v) => Math.max(v - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reels.length]);

  useEffect(() => {
    localStorage.setItem(STORAGE.REEL_DECK, JSON.stringify(deck));
  }, [deck]);

  useEffect(() => {
    localStorage.setItem(STORAGE.REEL_PROFILE, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE.REEL_STATS, JSON.stringify(stats));
  }, [stats]);

  const rebuildQueue = (opts?: { keepCurrent?: boolean }) => {
    const keepCurrent = opts?.keepCurrent ?? true;
    const current = keepCurrent ? (queue[idx] ?? queue[0]) : null;

    if (mode === 'FOLLOWING') {
      const next = reels.map((r) => r.id);
      setQueue(next);
      setIdx(current ? Math.max(0, next.indexOf(current)) : 0);
      return;
    }

    if (mode === 'TRENDING') {
      const decay = (ts: number) => {
        const hours = Math.max(1, (Date.now() - ts) / 36e5);
        return 1 / Math.pow(hours, 0.9);
      };
      const scoreTrend = (r: Reel) => {
        const s = stats[r.id];
        if (!s) return 0.01 + Math.random() * 0.01;
        const views = Math.max(1, s.views);
        const completionProxy = clamp(s.viewMs / (views * 6500), 0, 1); // ~6.5s target
        const engage = (s.likes * 1.0 + s.saves * 1.4 + s.shares * 1.6) / views;
        return (0.2 + completionProxy * 0.9 + engage * 2.2) * decay(s.lastEventTs);
      };
      const sorted = [...reels].sort((a, b) => scoreTrend(b) - scoreTrend(a));
      const next = sorted.map((r) => r.id);
      setQueue(next);
      setIdx(current ? Math.max(0, next.indexOf(current)) : 0);
      return;
    }

    const score = (r: Reel) => {
      const topic = (r.topic || 'General').toLowerCase();
      const creator = r.authorName.toLowerCase();
      const tAff = profile.topicAffinity[topic] ?? 0;
      const cAff = profile.creatorAffinity[creator] ?? 0;
      const seenPenalty = profile.seen[r.id] ? -0.6 : 0;
      const savedBoost = deck.some((d) => d.reelId === r.id) ? 0.2 : 0;
      const base = 0.15;
      const noise = (Math.random() - 0.5) * 0.12; // exploration
      return base + tAff * 0.55 + cAff * 0.35 + savedBoost + seenPenalty + noise;
    };

    const all = [...reels];
    all.sort((a, b) => score(b) - score(a));

    // simple diversity: avoid repeating same creator/topic back-to-back within top picks
    const out: Reel[] = [];
    const usedCreators = new Map<string, number>();
    const usedTopics = new Map<string, number>();
    for (const r of all) {
      const creator = r.authorName.toLowerCase();
      const topic = (r.topic || 'General').toLowerCase();
      const cCount = usedCreators.get(creator) ?? 0;
      const tCount = usedTopics.get(topic) ?? 0;
      const penalty = cCount * 0.35 + tCount * 0.22;
      if (out.length < 6 && penalty > 0.45) continue;
      out.push(r);
      usedCreators.set(creator, cCount + 1);
      usedTopics.set(topic, tCount + 1);
    }

    const nextIds = out.map((r) => r.id);
    // ensure we don't lose any reels
    for (const r of reels) if (!nextIds.includes(r.id)) nextIds.push(r.id);

    setQueue(nextIds);
    setIdx(current ? Math.max(0, nextIds.indexOf(current)) : 0);
  };

  const applySignal = (r: Reel, delta: number) => {
    const topic = (r.topic || 'General').toLowerCase();
    const creator = r.authorName.toLowerCase();
    setProfile((p) => {
      const topicAffinity = { ...p.topicAffinity, [topic]: clamp((p.topicAffinity[topic] ?? 0) + delta, -2, 4) };
      const creatorAffinity = { ...p.creatorAffinity, [creator]: clamp((p.creatorAffinity[creator] ?? 0) + delta * 0.8, -2, 4) };
      const seen = { ...p.seen, [r.id]: nowTs() };
      return { ...p, topicAffinity, creatorAffinity, seen };
    });
  };

  const bumpStats = (reelId: string, patch: Partial<ReelAggregateStats[string]>) => {
    setStats((prev) => {
      const base = prev[reelId] ?? { views: 0, viewMs: 0, likes: 0, saves: 0, shares: 0, lastEventTs: 0 };
      const next = {
        ...base,
        ...patch,
        lastEventTs: nowTs(),
      };
      return { ...prev, [reelId]: next };
    });
  };

  const commitViewIfNeeded = (nextId: string | null, reason: 'NEXT' | 'PREV' | 'TAB' | 'EXIT') => {
    const prevId = lastReelIdRef.current;
    if (!prevId) {
      lastReelIdRef.current = nextId;
      viewStartRef.current = nowTs();
      return;
    }
    if (prevId === nextId) return;
    const prev = reelById.get(prevId);
    if (!prev) {
      lastReelIdRef.current = nextId;
      viewStartRef.current = nowTs();
      return;
    }
    const ms = nowTs() - viewStartRef.current;
    // interpret: quick swipe/skip vs engaged view
    if (ms < 700) applySignal(prev, -0.18);
    else if (ms < 2500) applySignal(prev, 0.05);
    else if (ms < 7000) applySignal(prev, 0.14);
    else applySignal(prev, 0.22);

    bumpStats(prev.id, { views: (stats[prev.id]?.views ?? 0) + 1, viewMs: (stats[prev.id]?.viewMs ?? 0) + ms });

    lastReelIdRef.current = nextId;
    viewStartRef.current = nowTs();
    if (reason !== 'EXIT') {
      // refresh ranking for remaining queue after learning update
      rebuildQueue({ keepCurrent: true });
    }
  };

  // initialize last reel id + rebuild For You queue once
  useEffect(() => {
    if (!reels.length) return;
    if (queue.length !== reels.length) setQueue(reels.map((r) => r.id));
    lastReelIdRef.current = (queue[idx] ?? queue[0] ?? reels[0].id) || null;
    viewStartRef.current = nowTs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when idx changes, commit view time
  useEffect(() => {
    const nextId = queue[idx] ?? null;
    commitViewIfNeeded(nextId, 'NEXT');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  if (!cur) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-500 font-bold">
        No reels yet.
      </div>
    );
  }

  const isLiked = !!liked[cur.id];
  const likes = cur.likes + (isLiked ? 1 : 0);
  const inDeck = deck.some((d) => d.reelId === cur.id);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">Watch · Reels</p>
          <p className="text-xs font-bold text-slate-500 truncate">Use ↑ ↓ to switch reels</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => { setMode('FOR_YOU'); rebuildQueue({ keepCurrent: true }); }}
              className={`px-3 py-2 rounded-lg text-xs font-black transition ${
                mode === 'FOR_YOU' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Personalized"
            >
              For you
            </button>
            <button
              type="button"
              onClick={() => { setMode('FOLLOWING'); rebuildQueue({ keepCurrent: true }); }}
              className={`px-3 py-2 rounded-lg text-xs font-black transition ${
                mode === 'FOLLOWING' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Simple chronological"
            >
              Following
            </button>
            <button
              type="button"
              onClick={() => { setMode('TRENDING'); rebuildQueue({ keepCurrent: true }); }}
              className={`px-3 py-2 rounded-lg text-xs font-black transition ${
                mode === 'TRENDING' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Campus trending"
            >
              Trending
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIdx((v) => Math.max(v - 1, 0))}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black active:scale-95 transition"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setIdx((v) => Math.min(v + 1, reels.length - 1))}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black active:scale-95 transition"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setInsightsOpen((v) => !v)}
            className={`hidden sm:inline-flex px-4 py-2 rounded-xl text-xs font-black active:scale-95 transition border ${
              insightsOpen ? 'bg-[#fdf2f2] border-rose-200 text-[#3d0413]' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
            title="Smart Insights"
          >
            Insights
          </button>
        </div>
      </div>

      <div className="p-5 bg-[#f0f2f5]">
        <div className="mx-auto max-w-[1100px] grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-6 items-start">
          {/* Reel frame (centered like phone) */}
          <div className="flex justify-center">
            <div className="relative w-[min(420px,92vw)] aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] border border-black/30">
              <AnimatePresence mode="wait">
                <motion.div
                  key={cur.id}
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.985 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute inset-0"
                  onDoubleClick={() => setLiked((m) => ({ ...m, [cur.id]: true }))}
                  onTouchStart={(e) => {
                    const t = e.touches?.[0];
                    if (!t) return;
                    touchRef.current = { y: t.clientY, t: Date.now() };
                    const now = Date.now();
                    if (now - lastTapRef.current < 260) {
                      setLiked((m) => ({ ...m, [cur.id]: true }));
                    }
                    lastTapRef.current = now;
                  }}
                  onTouchEnd={(e) => {
                    const t = e.changedTouches?.[0];
                    const start = touchRef.current;
                    touchRef.current = null;
                    if (!t || !start) return;
                    const dy = t.clientY - start.y;
                    const dt = Date.now() - start.t;
                    if (dt > 700) return;
                    if (Math.abs(dy) < 48) return;
                    if (dy < 0) setIdx((v) => Math.min(v + 1, reels.length - 1));
                    if (dy > 0) setIdx((v) => Math.max(v - 1, 0));
                  }}
                >
                  {/* Visual placeholder for reel content */}
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-black" />
                  <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.35),transparent_40%),radial-gradient(circle_at_70%_70%,rgba(244,63,94,0.30),transparent_45%),radial-gradient(circle_at_40%_85%,rgba(16,185,129,0.22),transparent_45%)]" />

                  {/* Top overlay */}
                  <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-black shrink-0">
                        {cur.authorName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-black truncate">{cur.authorName}</p>
                        <p className="text-white/70 text-xs font-bold truncate">{cur.audio}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInsightsOpen(true)}
                        className="sm:hidden p-2 rounded-full bg-white/10 hover:bg-white/15 text-white/80 transition"
                        title="Insights"
                      >
                        <Bookmark size={18} />
                      </button>
                      <button type="button" className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white/80 transition" title="More">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Bottom overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-bold text-sm leading-snug line-clamp-3 drop-shadow">{cur.caption}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIdx((v) => Math.min(v + 1, reels.length - 1))}
                        className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-black active:scale-95 transition"
                      >
                        Swipe for next
                      </button>
                      <span className="text-white/60 text-xs font-bold">Reel {idx + 1} of {reels.length}</span>
                    </div>
                  </div>

                  {/* Side nav arrows (desktop helper) */}
                  <div className="hidden md:flex absolute inset-y-0 left-3 items-center">
                    <button
                      type="button"
                      onClick={() => setIdx((v) => Math.max(v - 1, 0))}
                      className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/45 text-white/90 border border-white/10 flex items-center justify-center transition active:scale-95"
                      title="Previous"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  </div>
                  <div className="hidden md:flex absolute inset-y-0 right-3 items-center">
                    <button
                      type="button"
                      onClick={() => setIdx((v) => Math.min(v + 1, reels.length - 1))}
                      className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/45 text-white/90 border border-white/10 flex items-center justify-center transition active:scale-95"
                      title="Next"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Side actions (like Facebook) */}
          <div className="hidden lg:flex flex-col items-center gap-4 pt-6">
            <button
              type="button"
              onClick={() => {
                const next = !isLiked;
                setLiked((m) => ({ ...m, [cur.id]: next }));
                bumpStats(cur.id, { likes: (stats[cur.id]?.likes ?? 0) + (next ? 1 : -1) });
                applySignal(cur, next ? 0.18 : -0.06);
                rebuildQueue({ keepCurrent: true });
              }}
              className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-50 active:scale-95 transition"
              title="Like"
            >
              <ThumbsUp size={20} className={isLiked ? 'text-blue-600' : ''} />
            </button>
            <span className="text-xs font-black text-slate-700">{likes}</span>

            <button
              type="button"
              className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-50 active:scale-95 transition"
              title="Comment"
            >
              <MessageCircle size={20} />
            </button>
            <span className="text-xs font-black text-slate-700">{cur.comments}</span>

            <button
              type="button"
              className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-800 hover:bg-slate-50 active:scale-95 transition"
              title="Share"
            >
              <Share2 size={20} />
            </button>
            <span className="text-xs font-black text-slate-700">{cur.shares}</span>
          </div>

          {/* Smart Insights (innovative) */}
          <AnimatePresence>
            {insightsOpen && (
              <motion.aside
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 14 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="lg:sticky lg:top-24 lg:self-start bg-white rounded-2xl border border-slate-200 shadow-sm w-full lg:w-[320px] overflow-hidden"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">Smart Insights</p>
                    <p className="text-xs font-bold text-slate-500 truncate">{cur.topic ?? 'Reel breakdown'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInsightsOpen(false)}
                    className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition"
                    title="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Key takeaways</p>
                    <ul className="mt-2 space-y-2">
                      {(cur.takeaways?.length ? cur.takeaways : ['No takeaways yet.']).map((t, i) => (
                        <li key={`${cur.id}-t-${i}`} className="text-sm font-bold text-slate-800 flex gap-2">
                          <span className="mt-1 w-2 h-2 rounded-full bg-[#2563eb] shrink-0" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLiked((m) => ({ ...m, [cur.id]: !m[cur.id] }))}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest active:scale-95 transition ${
                        isLiked ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      Like
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (inDeck) {
                          setDeck((prev) => prev.filter((d) => d.reelId !== cur.id));
                        } else {
                          setDeck((prev) => [
                            { reelId: cur.id, savedAt: new Date().toISOString(), topic: cur.topic, caption: cur.caption },
                            ...prev,
                          ]);
                        }
                        bumpStats(cur.id, { saves: (stats[cur.id]?.saves ?? 0) + (inDeck ? -1 : 1) });
                      }}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest active:scale-95 transition ${
                        inDeck ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                      }`}
                      title="Save to Study Deck"
                    >
                      {inDeck ? 'Saved' : 'Save'}
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Study deck</p>
                      <span className="text-xs font-black text-slate-700">{deck.length}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 mt-2">
                      Save reels you want to revise later. This stays on this device for now.
                    </p>
                    {deck.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDeck([])}
                        className="mt-3 w-full px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-widest active:scale-95 transition"
                      >
                        Clear deck
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] font-bold text-slate-400">
                    Pro tip: double‑tap to like, swipe up/down to switch reels.
                  </p>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const MarketplacePage: React.FC<{
  user: User;
  listings: MarketplaceListing[];
  setListings: React.Dispatch<React.SetStateAction<MarketplaceListing[]>>;
  addNotif: (t: string) => void;
}> = ({ user, listings, setListings, addNotif }) => {
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [category, setCategory] = useState<MarketplaceListing['category']>('Other');
  const [desc, setDesc] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const filtered = listings.filter((l) => {
    const qq = q.toLowerCase();
    return l.title.toLowerCase().includes(qq) || l.description.toLowerCase().includes(qq) || l.category.toLowerCase().includes(qq);
  });

  const create = () => {
    if (!title.trim()) return setErr('Title is required.');
    if (!price || price < 0) return setErr('Enter a valid price.');
    const item: MarketplaceListing = {
      id: `l-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: title.trim(),
      priceKsh: Math.round(price),
      category,
      description: desc.trim(),
      imageDataUrl: img,
      sellerId: user.id,
      sellerName: user.name,
      createdAt: new Date().toISOString(),
    };
    setListings((prev) => [item, ...prev]);
    setCreateOpen(false);
    setTitle('');
    setPrice(0);
    setDesc('');
    setImg(null);
    setCategory('Other');
    setErr(null);
    addNotif('Listing posted to Marketplace.');
  };

  return (
    <div className="space-y-5">
      <div className="bg-white/90 rounded-[2rem] border border-slate-200/70 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.35)] p-5 backdrop-blur">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 flex-1 min-w-0 shadow-sm">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings..." className="bg-transparent outline-none w-full text-sm font-bold text-slate-800 placeholder:text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-6 py-3 rounded-2xl bg-[#3d0413] hover:bg-black text-white text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 border-black/90 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <Package size={16} /> Create listing
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((l) => (
          <div key={l.id} className="bg-white/90 rounded-[2rem] border border-slate-200/70 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.35)] overflow-hidden backdrop-blur">
            <div className="aspect-video bg-slate-950 flex items-center justify-center text-white/30">
              {l.imageDataUrl ? <img src={l.imageDataUrl} className="w-full h-full object-contain" alt={l.title} /> : <Store size={34} />}
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{l.title}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{l.category} · {formatTime(l.createdAt)}</p>
                </div>
                <p className="text-sm font-black text-[#3d0413] whitespace-nowrap">{moneyKsh(l.priceKsh)}</p>
              </div>
              <p className="text-sm text-slate-700 font-medium mt-3 line-clamp-3">{l.description || '—'}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase tracking-widest shadow-sm" onClick={() => addNotif(`Message ${l.sellerName} (coming next).`)}>
                  Message
                </button>
                <button type="button" className="px-4 py-3 rounded-2xl bg-[#3d0413] hover:bg-black text-white text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 border-black/90 active:scale-95 transition">
                  Save
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-slate-900 uppercase tracking-tight">Create listing</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">Campus marketplace</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {err && <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-widest">{err}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Title</p>
                  <input value={title} onChange={(e) => { setTitle(e.target.value); setErr(null); }} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/5" placeholder="Item or service" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Price (KES)</p>
                  <input type="number" value={price} onChange={(e) => { setPrice(Number(e.target.value)); setErr(null); }} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/5" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Category</p>
                  <select value={category} onChange={(e) => setCategory(e.target.value as MarketplaceListing['category'])} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/5">
                    {['Books', 'Electronics', 'Services', 'Hostel', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Image</p>
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-full px-5 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 font-black uppercase text-[10px] tracking-widest shadow-sm flex items-center justify-center gap-2">
                    <ImageIcon size={16} /> {img ? 'Change image' : 'Add image'}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setImg(await fileToDataUrl(f));
                        setErr(null);
                      } catch (ex) {
                        setErr(ex instanceof Error ? ex.message : 'Could not load image.');
                      } finally {
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Description</p>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full min-h-[120px] px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium outline-none focus:ring-4 focus:ring-[#3d0413]/5" placeholder="Details, pickup point, condition..." />
              </div>
              <button type="button" onClick={create} className="w-full px-6 py-4 rounded-2xl bg-[#3d0413] hover:bg-black text-white text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 border-black/90 active:scale-95 transition">
                Post listing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const GroupsPage: React.FC<{
  groups: ClassnetGroup[];
  setGroups: React.Dispatch<React.SetStateAction<ClassnetGroup[]>>;
}> = ({ groups, setGroups }) => {
  const toggle = (id: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== id
          ? g
          : { ...g, isJoined: !g.isJoined, memberCount: g.memberCount + (g.isJoined ? -1 : 1) }
      )
    );
  };
  return (
    <div className="bg-white/90 rounded-[2rem] border border-slate-200/70 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.35)] p-5 backdrop-blur">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map((g) => (
          <div key={g.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-[#3d0413] via-rose-700 to-indigo-600 opacity-90" />
            <div className="p-5">
              <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{g.name}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{g.memberCount} members</p>
              <p className="text-sm text-slate-700 font-medium mt-3 line-clamp-3">{g.description}</p>
              <button
                type="button"
                onClick={() => toggle(g.id)}
                className={`mt-4 w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 active:scale-95 transition ${
                  g.isJoined ? 'bg-slate-200 text-slate-900 border-slate-400 hover:bg-slate-300' : 'bg-[#3d0413] text-white border-black/90 hover:bg-black'
                }`}
              >
                {g.isJoined ? 'Joined' : 'Join group'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EventsPage: React.FC<{
  events: ClassnetEvent[];
  setEvents: React.Dispatch<React.SetStateAction<ClassnetEvent[]>>;
}> = ({ events, setEvents }) => {
  const rsvp = (id: string, v: ClassnetEvent['rsvp']) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, rsvp: v } : e)));
  };
  return (
    <div className="space-y-4">
      {events.map((e) => (
        <div key={e.id} className="bg-white/90 rounded-[2rem] border border-slate-200/70 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.35)] p-6 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{e.title}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mt-1">{new Date(e.startAt).toLocaleString()} · {e.location}</p>
            </div>
            <span className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
              e.rsvp === 'GOING' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : e.rsvp === 'INTERESTED' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              {e.rsvp === 'NONE' ? 'No RSVP' : e.rsvp}
            </span>
          </div>
          <p className="text-slate-700 font-medium mt-4">{e.description}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => rsvp(e.id, 'GOING')} className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 border-black/70 active:scale-95 transition">Going</button>
            <button type="button" onClick={() => rsvp(e.id, 'INTERESTED')} className="px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 border-black/70 active:scale-95 transition">Interested</button>
            <button type="button" onClick={() => rsvp(e.id, 'NONE')} className="px-4 py-3 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-900 text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition">Clear</button>
          </div>
        </div>
      ))}
    </div>
  );
};

const MessagesPage: React.FC<{ user: User; addNotif: (t: string) => void }> = ({ user, addNotif }) => {
  const [threads] = useState<MessageThread[]>(() => [
    { id: 't1', title: 'ICT 2026', lastMessage: 'Reminder: lab at 2pm.', updatedAt: new Date().toISOString() },
    { id: 't2', title: 'Library Helpdesk', lastMessage: 'Your request has been received.', updatedAt: new Date().toISOString() },
    { id: 't3', title: 'Class Rep', lastMessage: 'Please share your admission number.', updatedAt: new Date().toISOString() },
  ]);
  const [active, setActive] = useState<MessageThread | null>(threads[0] ?? null);
  const [val, setVal] = useState('');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-4 bg-white/90 rounded-[2rem] border border-slate-200/70 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.35)] p-4 backdrop-blur">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] px-2 mb-3">Threads</p>
        <div className="space-y-2">
          {threads.map((t) => (
            <button key={t.id} type="button" onClick={() => setActive(t)} className={`w-full text-left p-3 rounded-2xl border transition ${
              active?.id === t.id ? 'bg-[#fdf2f2] border-rose-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}>
              <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{t.title}</p>
              <p className="text-[10px] font-bold text-slate-500 truncate mt-1">{t.lastMessage}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="lg:col-span-8 bg-white/90 rounded-[2rem] border border-slate-200/70 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.35)] p-5 backdrop-blur">
        {!active ? (
          <div className="p-10 text-center text-slate-400 font-bold">Select a thread.</div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{active.title}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Classnet messages</p>
              </div>
              <button type="button" className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest shadow-sm" onClick={() => addNotif('Realtime messaging will be enabled when backend is connected.')}>
                Enable realtime
              </button>
            </div>
            <div className="space-y-3 min-h-[260px]">
              <div className="flex justify-start">
                <div className="max-w-[75%] p-3 rounded-2xl bg-slate-100 border border-slate-200">
                  <p className="text-sm font-bold text-slate-700">Hello {user.name.split(' ')[0]} — welcome to Classnet messages.</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[75%] p-3 rounded-2xl bg-[#3d0413] text-white border border-black/20">
                  <p className="text-sm font-bold">Thanks!</p>
                </div>
              </div>
            </div>
            <form
              className="mt-4 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!val.trim()) return;
                addNotif('Message sending will be enabled when backend is connected.');
                setVal('');
              }}
            >
              <div className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3">
                <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Write a message..." className="bg-transparent outline-none w-full text-sm font-bold text-slate-700 placeholder:text-slate-400" />
              </div>
              <button type="submit" className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest border-b-4 border-black active:scale-95 transition flex items-center gap-2">
                <Send size={14} /> Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

const ProfilePage: React.FC<{
  user: User;
  profile: ClassnetProfile;
  setProfile: React.Dispatch<React.SetStateAction<ClassnetProfile>>;
  addNotif: (t: string) => void;
  viewedUserId?: string | null;
  onBackToMe: () => void;
}> = ({ user, profile, setProfile, addNotif, viewedUserId, onBackToMe }) => {
  const isSelf = !viewedUserId || viewedUserId === user.id;
  const [remoteProfile, setRemoteProfile] = useState<{ userId: string; displayName: string; headline?: string | null; department?: string | null; avatarUrl?: string | null } | null>(null);
  const [remoteLive, setRemoteLive] = useState<LiveSession | null>(null);

  // Load remote profile + live status when viewing someone else
  useEffect(() => {
    if (!supabase || isSelf || !viewedUserId) {
      setRemoteProfile(null);
      setRemoteLive(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('classnet_profiles')
        .select('user_id,display_name,headline,department,avatar_url')
        .eq('user_id', viewedUserId)
        .maybeSingle();
      if (!cancelled && data) {
        setRemoteProfile({
          userId: data.user_id,
          displayName: data.display_name,
          headline: data.headline,
          department: data.department,
          avatarUrl: data.avatar_url,
        });
      }
      const { data: lives } = await supabase
        .from('classnet_live_sessions')
        .select('*')
        .eq('status', 'LIVE')
        .eq('host_id', viewedUserId)
        .order('started_at', { ascending: false })
        .limit(1);
      if (!cancelled && lives && lives[0]) {
        const r: any = lives[0];
        setRemoteLive({
          id: r.id,
          title: r.title,
          hostId: r.host_id,
          hostName: r.host_name,
          type: r.type,
          audience: r.audience,
          viewerCount: 1,
          startedAt: r.started_at,
          isLive: true,
          inviteCode: r.invite_code,
          passkey: r.passkey,
        });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSelf, viewedUserId]);

  const [name, setName] = useState(profile.displayName || user.name);
  const [headline, setHeadline] = useState(profile.headline || 'Student · TKNP');
  const [dept, setDept] = useState(profile.department || '');

  if (!isSelf) {
    const p = remoteProfile;
    return (
      <div className="space-y-4">
        <div className="bg-white/90 rounded-[2rem] border border-slate-200/70 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.35)] p-6 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                {p?.avatarUrl ? (
                  <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <span className="text-slate-700 font-black text-xl">{(p?.displayName || 'U').slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black text-slate-900 truncate">{p?.displayName || 'User'}</p>
                <p className="text-sm font-bold text-slate-600 truncate">{p?.headline || 'Classnet user'}</p>
                {p?.department && <p className="text-xs font-bold text-slate-500 mt-1">{p.department}</p>}
              </div>
            </div>
            <button type="button" onClick={onBackToMe} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black">
              Back
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-black text-slate-900">Live</p>
          {remoteLive ? (
            <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{remoteLive.title}</p>
                <p className="text-xs font-bold text-slate-500 mt-1">LIVE now · {remoteLive.audience.toLowerCase()} · {remoteLive.type}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addNotif('Join from profile: wire to Live theater next.')}
                  className="px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-black"
                >
                  Watch live
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!supabase) return;
                    await supabase.from('classnet_live_guest_requests').insert({
                      live_id: remoteLive.id,
                      from_user_id: user.id,
                      from_name: user.name,
                      note: 'Request to join as guest.',
                      status: 'PENDING',
                    });
                    addNotif('Guest request sent.');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black"
                >
                  Request to join
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm font-bold text-slate-500 mt-2">Not live right now.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-black text-slate-900">Activity</p>
          <p className="text-sm font-bold text-slate-500 mt-2">Next: posts/reels activity can be stored in Supabase too.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 rounded-[2rem] border border-slate-200/70 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.35)] p-6 backdrop-blur">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
            <div className="w-24 h-24 rounded-[2rem] bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-sm">
              {profile.avatarDataUrl ? (
                <img src={profile.avatarDataUrl} alt="Avatar" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <span className="text-slate-700 font-black text-3xl">{(name || user.name).slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <p className="mt-4 text-lg font-black text-slate-900 uppercase tracking-tight">{name}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mt-1">{headline}</p>
            {dept && <p className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700"><UsersRound size={14} /> {dept}</p>}
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Display name</p>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/5" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Department</p>
              <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="ICT / Electrical / ..." className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/5" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Headline</p>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/5" />
          </div>
          <button
            type="button"
            onClick={() => {
              setProfile((p) => ({ ...p, displayName: name.trim() || user.name, headline: headline.trim() || 'Student · TKNP', department: dept.trim() || undefined }));
              addNotif('Profile updated.');
            }}
            className="w-full px-6 py-4 rounded-2xl bg-[#3d0413] hover:bg-black text-white text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 border-black/90 active:scale-95 transition"
          >
            Save changes
          </button>
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mb-2">Identity</p>
            <p className="text-sm font-bold text-slate-700">Signed in as <span className="font-black">{user.name}</span></p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Changes here only affect Classnet display.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsPage: React.FC<{ addNotif: (t: string) => void }> = ({ addNotif }) => {
  const [privacy, setPrivacy] = useState<'SCHOOL' | 'PUBLIC'>('SCHOOL');
  const [safeMode, setSafeMode] = useState(true);
  const [notifMode, setNotifMode] = useState<'ALL' | 'IMPORTANT'>('IMPORTANT');
  return (
    <div className="bg-white/90 rounded-[2rem] border border-slate-200/70 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.35)] p-6 backdrop-blur space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mb-2">Privacy</p>
          <p className="text-sm font-bold text-slate-700">Default visibility</p>
          <select value={privacy} onChange={(e) => setPrivacy(e.target.value as any)} className="mt-3 w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 font-bold outline-none">
            <option value="SCHOOL">School only</option>
            <option value="PUBLIC">Public</option>
          </select>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mb-2">Safety</p>
          <p className="text-sm font-bold text-slate-700">Campus safe mode</p>
          <button
            type="button"
            onClick={() => setSafeMode((v) => !v)}
            className={`mt-3 w-full px-5 py-4 rounded-2xl border font-black uppercase text-[10px] tracking-widest ${
              safeMode ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {safeMode ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mb-2">Notifications</p>
          <p className="text-sm font-bold text-slate-700">Delivery</p>
          <select value={notifMode} onChange={(e) => setNotifMode(e.target.value as any)} className="mt-3 w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 font-bold outline-none">
            <option value="ALL">All activity</option>
            <option value="IMPORTANT">Important only</option>
          </select>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-[#3d0413]">
          <HeartHandshake size={22} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Professional policy</p>
          <p className="text-sm text-slate-700 font-medium mt-1">Respectful communication, academic integrity, and privacy are enforced on Classnet.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => addNotif('Settings saved.')}
        className="w-full px-6 py-4 rounded-2xl bg-[#3d0413] hover:bg-black text-white text-[10px] font-black uppercase tracking-widest shadow-xl border-b-4 border-black/90 active:scale-95 transition"
      >
        Save settings
      </button>
    </div>
  );
};

const StoriesRow: React.FC<{
  user: User;
  profile: ClassnetProfile;
  onCreateStory: () => void;
}> = ({ user, profile, onCreateStory }) => {
  const stories: Story[] = useMemo(
    () => [
      { id: 's-mine', authorName: profile.displayName || user.name, isMine: true, imageDataUrl: profile.avatarDataUrl ?? null },
      { id: 's1', authorName: 'Dag Heward', imageDataUrl: null },
      { id: 's2', authorName: 'Vusi Thembekwayo', imageDataUrl: null },
      { id: 's3', authorName: 'Charity Nganga', imageDataUrl: null },
      { id: 's4', authorName: 'Peter Tuch', imageDataUrl: null },
    ],
    [profile.avatarDataUrl, profile.displayName, user.name]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {stories.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => (s.isMine ? onCreateStory() : undefined)}
            className="relative w-28 sm:w-32 h-44 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 hover:shadow-md transition"
            title={s.isMine ? 'Create my story' : s.authorName}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/10 to-slate-900/60" />
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              <MonitorPlay size={26} />
            </div>

            <div className="absolute top-3 left-3 w-9 h-9 rounded-full border-2 border-[#2563eb] bg-white overflow-hidden flex items-center justify-center">
              {s.imageDataUrl ? (
                <img src={s.imageDataUrl} alt={s.authorName} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <span className="text-slate-700 font-black text-sm">{s.authorName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>

            {s.isMine && (
              <div className="absolute bottom-11 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center border-4 border-white shadow">
                <span className="text-2xl leading-none font-black">+</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white text-[12px] font-black leading-tight">
                {s.isMine ? 'Create my story' : s.authorName}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const CommentComposer: React.FC<{ onSubmit: (msg: string) => void }> = ({ onSubmit }) => {
  const [val, setVal] = useState('');
  return (
    <form
      className="mt-4 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const msg = val;
        setVal('');
        onSubmit(msg);
      }}
    >
      <div className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Write a comment..."
          className="bg-transparent outline-none w-full text-sm font-bold text-slate-700 placeholder:text-slate-400"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest border-b-4 border-black active:scale-95 transition flex items-center gap-2"
      >
        <MessageCircle size={14} /> Comment
      </button>
    </form>
  );
};

export default Classnet;

