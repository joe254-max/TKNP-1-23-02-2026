import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Resource } from '../types';
import { 
  Plus, ArrowLeft, X, ShieldCheck, Save, Video as VideoIcon,
  CheckCircle2, Users, MonitorPlay, Sparkles, 
  Search, Edit3, UserPlus, Presentation, FileCode, School,
  Mic, MicOff, VideoOff, MonitorUp, MessageSquare, Hand, Radio, Phone,
  UserCheck, Send, Activity, FileDown, PhoneCall, Check,
  UserCheck2, UserX2, Filter, RotateCcw, Info, Printer, Lock, History, FileText, CloudUpload, Mail, BarChart3, ArrowRight, ExternalLink, Monitor, Zap, Globe, Layers, BookOpen, Clock, Trash2, CalendarPlus, TrendingUp, AlertTriangle, Briefcase, Calendar, Power, DoorOpen, Bell, Settings
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { addSignal, listenSignals, removeSignal } from '../lib/tknpSupabaseSignals';
import { jsPDF } from 'jspdf';
import { saveRecording, getAllRecordings, type RecordedSession } from '../lib/recordingsDb';
import ERepositoryUpload from './ERepositoryUpload';
import { deleteClassSession, fetchClassSessions, upsertClassSession } from '../lib/timetableService';
import { fetchOwnedSchoolClasses, fetchOwnedSchoolStudents, searchSchoolClasses, subscribeSchoolClasses, upsertSchoolClassIndex, upsertSchoolStudents, type SchoolClassRecord } from '../lib/schoolClassService';
import { DEPARTMENTS } from '../constants';

interface DashboardProps {
  user: User;
  resources: Resource[];
  onOpenRepository?: () => void;
  forceView?: 'HOME' | 'EREPOSITORY' | null;
  onForceViewHandled?: () => void;
}

type SystemView = 'HOME' | 'PHYSICAL_CLASS_DETAIL' | 'ONLINE_CLASS_DETAIL' | 'EREPOSITORY' | 'ASSESSMENTS' | 'SETTINGS';
type ClassTab = 'REGISTER' | 'TIME TABLE' | 'STUDENTS' | 'MATERIALS';
type MaterialCategory = 'LECTURE_NOTES' | 'LAB_MANUALS' | 'PAST_PAPERS';

interface LectureNote {
  id: string;
  title: string;
  fileName: string;
  size: string;
  uploadedDate: string;
  downloads: number;
  format: 'PDF' | 'PPT' | 'DOC';
  week: number;
  category: MaterialCategory;
  tags: string[];
}

interface ScheduleSession {
  id: string;
  day: string;
  time: string;
  venue: string;
  type: 'LECTURE' | 'PRACTICAL' | 'SEMINAR';
}

interface Student {
  id: string;
  name: string;
  admNo: string;
  phone: string;
  attendance: number;
  gradeAverage: number;
  status: 'ACTIVE' | 'PROBATION' | 'DEFERRED';
  classId?: string;
}

interface PhysicalClass {
  id: string;
  code: string;
  title: string;
  room: string;
  studentCount: number;
  type: 'PHYSICAL';
  department: string;
  credits: number;
  staff: string;
  schedule: ScheduleSession[];
}

interface VirtualClass {
  id: string;
  code: string;
  title: string;
  platform: string;
  department?: string;
  students: number;
  link: string;
  type: 'ONLINE';
  startTime: string;
}

interface LiveParticipant {
  id: string;
  name: string;
  classId: string;
  hasVideo: boolean;
  fullName?: string;
  schoolRegistryId?: string;
  phone?: string;
  gender?: string;
  checked?: boolean;
}

const STORAGE_KEYS = {
  PHYSICAL: 'staff_physical_classes_v1',
  VIRTUAL: 'staff_virtual_classes_v1',
  STUDENT_REGISTRY: 'poly_institutional_registry',
  ENROLLED_STUDENTS: 'poly_enrolled_students'
};

const StaffDashboardHome: React.FC<DashboardProps> = ({
  user,
  resources,
  onOpenRepository,
  forceView = null,
  onForceViewHandled,
}) => {
  const [currentView, setCurrentView] = useState<SystemView>('HOME');
  const [activeClassTab, setActiveClassTab] = useState<ClassTab>('REGISTER');
  const [activeMaterialCategory, setActiveMaterialCategory] = useState<MaterialCategory | null>(null);
  const [selectedPhysicalClass, setSelectedPhysicalClass] = useState<PhysicalClass | null>(null);
  const [selectedOnlineClass, setSelectedOnlineClass] = useState<VirtualClass | null>(null);
  
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info'} | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [materialsSearch, setMaterialsSearch] = useState('');
  const [schoolClassSearch, setSchoolClassSearch] = useState('');
  const [schoolClassResults, setSchoolClassResults] = useState<SchoolClassRecord[]>([]);
  const [isSchoolClassLoading, setIsSchoolClassLoading] = useState(false);
  const [schoolClassSearchOpen, setSchoolClassSearchOpen] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const lecturerCameraPiPRef = useRef<HTMLVideoElement>(null);
  const pdfPrintRef = useRef<HTMLDivElement>(null);
  const classFormRef = useRef<HTMLFormElement>(null);
  const broadcasterSignalRef = useRef<any | null>(null);
  const firestoreUnsubRef = useRef<(() => void) | null>(null);
  interface PeerState {
    pc: RTCPeerConnection;
    cameraSender: RTCRtpSender | null;
    screenSender: RTCRtpSender | null;
  }
  const broadcasterPeersRef = useRef<Record<string, PeerState>>({});
  const broadcasterClassIdRef = useRef<string | null>(null);

  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isCamRequesting, setIsCamRequesting] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [liveParticipants, setLiveParticipants] = useState<LiveParticipant[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => { mediaStreamRef.current = mediaStream; }, [mediaStream]);
  useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);

  const recordingRef = useRef<{
    recorder: MediaRecorder;
    chunks: Blob[];
    startTime: number;
  } | null>(null);
  const [recordedSessions, setRecordedSessions] = useState<RecordedSession[]>([]);

  useEffect(() => {
    if (!forceView) return;
    setCurrentView(forceView);
    onForceViewHandled?.();
  }, [forceView, onForceViewHandled]);

  const RTC_CONFIG: RTCConfiguration = useMemo(() => ({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  }), []);

  // Persistence Logic for Staff Dashboard
  const [physicalClasses, setPhysicalClasses] = useState<PhysicalClass[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PHYSICAL);
    return saved ? JSON.parse(saved) : [
      { 
        id: 'pc1', code: 'EE-402', title: 'POWER SYSTEMS II', room: 'POWER LAB 2', studentCount: 42, type: 'PHYSICAL' as const, department: 'ELECTRICAL ENGINEERING', credits: 3, staff: user.name,
        schedule: [
          { id: 's1', day: 'MONDAY', time: '08:00 AM - 11:00 AM', venue: 'POWER LAB 2', type: 'PRACTICAL' },
          { id: 's2', day: 'WEDNESDAY', time: '02:00 PM - 04:00 PM', venue: 'LT-04', type: 'LECTURE' },
        ],
      }
    ];
  });

  const [virtualClasses, setVirtualClasses] = useState<VirtualClass[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VIRTUAL);
    return saved ? JSON.parse(saved) : [
      { id: 'v1', code: 'ICT-101', title: 'PROGRAMMING LOGIC', platform: 'MICROSOFT TEAMS', department: user.department || 'General', students: 42, link: 'https://teams.microsoft.com', type: 'ONLINE' as const, startTime: '10:00 AM' }
    ];
  });

  // Load students from Registry + Defaults
  const [students, setStudents] = useState<Student[]>(() => {
    const defaultStudents: Student[] = [
      { id: 'st1', name: 'BENJAMIN KIPROP', admNo: 'EE/001/2024', phone: '+254 711 000 001', attendance: 98, gradeAverage: 74, status: 'ACTIVE' },
      { id: 'st2', name: 'CYNTHIA ANYANGO', admNo: 'EE/042/2024', phone: '+254 711 000 002', attendance: 82, gradeAverage: 68, status: 'ACTIVE' },
      { id: 'st3', name: 'DOUGLAS MWANGI', admNo: 'EE/105/2024', phone: '+254 711 000 003', attendance: 45, gradeAverage: 52, status: 'PROBATION' },
    ];
    const saved = localStorage.getItem(STORAGE_KEYS.ENROLLED_STUDENTS);
    const joinedStudents: Student[] = saved ? JSON.parse(saved) : [];
    return [...defaultStudents, ...joinedStudents];
  });

  // Sync to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PHYSICAL, JSON.stringify(physicalClasses));
  }, [physicalClasses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VIRTUAL, JSON.stringify(virtualClasses));
  }, [virtualClasses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ENROLLED_STUDENTS, JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    let mounted = true;
    const hydrateFromSupabase = async () => {
      try {
        const [classRows, studentRows] = await Promise.all([
          fetchOwnedSchoolClasses(),
          fetchOwnedSchoolStudents(),
        ]);

        if (!mounted) return;

        if (classRows.length > 0) {
          const nextPhysical = classRows
            .filter((r) => r.class_mode === 'PHYSICAL')
            .map((r) => ({
              id: r.class_key,
              code: r.code,
              title: r.title,
              room: r.room_or_platform,
              studentCount: r.student_count ?? 0,
              type: 'PHYSICAL' as const,
              department: r.department || user.department || 'General',
              credits: 3,
              staff: r.teacher_name || user.name,
              schedule: [],
            }));
          const nextVirtual = classRows
            .filter((r) => r.class_mode === 'ONLINE')
            .map((r) => ({
              id: r.class_key,
              code: r.code,
              title: r.title,
              platform: r.room_or_platform,
              department: r.department || user.department || 'General',
              students: r.student_count ?? 0,
              link: '#',
              type: 'ONLINE' as const,
              startTime: '12:00 PM',
            }));

          if (nextPhysical.length > 0) setPhysicalClasses(nextPhysical);
          if (nextVirtual.length > 0) setVirtualClasses(nextVirtual);
        }

        if (studentRows.length > 0) {
          setStudents((prev) => {
            const byAdm = new Map(prev.map((s) => [s.admNo, s]));
            studentRows.forEach((r) => {
              byAdm.set(r.adm_no, {
                id: r.student_id || `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name: r.student_name,
                admNo: r.adm_no,
                phone: r.phone || '',
                attendance: Number(r.attendance || 0),
                gradeAverage: Number(r.grade_average || 0),
                status: (r.status as Student['status']) || 'ACTIVE',
                classId: r.class_key,
              });
            });
            return Array.from(byAdm.values());
          });
        }
      } catch {
        // local state remains fallback if Supabase hydration fails
      }
    };

    void hydrateFromSupabase();
    return () => {
      mounted = false;
    };
  }, [user.department, user.name]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      try {
        setCloudSyncStatus('saving');
        await upsertSchoolClassIndex([
          ...physicalClasses.map((c) => ({
            class_key: c.id,
            code: c.code,
            title: c.title,
            department: c.department || user.department || 'General',
            class_mode: 'PHYSICAL' as const,
            room_or_platform: c.room,
            teacher_name: c.staff || user.name,
            student_count: c.studentCount ?? 0,
          })),
          ...virtualClasses.map((c) => ({
            class_key: c.id,
            code: c.code,
            title: c.title,
            department: c.department || user.department || 'General',
            class_mode: 'ONLINE' as const,
            room_or_platform: c.platform,
            teacher_name: user.name,
            student_count: c.students ?? 0,
          })),
        ]);
        markCloudSaved();
      } catch {
        setCloudSyncStatus('error');
        // Keep UI responsive even when cloud sync is unavailable.
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [physicalClasses, virtualClasses, user.department, user.name]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      try {
        setCloudSyncStatus('saving');
        await upsertSchoolStudents(
          students.map((s) => ({
            class_key: s.classId || 'UNASSIGNED',
            student_id: s.id,
            adm_no: s.admNo,
            student_name: s.name,
            phone: s.phone || '',
            status: s.status || 'ACTIVE',
            attendance: Number(s.attendance || 0),
            grade_average: Number(s.gradeAverage || 0),
          })),
        );
        markCloudSaved();
      } catch {
        setCloudSyncStatus('error');
        // keep non-blocking
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [students]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setIsSchoolClassLoading(true);
      try {
        const rows = await searchSchoolClasses(schoolClassSearch);
        setSchoolClassResults(rows);
      } catch {
        setSchoolClassResults([]);
      } finally {
        setIsSchoolClassLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [schoolClassSearch]);

  useEffect(() => {
    const unsubscribe = subscribeSchoolClasses(() => {
      void (async () => {
        try {
          const rows = await searchSchoolClasses(schoolClassSearch);
          setSchoolClassResults(rows);
        } catch {
          // keep current list on realtime refresh errors
        }
      })();
    });
    return unsubscribe;
  }, [schoolClassSearch]);

  // Sync live participants list for current online class
  useEffect(() => {
    const loadParticipants = () => {
      try {
        const raw = localStorage.getItem('poly_live_participants') || '[]';
        const all: LiveParticipant[] = JSON.parse(raw);
        if (selectedOnlineClass) {
          setLiveParticipants(all.filter(p => p.classId === selectedOnlineClass.id));
        } else {
          setLiveParticipants([]);
        }
      } catch {
        setLiveParticipants([]);
      }
    };
    loadParticipants();
    const id = window.setInterval(loadParticipants, 3000);
    return () => window.clearInterval(id);
  }, [selectedOnlineClass]);

  // Lecturer camera PiP when screen sharing + camera on
  useEffect(() => {
    if (!lecturerCameraPiPRef.current || !isScreenSharing || !isCamOn || !mediaStream) return;
    lecturerCameraPiPRef.current.srcObject = mediaStream;
    void lecturerCameraPiPRef.current.play();
  }, [isScreenSharing, isCamOn, mediaStream]);

  // Load recorded sessions for History Classes
  useEffect(() => {
    let mounted = true;
    getAllRecordings().then((list) => {
      if (mounted) setRecordedSessions(list);
    });
    return () => { mounted = false; };
  }, []);

  // Calendar Governance States
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarAction, setCalendarAction] = useState<'OPENING' | 'CLOSING'>('OPENING');
  const [academicConfig, setAcademicConfig] = useState({
    term: 1,
    openingDate: '2026-05-01',
    closingDate: '2026-08-15',
    status: 'ACTIVE' as 'ACTIVE' | 'BREAK'
  });

  const [attendanceLog, setAttendanceLog] = useState<Record<string, 'PRESENT' | 'ABSENT'>>({});
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<PhysicalClass | VirtualClass | null>(null);
  const [provisionType, setProvisionType] = useState<'PHYSICAL' | 'ONLINE'>('PHYSICAL');
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  
  const [messagingStudent, setMessagingStudent] = useState<Student | null>(null);
  const [analyticsStudent, setAnalyticsStudent] = useState<Student | null>(null);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ScheduleSession | null>(null);

  const [lectureNotes] = useState<LectureNote[]>([
    { id: 'n1', title: 'TRANSMISSION LINE MODELLING', fileName: 'EE402_WK1_TRANSMISSION.PDF', size: '4.8 MB', uploadedDate: 'FEB 1, 2026', downloads: 124, format: 'PDF', week: 1, category: 'LECTURE_NOTES', tags: ['Core'] },
    { id: 'n2', title: 'LAB MANUAL: FAULT ANALYSIS', fileName: 'LAB_EE402_P1.PDF', size: '12.4 MB', uploadedDate: 'FEB 5, 2026', downloads: 215, format: 'PDF', week: 1, category: 'LAB_MANUALS', tags: ['Mandatory'] },
    { id: 'n3', title: 'POWER PROTECTION SYSTEMS 2023', fileName: 'EXAM_EE402_S1_2023.PDF', size: '2.1 MB', uploadedDate: 'DEC 12, 2025', downloads: 89, format: 'PDF', week: 14, category: 'PAST_PAPERS', tags: ['Exam'] },
  ]);

  const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const markCloudSaved = () => {
    setLastSavedAt(new Date());
    setCloudSyncStatus('saved');
    window.setTimeout(() => {
      setCloudSyncStatus((prev) => (prev === 'saved' ? 'idle' : prev));
    }, 2200);
  };

  const setStudentStatus = (id: string, status: 'PRESENT' | 'ABSENT') => {
    setAttendanceLog(prev => ({ ...prev, [id]: status }));
  };

  const syncToGlobalRegistry = (node: PhysicalClass | VirtualClass, isRemoval: boolean = false) => {
    const currentRegistryStr = localStorage.getItem(STORAGE_KEYS.STUDENT_REGISTRY) || '[]';
    let currentRegistry = JSON.parse(currentRegistryStr);
    
    if (isRemoval) {
      currentRegistry = currentRegistry.filter((r: any) => r.id !== node.id);
    } else {
      const existingIdx = currentRegistry.findIndex((r: any) => r.id === node.id);
      const registryItem = {
        id: node.id,
        title: `${node.code}: ${node.title}`,
        teacher: user.name,
        room: node.type === 'PHYSICAL' ? (node as PhysicalClass).room : (node as VirtualClass).platform,
        schedule: node.type === 'PHYSICAL' ? 'In-person node' : (node as VirtualClass).startTime || 'Virtual session',
        startTime: node.type === 'ONLINE' ? (node as VirtualClass).startTime : undefined,
        type: node.type,
        studentCount: (node as any).studentCount || (node as any).students || 0,
        department: user.department || 'General Academic Dept',
        platform: node.type === 'ONLINE' ? (node as VirtualClass).platform : undefined
      };

      if (existingIdx > -1) {
        currentRegistry[existingIdx] = registryItem;
      } else {
        currentRegistry.push(registryItem);
      }
    }
    
    localStorage.setItem(STORAGE_KEYS.STUDENT_REGISTRY, JSON.stringify(currentRegistry));
  };

  const handleDeleteNode = (e: React.MouseEvent, id: string, type: 'PHYSICAL' | 'ONLINE') => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to terminate this academic node? This action is irreversible.")) return;
    
    if (type === 'PHYSICAL') {
      const nodeToRemove = physicalClasses.find(c => c.id === id);
      if (nodeToRemove) syncToGlobalRegistry(nodeToRemove, true);
      setPhysicalClasses(prev => prev.filter(c => c.id !== id));
    } else {
      const nodeToRemove = virtualClasses.find(c => c.id === id);
      if (nodeToRemove) syncToGlobalRegistry(nodeToRemove, true);
      setVirtualClasses(prev => prev.filter(c => c.id !== id));
    }
    showToast("Academic Node Terminated", "info");
  };

  const handleOpenEdit = (e: React.MouseEvent, node: PhysicalClass | VirtualClass) => {
    e.stopPropagation();
    setEditingNode(node);
    setProvisionType(node.type);
    setIsCreateClassModalOpen(true);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!selectedPhysicalClass) return;
    if (!window.confirm("Delete this session from the time table?")) return;

    const updatedSchedule = selectedPhysicalClass.schedule.filter(s => s.id !== sessionId);
    const updatedClass = { ...selectedPhysicalClass, schedule: updatedSchedule };
    
    setPhysicalClasses(prev => prev.map(c => c.id === selectedPhysicalClass.id ? updatedClass : c));
    setSelectedPhysicalClass(updatedClass);
    void deleteClassSession(selectedPhysicalClass.id, sessionId).catch(() => {
      showToast('Cloud sync failed for session delete', 'info');
    });
    showToast("Session Removed", "info");
  };

  const handleOpenSessionModal = (session?: ScheduleSession) => {
    setEditingSession(session || null);
    setIsSessionModalOpen(true);
  };

  const openTimetableFromSidebar = async () => {
    const targetClass = selectedPhysicalClass || physicalClasses[0] || null;
    if (!targetClass) {
      setEditingNode(null);
      setProvisionType('PHYSICAL');
      setIsCreateClassModalOpen(true);
      showToast('Create a physical class first to manage timetable', 'info');
      return;
    }

    setSelectedPhysicalClass(targetClass);
    setCurrentView('PHYSICAL_CLASS_DETAIL');
    setActiveClassTab('TIME TABLE');

    try {
      const rows = await fetchClassSessions(targetClass.id);
      if (rows.length === 0) return;
      const cloudSchedule: ScheduleSession[] = rows.map((r) => ({
        id: r.session_id,
        day: r.day,
        time: r.time,
        venue: r.venue,
        type: r.session_type,
      }));
      const mergedClass: PhysicalClass = { ...targetClass, schedule: cloudSchedule };
      setPhysicalClasses((prev) => prev.map((c) => (c.id === targetClass.id ? mergedClass : c)));
      setSelectedPhysicalClass(mergedClass);
    } catch {
      showToast('Could not load cloud timetable; showing local schedule', 'info');
    }
  };

  const openPhysicalClassTab = (tab: ClassTab) => {
    const targetClass = selectedPhysicalClass || physicalClasses[0] || null;
    if (!targetClass) {
      setEditingNode(null);
      setProvisionType('PHYSICAL');
      setIsCreateClassModalOpen(true);
      showToast('Create a physical class first', 'info');
      return;
    }
    setSelectedPhysicalClass(targetClass);
    setCurrentView('PHYSICAL_CLASS_DETAIL');
    setActiveClassTab(tab);
  };

  const openLiveClassesFromSidebar = () => {
    const targetLiveClass = selectedOnlineClass || virtualClasses[0] || null;
    if (!targetLiveClass) {
      showToast('No live class found. Create one first.', 'info');
      return;
    }
    setSelectedOnlineClass(targetLiveClass);
    setCurrentView('ONLINE_CLASS_DETAIL');
  };

  const handleToggleMic = () => {
    setIsMicOn(!isMicOn);
    showToast(!isMicOn ? "Microphone Authorized" : "Microphone Muted", "info");
  };

  const startRecording = () => {
    const combined = new MediaStream();
    [mediaStreamRef.current, screenStreamRef.current].forEach((ms) => {
      if (ms) ms.getTracks().forEach((t) => combined.addTrack(t));
    });
    if (combined.getTracks().length === 0) return;
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 2500000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      const classId = broadcasterClassIdRef.current;
      const cls = selectedOnlineClass ?? virtualClasses.find((c) => c.id === classId);
      if (chunks.length && cls) {
        const blob = new Blob(chunks, { type: mime });
        const durationSec = Math.round((Date.now() - recordingRef.current!.startTime) / 1000);
        try {
          await saveRecording(
            {
              id: `rec-${classId}-${Date.now()}`,
              classId: cls.id,
              title: cls.title,
              teacherName: user.name,
              date: new Date().toISOString(),
              durationSec,
            },
            blob
          );
          setRecordedSessions(await getAllRecordings());
          showToast('Session saved to History Classes', 'success');
        } catch {
          showToast('Recording could not be saved', 'info');
        }
      }
      recordingRef.current = null;
    };
    recorder.start(2000);
    recordingRef.current = { recorder, chunks, startTime: Date.now() };
  };

  const stopRecording = () => {
    if (recordingRef.current) {
      recordingRef.current.recorder.stop();
    }
  };

  const stopBroadcast = () => {
    stopRecording();
    try {
      if (firestoreUnsubRef.current) {
        try { firestoreUnsubRef.current(); } catch {}
        firestoreUnsubRef.current = null;
      }
      try { if (broadcasterClassIdRef.current) addSignal(broadcasterClassIdRef.current, { type: 'end', classId: broadcasterClassIdRef.current, from: user.id, role: 'teacher' }); } catch {}
    } catch {
      // ignore
    }
    Object.values(broadcasterPeersRef.current).forEach((state: PeerState) => {
      try { state.pc.close(); } catch { /* ignore */ }
    });
    broadcasterPeersRef.current = {};
    broadcasterSignalRef.current = null;
    broadcasterClassIdRef.current = null;
  };

  const updateBroadcastTracks = (camStream: MediaStream | null, screenStr: MediaStream | null) => {
    const classId = broadcasterClassIdRef.current;
    if (!classId) return;
    const camTrack = camStream?.getVideoTracks()[0] ?? null;
    const screenTrack = screenStr?.getVideoTracks()[0] ?? null;

    Object.entries(broadcasterPeersRef.current).forEach(async ([studentId, state]: [string, PeerState]) => {
      const { pc, cameraSender, screenSender } = state;
      try {
        if (cameraSender) {
          await cameraSender.replaceTrack(camTrack);
        } else if (camTrack) {
          state.cameraSender = pc.addTrack(camTrack, camStream!);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          try { await addSignal(classId, { type: 'offer', classId, role: 'teacher', from: user.id, to: studentId, sdp: pc.localDescription ? { type: pc.localDescription.type, sdp: pc.localDescription.sdp } : null }); } catch {}
        }
        if (screenSender) {
          await screenSender.replaceTrack(screenTrack);
        } else if (screenTrack) {
          state.screenSender = pc.addTrack(screenTrack, screenStr!);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          try { await addSignal(classId, { type: 'offer', classId, role: 'teacher', from: user.id, to: studentId, sdp: pc.localDescription ? { type: pc.localDescription.type, sdp: pc.localDescription.sdp } : null }); } catch {}
        }
      } catch {
        // ignore
      }
    });
  };

  const startBroadcast = (classId: string) => {
    const camStream = mediaStreamRef.current;
    const screenStr = screenStreamRef.current;
    const hasAny = !!(camStream?.active || screenStr?.active);
    if (!hasAny) return;

    if (broadcasterClassIdRef.current === classId && broadcasterSignalRef.current) {
      updateBroadcastTracks(camStream, screenStr);
      return;
    }
    stopBroadcast();
    broadcasterClassIdRef.current = classId;
    // start listening to Firestore signals for this class
    const unsub = listenSignals(classId, async (snapshot: any) => {
      for (const change of snapshot.docChanges()) {
        const doc = change.doc;
        const msg = doc.data();
        if (!msg) continue;
        try {
          if (msg.role !== 'student') {
            await removeSignal(classId, doc.id);
            continue;
          }
          const studentId = msg.from as string;
          if (msg.type === 'join') {
            const state = await ensurePeer(studentId);
            const offer = await state.pc.createOffer();
            await state.pc.setLocalDescription(offer);
            await addSignal(classId, { type: 'offer', classId, role: 'teacher', from: user.id, to: studentId, sdp: state.pc.localDescription ? { type: state.pc.localDescription.type, sdp: state.pc.localDescription.sdp } : null });
          } else if (msg.type === 'answer' && msg.sdp) {
            const state = broadcasterPeersRef.current[studentId];
            if (state) await state.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          } else if (msg.type === 'candidate' && msg.candidate) {
            const state = await ensurePeer(studentId);
            await state.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
        } catch {
          // ignore
        }
        try { await removeSignal(classId, doc.id); } catch {}
      }
    });
    firestoreUnsubRef.current = unsub;

    const ensurePeer = async (studentId: string): Promise<PeerState> => {
      const existing = broadcasterPeersRef.current[studentId];
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const camTrack = mediaStreamRef.current?.getVideoTracks()[0];
      const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
      let cameraSender: RTCRtpSender | null = null;
      let screenSender: RTCRtpSender | null = null;
      if (camTrack && mediaStreamRef.current) {
        cameraSender = pc.addTrack(camTrack, mediaStreamRef.current);
      }
      if (screenTrack && screenStreamRef.current) {
        screenSender = pc.addTrack(screenTrack, screenStreamRef.current);
      }

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        try { addSignal(classId, { type: 'candidate', classId, role: 'teacher', from: user.id, to: studentId, candidate: ev.candidate.toJSON() }); } catch {}
      };

      const state: PeerState = { pc, cameraSender, screenSender };
      broadcasterPeersRef.current[studentId] = state;
      return state;
    };
    startRecording();
  };

  const persistLiveSession = (isLive: boolean) => {
    if (!selectedOnlineClass) return;
    try {
      const liveSession = {
        classId: selectedOnlineClass.id,
        title: selectedOnlineClass.title,
        teacher: user.name,
        isLive,
      };
      localStorage.setItem('poly_live_session', JSON.stringify(liveSession));
    } catch {
      // ignore
    }
  };

  const handleToggleVideo = async () => {
    if (isCamRequesting) return;
    if (isCamOn) {
      if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      setMediaStream(null);
      setIsCamOn(false);
      if (isScreenSharing) {
        updateBroadcastTracks(null, screenStreamRef.current);
      } else {
        stopBroadcast();
        persistLiveSession(false);
      }
    } else {
      try {
        if (!selectedOnlineClass) {
          showToast("Select an online class first", "info");
          return;
        }
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          showToast("Camera blocked: open on localhost or use HTTPS", "info");
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          showToast("Camera not supported in this browser", "info");
          return;
        }
        setIsCamRequesting(true);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        mediaStreamRef.current = stream;
        if (videoRef.current && !isScreenSharing) {
          videoRef.current.srcObject = stream;
          try { await videoRef.current.play(); } catch { /* ignore */ }
        }
        setMediaStream(stream);
        setIsCamOn(true);
        persistLiveSession(true);
        startBroadcast(selectedOnlineClass.id);
      } catch (err) {
        const name = (err as any)?.name as string | undefined;
        if (name === 'NotAllowedError') showToast("Camera permission denied", "info");
        else if (name === 'NotFoundError') showToast("No camera device found", "info");
        else if (name === 'NotReadableError') showToast("Camera is in use by another app", "info");
        else showToast("Visual Input Denied", "info");
      } finally {
        setIsCamRequesting(false);
      }
    }
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
      updateBroadcastTracks(mediaStreamRef.current, null);
      if (!isCamOn) persistLiveSession(false);
      if (mediaStream && videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try { await videoRef.current.play(); } catch { /* ignore */ }
      }
      showToast("Screen sharing stopped", "info");
    } else {
      try {
        if (!selectedOnlineClass) {
          showToast("Select an online class first", "info");
          return;
        }
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          showToast("Screen share blocked: open on localhost or use HTTPS", "info");
          return;
        }
        if (!navigator.mediaDevices?.getDisplayMedia) {
          showToast("Screen sharing not supported in this browser", "info");
          return;
        }
        // Browser picker allows Tab, Window, or Entire Screen – no restriction so all work
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        stream.getVideoTracks()[0].onended = () => {
          screenStreamRef.current = null;
          setScreenStream(null);
          setIsScreenSharing(false);
          updateBroadcastTracks(mediaStreamRef.current, null);
          if (!isCamOn) persistLiveSession(false);
          if (mediaStream && videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            try { videoRef.current.play(); } catch { /* ignore */ }
          }
          showToast("Screen sharing ended", "info");
        };
        if (videoRef.current) videoRef.current.srcObject = null;
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsScreenSharing(true);
        persistLiveSession(true);
        startBroadcast(selectedOnlineClass.id);
        showToast(isCamOn ? "Screen sharing added – students see camera and screen" : "Screen sharing started", "success");
      } catch (err) {
        const name = (err as any)?.name as string | undefined;
        if (name === 'NotAllowedError') showToast("Screen share permission denied", "info");
        else showToast("Screen share failed", "info");
        setIsScreenSharing(false);
        setScreenStream(null);
        screenStreamRef.current = null;
      }
    }
  };

  const handleExportPDF = async () => {
    if (!pdfPrintRef.current) return;
    showToast("Generating Academic Document...", "info");
    try {
      pdfPrintRef.current.style.display = 'block';
      const canvas = await html2canvas(pdfPrintRef.current, { scale: 2, useCORS: true });
      pdfPrintRef.current.style.display = 'none';
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`TKNP_Attendance_${selectedPhysicalClass?.code}.pdf`);
      showToast("Official Document Dispatched", "success");
    } catch (err) { showToast("PDF Sync Failure", "info"); }
  };

  // Filter students based on current selected class
  const classStudents = useMemo(() => {
    const currentId = selectedPhysicalClass?.id || selectedOnlineClass?.id;
    if (!currentId) return students;
    return students.filter(s => !s.classId || s.classId === currentId);
  }, [students, selectedPhysicalClass, selectedOnlineClass]);

  const filteredStudents = useMemo(() => {
    return classStudents.filter(s => 
      s.name.toLowerCase().includes(ledgerSearch.toLowerCase()) || 
      s.admNo.toLowerCase().includes(ledgerSearch.toLowerCase())
    );
  }, [classStudents, ledgerSearch]);

  const filteredMaterials = useMemo(() => {
    return lectureNotes.filter(note => {
      const query = materialsSearch.toLowerCase().trim();
      const matchesSearch = query === '' || 
                           note.title.toLowerCase().includes(query) || 
                           note.fileName.toLowerCase().includes(query) ||
                           note.tags.some(tag => tag.toLowerCase().includes(query));
      
      if (activeMaterialCategory) {
        return note.category === activeMaterialCategory && matchesSearch;
      }
      return matchesSearch;
    });
  }, [lectureNotes, activeMaterialCategory, materialsSearch]);

  const renderRegister = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] flex items-center justify-between shadow-sm">
          <div><p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Present Today</p>
          <p className="text-4xl font-black text-emerald-900">{Object.values(attendanceLog).filter(v => v === 'PRESENT').length}</p></div>
          <div className="w-14 h-14 bg-white/50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm"><UserCheck size={24} /></div>
        </div>
        <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem] flex items-center justify-between shadow-sm">
          <div><p className="text-[10px] font-black text-rose-800 uppercase tracking-widest mb-1">Absent Today</p>
          <p className="text-4xl font-black text-rose-900">{Object.values(attendanceLog).filter(v => v === 'ABSENT').length}</p></div>
          <div className="w-14 h-14 bg-white/50 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm"><X size={24} /></div>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex items-center justify-between shadow-sm">
          <div><p className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-1">Class Size</p>
          <p className="text-4xl font-black text-slate-900">{classStudents.length}</p></div>
          <div className="w-14 h-14 bg-white/50 rounded-2xl flex items-center justify-center text-slate-600 shadow-sm"><Users size={24} /></div>
        </div>
        <div className="bg-[#3d0413] p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl border-b-4 border-black">
          <div><p className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1">Completion</p>
          <p className="text-4xl font-black text-white">{Math.round((Object.keys(attendanceLog).length / (classStudents.length || 1)) * 100) || 0}%</p></div>
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white"><Activity size={24} /></div>
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between flex-wrap gap-4 bg-slate-50/20">
          <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Class Attendance</h3>
            <div className="mt-4 relative w-64">
              <input type="text" placeholder="Filter Ledger..." value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none shadow-sm" />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { classStudents.forEach(st => setStudentStatus(st.id, 'PRESENT')); showToast("Marked All Present"); }} className="px-6 py-4 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition flex items-center gap-2 border border-emerald-100"><UserCheck2 size={16} /> Mark All Present</button>
            <button onClick={() => setIsAddStudentModalOpen(true)} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition flex items-center gap-2"><UserPlus size={16} /> Enroll New</button>
            <button onClick={handleExportPDF} className="px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition flex items-center gap-2"><FileDown size={16} /> Official PDF</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                <th className="px-10 py-6 text-left">Student Node</th>
                <th className="px-10 py-6 text-left">Admission No</th>
                <th className="px-10 py-6 text-left">Phone Node</th>
                <th className="px-10 py-6 text-center">Mark Presence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStudents.map(st => (
                <tr key={st.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-[#3d0413]/10 text-[#3d0413] rounded-lg flex items-center justify-center font-black text-xs">
                        {st.name.charAt(0)}
                      </div>
                      <span className="font-black text-slate-900 uppercase text-xs">{st.name}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6 font-black text-slate-600 text-[11px] tracking-widest">{st.admNo}</td>
                  <td className="px-10 py-6 font-black text-slate-600 text-[11px] tracking-widest">{st.phone}</td>
                  <td className="px-10 py-6 text-center">
                    <div className="flex items-center justify-center gap-5">
                       <button onClick={() => setStudentStatus(st.id, 'PRESENT')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${attendanceLog[st.id] === 'PRESENT' ? 'bg-emerald-500 text-white shadow-lg scale-110' : 'bg-slate-50 text-slate-300 hover:text-emerald-500'}`}><Check size={20} strokeWidth={3} /></button>
                       <button onClick={() => setStudentStatus(st.id, 'ABSENT')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${attendanceLog[st.id] === 'ABSENT' ? 'bg-rose-600 text-white shadow-lg scale-110' : 'bg-slate-50 text-slate-300 hover:text-rose-600'}`}><X size={20} strokeWidth={3} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-10 py-20 text-center">
                     <Users size={48} className="mx-auto text-slate-200 mb-4" />
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching peer nodes in this module ledger</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderTimetable = () => (
    <div className="bg-white p-6 sm:p-10 lg:p-12 rounded-[2.5rem] lg:rounded-[4rem] border border-slate-100 shadow-xl animate-in fade-in slide-in-from-right-8 duration-700 relative">
      <div className="flex items-center justify-between mb-12">
        <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">TIME TABLE</h3>
        <button 
          onClick={() => handleOpenSessionModal()}
          className="px-8 py-4 bg-[#3d0413] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3 border-b-6 border-black"
        >
          <CalendarPlus size={20} /> Provision Session
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-8">
        {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map(day => (
          <div key={day} className="space-y-6">
            <div className="text-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-[#3d0413] uppercase tracking-[0.3em]">{day}</span>
            </div>
            <div className="min-h-[350px] flex flex-col gap-4">
              {(selectedPhysicalClass?.schedule || []).filter(s => s.day === day).length === 0 && (
                <div className="flex-1 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex items-center justify-center opacity-20">
                  <Clock size={32} />
                </div>
              )}
              {(selectedPhysicalClass?.schedule || []).filter(s => s.day === day).map(s => (
                <div key={s.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group relative">
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenSessionModal(s)}
                      className="p-2 bg-slate-50 text-slate-400 hover:text-[#3d0413] rounded-lg transition-all"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteSession(s.id)}
                      className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{s.time}</p>
                  <p className="font-black text-slate-900 uppercase text-xs mb-6 leading-tight">{s.venue}</p>
                  <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${s.type === 'PRACTICAL' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {s.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStudents = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-left-8 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative w-full md:w-96">
          <input 
            type="text" 
            placeholder="Search Academic Roster..." 
            value={ledgerSearch}
            onChange={(e) => setLedgerSearch(e.target.value)}
            className="w-full pl-16 pr-8 py-5 bg-white border border-slate-200 rounded-[2rem] text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-[#3d0413]/5 transition-all" 
          />
          <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
        </div>
        <button onClick={() => setIsAddStudentModalOpen(true)} className="px-10 py-5 bg-[#3d0413] text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all border-b-6 border-black">Enroll Peer Node</button>
      </div>

      <div className="bg-white rounded-[2.5rem] lg:rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                <th className="px-10 py-8 text-left">Academic Peer</th>
                <th className="px-10 py-8 text-left">Registry ID</th>
                <th className="px-10 py-8 text-left">Communication Node</th>
                <th className="px-10 py-8 text-center">Engagement %</th>
                <th className="px-10 py-8 text-center">Enrolment Status</th>
                <th className="px-10 py-8 text-center">Attendance History</th>
                <th className="px-10 py-8 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStudents.map(st => (
                <tr key={st.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#3d0413] font-black group-hover:bg-[#3d0413] group-hover:text-white transition-all duration-300">
                        {st.name.charAt(0)}
                      </div>
                      <span className="font-black text-slate-900 uppercase text-xs tracking-tight">{st.name}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6 font-black text-slate-600 text-[11px] tracking-widest">{st.admNo}</td>
                  <td className="px-10 py-6 font-black text-slate-600 text-[11px] tracking-widest">{st.phone}</td>
                  <td className="px-10 py-6 text-center">
                    <div className="inline-flex items-center gap-2">
                      <span className="font-black text-slate-900 text-[11px]">{st.attendance}%</span>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${st.attendance > 75 ? 'bg-emerald-500' : st.attendance > 40 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                          style={{ width: `${st.attendance}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      st.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      st.status === 'PROBATION' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                      'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {st.status}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <button 
                      onClick={() => setHistoryStudent(st)}
                      className="p-3 bg-slate-50 text-[#3d0413] hover:bg-[#3d0413] hover:text-white rounded-xl shadow-sm transition-all"
                    >
                      <History size={18} />
                    </button>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={() => setMessagingStudent(st)}
                        className="p-2.5 bg-slate-50 text-slate-400 hover:text-[#3d0413] hover:bg-white hover:shadow-md rounded-xl transition-all" 
                      >
                        <Mail size={16} />
                      </button>
                      <button 
                        onClick={() => setAnalyticsStudent(st)}
                        className="p-2.5 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-white hover:shadow-md rounded-xl transition-all" 
                      >
                        <BarChart3 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                   <td colSpan={7} className="px-10 py-20 text-center">
                      <Users size={64} className="mx-auto text-slate-100 mb-4" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No peer nodes joined this institutional repository module</p>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderMaterials = () => {
    const isSearching = materialsSearch.trim().length > 0;
    const showList = activeMaterialCategory !== null || isSearching;
    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-4xl font-black uppercase tracking-tight text-slate-900">
              {activeMaterialCategory ? activeMaterialCategory.replace('_', ' ') : isSearching ? 'Search Results' : 'Asset Repository'}
            </h3>
            {activeMaterialCategory && (
              <button 
                onClick={() => { setActiveMaterialCategory(null); setMaterialsSearch(''); }}
                className="text-[10px] font-black text-[#3d0413] uppercase tracking-widest hover:underline flex items-center gap-1 w-fit"
              >
                <ArrowLeft size={12} /> Back to Categories
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
             <div className="relative w-full sm:w-80">
                <input 
                  type="text" 
                  placeholder="Filter Assets..." 
                  value={materialsSearch}
                  onChange={(e) => setMaterialsSearch(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none shadow-sm focus:ring-4 focus:ring-[#3d0413]/5 transition-all" 
                />
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                {isSearching && (
                  <button 
                    onClick={() => setMaterialsSearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
             </div>
             <button className="px-10 py-5 bg-[#3d0413] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3 border-b-6 border-black">
               <CloudUpload size={20} /> Provision Asset
             </button>
          </div>
        </div>
        {!showList ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {[
              { id: 'LECTURE_NOTES', title: 'Curriculum Nodes', icon: <FileText size={48} />, color: 'bg-emerald-50 text-emerald-600' },
              { id: 'LAB_MANUALS', title: 'Practical Logs', icon: <Lock size={48} />, color: 'bg-amber-50 text-amber-600' },
              { id: 'PAST_PAPERS', title: 'Historical Exams', icon: <History size={48} />, color: 'bg-indigo-50 text-indigo-600' },
            ].map(cat => (
              <div key={cat.id} onClick={() => setActiveMaterialCategory(cat.id as MaterialCategory)} className="bg-white p-14 rounded-[4.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group cursor-pointer text-center">
                <div className={`w-28 h-28 ${cat.color} rounded-[3rem] flex items-center justify-center mx-auto mb-10 group-hover:scale-110 transition-transform shadow-inner`}>{cat.icon}</div>
                <h4 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">{cat.title}</h4>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Select to view files</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {filteredMaterials.map(note => (
              <div key={note.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col justify-between aspect-[5/6]">
                <div>
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-[#3d0413] mb-6 group-hover:scale-110 transition-transform"><FileCode size={32} /></div>
                  <h4 className="text-lg font-black text-slate-900 mb-1 uppercase line-clamp-2 leading-tight group-hover:text-[#3d0413] transition-colors">{note.title}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 truncate">{note.fileName}</p>
                  <div className="flex flex-wrap gap-2 mb-8">
                     {note.tags.map(tag => (
                       <span key={tag} className="px-2.5 py-1 bg-slate-50 text-[9px] font-black uppercase text-slate-400 border border-slate-100 rounded-lg group-hover:bg-rose-50 group-hover:text-rose-600 transition-colors">{tag}</span>
                     ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-50 pt-6">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{note.size}</span>
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{note.uploadedDate}</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-3 bg-slate-50 text-slate-400 hover:text-[#3d0413] hover:bg-white hover:shadow-md rounded-xl transition-all"><FileDown size={18} /></button>
                    <button className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:shadow-md rounded-xl transition-all"><Trash2 size={18} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAssessments = () => (
    <div className="animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl border border-[#eddde0] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[#1a0208] uppercase tracking-tight">Assessments</h2>
            <p className="text-sm text-[#9a7880] mt-1">Manage assessments, marks, and class evaluation workflows.</p>
          </div>
          <button
            onClick={() => openPhysicalClassTab('REGISTER')}
            className="px-4 py-2 rounded-lg bg-[#3d0413] text-white text-xs font-black uppercase tracking-widest hover:bg-black transition"
          >
            Open Class Register
          </button>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl border border-[#eddde0] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[#1a0208] uppercase tracking-tight">Admin Settings</h2>
            <p className="text-sm text-[#9a7880] mt-1">Portal-level lecturer tools, configuration, and account preferences.</p>
          </div>
          <button
            onClick={() => setCurrentView('HOME')}
            className="px-4 py-2 rounded-lg border border-[#eddde0] text-[#3d0413] text-xs font-black uppercase tracking-widest hover:bg-[#fdf2f4] transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );

  const renderOnlineClassDetail = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 animate-in fade-in slide-in-from-right-12 duration-1000">
      <div className="lg:col-span-2 space-y-8 lg:space-y-12">
        <div className="relative bg-slate-950 aspect-video rounded-[2rem] lg:rounded-[4rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] group border border-white/5">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover opacity-90 transition-opacity duration-300 ${isScreenSharing ? 'opacity-0' : ''}`}
          />
          {/* When screen sharing, local preview must not show the captured feed (avoids recursion). Show status only. */}
          {isScreenSharing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-white/90 px-4 text-center z-10">
              <div className="w-20 h-20 sm:w-28 sm:h-28 bg-emerald-500/20 rounded-full flex items-center justify-center mb-5 sm:mb-7 border-2 border-emerald-500/50">
                <MonitorUp className="w-10 h-10 sm:w-14 sm:h-14 text-emerald-400" />
              </div>
              <p className="text-sm sm:text-base font-black uppercase tracking-wider">
                You are sharing your screen
              </p>
              <p className="text-[10px] sm:text-[11px] font-medium text-white/50 mt-2 uppercase tracking-widest">
                Students see your shared content
              </p>
              <p className="text-[9px] font-medium text-amber-400/80 mt-3 max-w-sm">
                In the share dialog, choose a tab or window with your content only – not this app tab or the student preview tab – to avoid a mirror effect for students.
              </p>
              {isCamOn && mediaStream && (
                <div className="absolute bottom-20 left-4 sm:left-6 w-28 sm:w-36 aspect-video rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl bg-slate-800 z-20">
                  <video ref={lecturerCameraPiPRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          ) : (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center text-white/20 px-4 text-center transition-opacity duration-300 ${
                isCamOn ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-white/5 rounded-full flex items-center justify-center mb-5 sm:mb-7 md:mb-8">
                <VideoOff className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16" />
              </div>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.35em] sm:tracking-[0.5em]">
                {isCamRequesting ? 'Requesting Camera Access...' : 'Institutional Feed Offline'}
              </p>
            </div>
          )}
          {isScreenSharing && (
            <div className="absolute top-3 right-3 sm:top-6 sm:right-6 lg:top-12 lg:right-12 px-4 py-2 sm:px-6 sm:py-3 bg-emerald-500 text-white rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] lg:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.35em] flex items-center gap-2 sm:gap-3 shadow-2xl animate-pulse z-20">
              <MonitorUp size={14} className="sm:w-4 sm:h-4" />
              <span>Screen Sharing</span>
            </div>
          )}
          <div className="absolute bottom-4 sm:bottom-8 lg:bottom-12 left-1/2 -translate-x-1/2 flex flex-wrap sm:flex-nowrap items-center justify-center gap-3 sm:gap-4 lg:gap-6 px-4 py-3 sm:px-5 sm:py-4 lg:p-6 bg-white/10 backdrop-blur-3xl rounded-2xl sm:rounded-[2.5rem] border border-white/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-500 scale-95 sm:scale-90 sm:group-hover:scale-100 w-[calc(100%-2rem)] sm:w-auto max-w-[480px]">
            <button
              onClick={handleToggleMic}
              className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center transition-all ${isMicOn ? 'bg-white text-[#3d0413]' : 'bg-rose-600 text-white'}`}
            >
              {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
            <button
              onClick={handleToggleVideo}
              className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center transition-all ${isCamOn ? 'bg-white text-[#3d0413]' : 'bg-rose-600 text-white'}`}
            >
              {isCamOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
            </button>
            <button 
              onClick={handleToggleScreenShare}
              className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center transition-all ${isScreenSharing ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title={isScreenSharing ? 'Stop sharing screen (feed switches to camera if on)' : 'Share tab, window, or entire screen'}
            >
              <MonitorUp size={22} />
            </button>
            {isScreenSharing && (
              <button
                onClick={handleToggleScreenShare}
                className="px-4 py-3 sm:px-5 sm:py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                title="Stop screen sharing only; camera feed continues if it was on"
              >
                Stop Screen Sharing
              </button>
            )}
            <div className="hidden sm:block w-px h-10 bg-white/10 mx-2"></div>
            <button
              onClick={() => {
                setCurrentView('HOME');
                setSelectedOnlineClass(null);
                stopBroadcast();
                try {
                  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
                } catch {
                  // ignore
                }
                try {
                  if (screenStream) screenStream.getTracks().forEach(t => t.stop());
                } catch {
                  // ignore
                }
                mediaStreamRef.current = null;
                screenStreamRef.current = null;
                setMediaStream(null);
                setScreenStream(null);
                setIsCamOn(false);
                setIsScreenSharing(false);
                try {
                  localStorage.removeItem('poly_live_session');
                  localStorage.removeItem('poly_live_participants');
                } catch {
                  // ignore
                }
                setLiveParticipants([]);
              }}
              className="mt-2 sm:mt-0 px-6 py-3 sm:px-8 sm:py-4 lg:px-10 lg:py-5 bg-rose-600 text-white rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
            >
              Terminate
            </button>
          </div>
          <div className="absolute top-3 left-3 sm:top-6 sm:left-6 lg:top-12 lg:left-12 px-4 py-2 sm:px-6 sm:py-3 lg:px-8 lg:py-4 bg-emerald-500 text-white rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] lg:text-[10px] font-black uppercase tracking-[0.25em] sm:tracking-[0.35em] lg:tracking-widest flex items-center gap-2 sm:gap-3 shadow-2xl animate-pulse max-w-[90%]">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full"></div>
            <span className="truncate">Live Feed Authorized</span>
          </div>
        </div>
        <div className="bg-white p-6 sm:p-10 lg:p-14 rounded-[2.5rem] lg:rounded-[4.5rem] border border-slate-100 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
           <div>
             <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2">{selectedOnlineClass?.title}</h3>
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-4">
               <span className="text-rose-600 font-black">{selectedOnlineClass?.platform}</span> • {selectedOnlineClass?.code}
             </p>
           </div>
           <div className="flex flex-wrap items-center gap-3">
             <a href={selectedOnlineClass?.link} target="_blank" rel="noopener noreferrer" className="px-12 py-6 bg-[#3d0413] text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-4 border-b-6 border-black"><ExternalLink size={20} /> Open Platform Node</a>
             <button
               type="button"
               onClick={() => window.open(`${window.location.origin}${window.location.pathname}?lecturer_preview=1`, '_blank', 'noopener')}
               className="px-8 py-6 bg-amber-500 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-3 border-b-4 border-amber-700 hover:bg-amber-600"
               title="Open student view in a new tab. Use this tab to test connection; do not share that tab when screen sharing to avoid mirror effect."
             >
               <Monitor size={20} /> Preview student view
             </button>
           </div>
        </div>
      </div>
      <div className="space-y-8 lg:space-y-12">
        <div className="bg-slate-50 border border-slate-100 p-6 sm:p-8 lg:p-10 rounded-[2.5rem] lg:rounded-[4rem] flex items-center justify-between">
          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Peers</p><p className="text-5xl font-black text-slate-900">{selectedOnlineClass?.students}</p></div>
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#3d0413] shadow-sm"><Users size={32} /></div>
        </div>
        <div className="bg-white rounded-[2.5rem] lg:rounded-[4rem] border border-slate-100 shadow-2xl p-6 sm:p-8 lg:p-10 flex flex-col h-[420px] sm:h-[480px] lg:h-[500px]">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 lg:mb-8 flex items-center gap-3"><MessageSquare size={16} /> Session Intelligence Chat</h3>
          <div className="flex-1 overflow-y-auto space-y-6 mb-8 pr-4 scrollbar-hide">
            <div className="bg-slate-50 p-6 rounded-[2rem] rounded-tl-none border border-slate-100 max-w-[85%]"><p className="text-[9px] font-black text-[#3d0413] uppercase tracking-widest mb-2">System Registry</p><p className="text-xs font-medium text-slate-600 leading-relaxed">Institutional Security Node Verified. All sessions cataloged.</p></div>
          </div>
          <div className="relative mb-6"><input type="text" placeholder="Broadcast to peers..." className="w-full pl-8 pr-20 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold outline-none" /><button className="absolute right-3 top-3 bottom-3 px-6 bg-[#3d0413] text-white rounded-xl shadow-xl active:scale-90 transition-all"><Send size={18} /></button></div>
          <div className="mt-auto border-t border-slate-100 pt-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
              <Users size={14} /> Live Participants
            </h4>
            {liveParticipants.length === 0 ? (
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.25em]">No student video nodes joined yet.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto pr-1">
                <table className="w-full text-[9px] sm:text-[10px]">
                  <thead>
                    <tr className="text-slate-400 font-black uppercase tracking-wider border-b border-slate-200">
                      <th className="text-left py-2 pr-2">Full Legal Name</th>
                      <th className="text-left py-2 pr-2 hidden sm:table-cell">Registry ID</th>
                      <th className="text-left py-2 pr-2 hidden md:table-cell">Phone</th>
                      <th className="text-left py-2 pr-2 hidden md:table-cell">Gender</th>
                      <th className="text-center py-2 w-12">✓</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveParticipants.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 text-slate-700 font-bold">
                        <td className="py-2 pr-2">
                          <span className="truncate max-w-[120px] sm:max-w-none block">{p.fullName ?? p.name}</span>
                          <span className="sm:hidden text-slate-400">{p.schoolRegistryId || p.id}</span>
                        </td>
                        <td className="py-2 pr-2 hidden sm:table-cell">{p.schoolRegistryId || '–'}</td>
                        <td className="py-2 pr-2 hidden md:table-cell">{p.phone || '–'}</td>
                        <td className="py-2 pr-2 hidden md:table-cell">{p.gender || '–'}</td>
                        <td className="py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!p.checked}
                            onChange={() => {
                              try {
                                const raw = localStorage.getItem('poly_live_participants') || '[]';
                                const list: LiveParticipant[] = JSON.parse(raw);
                                const idx = list.findIndex((x) => x.id === p.id && x.classId === selectedOnlineClass?.id);
                                if (idx > -1) {
                                  list[idx] = { ...list[idx], checked: !list[idx].checked };
                                  localStorage.setItem('poly_live_participants', JSON.stringify(list));
                                  setLiveParticipants(list.filter((x) => x.classId === selectedOnlineClass?.id));
                                }
                              } catch {
                                // ignore
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-[#3d0413]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-[2.5rem] lg:rounded-[4rem] border border-slate-100 shadow-2xl p-6 sm:p-8 lg:p-10">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 lg:mb-6 flex items-center gap-3">
            <History size={16} /> History Classes
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Recorded sessions – watch or download. Auto-saved when you end a live session.
          </p>
          {recordedSessions.length === 0 ? (
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] py-6">
              No recorded sessions yet. Stream a class and end the session to save it here.
            </p>
          ) : (
            <ul className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
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
                      className="inline-flex items-center gap-2 px-3 py-2 bg-[#3d0413] text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-[#5a061c]"
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
      </div>
    </div>
  );

  const renderERepository = () => (
    <div className="animate-in fade-in duration-500">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-[#1a0208]">E-Library Manager</h3>
          <p className="text-[11px] text-[#9a7880] mt-1">
            Upload, publish, and manage materials visible in the public E-Repository.
          </p>
        </div>
        <button
          onClick={() => setCurrentView('HOME')}
          className="px-4 py-2 rounded-lg bg-[#fdf2f4] border border-[#f0dde1] text-[10px] font-black uppercase tracking-widest text-[#3d0413] hover:bg-[#fbeaec]"
        >
          Back
        </button>
      </div>
      <ERepositoryUpload
        user={user}
        onUploadSuccess={() => showToast('E-Library updated', 'success')}
        onOpenLibraryPage={() => {
          if (onOpenRepository) {
            onOpenRepository();
          }
        }}
      />
    </div>
  );

      return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="flex min-h-screen">
        <aside className="w-[220px] bg-[#3d0413] text-white hidden md:flex flex-col border-r border-[#5f1f30]">
          <div className="p-5 border-b border-black/10">
            <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-[11px] font-bold mb-3">TKNP</div>
            <div className="text-[11px] font-bold leading-tight">Kitale National Polytechnic</div>
            <div className="text-[10px] text-white/55 mt-1">Lecturer Portal</div>
          </div>
          <div
            className="p-3 flex-1 border border-black"
            style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(58, 3, 3, 1) 0%, rgba(0, 0, 0, 1) 100%)' }}
          >
            <div className="text-[9px] uppercase tracking-[0.12em] text-white/35 px-2 py-1">Main</div>
            <button className="w-full text-left px-3 py-2 rounded-none bg-white/15 text-white text-sm font-semibold flex items-center gap-2"><BarChart3 size={14} /> Dashboard</button>
            <button onClick={() => { void openTimetableFromSidebar(); }} className="w-full text-left px-3 py-2 text-white/70 text-sm flex items-center gap-2 hover:bg-white/10"><Calendar size={14} /> Timetable</button>
            <button onClick={() => openPhysicalClassTab('STUDENTS')} className="w-full text-left px-3 py-2 text-white/70 text-sm flex items-center gap-2 hover:bg-white/10"><Users size={14} /> Students <span className="ml-auto text-[9px] bg-white/20 rounded-full px-2 py-0.5">{students.length}</span></button>
            <button
              onClick={() => {
                if (onOpenRepository) {
                  onOpenRepository();
                  return;
                }
                setCurrentView('EREPOSITORY');
              }}
              className="w-full text-left px-3 py-2 text-white/70 text-sm flex items-center gap-2 hover:bg-white/10"
            >
              <BookOpen size={14} /> E-Library
              <span className="ml-auto text-[9px] bg-white/20 rounded-full px-2 py-0.5">{resources.length}</span>
            </button>
            <div className="text-[9px] uppercase tracking-[0.12em] text-white/35 px-2 py-2 mt-2">Teaching</div>
            <button onClick={() => openPhysicalClassTab('REGISTER')} className="w-full text-left px-3 py-2 text-white/70 text-sm flex items-center gap-2 hover:bg-white/10"><Check size={14} /> Attendance</button>
            <button onClick={() => setCurrentView('ASSESSMENTS')} className="w-full text-left px-3 py-2 text-white/70 text-sm flex items-center gap-2 hover:bg-white/10"><FileText size={14} /> Assessments</button>
            <button onClick={() => openPhysicalClassTab('MATERIALS')} className="w-full text-left px-3 py-2 text-white/70 text-sm flex items-center gap-2 hover:bg-white/10"><BookOpen size={14} /> Materials <span className="ml-auto text-[9px] bg-white/20 rounded-full px-2 py-0.5">{resources.length}</span></button>
            <button onClick={openLiveClassesFromSidebar} className="w-full text-left px-3 py-2 text-white/70 text-sm flex items-center gap-2 hover:bg-white/10"><Radio size={14} /> Live Classes</button>
            <button onClick={() => setCurrentView('SETTINGS')} className="w-full text-left px-2 py-2 mt-2 text-white/40 text-[9px] uppercase tracking-[0.12em] hover:text-white/70">Admin</button>
            <button onClick={() => setCurrentView('SETTINGS')} className="w-full text-left px-3 py-2 text-white/70 text-sm flex items-center gap-2 hover:bg-white/10"><Settings size={14} /> Settings</button>
          </div>
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-[11px] font-semibold">{user.name}</div>
                <div className="text-[9px] text-white/55">{user.department || 'General Dept.'}</div>
              </div>
            </div>
          </div>
        </aside>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-[52px] bg-white border-b border-[#e8dfe1] px-6 flex items-center justify-between gap-4">
            <div className="text-[14px] font-semibold text-[#1a0208]">Lecturer Dashboard</div>
            <div className="relative flex-1 max-w-xl">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={schoolClassSearch}
                onChange={(e) => setSchoolClassSearch(e.target.value)}
                onFocus={() => setSchoolClassSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSchoolClassSearchOpen(false), 120)}
                placeholder="Search all classes in school..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#e8dfe1] bg-[#faf7f8] text-[12px] font-semibold text-[#3d0413] outline-none focus:ring-2 focus:ring-[#3d0413]/20"
              />
              {schoolClassSearchOpen && (
                <div className="absolute top-11 left-0 right-0 z-30 bg-white border border-[#eddde0] rounded-xl shadow-xl max-h-72 overflow-y-auto">
                  {isSchoolClassLoading && <div className="px-4 py-3 text-xs text-slate-500">Searching classes...</div>}
                  {!isSchoolClassLoading && schoolClassResults.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-500">No classes found.</div>
                  )}
                  {!isSchoolClassLoading &&
                    schoolClassResults.map((item) => (
                      <button
                        key={item.class_key}
                        onMouseDown={() => {
                          const picked = physicalClasses.find((c) => c.id === item.class_key);
                          if (picked) {
                            setSelectedPhysicalClass(picked);
                            setCurrentView('PHYSICAL_CLASS_DETAIL');
                            setActiveClassTab('REGISTER');
                            return;
                          }
                          const pickedOnline = virtualClasses.find((c) => c.id === item.class_key);
                          if (pickedOnline) {
                            setSelectedOnlineClass(pickedOnline);
                            setCurrentView('ONLINE_CLASS_DETAIL');
                          }
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-[#fdf2f4] border-b border-[#f4eaec] last:border-b-0"
                      >
                        <div className="text-[12px] font-black text-[#1a0208]">{item.code} - {item.title}</div>
                        <div className="text-[10px] text-[#9a7880] mt-1">{item.department} · {item.class_mode} · {item.room_or_platform} · {item.student_count} students</div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`text-[10px] px-2.5 py-1 rounded-md border font-black uppercase tracking-widest ${
                  cloudSyncStatus === 'saving'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : cloudSyncStatus === 'saved'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : cloudSyncStatus === 'error'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-[#fdf2f4] text-[#9a7880] border-[#f0dde1]'
                }`}
              >
                {cloudSyncStatus === 'saving'
                  ? 'Syncing...'
                  : cloudSyncStatus === 'saved'
                  ? 'Saved to Cloud'
                  : cloudSyncStatus === 'error'
                  ? 'Sync Error'
                  : 'Cloud Ready'}
              </div>
              {lastSavedAt && (
                <div className="text-[10px] text-[#9a7880] bg-[#f8f1f3] px-2.5 py-1 rounded-md border border-[#f0dde1] font-bold">
                  Last saved: {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <div className="text-[11px] text-[#9a7880] bg-[#fdf2f4] px-3 py-1 rounded-md border border-[#f0dde1]">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <button className="w-8 h-8 rounded-lg bg-[#fdf2f4] border border-[#f0dde1] flex items-center justify-center relative">
                <Bell size={14} className="text-[#3d0413]" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#c0392b]" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-6 py-5 relative z-10">
        {notification && (
          <div className="fixed top-24 right-12 z-[1000] animate-in slide-in-from-right-8">
            <div className={`px-12 py-6 rounded-3xl shadow-2xl border-l-8 flex items-center gap-8 ${notification.type === 'success' ? 'bg-white border-emerald-500 text-slate-900' : 'bg-[#3d0413] border-rose-400 text-white'}`}>
              {notification.type === 'success' ? <CheckCircle2 className="text-emerald-500" size={36} /> : <Info className="text-rose-400" size={36} />}
              <p className="text-base font-black uppercase tracking-[0.1em]">{notification.msg}</p>
            </div>
          </div>
        )}

        {currentView === 'HOME' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="bg-[#3d0413] rounded-2xl px-6 py-5 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-[11px] text-white/65">Good morning,</p>
                <h2 className="text-3xl font-black leading-tight">{user.name}</h2>
                <p className="text-xs text-white/70">{user.role} — {user.department || 'General Department'}</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] px-3 py-1 rounded-md bg-white/15 border border-white/20 inline-block">
                  Term {academicConfig.term} · {new Date().getFullYear()}/{new Date().getFullYear() + 1}
                </div>
                <div className="mt-2 text-[11px] text-white/75 flex items-center justify-end gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  Active Session
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-[#eddde0] rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-[#9a7880] font-semibold">My Classes</div>
                <div className="text-4xl font-black text-[#1a0208]">{physicalClasses.length + virtualClasses.length}</div>
                <div className="text-[10px] text-[#c07080]">Active this term</div>
              </div>
              <div className="bg-white border border-[#eddde0] rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-[#9a7880] font-semibold">Total Students</div>
                <div className="text-4xl font-black text-[#1a0208]">{students.length}</div>
                <div className="text-[10px] text-[#c07080]">Enrolled</div>
              </div>
              <div className="bg-white border border-[#eddde0] rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-[#9a7880] font-semibold">Avg. Attendance</div>
                <div className="text-4xl font-black text-[#1a0208]">{students.length > 0 ? Math.round(students.reduce((a, s) => a + s.attendance, 0) / students.length) : 0}%</div>
                <div className="text-[10px] text-[#c07080]">This week</div>
              </div>
              <div
                className="bg-[#3d0413] border border-[#3d0413] rounded-xl p-4"
                style={{ background: 'conic-gradient(from 0deg at 50% 50%, rgba(61, 4, 19, 1) 0%, rgba(0, 0, 0, 1) 100%)' }}
              >
                <div className="text-[10px] uppercase tracking-widest text-white/65 font-semibold">On Probation</div>
                <div className="text-4xl font-black text-white">{students.filter(s => s.status === 'PROBATION').length}</div>
                <div className="text-[10px] text-rose-200/70">Needs attention</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#3d0413] mb-2">My Classes</div>
                <div className="space-y-2">
              {physicalClasses.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setSelectedPhysicalClass(c); setCurrentView('PHYSICAL_CLASS_DETAIL'); setActiveClassTab('REGISTER'); }}
                  className="border border-[#eddde0] rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-[#3d0413] transition"
                  style={{ background: 'linear-gradient(90deg, rgba(29, 22, 22, 1) 0%, rgba(52, 4, 4, 1) 100%)' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-[#f0dde1] flex items-center justify-center text-[#3d0413]"><School size={16} /></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{c.title}</div>
                    <div className="text-[11px] text-rose-100/80">{c.code} · {c.room} · {c.studentCount} students</div>
                  </div>
                  <div className="text-[10px] bg-[#fdf2f4] border border-[#f0dde1] text-[#3d0413] px-2 py-1 rounded-md font-semibold">In-Person</div>
                  <div className="flex gap-2">
                    <button onClick={(e) => handleOpenEdit(e, c)} className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white shadow-xl flex items-center justify-center text-slate-600 hover:text-[#3d0413] border border-slate-100"><Edit3 size={14} className="sm:w-[18px] sm:h-[18px]" /></button>
                    <button onClick={(e) => handleDeleteNode(e, c.id, 'PHYSICAL')} className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white shadow-xl flex items-center justify-center text-rose-600 border border-rose-100"><Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" /></button>
                  </div>
                </div>
              ))}
              {virtualClasses.map(v => (
                <div key={v.id} onClick={() => { setSelectedOnlineClass(v); setCurrentView('ONLINE_CLASS_DETAIL'); }} className="bg-white border border-[#eddde0] rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-[#7a0f2a] border-l-[3px] border-l-[#7a0f2a] transition">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-[#f0dde1] flex items-center justify-center text-[#7a0f2a]"><Monitor size={16} /></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[#1a0208]">{v.title}</div>
                    <div className="text-[11px] text-[#9a7880]">{v.code} · {v.platform} · {v.students} students</div>
                  </div>
                  <div className="text-[10px] bg-[#fff0f6] border border-[#f0d5dd] text-[#7a0f2a] px-2 py-1 rounded-md font-semibold">Online</div>
                  <div className="flex gap-2">
                    <button onClick={(e) => handleOpenEdit(e, v)} className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-xl shadow-xl flex items-center justify-center text-white/80 border border-white/10"><Edit3 size={14} className="sm:w-[18px] sm:h-[18px]" /></button>
                    <button onClick={(e) => handleDeleteNode(e, v.id, 'ONLINE')} className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-xl shadow-xl flex items-center justify-center text-rose-400 border border-rose-900/50"><Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" /></button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => { setEditingNode(null); setProvisionType('PHYSICAL'); setIsCreateClassModalOpen(true); }}
                className="rounded-xl border-[1.5px] border-dashed border-[#ddb8bf] p-4 flex items-center gap-3 text-rose-100 hover:border-[#3d0413] hover:text-white transition"
                style={{
                  backgroundColor: 'rgba(82, 0, 10, 1)',
                  borderImage: 'linear-gradient(90deg, rgba(66, 6, 17, 1) 0%, rgba(28, 23, 23, 1) 100%) 1',
                }}
              >
                <div className="w-7 h-7 rounded-md bg-white border border-[#ddb8bf] flex items-center justify-center text-[#3d0413]">
                  <Plus size={16} />
                </div>
                <span className="text-[11px] font-semibold">Add new class</span>
              </button>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#3d0413] mb-2">Today's Schedule</div>
                <div className="space-y-2">
                  {(selectedPhysicalClass?.schedule || physicalClasses[0]?.schedule || []).slice(0, 3).map((s) => (
                    <div key={s.id} className="bg-white border border-[#eddde0] rounded-lg px-4 py-3 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${s.type === 'LECTURE' ? 'bg-[#3d0413]' : s.type === 'PRACTICAL' ? 'bg-[#7a0f2a]' : 'bg-[#c0392b]'}`} />
                      <div className="text-[11px] font-semibold text-[#3d0413] min-w-[65px]">{s.time.split('-')[0].trim()}</div>
                      <div>
                        <div className="text-sm font-semibold text-[#1a0208]">{selectedPhysicalClass?.title || physicalClasses[0]?.title} — {s.type}</div>
                        <div className="text-[11px] text-[#9a7880]">{s.venue}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#3d0413] mb-2">Quick Actions</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { const c = physicalClasses[0]; if (c) { setSelectedPhysicalClass(c); setCurrentView('PHYSICAL_CLASS_DETAIL'); setActiveClassTab('REGISTER'); } }} className="bg-white border border-[#eddde0] rounded-lg px-3 py-2 text-xs font-semibold text-[#3d0413] text-left hover:bg-[#fdf2f4]">Take Attendance</button>
                    <button onClick={() => setCurrentView('EREPOSITORY')} className="bg-white border border-[#eddde0] rounded-lg px-3 py-2 text-xs font-semibold text-[#3d0413] text-left hover:bg-[#fdf2f4]">Library</button>
                    <button onClick={() => { const v = virtualClasses[0]; if (v) { setSelectedOnlineClass(v); setCurrentView('ONLINE_CLASS_DETAIL'); } }} className="bg-white border border-[#eddde0] rounded-lg px-3 py-2 text-xs font-semibold text-[#3d0413] text-left hover:bg-[#fdf2f4]">Start Live Class</button>
                    <button onClick={() => { const c = physicalClasses[0]; if (c) { setSelectedPhysicalClass(c); setCurrentView('PHYSICAL_CLASS_DETAIL'); setActiveClassTab('STUDENTS'); } }} className="bg-white border border-[#eddde0] rounded-lg px-3 py-2 text-xs font-semibold text-[#3d0413] text-left hover:bg-[#fdf2f4]">View Reports</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'PHYSICAL_CLASS_DETAIL' && selectedPhysicalClass && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-6 sm:space-y-10 lg:space-y-12 pb-10 sm:pb-16 lg:pb-20 relative z-10">
            <header className="bg-white p-4 sm:p-6 lg:p-10 xl:p-14 rounded-xl sm:rounded-[2rem] lg:rounded-[3.5rem] xl:rounded-[4.5rem] border border-slate-100 shadow-xl flex flex-col gap-4 sm:gap-6 lg:gap-8 xl:gap-10">
              <div className="flex items-start sm:items-center gap-3 sm:gap-6 lg:gap-10">
                <button onClick={() => { setCurrentView('HOME'); setSelectedPhysicalClass(null); }} className="p-2.5 sm:p-4 lg:p-5 xl:p-6 bg-slate-50 text-slate-400 hover:text-[#3d0413] rounded-lg sm:rounded-xl lg:rounded-2xl xl:rounded-3xl transition-all shadow-sm shrink-0">
                  <ArrowLeft size={18} className="sm:hidden" strokeWidth={3} />
                  <ArrowLeft size={22} className="hidden sm:block lg:hidden" strokeWidth={3} />
                  <ArrowLeft size={28} className="hidden lg:block" strokeWidth={3} />
                </button>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-6xl font-black text-slate-900 uppercase tracking-tight leading-tight break-words">{selectedPhysicalClass.title}</h2>
                  <p className="text-[9px] sm:text-[10px] lg:text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.4em] lg:tracking-[0.5em] mt-2 sm:mt-3 lg:mt-5 flex flex-wrap items-center gap-2 sm:gap-4">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="truncate">{selectedPhysicalClass.department}</span>
                    <span>•</span>
                    <span>{selectedPhysicalClass.code}</span>
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
                <div className="flex gap-1.5 sm:gap-2 bg-slate-50 p-1.5 sm:p-2 lg:p-3 rounded-xl sm:rounded-2xl lg:rounded-[2.5rem] border border-slate-100 shadow-inner min-w-max sm:min-w-0 sm:flex-wrap sm:justify-center lg:justify-start">
                  {['REGISTER', 'TIME TABLE', 'STUDENTS', 'MATERIALS'].map(tab => (
                    <button key={tab} onClick={() => setActiveClassTab(tab as ClassTab)} className={`px-3 sm:px-6 lg:px-8 xl:px-10 py-2 sm:py-3 lg:py-4 xl:py-5 rounded-lg sm:rounded-xl lg:rounded-[1.5rem] text-[8px] sm:text-[9px] lg:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap ${activeClassTab === tab ? 'bg-[#3d0413] text-white shadow-xl sm:shadow-2xl' : 'text-slate-400 hover:text-slate-800'}`}>{tab === 'TIME TABLE' ? 'SCHEDULE' : tab}</button>
                  ))}
                </div>
              </div>
            </header>
            <div className="min-h-[500px]">
              {activeClassTab === 'REGISTER' && renderRegister()}
              {activeClassTab === 'TIME TABLE' && renderTimetable()}
              {activeClassTab === 'STUDENTS' && renderStudents()}
              {activeClassTab === 'MATERIALS' && renderMaterials()}
            </div>
          </div>
        )}
        {currentView === 'ONLINE_CLASS_DETAIL' && selectedOnlineClass && renderOnlineClassDetail()}
        {currentView === 'EREPOSITORY' && renderERepository()}
        {currentView === 'ASSESSMENTS' && renderAssessments()}
        {currentView === 'SETTINGS' && renderSettings()}
      </div>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT CLASS MODAL */}
      {isCreateClassModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-6 lg:p-8">
           <div
             className="absolute inset-0 bg-[rgba(0,0,0,0.03)] border border-black/20"
             style={{ backdropFilter: 'blur(28px) brightness(0.72)', WebkitBackdropFilter: 'blur(28px) brightness(0.72)' }}
             onClick={() => { setIsCreateClassModalOpen(false); setEditingNode(null); }}
           ></div>
           <div className="relative w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl sm:rounded-[2.5rem] lg:rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in flex flex-col border border-[#3d0413]/20">
              <div className="bg-black px-5 py-4 sm:px-8 sm:py-6 lg:px-12 lg:py-8 flex justify-between items-center">
                <h3
                  className="text-xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight leading-none bg-clip-text text-transparent"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 1)',
                    backgroundImage: 'linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(0, 0, 0, 1)',
                    boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  {editingNode ? 'Edit Class' : 'Add New Class'}
                </h3>
                <button onClick={() => { setIsCreateClassModalOpen(false); setEditingNode(null); }} className="p-2.5 sm:p-3.5 bg-white/10 rounded-xl sm:rounded-2xl hover:bg-white/20 transition-all border border-white/15 text-white">
                  <X size={22} style={{ color: 'rgba(236, 228, 228, 0.95)' }} />
                </button>
              </div>
              <div className="px-4 py-5 sm:px-8 sm:py-7 lg:px-12 lg:py-9 overflow-y-auto">
                <form 
                  ref={classFormRef}
                  onSubmit={(e) => {
                   e.preventDefault();
                   const formData = new FormData(e.currentTarget as HTMLFormElement);
                   const type = provisionType;
                   const code = (formData.get('code') as string).toUpperCase();
                   const title = (formData.get('title') as string).toUpperCase();
                   const target = (formData.get('target') as string).toUpperCase();
                  const department = ((formData.get('department') as string) || user.department || 'General').toUpperCase();
                   
                   const submitter = (e.nativeEvent as any).submitter?.name;
                   const destinationTab = submitter === 'STUDENTS' ? 'STUDENTS' : submitter === 'TIMETABLE' ? 'TIME TABLE' : 'REGISTER';

                   let classToSelect: PhysicalClass | VirtualClass | null = null;

                   if (editingNode) {
                      if (type === 'PHYSICAL') {
                        setPhysicalClasses(prev => prev.map(c => {
                          if (c.id === editingNode.id) {
                            const updated = { ...c, code, title, room: target, department, type: 'PHYSICAL' as const };
                            classToSelect = updated;
                            syncToGlobalRegistry(updated);
                            return updated;
                          }
                          return c;
                        }));
                      } else {
                        setVirtualClasses(prev => prev.map(c => {
                          if (c.id === editingNode.id) {
                            const updated = { ...c, code, title, platform: target, department, type: 'ONLINE' as const };
                            classToSelect = updated;
                            syncToGlobalRegistry(updated);
                            return updated;
                          }
                          return c;
                        }));
                      }
                      showToast("Academic Node Synchronized");
                   } else {
                      let newNode: any;
                      if (type === 'PHYSICAL') {
                        newNode = { id: `p-${Date.now()}`, code, title, room: target, studentCount: 0, type: 'PHYSICAL' as const, department, credits: 3, staff: user.name, schedule: [] };
                        setPhysicalClasses(prev => [...prev, newNode]);
                        classToSelect = newNode;
                        syncToGlobalRegistry(newNode);
                      } else {
                        newNode = { id: `v-${Date.now()}`, code, title, platform: target, department, students: 0, link: '#', type: 'ONLINE' as const, startTime: '12:00 PM' };
                        setVirtualClasses(prev => [...prev, newNode]);
                        classToSelect = newNode;
                        syncToGlobalRegistry(newNode);
                      }
                      showToast("Academic Node Provisioned");
                   }

                   if (submitter === 'STUDENTS' || submitter === 'TIMETABLE') {
                      if (type === 'PHYSICAL' && classToSelect) {
                        setSelectedPhysicalClass(classToSelect as PhysicalClass);
                        setCurrentView('PHYSICAL_CLASS_DETAIL');
                        setActiveClassTab(destinationTab as ClassTab);
                      } else if (type === 'ONLINE' && classToSelect) {
                        setSelectedOnlineClass(classToSelect as VirtualClass);
                        setCurrentView('ONLINE_CLASS_DETAIL');
                      }
                   }
                   setIsCreateClassModalOpen(false);
                   setEditingNode(null);
                 }} className="space-y-5 sm:space-y-7">
                    <div className="space-y-2.5 sm:space-y-3">
                      <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] px-2 sm:px-3">Class Type</label>
                      <div className="flex p-1.5 bg-slate-100 rounded-2xl sm:rounded-[1.8rem] border border-slate-200 shadow-inner">
                        <button
                          type="button"
                          onClick={() => setProvisionType('PHYSICAL')}
                          className={`flex-1 py-3 sm:py-4 rounded-xl sm:rounded-[1.2rem] font-black uppercase text-[9px] sm:text-[10px] tracking-[0.12em] sm:tracking-widest transition-all ${provisionType === 'PHYSICAL' ? 'shadow-md' : 'bg-white text-slate-500 shadow-sm'}`}
                          style={{
                            backgroundColor: provisionType === 'PHYSICAL' ? 'rgba(61, 4, 19, 1)' : 'rgb(255, 255, 255)',
                            color: provisionType === 'PHYSICAL' ? 'rgb(255, 255, 255)' : 'rgb(100, 116, 139)',
                            boxShadow: '0px 0px 10px 12px rgba(0, 0, 0, 0), 0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
                            filter: 'blur(0px)',
                          }}
                        >
                          Physical Classroom
                        </button>
                        <button
                          type="button"
                          onClick={() => setProvisionType('ONLINE')}
                          className={`flex-1 py-3 sm:py-4 rounded-xl sm:rounded-[1.2rem] font-black uppercase text-[9px] sm:text-[10px] tracking-[0.12em] sm:tracking-widest transition-all ${provisionType === 'ONLINE' ? 'shadow-md' : 'bg-white text-slate-500 shadow-sm'}`}
                          style={{
                            backgroundColor: provisionType === 'ONLINE' ? 'rgba(61, 4, 19, 1)' : 'rgb(255, 255, 255)',
                            color: provisionType === 'ONLINE' ? 'rgb(255, 255, 255)' : 'rgb(100, 116, 139)',
                            boxShadow: '0px 0px 10px 12px rgba(0, 0, 0, 0), 0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
                            filter: 'blur(0px)',
                          }}
                        >
                          Online Class
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2.5 sm:space-y-3"><label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] px-2 sm:px-3">Class Code</label><input name="code" defaultValue={editingNode?.code} required type="text" placeholder="EE-402" style={{ boxShadow: '0px 0px 0px 4px rgba(61, 4, 19, 0.1), inset 0px 0px 0px 0px rgba(0, 0, 0, 0)', filter: 'blur(0px)' }} className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 border border-[#3d0413] rounded-xl sm:rounded-[1.5rem] font-black outline-none focus:ring-4 focus:ring-[#3d0413]/10 text-sm sm:text-base" /></div>
                        <div className="space-y-2.5 sm:space-y-3"><label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] px-2 sm:px-3">{provisionType === 'PHYSICAL' ? 'Venue' : 'Platform'}</label><input name="target" defaultValue={(editingNode as any)?.room || (editingNode as any)?.platform} required type="text" placeholder={provisionType === 'PHYSICAL' ? "Power Lab 2" : "MS Teams"} className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 border border-[#3d0413] rounded-xl sm:rounded-[1.5rem] font-black outline-none focus:ring-4 focus:ring-[#3d0413]/10 text-sm sm:text-base" /></div>
                    </div>
                    <div className="space-y-2.5 sm:space-y-3">
                      <label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] px-2 sm:px-3">Department</label>
                      <select
                        name="department"
                        defaultValue={(editingNode as any)?.department || user.department || DEPARTMENTS[0]?.name || ''}
                        required
                        style={{ boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.15), inset 0px 4px 0px 0px rgba(0, 0, 0, 0.15)', filter: 'blur(0px)' }}
                        className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 border border-[#3d0413] rounded-xl sm:rounded-[1.5rem] font-black outline-none focus:ring-4 focus:ring-[#3d0413]/10 text-sm sm:text-base"
                      >
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept.id} value={dept.name}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2.5 sm:space-y-3"><label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] px-2 sm:px-3">Unit Title</label><input name="title" defaultValue={editingNode?.title} required type="text" placeholder="Advanced Power Systems" style={{ boxShadow: '0px 0px 0px 4px rgba(61, 4, 19, 0.1), 0px 0px 0px 0px rgba(0, 0, 0, 0)', filter: 'blur(0px)' }} className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-slate-50 border border-[#3d0413] rounded-xl sm:rounded-[1.5rem] font-black outline-none focus:ring-4 focus:ring-[#3d0413]/10 text-sm sm:text-base" /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <button type="submit" name="STUDENTS" className="py-4 sm:py-5 bg-black text-white border border-black rounded-xl sm:rounded-[2rem] font-black uppercase text-[9px] sm:text-[10px] tracking-[0.12em] sm:tracking-widest shadow-sm hover:bg-[#111] transition-all flex items-center justify-center gap-2 sm:gap-3"><UserPlus size={16} /> Add Student</button>
                      <button type="submit" name="TIMETABLE" className="py-4 sm:py-5 bg-amber-200 text-amber-700 border border-amber-100 rounded-xl sm:rounded-[2rem] font-black uppercase text-[9px] sm:text-[10px] tracking-[0.12em] sm:tracking-widest shadow-sm hover:bg-amber-300 transition-all flex items-center justify-center gap-2 sm:gap-3"><Clock size={16} /> Add Time Table</button>
                    </div>
                    <button type="submit" style={{ borderBottomColor: 'rgba(61, 4, 19, 1)', borderImage: 'none' }} className="w-full py-4 sm:py-5 bg-[#3d0413] text-white rounded-xl sm:rounded-[2rem] font-black uppercase text-[10px] sm:text-sm tracking-[0.12em] sm:tracking-widest shadow-2xl active:scale-95 border-b-4 sm:border-b-8 border-black transition-all hover:bg-black">{editingNode ? 'Confirm Changes' : 'Confirm'}</button>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* SESSION MODAL */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 z-[650] flex items-center justify-center p-8">
           <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => { setIsSessionModalOpen(false); setEditingSession(null); }}></div>
           <div className="relative w-full max-w-xl bg-white rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in">
              <div className="bg-[#3d0413] p-12 flex justify-between items-center text-white">
                <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">{editingSession ? 'Re-edit Session' : 'Add Session'}</h3>
                <button onClick={() => { setIsSessionModalOpen(false); setEditingSession(null); }} className="p-4 bg-white/10 rounded-[1.5rem] hover:bg-white/20 transition-all"><X size={32}/></button>
              </div>
              <div className="p-12">
                <form onSubmit={async (e) => {
                   e.preventDefault();
                   if (!selectedPhysicalClass) return;
                   const formData = new FormData(e.currentTarget as HTMLFormElement);
                   const sessionData: ScheduleSession = {
                      id: editingSession?.id || `s-${Date.now()}`,
                      day: formData.get('day') as string,
                      time: formData.get('time') as string,
                      venue: (formData.get('venue') as string).toUpperCase(),
                      type: formData.get('type') as 'LECTURE' | 'PRACTICAL' | 'SEMINAR',
                   };
                   const updatedSchedule = editingSession 
                      ? selectedPhysicalClass.schedule.map(s => s.id === editingSession.id ? sessionData : s)
                      : [...selectedPhysicalClass.schedule, sessionData];
                   const updatedClass = { ...selectedPhysicalClass, schedule: updatedSchedule };
                   setPhysicalClasses(prev => prev.map(c => c.id === selectedPhysicalClass.id ? updatedClass : c));
                   setSelectedPhysicalClass(updatedClass);
                   try {
                     await upsertClassSession(selectedPhysicalClass.id, sessionData);
                   } catch {
                     showToast('Cloud sync failed for timetable session', 'info');
                   }
                   showToast(editingSession ? "Session Synchronized" : "Session Provisioned");
                   setIsSessionModalOpen(false);
                   setEditingSession(null);
                 }} className="space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                           <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] px-3">Weekday</label>
                           <select name="day" defaultValue={editingSession?.day || 'MONDAY'} className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-black outline-none appearance-none cursor-pointer">
                              {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map(d => <option key={d} value={d}>{d}</option>)}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] px-3">Type</label>
                           <select name="type" defaultValue={editingSession?.type || 'LECTURE'} className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-black outline-none appearance-none cursor-pointer">
                              <option value="LECTURE">LECTURE</option>
                              <option value="PRACTICAL">PRACTICAL</option>
                              <option value="SEMINAR">SEMINAR</option>
                           </select>
                        </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] px-3">Time</label>
                       <input name="time" defaultValue={editingSession?.time} required type="text" placeholder="08:00 AM - 11:00 AM" className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-black outline-none" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] px-3">Venue</label>
                       <input name="venue" defaultValue={editingSession?.venue} required type="text" placeholder="POWER LAB 2" className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-black outline-none" />
                    </div>
                    <button type="submit" className="w-full py-6 bg-[#3d0413] text-white rounded-[2rem] font-black uppercase text-sm shadow-2xl active:scale-95 border-b-6 border-black">
                       {editingSession ? 'Authorize Session Change' : 'Provision Session Node'}
                    </button>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-[640] flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setIsAddStudentModalOpen(false)}></div>
          <div className="relative w-full max-w-xl bg-white rounded-3xl border border-[#eddde0] shadow-2xl overflow-hidden">
            <div className="bg-[#3d0413] px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between text-white">
              <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tight">Add Student</h3>
              <button onClick={() => setIsAddStudentModalOpen(false)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 sm:p-7">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget as HTMLFormElement);
                  const name = String(form.get('name') || '').trim().toUpperCase();
                  const admNo = String(form.get('admNo') || '').trim().toUpperCase();
                  const phone = String(form.get('phone') || '').trim();
                  const status = String(form.get('status') || 'ACTIVE') as Student['status'];
                  const classId =
                    String(form.get('classId') || '').trim() ||
                    selectedPhysicalClass?.id ||
                    physicalClasses[0]?.id ||
                    '';

                  if (!name || !admNo || !classId) {
                    showToast('Name, admission number, and class are required', 'info');
                    return;
                  }

                  const newStudent: Student = {
                    id: `st-${Date.now()}`,
                    name,
                    admNo,
                    phone,
                    attendance: 0,
                    gradeAverage: 0,
                    status,
                    classId,
                  };

                  setStudents((prev) => {
                    const hasSameAdm = prev.some((s) => s.admNo === newStudent.admNo);
                    if (hasSameAdm) {
                      return prev.map((s) => (s.admNo === newStudent.admNo ? { ...s, ...newStudent } : s));
                    }
                    return [...prev, newStudent];
                  });
                  setIsAddStudentModalOpen(false);
                  showToast('Student enrolled', 'success');
                }}
              >
                <input name="name" placeholder="STUDENT FULL NAME" required className="w-full px-4 py-3 bg-slate-50 border border-[#3d0413]/30 rounded-xl font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/10" />
                <input name="admNo" placeholder="ADMISSION NO (e.g. EE/001/2026)" required className="w-full px-4 py-3 bg-slate-50 border border-[#3d0413]/30 rounded-xl font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/10" />
                <input name="phone" placeholder="+254 7XX XXX XXX" className="w-full px-4 py-3 bg-slate-50 border border-[#3d0413]/30 rounded-xl font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/10" />
                <select name="classId" defaultValue={selectedPhysicalClass?.id || physicalClasses[0]?.id || ''} className="w-full px-4 py-3 bg-slate-50 border border-[#3d0413]/30 rounded-xl font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/10">
                  {(physicalClasses.length > 0 ? physicalClasses : []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
                <select name="status" defaultValue="ACTIVE" className="w-full px-4 py-3 bg-slate-50 border border-[#3d0413]/30 rounded-xl font-bold outline-none focus:ring-4 focus:ring-[#3d0413]/10">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PROBATION">PROBATION</option>
                  <option value="DEFERRED">DEFERRED</option>
                </select>

                <button type="submit" className="w-full py-3 bg-[#3d0413] text-white rounded-xl font-black uppercase tracking-widest hover:bg-black transition">
                  Save Student
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboardHome;