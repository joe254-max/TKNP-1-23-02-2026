import React, { useState, useMemo, useEffect, useRef } from 'react';
import { addSignal, listenSignals, removeSignal } from '../lib/firebaseClient';
import { 
  ArrowLeft, Users, Calendar, Clock, GraduationCap, 
  BookOpen, FileText, BarChart3, Presentation, Plus, 
  ExternalLink, ChevronRight, School, Monitor, Video, 
  Bell, CalendarPlus, MessageSquare, AlertCircle, Play,
  Search, X, CheckCircle2, Filter, User, Smartphone, Hash, History, FileDown, UserCircle,
  Maximize2, Minimize2, Settings, Camera, Fullscreen, HelpCircle, BarChart2
} from 'lucide-react';
import { getAllRecordings, type RecordedSession } from '../lib/recordingsDb';
import { getStoredProfile } from '../lib/profile';

interface ClassItem {
  id: string;
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

const MY_CLASSES_STORAGE_KEY = 'poly_my_classes';
const STUDENT_PROFILE_KEY = 'poly_student_profile';

export interface StudentProfile {
  fullName: string;
  schoolRegistryId: string;
  phone: string;
  gender: string;
}

function loadMyClasses(): ClassItem[] {
  try {
    const raw = localStorage.getItem(MY_CLASSES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function loadStudentProfile(): StudentProfile | null {
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

const GLOBAL_AVAILABLE_CLASSES: ClassItem[] = [
  {
    id: 'g1',
    title: 'ELECTRICAL INSTALLATION III',
    teacher: 'Eng. Mutua',
    room: 'Workshop 4',
    schedule: 'Mon/Wed 08:00 AM',
    type: 'PHYSICAL',
    studentCount: 25,
    department: 'ELECTRICAL ENGINEERING'
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
    department: 'ICT'
  },
  {
    id: 'g3',
    title: 'FLUID MECHANICS',
    teacher: 'Mr. Otieno',
    room: 'Room 12',
    schedule: 'Tue/Thu 11:00 AM',
    type: 'PHYSICAL',
    studentCount: 40,
    department: 'CIVIL ENGINEERING'
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
    department: 'BUSINESS'
  },
  {
    id: 'g5',
    title: 'ELECTRONICS I',
    teacher: 'Prof. Juma',
    room: 'Lab 1',
    schedule: 'Mon/Fri 02:00 PM',
    type: 'PHYSICAL',
    studentCount: 35,
    department: 'ELECTRICAL ENGINEERING'
  }
];

const StudentClasses: React.FC<{
  initialTab?: 'PHYSICAL' | 'ONLINE';
  isLecturerPreview?: boolean;
  onNavigateToProfile?: () => void;
}> = ({ initialTab = 'PHYSICAL', isLecturerPreview = false, onNavigateToProfile }) => {
  const [activeView, setActiveView] = useState<'LIST' | 'DETAIL' | 'NOT_LIVE' | 'JOIN_LIST' | 'LIVE_JOIN'>( 'LIST');
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [activeTab, setActiveTab] = useState<'PHYSICAL' | 'ONLINE'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pending class when profile is incomplete (show "Go to My Profile" modal)
  const [classPendingEnrollment, setClassPendingEnrollment] = useState<ClassItem | null>(null);

  const savedClasses = loadMyClasses();
  const defaultClasses: ClassItem[] = savedClasses.length > 0 ? [] : [
    { id: 'sc1', title: 'POWER SYSTEMS II', teacher: 'Dr. Kamau', room: 'Lab 2', schedule: 'Mon/Wed/Fri 05:00 AM', grade: 82, type: 'PHYSICAL', studentCount: 42, attendance: 90, assignmentsDone: '4/5 done', department: 'ELECTRICAL ENGINEERING' },
    { id: 'sc2', title: 'PROGRAMMING BASICS', teacher: 'Dr. Wangari', room: 'Online', schedule: 'Tue/Thu 02:00 PM', grade: 85, type: 'ONLINE', platform: 'Microsoft Teams', link: 'https://teams.microsoft.com/l/meetup-join/ict101', isLive: false, studentCount: 38, attendance: 95, assignmentsDone: '5/5 done', department: 'ICT' }
  ];
  const [myClasses, setMyClasses] = useState<ClassItem[]>(savedClasses.length > 0 ? savedClasses : defaultClasses);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(loadStudentProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<StudentProfile>(() => {
    const p = loadStudentProfile();
    const userStr = typeof window !== 'undefined' ? (localStorage.getItem('poly_library_user') || sessionStorage.getItem('poly_library_user')) : null;
    const name = userStr ? (() => { try { return JSON.parse(userStr).name || ''; } catch { return ''; } })() : '';
    return p ? { ...p } : { fullName: name, schoolRegistryId: '', phone: '', gender: '' };
  });

  useEffect(() => {
    localStorage.setItem(MY_CLASSES_STORAGE_KEY, JSON.stringify(myClasses));
  }, [myClasses]);

  const [registryClasses, setRegistryClasses] = useState<ClassItem[]>([]);

  // Live session info written by staff dashboard
  const [liveSession, setLiveSession] = useState<{ classId: string; title: string; teacher: string; isLive: boolean } | null>(null);

  // Student's own live video node
  const [isStudentCamOn, setIsStudentCamOn] = useState(false);
  const [studentStream, setStudentStream] = useState<MediaStream | null>(null);
  const studentVideoRef = React.useRef<HTMLVideoElement | null>(null);

  // Teacher live feed (WebRTC receiver) – camera = first video track, screen = second
  const teacherVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const teacherPiPRef = React.useRef<HTMLVideoElement | null>(null);
  const teacherPeerRef = React.useRef<RTCPeerConnection | null>(null);
  const teacherSignalRef = React.useRef<any | null>(null);
  const teacherFirestoreUnsubRef = React.useRef<(() => void) | null>(null);
  const teacherIdRef = React.useRef<string | null>(null);
  const pendingCandidatesRef = React.useRef<any[]>([]);
  const teacherStreamsRef = React.useRef<{ camera: MediaStream | null; screen: MediaStream | null }>({ camera: null, screen: null });
  const teacherVideoCountRef = React.useRef(0);
  const [teacherFeedStatus, setTeacherFeedStatus] = useState<'CONNECTING' | 'LIVE' | 'OFFLINE' | 'ERROR'>('OFFLINE');
  const [teacherStreams, setTeacherStreams] = useState<{ camera: MediaStream | null; screen: MediaStream | null }>({ camera: null, screen: null });
  const [recordedSessions, setRecordedSessions] = useState<RecordedSession[]>([]);

  // Feed video container: theater, fullscreen, settings, screenshot
  const feedContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [feedTheaterMode, setFeedTheaterMode] = useState(false);
  const [feedFullscreen, setFeedFullscreen] = useState(false);
  const [feedSettingsOpen, setFeedSettingsOpen] = useState(false);
  const [feedQuality, setFeedQuality] = useState<string>('1080p');
  const [feedPlaybackSpeed, setFeedPlaybackSpeed] = useState(1);
  const [feedSubtitlesOn, setFeedSubtitlesOn] = useState(false);
  const [feedSubtitleLang, setFeedSubtitleLang] = useState('en');
  const [feedAudioTrack, setFeedAudioTrack] = useState('default');
  const [feedStatsNerdsOpen, setFeedStatsNerdsOpen] = useState(false);
  const settingsPanelRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getAllRecordings().then((list) => {
      if (mounted) setRecordedSessions(list);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const loadRegistry = () => {
      try {
        const data = localStorage.getItem('poly_institutional_registry');
        if (data) setRegistryClasses(JSON.parse(data));
        else setRegistryClasses([]);
      } catch {
        setRegistryClasses([]);
      }
    };

    // Load immediately and keep in sync across tabs
    loadRegistry();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'poly_institutional_registry') loadRegistry();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Poll live session started by staff (teacher camera)
  useEffect(() => {
    const loadLiveSession = () => {
      try {
        const raw = localStorage.getItem('poly_live_session');
        if (!raw) {
          setLiveSession(null);
          return;
        }
        const parsed = JSON.parse(raw);
        setLiveSession(parsed && parsed.isLive ? parsed : null);
      } catch {
        setLiveSession(null);
      }
    };
    loadLiveSession();
    const id = window.setInterval(loadLiveSession, 3000);
    return () => window.clearInterval(id);
  }, []);

  const CURRENT_STUDENT_ID_KEY = 'poly_current_student_identity';
  const RTC_CONFIG: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  const getStudentProfile = (): StudentProfile => {
    const userStr = typeof window !== 'undefined' ? (localStorage.getItem('poly_library_user') || sessionStorage.getItem('poly_library_user')) : null;
    let user: { id?: string; name?: string } | null = null;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        // ignore
      }
    }
    if (user?.id) {
      const stored = getStoredProfile(user.id);
      if (stored && (stored.fullName || stored.schoolRegistryId)) {
        return {
          fullName: stored.fullName || user.name || 'Student',
          schoolRegistryId: stored.schoolRegistryId || '',
          phone: stored.phone || '',
          gender: stored.gender || '',
        };
      }
    }
    const p = loadStudentProfile();
    const name = user?.name || '';
    return p && (p.fullName || p.schoolRegistryId) ? p : { fullName: name || 'Student', schoolRegistryId: '', phone: '', gender: '' };
  };

  const getCurrentStudentIdentity = () => {
    try {
      const raw = localStorage.getItem(CURRENT_STUDENT_ID_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    const profile = getStudentProfile();
    const id = profile.schoolRegistryId || `anon-${Date.now()}`;
    return { id, name: profile.fullName || 'Student Node' };
  };

  const upsertLiveParticipant = (classId: string, hasVideo: boolean, checked = false) => {
    const profile = getStudentProfile();
    const id = profile.schoolRegistryId || `anon-${Date.now()}`;
    try {
      const raw = localStorage.getItem('poly_live_participants') || '[]';
      const list = JSON.parse(raw);
      const record = {
        id,
        name: profile.fullName,
        fullName: profile.fullName,
        schoolRegistryId: profile.schoolRegistryId,
        phone: profile.phone,
        gender: profile.gender,
        classId,
        hasVideo,
        checked,
      };
      const existingIdx = list.findIndex((p: { id: string }) => p.id === id);
      if (existingIdx > -1) list[existingIdx] = { ...list[existingIdx], ...record };
      else list.push(record);
      localStorage.setItem('poly_live_participants', JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  const setMyParticipantVideoFlag = (classId: string, hasVideo: boolean) => {
    upsertLiveParticipant(classId, hasVideo);
  };

  const stopStudentCamera = () => {
    if (studentStream) studentStream.getTracks().forEach(t => t.stop());
    setStudentStream(null);
    setIsStudentCamOn(false);
    if (selectedClass) setMyParticipantVideoFlag(selectedClass.id, false);
  };

  const toggleStudentCamera = async () => {
    if (!selectedClass) return;
    if (isStudentCamOn) {
      stopStudentCamera();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStudentStream(stream);
      setIsStudentCamOn(true);
      if (studentVideoRef.current) {
        studentVideoRef.current.srcObject = stream;
        try {
          await studentVideoRef.current.play();
        } catch {
          // ignore autoplay restrictions; user click triggered
        }
      }
      setMyParticipantVideoFlag(selectedClass.id, true);
    } catch {
      // ignore
      setIsStudentCamOn(false);
      setStudentStream(null);
    }
  };

  const stopTeacherReceiver = () => {
    try { teacherSignalRef.current?.off && teacherSignalRef.current.off('signal'); } catch {}
    try { teacherSignalRef.current?.disconnect && teacherSignalRef.current.disconnect(); } catch {}
    teacherSignalRef.current = null;
    try { if (teacherFirestoreUnsubRef.current) { teacherFirestoreUnsubRef.current(); } } catch {}
    teacherFirestoreUnsubRef.current = null;
    teacherIdRef.current = null;
    pendingCandidatesRef.current = [];
    try {
      teacherPeerRef.current?.close();
    } catch {
      // ignore
    }
    teacherPeerRef.current = null;
    teacherStreamsRef.current = { camera: null, screen: null };
    teacherVideoCountRef.current = 0;
    if (teacherVideoRef.current) teacherVideoRef.current.srcObject = null;
    if (teacherPiPRef.current) teacherPiPRef.current.srcObject = null;
    setTeacherStreams({ camera: null, screen: null });
    setTeacherFeedStatus('OFFLINE');
  };

  // When student enters LIVE_JOIN, connect to teacher via WebRTC (demo signaling via BroadcastChannel)
  useEffect(() => {
    if (activeView !== 'LIVE_JOIN' || !selectedClass) return;

    const session = liveSession;
    if (!session || !session.isLive || session.classId !== selectedClass.id) {
      stopTeacherReceiver();
      return;
    }

    const identity = getCurrentStudentIdentity() || { id: `anon-${Date.now()}`, name: 'Student Node' };

    // (Re)connect
    stopTeacherReceiver();
    setTeacherFeedStatus('CONNECTING');

      teacherSignalRef.current = null;

      // listen for Firestore signals for this class
      const unsub = listenSignals(selectedClass.id, async (snapshot: any) => {
        for (const change of snapshot.docChanges()) {
          if (change.type !== 'added') continue;
          const doc = change.doc;
          const msg = doc.data();
          if (!msg) continue;
          if (msg.role !== 'teacher') {
            try { await removeSignal(selectedClass.id, doc.id); } catch {}
            continue;
          }
          if (msg.to && msg.to !== identity.id) continue;
          try {
            if (msg.type === 'offer' && msg.sdp) {
              teacherIdRef.current = msg.from as string;
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              try { await addSignal(selectedClass.id, { type: 'answer', classId: selectedClass.id, from: identity.id, role: 'student', to: msg.from, sdp: pc.localDescription ? { type: pc.localDescription.type, sdp: pc.localDescription.sdp } : null }); } catch {}
              // flush pending candidates
              const teacherId = msg.from as string;
              for (const c of pendingCandidatesRef.current) {
                try { await addSignal(selectedClass.id, { type: 'candidate', classId: selectedClass.id, from: identity.id, role: 'student', to: teacherId, candidate: c }); } catch {}
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
          try { await removeSignal(selectedClass.id, doc.id); } catch {}
        }
      });
      teacherFirestoreUnsubRef.current = unsub;

      // ask teacher for an offer
      try { addSignal(selectedClass.id, { type: 'join', classId: selectedClass.id, from: identity.id, role: 'student', name: identity.name }); } catch {}

    const pc = new RTCPeerConnection(RTC_CONFIG);
    teacherPeerRef.current = pc;

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (!stream || ev.track.kind !== 'video') return;
      setTeacherFeedStatus('LIVE');
      if (isLecturerPreview) {
        if (teacherVideoRef.current) teacherVideoRef.current.srcObject = null;
        if (teacherPiPRef.current) teacherPiPRef.current.srcObject = null;
        return;
      }
      const slot = teacherVideoCountRef.current === 0 ? 'camera' : 'screen';
      teacherVideoCountRef.current = Math.min(teacherVideoCountRef.current + 1, 2);
      const prev = teacherStreamsRef.current;
      teacherStreamsRef.current = { ...prev, [slot]: stream };
      setTeacherStreams(teacherStreamsRef.current);
      ev.track.onended = () => {
        teacherStreamsRef.current = { ...teacherStreamsRef.current, [slot]: null };
        setTeacherStreams({ ...teacherStreamsRef.current });
      };
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const cand = ev.candidate.toJSON();
      const teacherId = teacherIdRef.current;
      if (teacherId) {
        try { addSignal(selectedClass.id, { type: 'candidate', classId: selectedClass.id, from: identity.id, role: 'student', to: teacherId, candidate: cand }); } catch {}
      } else {
        // queue until we know teacher id (offer arrives)
        pendingCandidatesRef.current.push(cand);
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        setTeacherFeedStatus('ERROR');
      }
    };

    // (handled via Firestore listener above)

    return () => {
      stopTeacherReceiver();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, selectedClass?.id, liveSession?.classId, liveSession?.isLive, isLecturerPreview]);

  // Attach teacher streams to video elements (main = screen preferred, PiP = camera when both)
  useEffect(() => {
    if (isLecturerPreview) return;
    const mainStream = teacherStreams.screen ?? teacherStreams.camera ?? null;
    const pipStream = teacherStreams.camera && teacherStreams.screen ? teacherStreams.camera : null;
    if (teacherVideoRef.current) {
      teacherVideoRef.current.srcObject = mainStream;
      teacherVideoRef.current.playbackRate = feedPlaybackSpeed;
      if (mainStream) {
        teacherVideoRef.current.muted = true;
        void teacherVideoRef.current.play();
      }
    }
    if (teacherPiPRef.current) {
      teacherPiPRef.current.srcObject = pipStream;
      teacherPiPRef.current.playbackRate = feedPlaybackSpeed;
      if (pipStream) {
        teacherPiPRef.current.muted = true;
        void teacherPiPRef.current.play();
      }
    }
  }, [teacherStreams, isLecturerPreview, feedPlaybackSpeed]);

  // Sync playback speed when setting changes
  useEffect(() => {
    if (teacherVideoRef.current) teacherVideoRef.current.playbackRate = feedPlaybackSpeed;
    if (teacherPiPRef.current) teacherPiPRef.current.playbackRate = feedPlaybackSpeed;
  }, [feedPlaybackSpeed]);

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setFeedFullscreen(isFs && document.fullscreenElement === feedContainerRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Close settings panel when clicking outside
  useEffect(() => {
    if (!feedSettingsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target as Node)) {
        setFeedSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [feedSettingsOpen]);

  const toggleFeedFullscreen = async () => {
    const el = feedContainerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const captureFeedScreenshot = () => {
    const video = teacherVideoRef.current;
    const container = feedContainerRef.current;
    if (!video || !container) return;
    try {
      const canvas = document.createElement('canvas');
      const rect = video.getBoundingClientRect();
      canvas.width = video.videoWidth || rect.width;
      canvas.height = video.videoHeight || rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const link = document.createElement('a');
      link.download = `feed-screenshot-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // fallback: try capturing container via html2canvas if available
      const win = window as Window & { html2canvas?: (el: HTMLElement, opts?: unknown) => Promise<HTMLCanvasElement> };
      if (typeof win.html2canvas === 'function') {
        win.html2canvas(container, { useCORS: true, allowTaint: true }).then((c) => {
          const link = document.createElement('a');
          link.download = `feed-screenshot-${Date.now()}.png`;
          link.href = c.toDataURL('image/png');
          link.click();
        }).catch(() => {});
      }
    }
  };

  const handleJoinClass = (cls: ClassItem) => {
    const session = liveSession;

    if (session && session.isLive && session.classId === cls.id) {
      setSelectedClass(cls);
      setActiveView('LIVE_JOIN');
      upsertLiveParticipant(cls.id, false, true);
      return;
    }

    if (cls.isLive && cls.link) {
      window.open(cls.link, '_blank');
    } else {
      setSelectedClass(cls);
      setActiveView('NOT_LIVE');
    }
  };

  const saveProfile = (p: StudentProfile) => {
    localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(p));
    setStudentProfile(p);
    setProfileForm(p);
  };

  const addClassFromRegistry = (cls: ClassItem) => {
    const profile = getStudentProfile();
    const needsProfile = !profile.schoolRegistryId || !profile.phone;
    if (needsProfile) {
      setClassPendingEnrollment(cls);
      if (onNavigateToProfile) {
        setIsProfileModalOpen(true); // show "Complete in My Profile" modal
      } else {
        setProfileForm({ ...profile });
        setIsProfileModalOpen(true); // legacy: show full profile form
      }
      return;
    }
    doAddClass(cls, profile);
  };

  const doAddClass = (cls: ClassItem, profile: StudentProfile) => {
    const enrolledClass: ClassItem = {
      ...cls,
      grade: 0,
      attendance: 0,
      assignmentsDone: '0 assignments'
    };
    try {
      setMyClasses((prev) => [...prev, enrolledClass]);
      const enrollmentKey = 'poly_enrolled_students';
      const currentEnrollmentsStr = localStorage.getItem(enrollmentKey) || '[]';
      const currentEnrollments = JSON.parse(currentEnrollmentsStr);
      currentEnrollments.push({
        id: `joined-${Date.now()}`,
        name: profile.fullName.toUpperCase(),
        admNo: profile.schoolRegistryId.toUpperCase(),
        phone: profile.phone,
        gender: profile.gender,
        classId: cls.id,
        attendance: 0,
        gradeAverage: 0,
        status: 'ACTIVE'
      });
      localStorage.setItem(enrollmentKey, JSON.stringify(currentEnrollments));
      localStorage.setItem(CURRENT_STUDENT_ID_KEY, JSON.stringify({ id: profile.schoolRegistryId, name: profile.fullName }));
      setIsProfileModalOpen(false);
      setClassPendingEnrollment(null);
      try { window.alert(`Added "${cls.title}" to My Classes`); } catch {}
      setActiveView('LIST');
    } catch (err) {
      try { window.alert('Could not add class — storage may be blocked.'); } catch {}
    }
  };

  const handleProfileModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = { ...profileForm };
    saveProfile(p);
    if (classPendingEnrollment) {
      doAddClass(classPendingEnrollment, p);
      setClassPendingEnrollment(null);
    }
    setIsProfileModalOpen(false);
  };

  const filteredGlobalClasses = useMemo(() => {
    const combinedRegistry = [...GLOBAL_AVAILABLE_CLASSES, ...registryClasses];
    const uniqueRegistry = Array.from(new Map(combinedRegistry.map(item => [item.id + item.title, item])).values());

    return uniqueRegistry.filter(gc => {
      const alreadyJoined = myClasses.some(mc => mc.id === gc.id || (mc.title === gc.title && mc.teacher === gc.teacher));
      const matchesSearch = gc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           gc.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           gc.department.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = (activeTab === 'PHYSICAL' ? gc.type === 'PHYSICAL' : gc.type === 'ONLINE');
      return !alreadyJoined && matchesSearch && matchesTab;
    });
  }, [myClasses, searchQuery, activeTab, registryClasses]);

  const availableOnlineClasses = useMemo(() => {
    const combinedRegistry = [...GLOBAL_AVAILABLE_CLASSES, ...registryClasses];
    const uniqueRegistry = Array.from(new Map(combinedRegistry.map(item => [item.id + item.title, item])).values());
    return uniqueRegistry
      .filter(c => c.type === 'ONLINE')
      .filter(c => !myClasses.some(mc => mc.id === c.id || (mc.title === c.title && mc.teacher === c.teacher)));
  }, [myClasses, registryClasses]);

  const renderJoinList = () => (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
        <div>
          <button 
            onClick={() => { setActiveView('LIST'); setSearchQuery(''); }}
            className="mb-4 flex items-center gap-3 text-slate-400 hover:text-[#3d0413] transition-all font-black text-[10px] uppercase tracking-widest"
          >
            <ArrowLeft size={16} strokeWidth={3} />
            Back to Dashboard
          </button>
          <h2 className="text-5xl font-black text-[#1a202c] uppercase tracking-tighter leading-none">JOIN NEW CLASS</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3 flex items-center gap-3">
             <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
             Registry Node: Available Institutional Modules
          </p>
        </div>

        <div className="relative w-full md:w-96 group">
          <input
            type="text"
            placeholder="Search classes, teachers or depts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-[2rem] text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-[#3d0413]/5 transition-all"
          />
          <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
        </div>
      </div>

      <div className="space-y-6">
        {filteredGlobalClasses.length > 0 ? (
          filteredGlobalClasses.map((cls) => (
            <div key={cls.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col md:flex-row items-center justify-between gap-8 group">
              <div className="flex items-center gap-8 flex-1">
                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all ${cls.type === 'ONLINE' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-[#3d0413]'} group-hover:scale-110`}>
                  {cls.type === 'ONLINE' ? <Monitor size={32} /> : <School size={32} />}
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight group-hover:text-[#3d0413] transition-colors">{cls.title}</h4>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">👨‍🏫 {cls.teacher}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">🏢 {cls.room}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">📅 {cls.schedule}</span>
                    <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[8px] font-black text-slate-400 uppercase tracking-widest">{cls.department}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => addClassFromRegistry(cls)}
                className="px-10 py-5 bg-[#3d0413] text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl border-b-6 border-black active:scale-95 transition-all flex items-center gap-3 whitespace-nowrap"
              >
                <Plus size={18} /> Join Class
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-[4rem] border-2 border-dashed border-slate-200">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200"><Filter size={48} /></div>
             <h3 className="text-xl font-black text-slate-900 uppercase">No Matches in Registry</h3>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Refine your search parameters or check other tabs</p>
          </div>
        )}
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={() => { setIsProfileModalOpen(false); setClassPendingEnrollment(null); }} />
          <div className="relative w-full max-w-xl bg-white rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-500">
            <div className="bg-[#3d0413] p-10 text-white flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black uppercase tracking-tighter">Complete your profile</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] mt-1 opacity-60">Required to add classes and join live sessions</p>
              </div>
              <button type="button" onClick={() => { setIsProfileModalOpen(false); setClassPendingEnrollment(null); }} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all">
                <X size={24} />
              </button>
            </div>
            {onNavigateToProfile ? (
              <div className="p-10 space-y-6">
                <p className="text-slate-600 font-bold">Add your Full Legal Name, School Registry ID, Phone, Gender, Class, Department, Year, Age and Photo in <strong>My Profile</strong>. The system will then auto-fill enrollment and live participant data.</p>
                <button
                  type="button"
                  onClick={() => { onNavigateToProfile(); setIsProfileModalOpen(false); setClassPendingEnrollment(null); }}
                  className="w-full py-6 bg-[#3d0413] text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all border-b-6 border-black flex items-center justify-center gap-4"
                >
                  <UserCircle size={18} /> Go to My Profile
                </button>
              </div>
            ) : (
              <form onSubmit={handleProfileModalSubmit} className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 flex items-center gap-2"><User size={12} /> Full Legal Name</label>
                  <input required type="text" value={profileForm.fullName} onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Enter your full name" className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-sm outline-none focus:ring-4 focus:ring-[#3d0413]/5" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 flex items-center gap-2"><Hash size={12} /> School Registry ID</label>
                  <input required type="text" value={profileForm.schoolRegistryId} onChange={(e) => setProfileForm((f) => ({ ...f, schoolRegistryId: e.target.value }))} placeholder="EE/XXX/2024" className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-sm outline-none focus:ring-4 focus:ring-[#3d0413]/5" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 flex items-center gap-2"><Smartphone size={12} /> Phone</label>
                  <input required type="tel" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+254 7XX XXX XXX" className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-sm outline-none focus:ring-4 focus:ring-[#3d0413]/5" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 flex items-center gap-2">Gender</label>
                  <select value={profileForm.gender} onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))} className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-sm outline-none focus:ring-4 focus:ring-[#3d0413]/5">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-6 mt-4 bg-[#3d0413] text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all border-b-6 border-black flex items-center justify-center gap-4">
                  {classPendingEnrollment ? `Save & add ${classPendingEnrollment.title}` : 'Save profile'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderClassNotLive = () => {
    if (!selectedClass) return null;
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in zoom-in duration-500">
        <button 
          onClick={() => setActiveView('LIST')}
          className="mb-8 flex items-center gap-3 text-slate-400 hover:text-[#3d0413] transition-all font-black text-[10px] uppercase tracking-widest"
        >
          <ArrowLeft size={16} strokeWidth={3} />
          Back to Online Node
        </button>

        <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="bg-[#3d0413] p-12 text-center text-white relative">
            <div className="absolute top-8 right-8 animate-pulse">
               <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">CLASS NOT LIVE YET</h2>
            <div className="flex items-center justify-center gap-4 text-rose-300 font-bold">
               <Clock size={20} />
               <span className="text-lg">Starts in: 2 hours 15 minutes</span>
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.3em] opacity-60">Next Session: Today, {selectedClass.schedule.split(' ').pop()}</p>
          </div>

          <div className="p-12 space-y-12">
             <div className="grid grid-cols-2 gap-6">
                <button className="flex flex-col items-center gap-4 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-slate-100 transition-all group">
                   <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#3d0413] shadow-sm group-hover:scale-110 transition-transform"><CalendarPlus size={24} /></div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Add to Calendar</span>
                </button>
                <button className="flex flex-col items-center gap-4 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-slate-100 transition-all group">
                   <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-sm group-hover:scale-110 transition-transform"><Bell size={24} /></div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Set Reminder</span>
                </button>
             </div>

             <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8 text-center">Wait-Time Resource Hub</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {[
                     { label: 'View Materials', icon: <BookOpen size={18} />, action: '📚' },
                     { label: 'Check Assignments', icon: <FileText size={18} />, action: '📝' },
                     { label: 'View Announcements', icon: <MessageSquare size={18} />, action: '💬' },
                   ].map(item => (
                     <button key={item.label} className="flex items-center gap-4 px-6 py-5 bg-white border border-slate-100 rounded-2xl hover:border-[#3d0413] transition-all group">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#3d0413] group-hover:bg-[#3d0413] group-hover:text-white transition-all">{item.icon}</div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{item.label}</span>
                     </button>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLiveJoin = () => {
    if (!selectedClass) return null;
    const teacherIsLive = !!(liveSession && liveSession.isLive && liveSession.classId === selectedClass.id);

    return (
      <div className="max-w-5xl mx-auto animate-in fade-in zoom-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <button
            onClick={() => {
              stopTeacherReceiver();
              stopStudentCamera();
              setActiveView('LIST');
            }}
            className="flex items-center gap-3 text-slate-400 hover:text-[#3d0413] transition-all font-black text-[10px] uppercase tracking-widest"
          >
            <ArrowLeft size={16} strokeWidth={3} />
            Back to Online Node
          </button>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.35em] border ${
              teacherIsLive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {teacherIsLive ? 'Live Session' : 'Offline'}
            </div>
            <button
              onClick={toggleStudentCamera}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm border transition-all ${
                isStudentCamOn ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' : 'bg-white text-[#3d0413] border-slate-200 hover:bg-slate-50'
              }`}
            >
              {isStudentCamOn ? 'Turn Off My Cam' : 'Turn On My Cam'}
            </button>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-8 ${feedTheaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
          <div className={feedTheaterMode ? 'w-full' : 'lg:col-span-2'}>
            <div
              ref={feedContainerRef}
              className={`relative bg-slate-950 aspect-video rounded-[2.5rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-white/5 ${feedFullscreen ? 'rounded-none' : ''}`}
            >
              <video
                ref={teacherVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover opacity-95 ${isLecturerPreview ? 'opacity-0' : ''}`}
              />
              {!isLecturerPreview && teacherStreams.camera && teacherStreams.screen && (
                <div className="absolute bottom-4 right-4 w-32 sm:w-40 aspect-video rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl bg-slate-900 z-10">
                  <video ref={teacherPiPRef} autoPlay playsInline muted className="w-full h-full object-cover" title="Lecturer camera" />
                  <span className="absolute bottom-0 left-0 right-0 py-1 bg-black/60 text-[9px] font-bold text-white text-center uppercase">Camera</span>
                </div>
              )}

              {isLecturerPreview && teacherFeedStatus === 'LIVE' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 bg-amber-950/90 z-10 border-2 border-amber-500/30 rounded-[2.5rem]">
                  <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 text-amber-400 border-2 border-amber-500/50">
                    <Monitor className="w-10 h-10" />
                  </div>
                  <p className="text-amber-100 text-sm font-black uppercase tracking-wider mb-2">
                    Lecturer preview – do not share this window
                  </p>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest max-w-sm">
                    This tab does not show the live feed to avoid mirror effect. Close or minimize it when screen sharing. Students see your shared screen in their own view.
                  </p>
                </div>
              )}

              {teacherFeedStatus !== 'LIVE' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 text-white/30">
                    <Video size={36} />
                  </div>
                  <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.45em]">
                    {teacherFeedStatus === 'CONNECTING'
                      ? 'Connecting to teacher feed...'
                      : teacherFeedStatus === 'ERROR'
                        ? 'Feed connection failed. Retry by reopening the session.'
                        : 'Teacher feed is offline.'}
                  </p>
                </div>
              )}

              <div className="absolute top-5 left-5 px-4 py-2 bg-emerald-500 text-white rounded-2xl text-[8px] font-black uppercase tracking-[0.35em] flex items-center gap-3 shadow-2xl z-20">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                <span className="truncate max-w-[260px]">{selectedClass.title}</span>
              </div>

              {/* Feed controls: Theater, Fullscreen, Settings, Screenshot */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-end gap-2 z-20">
                <button
                  type="button"
                  onClick={() => setFeedTheaterMode((v) => !v)}
                  className="p-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-all"
                  title={feedTheaterMode ? 'Exit theater mode' : 'Theater mode'}
                >
                  {feedTheaterMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  type="button"
                  onClick={toggleFeedFullscreen}
                  className="p-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-all"
                  title={feedFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  <Fullscreen size={18} />
                </button>
                <div className="relative" ref={settingsPanelRef}>
                  <button
                    type="button"
                    onClick={() => setFeedSettingsOpen((v) => !v)}
                    className="p-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-all"
                    title="Settings"
                  >
                    <Settings size={18} />
                  </button>
                  {feedSettingsOpen && (
                    <div className="absolute right-0 bottom-full mb-2 w-72 max-h-[80vh] overflow-y-auto rounded-2xl bg-slate-900 border border-white/10 shadow-2xl py-3 z-30">
                      <div className="px-4 py-2 border-b border-white/10">
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Feed settings</span>
                      </div>
                      <div className="px-4 py-3 space-y-4">
                        <div>
                          <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-2">Quality</p>
                          <div className="flex flex-wrap gap-2">
                            {['Auto', '720p', '1080p'].map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => { setFeedQuality(q); setFeedSettingsOpen(false); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${feedQuality === q ? 'bg-[#3d0413] text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-2">Playback speed</p>
                          <div className="flex flex-wrap gap-2">
                            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => { setFeedPlaybackSpeed(s); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${feedPlaybackSpeed === s ? 'bg-[#3d0413] text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                              >
                                {s}x
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-2">Subtitles / CC</p>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setFeedSubtitlesOn((v) => !v)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${feedSubtitlesOn ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/80'}`}
                            >
                              {feedSubtitlesOn ? 'On' : 'Off'}
                            </button>
                            <select
                              value={feedSubtitleLang}
                              onChange={(e) => setFeedSubtitleLang(e.target.value)}
                              className="bg-white/10 text-white text-xs font-bold rounded-lg px-3 py-1.5 border border-white/20"
                            >
                              <option value="en">English</option>
                              <option value="sw">Swahili</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-2">Audio track</p>
                          <select
                            value={feedAudioTrack}
                            onChange={(e) => setFeedAudioTrack(e.target.value)}
                            className="w-full bg-white/10 text-white text-xs font-bold rounded-lg px-3 py-2 border border-white/20"
                          >
                            <option value="default">Default</option>
                            <option value="en">English</option>
                            <option value="sw">Swahili</option>
                          </select>
                        </div>
                        <div className="pt-2 border-t border-white/10 space-y-2">
                          <button
                            type="button"
                            onClick={() => { setFeedStatsNerdsOpen(true); setFeedSettingsOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 text-xs font-bold"
                          >
                            <BarChart2 size={14} /> Stats for Nerds
                          </button>
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 text-xs font-bold"
                          >
                            <HelpCircle size={14} /> Report / Help
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={captureFeedScreenshot}
                  className="p-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-all"
                  title="Screenshot feed"
                >
                  <Camera size={18} />
                </button>
              </div>
            </div>
          </div>

          {!feedTheaterMode && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Session Preview</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em] mb-6">
                Instructor: {selectedClass.teacher}
              </p>

              <div className="space-y-3 text-[11px] font-bold text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-black uppercase text-[9px] tracking-widest">Status</span>
                  <span className={teacherIsLive ? 'text-emerald-600 font-black' : 'text-slate-400 font-black'}>
                    {teacherIsLive ? 'LIVE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-black uppercase text-[9px] tracking-widest">Feed</span>
                  <span className="font-black">
                    {teacherFeedStatus === 'LIVE' ? 'CONNECTED' : teacherFeedStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">My Camera</h4>
                <span className={`text-[9px] font-black uppercase tracking-widest ${isStudentCamOn ? 'text-emerald-600' : 'text-slate-300'}`}>
                  {isStudentCamOn ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="relative bg-slate-950 rounded-[2rem] overflow-hidden aspect-video border border-white/5">
                <video
                  ref={studentVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover opacity-90"
                />
                {!isStudentCamOn && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/20">
                    <Video size={26} />
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Stats for Nerds modal */}
        {feedStatsNerdsOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => setFeedStatsNerdsOpen(false)} />
            <div className="relative bg-slate-900 rounded-2xl border border-white/10 shadow-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <BarChart2 size={20} /> Stats for Nerds
                </h3>
                <button type="button" onClick={() => setFeedStatsNerdsOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/80">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3 text-xs font-mono text-white/90">
                <div className="flex justify-between"><span className="text-white/50">Feed status</span><span>{teacherFeedStatus}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Quality (preference)</span><span>{feedQuality}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Playback speed</span><span>{feedPlaybackSpeed}x</span></div>
                <div className="flex justify-between"><span className="text-white/50">Subtitles</span><span>{feedSubtitlesOn ? 'On' : 'Off'}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Class</span><span className="truncate max-w-[200px]">{selectedClass?.title}</span></div>
                <div className="flex justify-between"><span className="text-white/50">Instructor</span><span>{selectedClass?.teacher}</span></div>
                {teacherVideoRef.current && (
                  <>
                    <div className="flex justify-between"><span className="text-white/50">Video dimensions</span><span>{teacherVideoRef.current.videoWidth}×{teacherVideoRef.current.videoHeight}</span></div>
                    <div className="flex justify-between"><span className="text-white/50">Ready state</span><span>{teacherVideoRef.current.readyState}</span></div>
                  </>
                )}
              </div>
              <p className="mt-4 text-[10px] text-white/40 uppercase tracking-widest">Technical info for support and debugging</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderClassDetail = () => {
    if (!selectedClass) return null;
    return (
      <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500 pb-20">
        <button 
          onClick={() => setActiveView('LIST')}
          className="mb-8 flex items-center gap-3 text-slate-400 hover:text-[#3d0413] transition-all font-black text-[10px] uppercase tracking-widest"
        >
          <ArrowLeft size={16} strokeWidth={3} />
          Back to My Classes
        </button>

        <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="bg-[#3d0413] p-12 text-white">
            <div className="flex justify-between items-start mb-10">
              <h2 className="text-5xl font-black uppercase tracking-tighter leading-none">{selectedClass.title}</h2>
              <div className={`p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 ${selectedClass.type === 'ONLINE' ? 'text-blue-300' : 'text-rose-300'}`}>
                {selectedClass.type === 'ONLINE' ? <Monitor size={24} /> : <School size={24} />}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
               <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Teacher</p>
                 <p className="font-bold text-lg flex items-center gap-2 text-white">👨‍🏫 {selectedClass.teacher}</p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Room</p>
                 <p className="font-bold text-lg flex items-center gap-2 text-white">🏢 {selectedClass.room}</p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Time</p>
                 <p className="font-bold text-lg flex items-center gap-2 text-white">📅 {selectedClass.schedule}</p>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Class Size</p>
                 <p className="font-bold text-lg flex items-center gap-2 text-white">👥 {selectedClass.studentCount} students</p>
               </div>
            </div>
          </div>

          <div className="p-12 space-y-12">
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8">My Performance Node</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Grade Average</p>
                  <p className="text-5xl font-black text-slate-900">{selectedClass.grade}%</p>
                  <div className="mt-6 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#3d0413] rounded-full" style={{ width: `${selectedClass.grade}%` }}></div>
                  </div>
                </div>
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Attendance Node</p>
                  <p className="text-5xl font-black text-emerald-600">{selectedClass.attendance}%</p>
                  <div className="mt-6 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${selectedClass.attendance}%` }}></div>
                  </div>
                </div>
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Assignments</p>
                  <p className="text-4xl font-black text-slate-900">{selectedClass.assignmentsDone?.toUpperCase()}</p>
                  <div className="mt-6 flex items-center gap-2">
                    <ChevronRight size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase text-[#3d0413]">View All</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8">Quick Repository Access</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: 'View Materials', icon: <BookOpen size={20} />, color: 'bg-rose-50 text-[#3d0413]' },
                  { label: 'View Assignments', icon: <FileText size={20} />, color: 'bg-amber-50 text-amber-700' },
                  { label: 'View Grades', icon: <BarChart3 size={20} />, color: 'bg-emerald-50 text-emerald-700' },
                  { label: 'View Schedule', icon: <Calendar size={20} />, color: 'bg-indigo-50 text-indigo-700' },
                ].map(link => (
                  <button key={link.label} className="group p-8 rounded-[2rem] border border-slate-100 hover:border-[#3d0413] hover:shadow-xl transition-all duration-500 text-center">
                    <div className={`w-14 h-14 ${link.color} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform`}>{link.icon}</div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 block">{link.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderClassList = () => {
    const filteredClasses = myClasses.filter(c => 
      activeTab === 'PHYSICAL' ? c.type === 'PHYSICAL' : c.type === 'ONLINE'
    );

    return (
      <div className="space-y-6 sm:space-y-12 animate-in fade-in duration-1000 pb-10 sm:pb-20">
        <div className="flex flex-col gap-4 sm:gap-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#1a202c] uppercase tracking-tighter leading-none mb-2 sm:mb-4">
                {activeTab === 'PHYSICAL' ? 'MY CLASSES' : 'MY ONLINE CLASSES'}
              </h2>
              <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.4em] flex items-center gap-2 sm:gap-3">
                 <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-[#3d0413] rounded-full animate-pulse"></span>
                 <span className="hidden sm:inline">{activeTab === 'PHYSICAL' ? 'Physical Node Synchronized • TKNP Active Registry' : 'Virtual Classroom Link Authorized • Active Streaming Hub'}</span>
                 <span className="sm:hidden">{activeTab === 'PHYSICAL' ? 'Physical Classes' : 'Online Classes'}</span>
              </p>
            </div>
            <div className="flex gap-2 sm:gap-4 p-1.5 sm:p-2 bg-slate-100 rounded-xl sm:rounded-[1.5rem] border border-slate-200 self-start sm:self-auto">
               <button 
                 onClick={() => setActiveTab('PHYSICAL')}
                 className={`px-4 sm:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black uppercase text-[8px] sm:text-[9px] tracking-wider sm:tracking-widest transition-all ${activeTab === 'PHYSICAL' ? 'bg-white text-[#3d0413] shadow-md' : 'text-slate-400'}`}
               >
                 Physical
               </button>
               <button 
                 onClick={() => setActiveTab('ONLINE')}
                 className={`px-4 sm:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black uppercase text-[8px] sm:text-[9px] tracking-wider sm:tracking-widest transition-all ${activeTab === 'ONLINE' ? 'bg-[#3d0413] text-white shadow-md' : 'text-slate-400'}`}
               >
                 Online
               </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-10">
          {filteredClasses.map((cls, idx) => (
            <div 
              key={cls.id}
              className={`bg-white rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3.5rem] border border-slate-100 p-5 sm:p-8 lg:p-10 hover:shadow-[0_50px_80px_-20px_rgba(61,4,19,0.12)] transition-all duration-700 group cursor-pointer active:scale-[0.98] flex flex-col justify-between min-h-[320px] sm:min-h-[380px] lg:aspect-[5/6] ${activeTab === 'ONLINE' ? 'border-l-4 sm:border-l-8 border-l-[#3d0413]' : ''}`}
              onClick={() => {
                if (activeTab === 'PHYSICAL') {
                  setSelectedClass(cls);
                  setActiveView('DETAIL');
                }
              }}
            >
              <div>
                <div className="flex justify-between items-start mb-4 sm:mb-8 lg:mb-10">
                  <span className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                    {String(idx + 1).padStart(2, '0')}. Module
                  </span>
                  <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center transition-all ${cls.type === 'ONLINE' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-[#3d0413]'} group-hover:scale-110`}>
                    {cls.type === 'ONLINE' ? <Monitor size={16} className="sm:w-5 sm:h-5" /> : <School size={16} className="sm:w-5 sm:h-5" />}
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-6">
                  <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter leading-tight group-hover:text-[#3d0413] transition-colors">{cls.title}</h3>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-bold text-xs sm:text-sm">
                      <span className="text-sm sm:text-lg">👩‍🏫</span> {cls.teacher}
                    </div>
                    {activeTab === 'ONLINE' && (
                      <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-bold text-xs sm:text-sm">
                        <span className="text-sm sm:text-lg">🌐</span> {cls.platform}
                      </div>
                    )}
                    <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-bold text-xs sm:text-sm">
                      <span className="text-sm sm:text-lg">🏢</span> {cls.room}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-bold text-xs sm:text-sm">
                      <span className="text-sm sm:text-lg">📅</span> {cls.schedule}
                    </div>
                    {activeTab === 'ONLINE' && cls.link && (
                       <div className="flex items-center gap-2 sm:gap-3 text-[#3d0413] font-black text-[10px] sm:text-xs truncate opacity-40">
                         <span className="text-sm sm:text-lg">🔗</span> <span className="truncate">{cls.link.replace('https://', '')}</span>
                       </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 sm:pt-8 border-t border-slate-50 space-y-3 sm:space-y-6 mt-4">
                {activeTab === 'PHYSICAL' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider sm:tracking-widest">My Grade</span>
                      <span className="text-lg sm:text-2xl font-black text-slate-900 group-hover:text-[#3d0413] transition-colors">📊 {cls.grade}%</span>
                    </div>
                    <button className="w-full py-3 sm:py-5 bg-slate-50 group-hover:bg-[#3d0413] text-slate-400 group-hover:text-white rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest transition-all duration-500 flex items-center justify-center gap-2 sm:gap-3">
                      View Class <ChevronRight size={12} className="sm:w-[14px] sm:h-[14px]" strokeWidth={3} />
                    </button>
                  </>
                ) : (
                  (() => {
                    const teacherIsLive = !!(liveSession && liveSession.isLive && liveSession.classId === cls.id);
                    const nextTime = cls.startTime || cls.schedule;
                    return (
                      <div className="space-y-2">
                        {teacherIsLive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider">
                            <Clock size={10} /> Next: {nextTime}
                          </span>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleJoinClass(cls); }}
                          className={`w-full py-3 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest transition-all duration-500 flex items-center justify-center gap-2 sm:gap-3 shadow-xl active:scale-95 border-b-4 sm:border-b-6 border-black ${
                            teacherIsLive ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-[#3d0413] text-white hover:bg-black'
                          }`}
                        >
                          {teacherIsLive ? <Play size={14} className="sm:w-4 sm:h-4" fill="currentColor" /> : <Clock size={14} className="sm:w-4 sm:h-4" />}
                          {teacherIsLive ? 'JOIN CLASS' : `Session: ${nextTime}`}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Remove "${cls.title}" from My Online Classes?`)) {
                              setMyClasses((prev) => prev.filter((c) => c.id !== cls.id));
                            }
                          }}
                          className="w-full py-2 text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          Remove from my classes
                        </button>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          ))}
          
          <div 
            onClick={() => setActiveView('JOIN_LIST')}
            className="min-h-[200px] sm:min-h-[280px] lg:aspect-[5/6] border-2 sm:border-4 border-dashed border-slate-200 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3.5rem] flex flex-col items-center justify-center gap-4 sm:gap-6 text-slate-300 hover:text-[#3d0413] hover:border-[#3d0413] hover:bg-slate-50 transition-all cursor-pointer group"
          >
             <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full border-2 sm:border-4 border-dashed border-current flex items-center justify-center group-hover:scale-110 group-hover:border-solid transition-all">
               <Plus size={28} className="sm:w-10 sm:h-10" strokeWidth={3} />
             </div>
             <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em]">{activeTab === 'PHYSICAL' ? 'Add Class' : 'Join New Class'}</span>
          </div>
        </div>

        {activeTab === 'ONLINE' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">AVAILABLE ONLINE CLASSES</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">
              Add a class to see it in My Online Classes. When the lecturer goes live, you can join from the list above. Your profile (name, registry ID, phone, gender) is sent to the lecturer when you join.
            </p>

            {availableOnlineClasses.length === 0 ? (
              <div className="bg-white rounded-[3rem] border border-slate-100 p-10 text-center text-slate-400">
                <p className="text-[10px] font-black uppercase tracking-[0.35em]">No new online classes available right now</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {availableOnlineClasses.map((cls) => (
                  <div key={cls.id} className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all flex items-center justify-between gap-6">
                    <div className="flex items-center gap-6 min-w-0">
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Monitor size={22} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{cls.platform || 'ONLINE'}</p>
                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate">{cls.title}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">👨‍🏫 {cls.teacher}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addClassFromRegistry(cls)}
                      className="px-6 py-4 bg-[#3d0413] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl border-b-4 border-black active:scale-95 transition-all whitespace-nowrap"
                    >
                      Add to My Classes
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ONLINE' && (
          <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#3d0413] shadow-sm"><Calendar size={32}/></div>
                <div>
                   <h4 className="text-xl font-black text-slate-900 uppercase">Institutional Sync</h4>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next scheduled virtual node at 04:00 PM</p>
                </div>
             </div>
             <button className="px-10 py-5 bg-white text-[#3d0413] border border-slate-200 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-3">
                <Clock size={18} /> View Schedule
             </button>
          </div>
        )}

        {activeTab === 'ONLINE' && (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl p-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
              <History size={16} /> History Classes
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Recorded sessions – watch or download (saved by your teacher).
            </p>
            {recordedSessions.length === 0 ? (
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] py-4">No recorded sessions yet.</p>
            ) : (
              <ul className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {recordedSessions.map((rec) => (
                  <li key={rec.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-2">{rec.title}</span>
                      <span className="text-[9px] font-black text-slate-400 whitespace-nowrap">{new Date(rec.date).toLocaleDateString()} · {rec.durationSec}s</span>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{rec.teacherName}</p>
                    <div className="flex flex-wrap gap-2">
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
                        className="inline-flex items-center gap-2 px-3 py-2 bg-[#3d0413] text-white rounded-xl text-[9px] font-black uppercase tracking-wider"
                      >
                        <FileDown size={12} /> Download
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = URL.createObjectURL(rec.blob);
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.write(`
                              <!DOCTYPE html><html><head><title>${rec.title}</title></head>
                              <body style="margin:0;background:#111;">
                                <video controls autoplay src="${url}" style="width:100%;max-height:100vh;"></video>
                                <p style="padding:8px;color:#999;font-size:12px;">${rec.title} · ${rec.teacherName}</p>
                              </body></html>
                            `);
                            w.document.close();
                          }
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 text-slate-800 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-slate-300"
                      >
                        <Presentation size={12} /> Watch
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  if (activeView === 'DETAIL') return renderClassDetail();
  if (activeView === 'NOT_LIVE') return renderClassNotLive();
  if (activeView === 'JOIN_LIST') return renderJoinList();
  if (activeView === 'LIVE_JOIN') return renderLiveJoin();
  return renderClassList();
};

export default StudentClasses;