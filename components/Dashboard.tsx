import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Resource } from '../types';
import { 
  Plus, ArrowLeft, X, ShieldCheck, Save, Video as VideoIcon,
  CheckCircle2, Users, MonitorPlay, Sparkles, 
  Search, Edit3, UserPlus, Presentation, FileCode, School,
  Mic, MicOff, VideoOff, MonitorUp, MessageSquare, Hand, Radio, Phone,
  UserCheck, Send, Activity, FileDown, PhoneCall, Check,
  UserCheck2, UserX2, Filter, RotateCcw, Info, Printer, Lock, History, FileText, CloudUpload, Mail, BarChart3, ArrowRight, ExternalLink, Monitor, Zap, Globe, Layers, BookOpen, Clock, Trash2, CalendarPlus, TrendingUp, AlertTriangle, Briefcase, Calendar, Power, DoorOpen
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { addSignal, listenSignals, removeSignal } from '../lib/firebaseClient';
import { jsPDF } from 'jspdf';
import { saveRecording, getAllRecordings, type RecordedSession } from '../lib/recordingsDb';

interface DashboardProps {
  user: User;
  resources: Resource[];
}

type SystemView = 'HOME' | 'PHYSICAL_CLASS_DETAIL' | 'ONLINE_CLASS_DETAIL';
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

const StaffDashboardHome: React.FC<DashboardProps> = ({ user, resources }) => {
  const [currentView, setCurrentView] = useState<SystemView>('HOME');
  const [activeClassTab, setActiveClassTab] = useState<ClassTab>('REGISTER');
  const [activeMaterialCategory, setActiveMaterialCategory] = useState<MaterialCategory | null>(null);
  const [selectedPhysicalClass, setSelectedPhysicalClass] = useState<PhysicalClass | null>(null);
  const [selectedOnlineClass, setSelectedOnlineClass] = useState<VirtualClass | null>(null);
  
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info'} | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [materialsSearch, setMaterialsSearch] = useState('');
  
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
      { id: 'v1', code: 'ICT-101', title: 'PROGRAMMING LOGIC', platform: 'MICROSOFT TEAMS', students: 42, link: 'https://teams.microsoft.com', type: 'ONLINE' as const, startTime: '10:00 AM' }
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
    showToast("Session Removed", "info");
  };

  const handleOpenSessionModal = (session?: ScheduleSession) => {
    setEditingSession(session || null);
    setIsSessionModalOpen(true);
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

    socket.on('signal', async (msg: any) => {
      if (!msg || msg.classId !== classId) return;
      if (msg.role !== 'student') return;
      if (!msg.from) return;
      const studentId = msg.from as string;
      try {
        if (msg.type === 'join') {
          const state = await ensurePeer(studentId);
          const offer = await state.pc.createOffer();
          await state.pc.setLocalDescription(offer);
          try { socket.emit('signal', { type: 'offer', classId, role: 'teacher', from: user.id, to: studentId, sdp: state.pc.localDescription ? { type: state.pc.localDescription.type, sdp: state.pc.localDescription.sdp } : null }); } catch {}
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
    });
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

      return (
    <div className="min-h-screen bg-white relative overflow-x-hidden overflow-y-auto">
      <div className="absolute top-0 right-0 w-[40rem] sm:w-[50rem] lg:w-[60rem] h-[40rem] sm:h-[50rem] lg:h-[60rem] bg-rose-50/40 rounded-full blur-[100px] -mr-[10rem] sm:-mr-[15rem] lg:-mr-[20rem] -mt-[10rem] sm:-mt-[15rem] lg:-mt-[20rem] pointer-events-none z-0 animate-pulse duration-[5000ms]"></div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-20 py-8 sm:py-10 lg:py-20 relative z-10">
        {notification && (
          <div className="fixed top-24 right-12 z-[1000] animate-in slide-in-from-right-8">
            <div className={`px-12 py-6 rounded-3xl shadow-2xl border-l-8 flex items-center gap-8 ${notification.type === 'success' ? 'bg-white border-emerald-500 text-slate-900' : 'bg-[#3d0413] border-rose-400 text-white'}`}>
              {notification.type === 'success' ? <CheckCircle2 className="text-emerald-500" size={36} /> : <Info className="text-rose-400" size={36} />}
              <p className="text-base font-black uppercase tracking-[0.1em]">{notification.msg}</p>
            </div>
          </div>
        )}

        {currentView === 'HOME' && (
          <div className="space-y-16 lg:space-y-24 animate-in fade-in duration-1000">
            <div className="flex flex-col items-center text-center max-w-5xl mx-auto space-y-3 sm:space-y-4 px-2">
               <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-2 sm:mb-4">
                  <button 
                    onClick={() => { setCalendarAction('OPENING'); setIsCalendarModalOpen(true); }}
                    className="px-3 sm:px-6 py-2 sm:py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest flex items-center gap-1.5 sm:gap-2 hover:bg-emerald-100 transition shadow-sm"
                  >
                    <DoorOpen size={12} className="sm:w-[14px] sm:h-[14px]" /> <span className="hidden sm:inline">Open School Node</span><span className="sm:hidden">Open</span>
                  </button>
                  <button 
                    onClick={() => { setCalendarAction('CLOSING'); setIsCalendarModalOpen(true); }}
                    className="px-3 sm:px-6 py-2 sm:py-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest flex items-center gap-1.5 sm:gap-2 hover:bg-rose-100 transition shadow-sm"
                  >
                    <Power size={12} className="sm:w-[14px] sm:h-[14px]" /> <span className="hidden sm:inline">Close School Node</span><span className="sm:hidden">Close</span>
                  </button>
               </div>
               <div className="px-3 sm:px-6 py-1.5 sm:py-2 bg-[#3d0413]/5 rounded-full border border-[#3d0413]/10 flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
                  <ShieldCheck size={12} className="sm:w-[14px] sm:h-[14px] text-[#3d0413]" />
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.5em] text-[#3d0413]/70">Secure Gateway</span>
               </div>
               <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black text-[#1a202c] uppercase tracking-tighter leading-[0.95] sm:leading-[0.9] md:leading-[0.8]">
                 WELCOME <br />
                 <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#3d0413] via-[#800] to-rose-700 break-words">{user.name}</span>
               </h1>
               <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 mt-2 sm:mt-4">
                 <p className="text-slate-400 font-black uppercase tracking-[0.3em] sm:tracking-[0.6em] text-[9px] sm:text-[10px] leading-loose opacity-70">SELECT MODULE</p>
                 <div className="hidden sm:block h-px w-12 bg-slate-200"></div>
                 <span className="text-[9px] sm:text-[10px] font-black text-[#3d0413] uppercase tracking-[0.2em] sm:tracking-[0.3em]">Term {academicConfig.term} • {academicConfig.status}</span>
               </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 md:gap-12 lg:gap-16 max-w-[1300px] mx-auto px-2 sm:px-4 pb-10 sm:pb-16 lg:pb-20">
              {physicalClasses.map(c => (
                <div key={c.id} onClick={() => { setSelectedPhysicalClass(c); setCurrentView('PHYSICAL_CLASS_DETAIL'); setActiveClassTab('REGISTER'); }} className="bg-[#f8f9fa] min-h-[280px] sm:min-h-[350px] lg:aspect-[4/5] rounded-2xl sm:rounded-[3rem] md:rounded-[4rem] lg:rounded-[5rem] p-5 sm:p-8 lg:p-12 xl:p-16 flex flex-col justify-between hover:shadow-[0_60px_100px_-30px_rgba(61,4,19,0.15)] transition-all duration-700 cursor-pointer group border border-slate-100 relative overflow-hidden active:scale-[0.98]">
                  <div className="absolute top-4 sm:top-8 right-4 sm:right-8 flex gap-2 sm:gap-3 z-20 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onClick={(e) => handleOpenEdit(e, c)} className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white shadow-xl flex items-center justify-center text-slate-600 hover:text-[#3d0413] border border-slate-100"><Edit3 size={14} className="sm:w-[18px] sm:h-[18px]" /></button>
                    <button onClick={(e) => handleDeleteNode(e, c.id, 'PHYSICAL')} className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white shadow-xl flex items-center justify-center text-rose-600 border border-rose-100"><Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" /></button>
                  </div>
                  <div className="relative z-10 space-y-6 sm:space-y-12">
                    <div className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-white rounded-xl sm:rounded-2xl lg:rounded-3xl flex items-center justify-center text-[#3d0413] shadow-lg border border-slate-50 group-hover:-rotate-12 transition-transform duration-500">
                      <School size={28} className="sm:w-10 sm:h-10 lg:w-12 lg:h-12" strokeWidth={2.5} />
                    </div>
                    <div className="space-y-2 sm:space-y-4">
                      <h4 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight group-hover:text-[#3d0413] transition-colors">{c.title}</h4>
                      <p className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-wider sm:tracking-widest">{c.room}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/50 pt-4 sm:pt-8 lg:pt-12 relative z-10 mt-4">
                    <span className="text-[9px] sm:text-[11px] lg:text-[12px] font-black text-slate-900 uppercase tracking-[0.2em] sm:tracking-[0.4em]">INITIALIZE</span>
                    <div className="w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-white flex items-center justify-center text-[#3d0413] shadow-lg group-hover:translate-x-2 sm:group-hover:translate-x-4 transition-transform border border-slate-100">
                      <ArrowRight size={18} className="sm:w-6 sm:h-6 lg:w-7 lg:h-7" strokeWidth={3} />
                    </div>
                  </div>
                </div>
              ))}
              {virtualClasses.map(v => (
                <div key={v.id} onClick={() => { setSelectedOnlineClass(v); setCurrentView('ONLINE_CLASS_DETAIL'); }} className="bg-[#1a0208] min-h-[280px] sm:min-h-[350px] lg:aspect-[4/5] rounded-2xl sm:rounded-[3rem] md:rounded-[4rem] lg:rounded-[5rem] p-5 sm:p-8 lg:p-12 xl:p-16 flex flex-col justify-between hover:shadow-[0_60px_100px_-30px_rgba(225,29,72,0.3)] transition-all duration-700 cursor-pointer group border-b-[8px] sm:border-b-[14px] md:border-b-[18px] lg:border-b-[20px] border-black relative overflow-hidden active:scale-[0.98] shadow-2xl">
                  <div className="absolute top-4 sm:top-8 right-4 sm:right-8 flex gap-2 sm:gap-3 z-20 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onClick={(e) => handleOpenEdit(e, v)} className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-xl shadow-xl flex items-center justify-center text-white/80 border border-white/10"><Edit3 size={14} className="sm:w-[18px] sm:h-[18px]" /></button>
                    <button onClick={(e) => handleDeleteNode(e, v.id, 'ONLINE')} className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-xl shadow-xl flex items-center justify-center text-rose-400 border border-rose-900/50"><Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" /></button>
                  </div>
                  <div className="relative z-10 space-y-6 sm:space-y-12">
                    <div className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-white/10 backdrop-blur-3xl rounded-xl sm:rounded-2xl lg:rounded-3xl flex items-center justify-center text-rose-400 shadow-2xl border border-white/20 group-hover:rotate-12 transition-transform duration-500">
                      <Monitor size={28} className="sm:w-10 sm:h-10 lg:w-12 lg:h-12" strokeWidth={2.5} />
                    </div>
                    <div className="space-y-2 sm:space-y-4">
                      <h4 className="text-lg sm:text-2xl lg:text-3xl font-black text-white uppercase tracking-tighter leading-tight group-hover:text-rose-400 transition-colors">{v.title}</h4>
                      <p className="text-xs sm:text-sm font-black text-rose-300 uppercase tracking-wider sm:tracking-widest">{v.platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-4 sm:pt-8 lg:pt-12 relative z-10 mt-4">
                    <span className="text-[9px] sm:text-[11px] lg:text-[12px] font-black text-white uppercase tracking-[0.2em] sm:tracking-[0.4em]">JOIN NODE</span>
                    <div className="w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white shadow-lg group-hover:translate-x-2 sm:group-hover:translate-x-4 transition-transform border border-white/20">
                      <ArrowRight size={18} className="sm:w-6 sm:h-6 lg:w-7 lg:h-7" strokeWidth={3} />
                    </div>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => { setEditingNode(null); setProvisionType('PHYSICAL'); setIsCreateClassModalOpen(true); }} 
                className="min-h-[200px] sm:min-h-[280px] lg:aspect-[4/5] bg-white border-2 sm:border-4 border-dashed border-slate-200 rounded-2xl sm:rounded-[3rem] md:rounded-[4rem] lg:rounded-[5rem] flex flex-col items-center justify-center gap-4 sm:gap-8 md:gap-10 text-slate-300 hover:text-[#3d0413] hover:border-[#3d0413] hover:bg-[#3d0413]/5 transition-all duration-700 group active:scale-[0.98] shadow-sm"
              >
                <div className="w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-full border-2 sm:border-4 border-dashed border-current flex items-center justify-center group-hover:scale-110 sm:group-hover:scale-125 group-hover:border-solid transition-all">
                  <Plus size={32} strokeWidth={3} className="sm:w-14 sm:h-14 lg:w-20 lg:h-20 group-hover:rotate-90 transition-transform" />
                </div>
                <span className="text-[10px] sm:text-[12px] lg:text-[14px] font-black uppercase tracking-[0.3em] sm:tracking-[0.6em] block">ADD NEW CLASS</span>
              </button>
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
      </div>

      {/* CREATE / EDIT CLASS MODAL */}
      {isCreateClassModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-8">
           <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => { setIsCreateClassModalOpen(false); setEditingNode(null); }}></div>
           <div className="relative w-full max-w-2xl bg-white rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in">
              <div className="bg-[#3d0413] p-14 flex justify-between items-center text-white">
                <h3 className="text-5xl font-black uppercase tracking-tighter leading-none">{editingNode ? 'Edit Node' : 'Provision Node'}</h3>
                <button onClick={() => { setIsCreateClassModalOpen(false); setEditingNode(null); }} className="p-5 bg-white/10 rounded-[1.5rem] hover:bg-white/20 transition-all"><X size={36}/></button>
              </div>
              <div className="p-14">
                <form 
                  ref={classFormRef}
                  onSubmit={(e) => {
                   e.preventDefault();
                   const formData = new FormData(e.currentTarget as HTMLFormElement);
                   const type = provisionType;
                   const code = (formData.get('code') as string).toUpperCase();
                   const title = (formData.get('title') as string).toUpperCase();
                   const target = (formData.get('target') as string).toUpperCase();
                   
                   const submitter = (e.nativeEvent as any).submitter?.name;
                   const destinationTab = submitter === 'STUDENTS' ? 'STUDENTS' : submitter === 'TIMETABLE' ? 'TIME TABLE' : 'REGISTER';

                   let classToSelect: PhysicalClass | VirtualClass | null = null;

                   if (editingNode) {
                      if (type === 'PHYSICAL') {
                        setPhysicalClasses(prev => prev.map(c => {
                          if (c.id === editingNode.id) {
                            const updated = { ...c, code, title, room: target, type: 'PHYSICAL' as const };
                            classToSelect = updated;
                            syncToGlobalRegistry(updated);
                            return updated;
                          }
                          return c;
                        }));
                      } else {
                        setVirtualClasses(prev => prev.map(c => {
                          if (c.id === editingNode.id) {
                            const updated = { ...c, code, title, platform: target, type: 'ONLINE' as const };
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
                        newNode = { id: `p-${Date.now()}`, code, title, room: target, studentCount: 0, type: 'PHYSICAL' as const, department: user.department || 'General', credits: 3, staff: user.name, schedule: [] };
                        setPhysicalClasses(prev => [...prev, newNode]);
                        classToSelect = newNode;
                        syncToGlobalRegistry(newNode);
                      } else {
                        newNode = { id: `v-${Date.now()}`, code, title, platform: target, students: 0, link: '#', type: 'ONLINE' as const, startTime: '12:00 PM' };
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
                 }} className="space-y-10">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] px-3">Node Protocol</label>
                      <div className="flex p-1.5 bg-slate-100 rounded-[1.8rem] border border-slate-200 shadow-inner">
                        <button type="button" onClick={() => setProvisionType('PHYSICAL')} className={`flex-1 py-4 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest transition-all ${provisionType === 'PHYSICAL' ? 'bg-white text-[#3d0413] shadow-md' : 'text-slate-400'}`}>Physical Classroom</button>
                        <button type="button" onClick={() => setProvisionType('ONLINE')} className={`flex-1 py-4 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest transition-all ${provisionType === 'ONLINE' ? 'bg-[#3d0413] text-white shadow-lg' : 'text-slate-400'}`}>Online Class</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-10">
                        <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] px-3">Unit Code</label><input name="code" defaultValue={editingNode?.code} required type="text" placeholder="EE-402" className="w-full px-8 py-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-black outline-none focus:ring-4 focus:ring-[#3d0413]/5" /></div>
                        <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] px-3">{provisionType === 'PHYSICAL' ? 'Venue' : 'Platform'}</label><input name="target" defaultValue={(editingNode as any)?.room || (editingNode as any)?.platform} required type="text" placeholder={provisionType === 'PHYSICAL' ? "Power Lab 2" : "MS Teams"} className="w-full px-8 py-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-black outline-none focus:ring-4 focus:ring-[#3d0413]/5" /></div>
                    </div>
                    <div className="space-y-3"><label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] px-3">Unit Title</label><input name="title" defaultValue={editingNode?.title} required type="text" placeholder="Advanced Power Systems" className="w-full px-8 py-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-black outline-none focus:ring-4 focus:ring-[#3d0413]/5" /></div>
                    <div className="grid grid-cols-2 gap-6">
                      <button type="submit" name="STUDENTS" className="py-6 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-3"><UserPlus size={16} /> Add Student</button>
                      <button type="submit" name="TIMETABLE" className="py-6 bg-amber-50 text-amber-700 border border-amber-100 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-amber-100 transition-all flex items-center justify-center gap-3"><Clock size={16} /> Add Time Table</button>
                    </div>
                    <button type="submit" className="w-full py-7 bg-[#3d0413] text-white rounded-[2.5rem] font-black uppercase text-sm shadow-2xl active:scale-95 border-b-8 border-black transition-all hover:bg-black">{editingNode ? 'Authorize Changes' : 'Authorize Provisioning'}</button>
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
                <form onSubmit={(e) => {
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
    </div>
  );
};

export default StaffDashboardHome;