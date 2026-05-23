import React, { useEffect, useMemo, useRef, useState } from 'react';
import ClassMaterials from './ClassMaterials';
import ClassAssignments from './ClassAssignments';
import ClassGrades from './ClassGrades';
import ClassSchedule from './ClassSchedule';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Calendar,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileDown,
  FileText,
  History,
  HelpCircle,
  Hash,
  Maximize2,
  MessageSquare,
  Monitor,
  Minus,
  Minimize2,
  Play,
  Presentation,
  Search,
  Settings,
  Smartphone,
  User,
  UserCircle,
  Video,
  X,
  Plus,
} from 'lucide-react';
import { addSignal, listenSignals, removeSignal } from '../lib/tknpSupabaseSignals';
import { getAllRecordings, type RecordedSession } from '../lib/recordingsDb';
import { getStoredProfile } from '../lib/profile';
import { fetchAllSchoolClasses, subscribeSchoolClasses } from '../lib/schoolClassService';
import { supabase } from '../lib/supabaseClient';
import { LIVE_BRIDGE_CHANNEL, normalizeTitle } from '../lib/liveSessionBridge';
import type { LiveSessionBridgePayload } from '../lib/liveSessionBridge';

interface ClassItem {
  id: string;
  code?: string;
  title: string;
  teacher: string;
  room: string;
  schedule: string;
  grade?: number;
  type: 'PHYSICAL' | 'ONLINE';
  studentCount: number;
  attendance?: number;
  assignmentsDone?: string;
  platform?: 'Microsoft Teams' | 'Zoom' | 'Google Meet';
  link?: string;
  isLive?: boolean;
  department: string;
  startTime?: string;
}

interface StudentProfile {
  fullName: string;
  schoolRegistryId: string;
  phone: string;
  gender: string;
  department?: string;
  classCode?: string;
}

interface LiveSession {
  classId: string;
  title: string;
  teacher: string;
  isLive: boolean;
}

interface Props {
  initialTab?: 'PHYSICAL' | 'ONLINE';
  isLecturerPreview?: boolean;
  onNavigateToProfile?: () => void;
}

const MY_CLASSES_KEY = 'poly_my_classes';
const PROFILE_KEY = 'poly_student_profile';
const REGISTRY_KEY = 'poly_institutional_registry';
const LIVE_SESSION_KEY = 'poly_live_session';
const ENROLLED_STUDENTS_KEY = 'poly_enrolled_students';
const CURRENT_STUDENT_ID_KEY = 'poly_current_student_identity';

const SEED_CLASSES: ClassItem[] = [
  {
    id: 'seed-1',
    title: 'POWER SYSTEMS II',
    teacher: 'Dr. Kamau',
    room: 'Lab 2',
    schedule: 'Mon/Wed/Fri 08:00 AM',
    grade: 82,
    type: 'PHYSICAL',
    studentCount: 42,
    attendance: 90,
    assignmentsDone: '4/5 done',
    department: 'ELECTRICAL ENGINEERING',
  },
  {
    id: 'seed-2',
    title: 'PROGRAMMING BASICS',
    teacher: 'Dr. Wangari',
    room: 'Online',
    schedule: 'Tue/Thu 02:00 PM',
    grade: 85,
    type: 'ONLINE',
    platform: 'Microsoft Teams',
    link: 'https://teams.microsoft.com/l/meetup-join/ict101',
    isLive: false,
    studentCount: 38,
    attendance: 95,
    assignmentsDone: '5/5 done',
    department: 'ICT',
  },
];

const GLOBAL_AVAILABLE_CLASSES: ClassItem[] = [
  {
    id: 'g1',
    title: 'ELECTRICAL INSTALLATION III',
    teacher: 'Eng. Mutua',
    room: 'Workshop 4',
    schedule: 'Mon/Wed 08:00 AM',
    type: 'PHYSICAL',
    studentCount: 25,
    department: 'ELECTRICAL ENGINEERING',
  },
  {
    id: 'g2',
    title: 'OBJECT ORIENTED PROGRAMMING',
    teacher: 'Dr. Wangari',
    room: 'Online',
    schedule: 'Fri 10:00 AM',
    type: 'ONLINE',
    platform: 'Microsoft Teams',
    link: 'https://teams.microsoft.com/l/meetup-join/oop',
    isLive: true,
    studentCount: 60,
    department: 'ICT',
  },
  {
    id: 'g3',
    title: 'FLUID MECHANICS',
    teacher: 'Mr. Otieno',
    room: 'Room 12',
    schedule: 'Tue/Thu 11:00 AM',
    type: 'PHYSICAL',
    studentCount: 40,
    department: 'CIVIL ENGINEERING',
  },
  {
    id: 'g4',
    title: 'ENTREPRENEURSHIP',
    teacher: 'Mrs. Njeri',
    room: 'Online',
    schedule: 'Wed 02:00 PM',
    type: 'ONLINE',
    platform: 'Zoom',
    link: 'https://zoom.us/j/ent101',
    isLive: false,
    studentCount: 120,
    department: 'BUSINESS',
  },
  {
    id: 'g5',
    title: 'ELECTRONICS I',
    teacher: 'Prof. Juma',
    room: 'Lab 1',
    schedule: 'Mon/Fri 02:00 PM',
    type: 'PHYSICAL',
    studentCount: 35,
    department: 'ELECTRICAL ENGINEERING',
  },
];

const normalizeDepartment = (value?: string): string =>
  (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const normalizeClassCode = (value?: string): string =>
  (value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const deptMatch = (classDept: string, profileDept: string): boolean =>
  classDept === profileDept || classDept.includes(profileDept) || profileDept.includes(classDept);

const codeMatch = (classCode: string, profileCode: string): boolean =>
  classCode === profileCode || classCode.startsWith(profileCode) || profileCode.startsWith(classCode);

function safeParse<T>(value: string | null): T | null {
  if (value === null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

const sanitizeClassItem = (raw: unknown): ClassItem | null => {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const typeValue = record.type === 'ONLINE' ? 'ONLINE' : record.type === 'PHYSICAL' ? 'PHYSICAL' : null;
  if (!typeValue) return null;

  const id = String(record.id ?? record.class_key ?? '').trim();
  const title = String(record.title ?? '').trim();
  if (!id || !title) return null;

  const department = String(record.department ?? record.department ?? 'GENERAL').trim() || 'GENERAL';
  const schedule = String(record.schedule ?? record.room_or_platform ?? 'TBA');
  const room = String(record.room ?? record.room_or_platform ?? (typeValue === 'ONLINE' ? 'Online' : 'Classroom'));
  const teacher = String(record.teacher ?? record.teacher_name ?? 'Lecturer');

  return {
    id,
    code: record.code ? String(record.code) : undefined,
    title,
    teacher,
    room,
    schedule,
    grade: typeof record.grade === 'number' ? record.grade : 0,
    type: typeValue,
    studentCount: Number(record.studentCount ?? record.student_count ?? 0),
    attendance: typeof record.attendance === 'number' ? record.attendance : 0,
    assignmentsDone: record.assignmentsDone ? String(record.assignmentsDone) : '0 assignments',
    platform: record.platform ? String(record.platform) as ClassItem['platform'] : undefined,
    link: record.link ? String(record.link) : undefined,
    isLive: Boolean(record.isLive),
    department,
    startTime: record.startTime ? String(record.startTime) : undefined,
  };
};

const loadMyClasses = (): ClassItem[] | null => {
  const raw = localStorage.getItem(MY_CLASSES_KEY);
  if (raw === null) return null;
  const parsed = safeParse<unknown[]>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(sanitizeClassItem)
    .filter((item): item is ClassItem => item !== null);
};

const saveMyClasses = (classes: ClassItem[]): void => {
  localStorage.setItem(MY_CLASSES_KEY, JSON.stringify(classes));
};

const loadStoredProfile = (): StudentProfile | null => {
  const raw = localStorage.getItem(PROFILE_KEY);
  const parsed = safeParse<Record<string, unknown>>(raw);
  if (!parsed) return null;

  return {
    fullName: String(parsed.fullName ?? parsed.full_name ?? ''),
    schoolRegistryId: String(parsed.schoolRegistryId ?? parsed.schoolRegistryId ?? parsed.school_registry_id ?? ''),
    phone: String(parsed.phone ?? ''),
    gender: String(parsed.gender ?? ''),
    department: String(parsed.department ?? ''),
    classCode: String(parsed.classCode ?? parsed.class_code ?? parsed.class ?? ''),
  };
};

const loadRegistryClasses = (): ClassItem[] => {
  const raw = localStorage.getItem(REGISTRY_KEY);
  const parsed = safeParse<unknown[]>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(sanitizeClassItem)
    .filter((item): item is ClassItem => item !== null);
};

const loadLiveSessionFromStorage = (): LiveSession | null => {
  const raw = localStorage.getItem(LIVE_SESSION_KEY);
  const parsed = safeParse<Record<string, unknown>>(raw);
  if (!parsed) return null;
  if (!parsed.classId || typeof parsed.classId !== 'string') return null;
  return {
    classId: parsed.classId,
    title: String(parsed.title ?? ''),
    teacher: String(parsed.teacher ?? ''),
    isLive: Boolean(parsed.isLive),
  };
};

const getStudentProfile = (): StudentProfile => {
  const sessionRaw = typeof window !== 'undefined' ? sessionStorage.getItem('poly_library_user_current') : null;
  let sessionUser: Record<string, unknown> | null = null;
  if (sessionRaw) {
    try {
      sessionUser = JSON.parse(sessionRaw) as Record<string, unknown>;
    } catch {
      sessionUser = null;
    }
  }

  const userId = typeof sessionUser?.id === 'string' ? sessionUser.id : undefined;
  const stored = userId ? getStoredProfile(userId) : null;
  if (stored) {
    return {
      fullName: stored.fullName || String(sessionUser?.name ?? 'Student'),
      schoolRegistryId: stored.schoolRegistryId || '',
      phone: stored.phone || '',
      gender: stored.gender || '',
      department: stored.department || '',
      classCode: stored.class || '',
    };
  }

  const fallback = loadStoredProfile();
  return fallback ?? {
    fullName: String(sessionUser?.name ?? 'Student'),
    schoolRegistryId: '',
    phone: '',
    gender: '',
    department: '',
    classCode: '',
  };
};

const getCurrentStudentIdentity = (): { id: string; name: string } => {
  const raw = localStorage.getItem(CURRENT_STUDENT_ID_KEY);
  const parsed = safeParse<Record<string, unknown>>(raw);
  if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
    return { id: parsed.id, name: parsed.name };
  }

  const profile = getStudentProfile();
  return {
    id: profile.schoolRegistryId || `anon-${Date.now()}`,
    name: profile.fullName || 'Student',
  };
};

const StudentClasses: React.FC<Props> = ({ initialTab = 'PHYSICAL', isLecturerPreview = false, onNavigateToProfile }) => {
  const [activeView, setActiveView] = useState<'LIST' | 'DETAIL' | 'NOT_LIVE' | 'JOIN_LIST' | 'LIVE_JOIN' | 'MATERIALS' | 'ASSIGNMENTS' | 'GRADES' | 'SCHEDULE'>('LIST');
  const [activeTab, setActiveTab] = useState<'PHYSICAL' | 'ONLINE'>(initialTab);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<StudentProfile>(() => getStudentProfile());
  const [profileDraft, setProfileDraft] = useState<StudentProfile>(() => getStudentProfile());
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [pendingEnrollment, setPendingEnrollment] = useState<ClassItem | null>(null);
  const [myClassesSaved, setMyClassesSaved] = useState<boolean>(() => loadMyClasses() !== null);
  const [myClasses, setMyClasses] = useState<ClassItem[]>(() => {
    const loaded = loadMyClasses();
    return loaded === null ? [...SEED_CLASSES] : loaded;
  });
  const [dbClasses, setDbClasses] = useState<ClassItem[]>([]);
  const [registryClasses, setRegistryClasses] = useState<ClassItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<string>('Idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [liveSession, setLiveSession] = useState<LiveSession | null>(() => loadLiveSessionFromStorage());
  const [recordedSessions, setRecordedSessions] = useState<RecordedSession[]>([]);
  const [teacherFeedStatus, setTeacherFeedStatus] = useState<'CONNECTING' | 'LIVE' | 'OFFLINE' | 'ERROR'>('OFFLINE');
  const [isStudentCamOn, setIsStudentCamOn] = useState(false);
  const [studentStream, setStudentStream] = useState<MediaStream | null>(null);
  const [feedTheaterMode, setFeedTheaterMode] = useState(false);
  const [feedFullscreen, setFeedFullscreen] = useState(false);
  const [feedSettingsOpen, setFeedSettingsOpen] = useState(false);
  const [feedQuality, setFeedQuality] = useState<'Auto' | '720p' | '1080p'>('1080p');
  const [feedPlaybackSpeed, setFeedPlaybackSpeed] = useState<1 | 0.5 | 0.75 | 1.25 | 1.5 | 1.75 | 2>(1);
  const [feedSubtitlesOn, setFeedSubtitlesOn] = useState(false);
  const [feedSubtitleLang, setFeedSubtitleLang] = useState<'en' | 'sw'>('en');
  const [feedAudioTrack, setFeedAudioTrack] = useState<'default' | 'en' | 'sw'>('default');
  const [feedStatsOpen, setFeedStatsOpen] = useState(false);
  const [liveClassId, setLiveClassId] = useState<string | null>(null);

  const teacherVideoRef = useRef<HTMLVideoElement | null>(null);
  const teacherPiPRef = useRef<HTMLVideoElement | null>(null);
  const studentVideoRef = useRef<HTMLVideoElement | null>(null);
  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const settingsPanelRef = useRef<HTMLDivElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalUnsubscribeRef = useRef<(() => void) | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const teacherIdRef = useRef<string | null>(null);
  const teacherStreamCountRef = useRef(0);
  const teacherStreamsRef = useRef<{ camera: MediaStream | null; screen: MediaStream | null }>({ camera: null, screen: null });
  const [teacherStreams, setTeacherStreams] = useState<{ camera: MediaStream | null; screen: MediaStream | null }>({ camera: null, screen: null });

  const profileDept = normalizeDepartment(profile.department);
  const profileCode = normalizeClassCode(profile.classCode);
  const profileComplete = Boolean(profileDept && profileCode);

  const saveProfile = (nextProfile: StudentProfile): StudentProfile => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    setProfileDraft(nextProfile);
    return nextProfile;
  };

  const persistMyClasses = (classes: ClassItem[]): void => {
    setMyClasses(classes);
    saveMyClasses(classes);
    setMyClassesSaved(true);
  };

  const isProfileCompleteFor = (profileToCheck: StudentProfile) => {
    return Boolean(
      normalizeDepartment(profileToCheck.department) &&
      normalizeClassCode(profileToCheck.classCode),
    );
  };

  const getAllClassSources = useMemo(() => {
    const all = [...GLOBAL_AVAILABLE_CLASSES, ...registryClasses, ...dbClasses].map((item) => sanitizeClassItem(item)).filter((item): item is ClassItem => item !== null);
    const map = new Map<string, ClassItem>();
    for (const item of all) {
      const key = `${item.id}::${item.title}`;
      if (!map.has(key)) map.set(key, item);
    }
    return Array.from(map.values());
  }, [dbClasses, registryClasses]);

  const enrolledIds = useMemo(() => new Set(myClasses.map((item) => item.id)), [myClasses]);

  const filteredMyClasses = useMemo(
    () => myClasses.filter((cls) => cls.type === activeTab),
    [activeTab, myClasses],
  );

  const joinableClasses = useMemo(() => {
    return getAllClassSources.filter((cls) => {
      if (cls.type !== activeTab) return false;
      if (enrolledIds.has(cls.id)) return false;
      const classDept = normalizeDepartment(cls.department);
      const classCode = normalizeClassCode(cls.code || cls.title);
      const searchMatch = searchQuery.trim().length === 0 || [cls.title, cls.teacher, cls.department].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDept = !profileDept || deptMatch(classDept, profileDept);
      const matchesCode = !profileCode || codeMatch(classCode, profileCode);
      return searchMatch && matchesDept && matchesCode;
    });
  }, [activeTab, enrolledIds, getAllClassSources, profileComplete, profileCode, profileDept, searchQuery]);

  const availableOnlineClasses = useMemo(() => {
    return getAllClassSources.filter((cls) => {
      if (cls.type !== 'ONLINE') return false;
      if (enrolledIds.has(cls.id)) return false;
      const classDept = normalizeDepartment(cls.department);
      const classCode = normalizeClassCode(cls.code || cls.title);
      const matchesDept = !profileDept || deptMatch(classDept, profileDept);
      const matchesCode = !profileCode || codeMatch(classCode, profileCode);
      return matchesDept && matchesCode;
    });
  }, [enrolledIds, getAllClassSources, profileComplete, profileCode, profileDept]);

  const liveSessionActiveFor = (cls: ClassItem) => {
    if (!liveSession?.isLive) return false;
    if (liveSession.classId === cls.id) return true;
    if (liveSession.title && cls.title) {
      const sessionNorm = normalizeTitle(liveSession.title);
      const classNorm = normalizeTitle(cls.title);
      return sessionNorm.length >= 4 && classNorm.includes(sessionNorm.slice(0, 6));
    }
    return false;
  };

  const shouldShowEmptyState = filteredMyClasses.length === 0 && myClassesSaved;

  const loadRegistry = () => {
    setRegistryClasses(loadRegistryClasses());
  };

  const loadLiveSession = () => {
    const session = loadLiveSessionFromStorage();
    setLiveSession(session);
    setMyClasses((prev) =>
      prev.map((cls) => ({
        ...cls,
        isLive: Boolean(
          session &&
          session.isLive &&
          (cls.id === session.classId || normalizeTitle(cls.title).includes(normalizeTitle(session.title).slice(0, 6)))
        ),
      }))
    );
  };

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      try {
        const recordings = await getAllRecordings();
        if (active) setRecordedSessions(recordings);
      } catch {
        if (active) setRecordedSessions([]);
      }
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadDb = async () => {
      setSyncStatus('Syncing');
      try {
        const rows = await fetchAllSchoolClasses();
        if (!active) return;
        setDbClasses(rows.map((row) => ({
          id: row.class_key,
          code: row.code,
          title: row.title,
          teacher: row.teacher_name || 'Lecturer',
          room: row.room_or_platform || (row.class_mode === 'ONLINE' ? 'Online' : 'Classroom'),
          schedule: row.class_mode === 'ONLINE' ? 'Scheduled by Lecturer' : 'Scheduled by Lecturer',
          type: row.class_mode,
          studentCount: row.student_count ?? 0,
          department: row.department || 'GENERAL',
          platform: row.class_mode === 'ONLINE' ? 'Microsoft Teams' : undefined,
          link: row.class_mode === 'ONLINE' ? undefined : undefined,
          isLive: false,
        })));
        setSyncStatus('Synced');
      } catch {
        if (active) setSyncStatus('Fallback');
      } finally {
        if (active) setLastSyncTime(new Date().toLocaleTimeString());
      }
    };
    void loadDb();
    const unsubscribe = subscribeSchoolClasses(() => {
      void loadDb();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadRegistry();
    const onStorage = (event: StorageEvent) => {
      if (event.key === REGISTRY_KEY) loadRegistry();
      if (event.key === LIVE_SESSION_KEY) loadLiveSession();
      if (event.key === MY_CLASSES_KEY) {
        const loaded = loadMyClasses();
        if (loaded !== null) {
          setMyClasses(loaded);
          setMyClassesSaved(true);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(loadLiveSession, 3000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, []);

  const normalizeLiveSessionRow = (row: any): LiveSession | null => {
    if (!row || typeof row.title !== 'string') return null;
    const classId = typeof row.class_id === 'string' && row.class_id.trim() ? row.class_id : String(row.id || '');
    return {
      classId,
      title: row.title,
      teacher: row.host_name || row.hostName || 'Lecturer',
      isLive: String(row.status || 'LIVE').toUpperCase() === 'LIVE',
    };
  };

  useEffect(() => {
    if (!supabase) return;

    const syncWithBackend = async () => {
      const { data, error } = await supabase
        .from('classnet_live_sessions')
        .select('*')
        .eq('status', 'LIVE');

      if (!error && Array.isArray(data) && data.length > 0) {
        const session = data.map(normalizeLiveSessionRow).find((item) => item !== null);
        if (session) {
          setLiveSession(session);
          setMyClasses((prev) =>
            prev.map((cls) => ({
              ...cls,
              isLive: session.isLive && (cls.id === session.classId || normalizeTitle(cls.title).includes(normalizeTitle(session.title).slice(0, 6))),
            }))
          );
        }
      }
    };

    void syncWithBackend();

    const channel = supabase
      .channel('student-live-session-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'classnet_live_sessions' }, (payload) => {
        const session = normalizeLiveSessionRow(payload.new);
        if (session?.isLive) {
          setLiveSession(session);
          setMyClasses((prev) =>
            prev.map((cls) => ({
              ...cls,
              isLive: session.isLive && (cls.id === session.classId || normalizeTitle(cls.title).includes(normalizeTitle(session.title).slice(0, 6))),
            }))
          );
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'classnet_live_sessions' }, (payload) => {
        const session = normalizeLiveSessionRow(payload.new);
        if (session?.isLive) {
          setLiveSession(session);
          setMyClasses((prev) =>
            prev.map((cls) => ({
              ...cls,
              isLive: session.isLive && (cls.id === session.classId || normalizeTitle(cls.title).includes(normalizeTitle(session.title).slice(0, 6))),
            }))
          );
        } else if (payload.old) {
          const oldClassId = String(payload.old.class_id || payload.old.id || '');
          setLiveSession((current) => (current?.classId === oldClassId ? null : current));
          setMyClasses((prev) =>
            prev.map((cls) => ({
              ...cls,
              isLive: false,
            }))
          );
        }
      })
      .subscribe();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(LIVE_BRIDGE_CHANNEL);
      channel.onmessage = (event: MessageEvent<LiveSessionBridgePayload>) => {
        const payload = event.data;
        if (!payload) return;

        setLiveSession({
          classId: payload.classId,
          title: payload.title,
          teacher: payload.teacher,
          isLive: payload.isLive,
        });

        setMyClasses((prev) =>
          prev.map((cls) => ({
            ...cls,
            isLive: payload.isLive && (
              cls.id === payload.classId || normalizeTitle(cls.title).includes(payload.classTitle.slice(0, 6))
            ),
          }))
        );
      };
    } catch {
      channel = null;
    }
    return () => {
      channel?.close();
    };
  }, []);

  useEffect(() => {
    if (!studentStream || !studentVideoRef.current) return;
    studentVideoRef.current.srcObject = studentStream;
    studentVideoRef.current.play().catch(() => {});
  }, [studentStream]);

  useEffect(() => {
    const mainStream = teacherStreamsRef.current.screen ?? teacherStreamsRef.current.camera;
    if (teacherVideoRef.current) {
      teacherVideoRef.current.srcObject = mainStream;
      teacherVideoRef.current.play().catch(() => {});
    }
    if (teacherPiPRef.current) {
      teacherPiPRef.current.srcObject = teacherStreamsRef.current.screen && teacherStreamsRef.current.camera ? teacherStreamsRef.current.camera : null;
      teacherPiPRef.current.play().catch(() => {});
    }
  }, [teacherStreams]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (feedSettingsOpen && settingsPanelRef.current && !settingsPanelRef.current.contains(event.target as Node)) {
        setFeedSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [feedSettingsOpen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFull = document.fullscreenElement === feedContainerRef.current;
      setFeedFullscreen(isFull);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const stopTeacherReceiver = () => {
    setLiveClassId(null);
    signalUnsubscribeRef.current?.();
    signalUnsubscribeRef.current = null;
    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    pcRef.current = null;
    teacherIdRef.current = null;
    pendingCandidatesRef.current = [];
    teacherStreamsRef.current = { camera: null, screen: null };
    setTeacherStreams({ camera: null, screen: null });
    setTeacherFeedStatus('OFFLINE');
    if (teacherVideoRef.current) teacherVideoRef.current.srcObject = null;
    if (teacherPiPRef.current) teacherPiPRef.current.srcObject = null;
  };

  const connectToLiveClass = async (cls: ClassItem) => {
    stopTeacherReceiver();
    setTeacherFeedStatus('CONNECTING');

    if (!cls.id) {
      setTeacherFeedStatus('ERROR');
      return;
    }

    const identity = getCurrentStudentIdentity();
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (!event.streams || event.streams.length === 0) return;
      setTeacherFeedStatus('LIVE');
      const incoming = event.streams[0];
      const slot = teacherStreamCountRef.current === 0 ? 'camera' : 'screen';
      teacherStreamCountRef.current = Math.min(teacherStreamCountRef.current + 1, 2);
      teacherStreamsRef.current = { ...teacherStreamsRef.current, [slot]: incoming };
      setTeacherStreams({ ...teacherStreamsRef.current });
    };

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (teacherIdRef.current) {
        await addSignal(cls.id, {
          type: 'candidate',
          classId: cls.id,
          from: identity.id,
          role: 'student',
          to: teacherIdRef.current,
          candidate,
        });
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        setTeacherFeedStatus('ERROR');
      }
    };

    const unsubscribe = listenSignals(cls.id, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added') continue;
        const doc = change.doc;
        const msg = doc.data();
        if (!msg || msg.role !== 'teacher') {
          try {
            if (msg?.role !== 'teacher') await removeSignal(cls.id, doc.id);
          } catch {
            // ignore
          }
          continue;
        }
        if (msg.to && msg.to !== identity.id) continue;

        try {
          if (msg.type === 'offer' && msg.sdp) {
            teacherIdRef.current = String(msg.from ?? '');
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await addSignal(cls.id, {
              type: 'answer',
              classId: cls.id,
              from: identity.id,
              role: 'student',
              to: msg.from,
              sdp: pc.localDescription ? { type: pc.localDescription.type, sdp: pc.localDescription.sdp } : null,
            });
            for (const candidate of pendingCandidatesRef.current) {
              await addSignal(cls.id, {
                type: 'candidate',
                classId: cls.id,
                from: identity.id,
                role: 'student',
                to: teacherIdRef.current,
                candidate,
              });
            }
            pendingCandidatesRef.current = [];
          } else if (msg.type === 'candidate' && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } else if (msg.type === 'end') {
            setTeacherFeedStatus('OFFLINE');
            stopTeacherReceiver();
          }
        } catch {
          setTeacherFeedStatus('ERROR');
        }
        try {
          await removeSignal(cls.id, doc.id);
        } catch {
          // ignore
        }
      }
    });

    signalUnsubscribeRef.current = unsubscribe;
    await addSignal(cls.id, {
      type: 'join',
      classId: cls.id,
      from: identity.id,
      role: 'student',
      name: identity.name,
    });
  };

  useEffect(() => {
    const classId = selectedClass?.id ?? null;
    const sessionIsLive = selectedClass ? liveSessionActiveFor(selectedClass) : false;

    if (!classId || !selectedClass || !sessionIsLive) {
      if (liveClassId !== null) {
        stopTeacherReceiver();
      }
      return undefined;
    }

    if (liveClassId === classId && pcRef.current !== null) {
      return undefined;
    }

    setLiveClassId(classId);
    void connectToLiveClass(selectedClass);

    return () => {
      stopTeacherReceiver();
    };
  }, [selectedClass, liveSession]);

  const handleEnrollClass = (cls: ClassItem, profileOverride?: StudentProfile) => {
    const activeProfile = profileOverride ?? profile;
    // Enrollment is allowed even when the local profile is incomplete.

    if (enrolledIds.has(cls.id)) return;
    const enrolled: ClassItem = {
      ...cls,
      grade: cls.grade ?? 0,
      attendance: cls.attendance ?? 0,
      assignmentsDone: cls.assignmentsDone ?? '0 assignments',
    };
    const next = [...myClasses, enrolled];
    persistMyClasses(next);
    const studentId = activeProfile.schoolRegistryId || getCurrentStudentIdentity().id;
    const enrollments = safeParse<unknown[]>(localStorage.getItem(ENROLLED_STUDENTS_KEY)) ?? [];
    if (Array.isArray(enrollments)) {
      const updated = [...enrollments, {
        id: `${cls.id}-${Date.now()}`,
        classId: cls.id,
        admNo: activeProfile.schoolRegistryId,
        studentName: activeProfile.fullName,
        phone: activeProfile.phone,
        status: 'ACTIVE',
        attendance: 0,
        gradeAverage: 0,
      }];
      localStorage.setItem(ENROLLED_STUDENTS_KEY, JSON.stringify(updated));
    }
    localStorage.setItem(CURRENT_STUDENT_ID_KEY, JSON.stringify({ id: studentId, name: activeProfile.fullName }));
    setPendingEnrollment(null);
    setActiveView('LIST');
  };

  const handleJoinClass = (cls: ClassItem) => {
    if (liveSessionActiveFor(cls) && liveSession) {
      const selected = liveSession.classId && liveSession.classId !== cls.id
        ? { ...cls, id: liveSession.classId }
        : cls;
      setSelectedClass(selected);
      setActiveView('LIVE_JOIN');
      return;
    }

    if (cls.type === 'ONLINE') {
      setSelectedClass(cls);
      setActiveView('NOT_LIVE');
      return;
    }

    setSelectedClass(cls);
    setActiveView('DETAIL');
  };

  const handleSaveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const savedProfile = saveProfile(profileDraft);
    if (pendingEnrollment) {
      handleEnrollClass(pendingEnrollment, savedProfile);
      if (!isProfileCompleteFor(savedProfile)) {
        return;
      }
    }
    setProfileModalOpen(false);
  };

  const openProfileAction = () => {
    if (onNavigateToProfile) {
      onNavigateToProfile();
      return;
    }
    setProfileModalOpen(true);
  };

  const toggleStudentCamera = async () => {
    if (isStudentCamOn) {
      studentStream?.getTracks().forEach((track) => track.stop());
      setStudentStream(null);
      setIsStudentCamOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStudentStream(stream);
      setIsStudentCamOn(true);
    } catch {
      setIsStudentCamOn(false);
    }
  };

  const toggleFeedFullscreen = async () => {
    if (!feedContainerRef.current) return;
    if (document.fullscreenElement === feedContainerRef.current) {
      await document.exitFullscreen();
      return;
    }
    await feedContainerRef.current.requestFullscreen().catch(() => {});
  };

  const captureScreenshot = () => {
    const video = teacherVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `live-screenshot-${Date.now()}.png`;
      link.click();
    } catch {
      // ignore
    }
  };

  const renderEmptyState = () => (
    <div className="py-20 px-8 sm:px-12 bg-white rounded-[3rem] border border-slate-200 shadow-sm text-center">
      <div className="mx-auto mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-[#3d0413] text-[#3d0413]">
        <Plus size={36} />
      </div>
      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">No Classes Yet</h3>
      <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.35em] mb-8">Your class list is empty. Add a new class to get started.</p>
      <button
        type="button"
        onClick={() => setActiveView('JOIN_LIST')}
        className="inline-flex items-center gap-3 px-8 py-4 bg-[#3d0413] text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.35em] shadow-lg"
      >
        Browse Available Classes
        <ChevronRight size={16} />
      </button>
    </div>
  );

  const renderList = () => {
    const hasNoClasses = shouldShowEmptyState;
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.45em] text-slate-400 mb-2">My Classes</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase text-[#1a202c] tracking-tight">{activeTab === 'PHYSICAL' ? 'Physical Classes' : 'Online Classes'}</h1>
          </div>
          <div className="flex items-center gap-3 bg-slate-100 rounded-3xl p-2 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('PHYSICAL')}
              className={`px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.35em] transition ${activeTab === 'PHYSICAL' ? 'bg-white text-[#3d0413] shadow-md' : 'text-slate-500'}`}
            >
              Physical
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ONLINE')}
              className={`px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.35em] transition ${activeTab === 'ONLINE' ? 'bg-[#3d0413] text-white shadow-md' : 'text-slate-500'}`}
            >
              Online
            </button>
          </div>
        </div>

        {activeTab === 'ONLINE' && liveSession?.isLive && (
          <div className="mb-8 rounded-[2.5rem] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-700">Live Right Now</p>
                <h2 className="text-2xl font-black text-slate-900 mt-2">{liveSession.title}</h2>
                <p className="text-sm text-slate-600">{liveSession.teacher} is live now.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const matchedClass = myClasses.find((cls) => liveSessionActiveFor(cls)) ?? {
                    id: liveSession.classId || 'live-temp',
                    title: liveSession.title,
                    teacher: liveSession.teacher,
                    room: 'Online',
                    schedule: 'Live now',
                    type: 'ONLINE' as const,
                    studentCount: 0,
                    department: 'GENERAL',
                  };
                  setSelectedClass(matchedClass);
                  setActiveView('LIVE_JOIN');
                }}
                className="rounded-2xl bg-emerald-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-white hover:bg-emerald-700 transition"
              >
                Join Live Class
              </button>
            </div>
          </div>
        )}
        {hasNoClasses ? renderEmptyState() : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {filteredMyClasses.map((cls, index) => (
              <div key={cls.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-xl transition-all">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">Module {String(index + 1).padStart(2, '0')}</span>
                    <span className={`px-3 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.35em] ${activeTab === 'ONLINE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-[#3d0413]'}`}>
                      {cls.type}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mb-4">{cls.title}</h2>
                  <div className="space-y-3 text-sm text-slate-500">
                    <div className="flex items-center gap-2"><span>👨‍🏫</span> {cls.teacher}</div>
                    <div className="flex items-center gap-2"><span>🏢</span> {cls.room}</div>
                    <div className="flex items-center gap-2"><span>📅</span> {cls.schedule}</div>
                    {activeTab === 'ONLINE' && cls.link && <div className="flex items-center gap-2 text-[#3d0413] text-sm truncate"><span>🔗</span> {cls.link.replace(/^https?:\/\//, '')}</div>}
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {activeTab === 'PHYSICAL' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Grade</span>
                        <span className="text-lg font-black text-slate-900">{cls.grade ?? 0}%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedClass(cls); setActiveView('DETAIL'); }}
                        className="w-full rounded-2xl bg-[#3d0413] text-white py-4 text-[10px] font-black uppercase tracking-[0.35em]"
                      >
                        View Details
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        {liveSessionActiveFor(cls) ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-2 text-[10px] font-black uppercase tracking-[0.35em]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.35em]"><Clock size={12} /> {cls.startTime ?? cls.schedule}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJoinClass(cls)}
                        className={`w-full rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.35em] ${liveSessionActiveFor(cls) ? 'bg-emerald-600 text-white' : 'bg-[#3d0413] text-white'}`}
                      >
                        {liveSessionActiveFor(cls) ? 'JOIN CLASS' : `Session: ${cls.startTime ?? cls.schedule}`}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => { setActiveView('JOIN_LIST'); setSearchQuery(''); }}
              className="rounded-[2.5rem] border-2 border-dashed border-slate-300 bg-white py-16 flex flex-col items-center justify-center text-slate-400 hover:border-[#3d0413] hover:text-[#3d0413] transition-all"
            >
              <div className="mb-4 inline-flex items-center justify-center rounded-full border-2 border-current h-16 w-16 text-3xl">+</div>
              <span className="text-[10px] font-black uppercase tracking-[0.35em]">{activeTab === 'PHYSICAL' ? 'Add Class' : 'Join New Class'}</span>
            </button>
          </div>
        )}

        {activeTab === 'ONLINE' && (
          <div className="mt-12 grid gap-8">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-3">Available Online Classes</h3>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-6">Browse classes you have not yet added.</p>
              {availableOnlineClasses.length === 0 ? (
                <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8 text-center text-slate-500 uppercase tracking-[0.35em]">No available online classes match your profile.</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {availableOnlineClasses.map((cls) => (
                    <div key={cls.id} className="rounded-[2rem] border border-slate-200 p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><Monitor size={20} /></div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">{cls.platform || 'ONLINE'}</p>
                            <h4 className="font-black text-lg text-slate-900">{cls.title}</h4>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500">👨‍🏫 {cls.teacher}</p>
                        <p className="text-sm text-slate-500">🏢 {cls.room}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEnrollClass(cls)}
                        className="mt-6 rounded-2xl bg-[#3d0413] px-5 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-white"
                      >
                        Join Class
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8">
              <h3 className="text-xs font-black uppercase tracking-[0.35em] text-slate-400 mb-4 flex items-center gap-2"><History size={16} /> History Classes</h3>
              {recordedSessions.length === 0 ? (
                <p className="text-sm font-black uppercase tracking-[0.35em] text-slate-300">No recorded sessions yet.</p>
              ) : (
                <div className="space-y-4">
                  {recordedSessions.map((rec) => (
                    <div key={rec.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-slate-900">{rec.title}</p>
                          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">{rec.teacherName}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.35em] text-slate-400">{new Date(rec.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const url = URL.createObjectURL(rec.blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${rec.title.replace(/\s+/g, '-')}-${rec.date.slice(0, 10)}.webm`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="rounded-2xl bg-[#3d0413] px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-white"
                        >
                          <FileDown size={14} /> Download
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const url = URL.createObjectURL(rec.blob);
                            const win = window.open('', '_blank');
                            if (win) {
                              win.document.write(`<video controls autoplay src="${url}" style="width:100%;height:100%;background:#000"></video>`);
                              win.document.close();
                            }
                          }}
                          className="rounded-2xl bg-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-slate-800"
                        >
                          Watch
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderJoinList = () => (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-10">
        <div>
          <button
            type="button"
            onClick={() => { setActiveView('LIST'); setSearchQuery(''); }}
            className="mb-4 inline-flex items-center gap-2 text-slate-500 uppercase tracking-[0.35em] font-black text-[10px]"
          >
            <ArrowLeft size={16} /> Back to Classes
          </button>
          <h1 className="text-5xl font-black uppercase tracking-tight text-[#1a202c]">Join New Class</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-500 uppercase tracking-[0.35em]">Filtered by your department and class code so you only see classes that match your profile.</p>
        </div>
        <div className="relative w-full max-w-xl">
          <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search title, teacher, department..."
            className="w-full rounded-[2rem] border border-slate-200 bg-white py-4 pl-14 pr-6 text-sm font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/10"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {!profileComplete ? (
            <div className="rounded-[3rem] border border-slate-200 bg-white p-10 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400 mb-3">Complete Your Profile First</p>
                  <h2 className="text-3xl font-black text-[#1a202c] uppercase tracking-tight">Your profile is incomplete.</h2>
                  <p className="mt-4 text-sm text-slate-500">Add your department and class code to see available classes. No empty screen, only a clear action.</p>
                </div>
                <button
                  type="button"
                  onClick={openProfileAction}
                  className="rounded-2xl bg-[#3d0413] px-8 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-white"
                >
                  Complete Profile
                </button>
              </div>
            </div>
          ) : null}

          {profileComplete && joinableClasses.length === 0 ? (
            <div className="rounded-[3rem] border border-slate-200 bg-slate-50 p-10 text-center text-slate-500 uppercase tracking-[0.35em]">
              No matching classes were found for your department and class code.
            </div>
          ) : null}

          {profileComplete && joinableClasses.length > 0 ? (
            <div className="space-y-4">
              {joinableClasses.map((cls) => (
                <div key={cls.id} className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">{cls.type} class</p>
                      <h3 className="text-xl font-black text-slate-900">{cls.title}</h3>
                      <p className="mt-2 text-sm text-slate-500">{cls.teacher} • {cls.department}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">{cls.type}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.35em] text-slate-500">
                    <div className="rounded-2xl bg-slate-50 p-3">Room: {cls.room}</div>
                    <div className="rounded-2xl bg-slate-50 p-3">Time: {cls.schedule}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEnrollClass(cls)}
                    className="self-start rounded-2xl bg-[#3d0413] px-8 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-white"
                  >
                    Join Class
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-[3rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 mb-4">Sync Debug Bar</p>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>DB count</span><span>{dbClasses.length}</span></div>
              <div className="flex items-center justify-between"><span>Registry count</span><span>{registryClasses.length}</span></div>
              <div className="flex items-center justify-between"><span>Profile Dept</span><span>{profile.department || '—'}</span></div>
              <div className="flex items-center justify-between"><span>Profile Code</span><span>{profile.classCode || '—'}</span></div>
              <div className="flex items-center justify-between"><span>Match count</span><span>{joinableClasses.length}</span></div>
              <div className="flex items-center justify-between"><span>Status</span><span>{syncStatus}</span></div>
              <div className="flex items-center justify-between"><span>Last sync</span><span>{lastSyncTime || '—'}</span></div>
            </div>
          </div>
          <div className="rounded-[3rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-[0.35em] text-slate-400 mb-4">Available pool</h3>
            <div className="grid gap-4">
              <div className="rounded-2xl bg-slate-50 p-4"><span className="font-black">Global seed</span></div>
              <div className="rounded-2xl bg-slate-50 p-4"><span className="font-black">Registry source</span></div>
              <div className="rounded-2xl bg-slate-50 p-4"><span className="font-black">Supabase fallback</span></div>
            </div>
          </div>
        </div>
      </div>

      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-[3rem] bg-white p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => { setProfileModalOpen(false); setPendingEnrollment(null); }}
              className="absolute right-6 top-6 text-slate-500 hover:text-slate-900"
            >
              <X size={24} />
            </button>
            <div className="mb-8">
              <h2 className="text-3xl font-black uppercase tracking-tight text-[#1a202c]">Complete Your Profile</h2>
              <p className="mt-3 text-sm text-slate-500">Enter Department and Class Code so joinable classes appear correctly.</p>
            </div>
            <form onSubmit={handleSaveProfile} className="grid gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-black uppercase tracking-[0.3em] text-slate-500">
                  Full Name
                  <input
                    type="text"
                    value={profileDraft.fullName}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, fullName: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none"
                    required
                  />
                </label>
                <label className="space-y-2 text-sm font-black uppercase tracking-[0.3em] text-slate-500">
                  School Registry ID
                  <input
                    type="text"
                    value={profileDraft.schoolRegistryId}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, schoolRegistryId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none"
                    required
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-black uppercase tracking-[0.3em] text-slate-500">
                  Phone
                  <input
                    type="tel"
                    value={profileDraft.phone}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, phone: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none"
                    required
                  />
                </label>
                <label className="space-y-2 text-sm font-black uppercase tracking-[0.3em] text-slate-500">
                  Gender
                  <select
                    value={profileDraft.gender}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, gender: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-black uppercase tracking-[0.3em] text-slate-500">
                  Department
                  <input
                    type="text"
                    value={profileDraft.department ?? ''}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, department: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none"
                    required
                  />
                </label>
                <label className="space-y-2 text-sm font-black uppercase tracking-[0.3em] text-slate-500">
                  Class Code
                  <input
                    type="text"
                    value={profileDraft.classCode ?? ''}
                    onChange={(event) => setProfileDraft((prev) => ({ ...prev, classCode: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold outline-none"
                    required
                  />
                </label>
              </div>
              <button
                type="submit"
                className="rounded-2xl bg-[#3d0413] px-8 py-4 text-[10px] font-black uppercase tracking-[0.35em] text-white"
              >
                Save Profile
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderClassDetail = () => {
    if (!selectedClass) return null;
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={() => setActiveView('LIST')}
          className="mb-8 inline-flex items-center gap-3 text-slate-500 uppercase tracking-[0.35em] font-black text-[10px]"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="rounded-[3rem] bg-white border border-slate-200 p-10 shadow-sm">
          <div className="rounded-[2.5rem] bg-[#3d0413] p-10 text-white">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-200">Physical Class Detail</p>
                <h2 className="mt-4 text-4xl font-black uppercase tracking-tight">{selectedClass.title}</h2>
                <p className="mt-3 text-sm text-slate-200">{selectedClass.teacher} • {selectedClass.room} • {selectedClass.schedule}</p>
              </div>
              <div className="rounded-3xl bg-white/10 border border-white/20 px-6 py-4 text-sm uppercase tracking-[0.35em] text-white">
                Students: {selectedClass.studentCount}
              </div>
            </div>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { label: 'Grade Average', value: `${selectedClass.grade ?? 0}%`, color: 'bg-[#3d0413]' },
              { label: 'Attendance', value: `${selectedClass.attendance ?? 0}%`, color: 'bg-emerald-500' },
              { label: 'Assignments Done', value: selectedClass.assignmentsDone ?? '0 assignments', color: 'bg-slate-900' },
            ].map((card) => (
              <div key={card.label} className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 mb-4">{card.label}</p>
                <p className="text-3xl font-black text-slate-900">{card.value}</p>
                <div className="mt-6 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: card.value.includes('%') ? card.value : '100%', backgroundColor: card.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveView('MATERIALS')}
              className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-left text-sm font-black uppercase tracking-[0.35em] text-slate-900"
            >
              View Materials
            </button>
            <button
              type="button"
              onClick={() => setActiveView('ASSIGNMENTS')}
              className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-left text-sm font-black uppercase tracking-[0.35em] text-slate-900"
            >
              View Assignments
            </button>
            <button
              type="button"
              onClick={() => setActiveView('GRADES')}
              className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-left text-sm font-black uppercase tracking-[0.35em] text-slate-900"
            >
              View Grades
            </button>
            <button
              type="button"
              onClick={() => setActiveView('SCHEDULE')}
              className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-left text-sm font-black uppercase tracking-[0.35em] text-slate-900"
            >
              View Schedule
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderClassNotLive = () => {
    if (!selectedClass) return null;
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={() => setActiveView('LIST')}
          className="mb-8 inline-flex items-center gap-3 text-slate-500 uppercase tracking-[0.35em] font-black text-[10px]"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="rounded-[3rem] border border-slate-200 bg-white p-10 shadow-sm">
          <div className="rounded-[2.5rem] bg-[#3d0413] p-10 text-center text-white">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-200 mb-4">Class Not Live</p>
            <h2 className="text-4xl font-black uppercase tracking-tight">CLASS NOT LIVE YET</h2>
            <p className="mt-4 text-sm text-slate-200">Starts in: 2h 15m • Next session: {selectedClass.schedule}</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <button type="button" className="rounded-3xl border border-slate-200 bg-slate-50 px-8 py-8 font-black uppercase tracking-[0.35em] text-slate-900">Add to Calendar</button>
            <button type="button" className="rounded-3xl border border-slate-200 bg-slate-50 px-8 py-8 font-black uppercase tracking-[0.35em] text-slate-900">Set Reminder</button>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {['View Materials', 'Check Assignments', 'View Announcements'].map((label) => (
              <button key={label} type="button" className="rounded-3xl border border-slate-200 bg-white px-6 py-7 text-left text-sm font-black uppercase tracking-[0.35em] text-slate-900">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderLiveJoin = () => {
    if (!selectedClass) return null;
    const isLive = liveSessionActiveFor(selectedClass);
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between lg:items-center mb-8">
          <button
            type="button"
            onClick={() => { stopTeacherReceiver(); setActiveView('LIST'); }}
            className="inline-flex items-center gap-3 text-slate-500 uppercase tracking-[0.35em] font-black text-[10px]"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex flex-wrap gap-3 items-center">
            <span className={`rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-[0.35em] ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {isLive ? 'Live' : 'Offline'}
            </span>
            <button
              type="button"
              onClick={toggleStudentCamera}
              className="rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.35em] border border-slate-200"
            >
              {isStudentCamOn ? 'Turn Off My Cam' : 'Turn On My Cam'}
            </button>
          </div>
        </div>
        <div className={`grid gap-6 ${feedTheaterMode ? '' : 'lg:grid-cols-[2fr_1fr]'}`}>
          <div className="rounded-[3rem] bg-slate-950 p-6 shadow-xl relative" ref={feedContainerRef}>
            <div className="absolute top-6 left-6 rounded-full bg-emerald-500 px-3 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-white">LIVE</div>
            <video ref={teacherVideoRef} autoPlay playsInline muted className="h-[60vh] w-full rounded-[2rem] object-cover bg-black" />
            {teacherStreams.camera && teacherStreams.screen && (
              <div className="absolute bottom-6 right-6 w-40 rounded-[1.5rem] overflow-hidden border-2 border-white/20 bg-slate-900">
                <video ref={teacherPiPRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              </div>
            )}
            {(!teacherStreams.camera && !teacherStreams.screen) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white/70">
                <Video size={44} />
                <p className="mt-4 uppercase tracking-[0.35em] text-sm font-black">{teacherFeedStatus === 'CONNECTING' ? 'CONNECTING...' : teacherFeedStatus === 'ERROR' ? 'CONNECTION ERROR' : 'OFFLINE'}</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setFeedTheaterMode((prev) => !prev)} className="rounded-2xl bg-white/10 px-4 py-3 text-white text-[10px] font-black uppercase tracking-[0.35em]">{feedTheaterMode ? 'Exit Theater' : 'Theater Mode'}</button>
              <button type="button" onClick={toggleFeedFullscreen} className="rounded-2xl bg-white/10 px-4 py-3 text-white text-[10px] font-black uppercase tracking-[0.35em]">Fullscreen</button>
              <button type="button" onClick={() => setFeedSettingsOpen((prev) => !prev)} className="rounded-2xl bg-white/10 px-4 py-3 text-white text-[10px] font-black uppercase tracking-[0.35em]">Settings</button>
              <button type="button" onClick={captureScreenshot} className="rounded-2xl bg-white/10 px-4 py-3 text-white text-[10px] font-black uppercase tracking-[0.35em]">Screenshot</button>
            </div>
          </div>
          {!feedTheaterMode && (
            <div className="space-y-6">
              <div className="rounded-[3rem] bg-white border border-slate-200 p-6 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-[0.35em] text-slate-400 mb-4">Session Preview</h3>
                <p className="text-lg font-black text-slate-900">{selectedClass.title}</p>
                <p className="mt-2 text-sm text-slate-500">Instructor: {selectedClass.teacher}</p>
                <p className="mt-3 text-sm uppercase tracking-[0.35em] text-slate-500">Feed: {teacherFeedStatus}</p>
              </div>
              <div className="rounded-[3rem] bg-white border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-black uppercase tracking-[0.35em] text-slate-400">My Camera</h4>
                  <span className={`text-[10px] font-black uppercase tracking-[0.35em] ${isStudentCamOn ? 'text-emerald-600' : 'text-slate-400'}`}>{isStudentCamOn ? 'ON' : 'OFF'}</span>
                </div>
                <div className="h-64 rounded-[2rem] bg-slate-950 overflow-hidden border border-slate-200">
                  <video ref={studentVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  {!isStudentCamOn && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/30">
                      <Camera size={28} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {feedSettingsOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/40">
            <div ref={settingsPanelRef} className="w-full max-w-md rounded-[2rem] bg-slate-950 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black uppercase tracking-[0.35em]">Feed Settings</h3>
                <button type="button" onClick={() => setFeedSettingsOpen(false)} className="text-slate-300"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500 mb-2">Quality</p>
                  <div className="flex flex-wrap gap-2">
                    {(['Auto', '720p', '1080p'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFeedQuality(option)}
                        className={`rounded-2xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.35em] ${feedQuality === option ? 'bg-[#3d0413] text-white' : 'bg-white/10 text-slate-200'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500 mb-2">Playback Speed</p>
                  <div className="flex flex-wrap gap-2">
                    {[0.5, 0.75, 1, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setFeedPlaybackSpeed(speed as 1 | 0.5 | 0.75 | 1.25 | 1.5 | 1.75 | 2)}
                        className={`rounded-2xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.35em] ${feedPlaybackSpeed === speed ? 'bg-[#3d0413] text-white' : 'bg-white/10 text-slate-200'}`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => setFeedSubtitlesOn((prev) => !prev)}
                    className={`rounded-2xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.35em] ${feedSubtitlesOn ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-200'}`}
                  >
                    Subtitles: {feedSubtitlesOn ? 'On' : 'Off'}
                  </button>
                  <select
                    value={feedSubtitleLang}
                    onChange={(event) => setFeedSubtitleLang(event.target.value as 'en' | 'sw')}
                    className="rounded-2xl bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-white"
                  >
                    <option value="en">English</option>
                    <option value="sw">Swahili</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (activeView === 'MATERIALS' && selectedClass) return <ClassMaterials selectedClass={selectedClass} onBack={() => setActiveView('DETAIL')} />;
  if (activeView === 'ASSIGNMENTS' && selectedClass) return <ClassAssignments selectedClass={selectedClass} onBack={() => setActiveView('DETAIL')} />;
  if (activeView === 'GRADES' && selectedClass) return <ClassGrades selectedClass={selectedClass} onBack={() => setActiveView('DETAIL')} />;
  if (activeView === 'SCHEDULE' && selectedClass) return <ClassSchedule selectedClass={selectedClass} onBack={() => setActiveView('DETAIL')} />;
  if (activeView === 'DETAIL') return renderClassDetail();
  if (activeView === 'NOT_LIVE') return renderClassNotLive();
  if (activeView === 'JOIN_LIST') return renderJoinList();
  if (activeView === 'LIVE_JOIN') return renderLiveJoin();
  return renderList();
};

export default StudentClasses;
