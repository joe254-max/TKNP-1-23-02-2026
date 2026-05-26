import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hand, MicOff, MonitorUp, Pin, VideoOff, X } from 'lucide-react';
import type { LiveParticipant, ModAction } from '../../types/liveClassroom';
import { useSpeakingDetection } from '../../hooks/useSpeakingDetection';
import VideoTile from './VideoTile';

interface LecturerBroadcastViewProps {
  lecturerStream: MediaStream | null;
  screenStream: MediaStream | null;
  isScreenSharing: boolean;
  isCamOn: boolean;
  isMicOn: boolean;
  lecturerName: string;
  lecturerUserId: string;
  participants: LiveParticipant[];
  liveStudentCount: number;
  onModAction: (action: ModAction, targetUserId: string) => void;
  controlsSlot?: React.ReactNode;
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const LecturerBroadcastView: React.FC<LecturerBroadcastViewProps> = ({
  lecturerStream,
  screenStream,
  isScreenSharing,
  isCamOn,
  isMicOn,
  lecturerName,
  lecturerUserId,
  participants,
  liveStudentCount,
  onModAction,
  controlsSlot,
}) => {
  const lecturerVideoRef = useRef<HTMLVideoElement>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [handsOpen, setHandsOpen] = useState(true);

  const outgoingStream = isScreenSharing ? screenStream : lecturerStream;
  const lecturerSpeaking = useSpeakingDetection(outgoingStream, isMicOn);

  useEffect(() => {
    const el = lecturerVideoRef.current;
    if (!el) return;
    if (isScreenSharing) {
      el.srcObject = null;
      return;
    }
    if (isCamOn && lecturerStream) {
      el.srcObject = lecturerStream;
      void el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [isCamOn, isScreenSharing, lecturerStream]);

  const students = useMemo(() => {
    const list = participants.filter((p) => p.role === 'student');
    return [...list].sort((a, b) => {
      if (a.handRaised && !b.handRaised) return -1;
      if (!a.handRaised && b.handRaised) return 1;
      return (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0);
    });
  }, [participants]);

  const raisedHands = students.filter((s) => s.handRaised);
  const cameraLiveCount = students.filter((s) => s.isVideoOn && s.stream).length;
  const hiddenCount = Math.max(0, liveStudentCount - students.length);

  const pinnedStudent = pinnedId ? students.find((s) => s.userId === pinnedId) : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Left: lecturer broadcast */}
      <div className="relative min-h-[280px] flex-[3] overflow-hidden rounded-[2rem] border border-[#e8c8cf]/30 bg-[#1a0509] shadow-xl lg:min-h-[420px]">
        {isScreenSharing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a0509] px-6 text-center text-white">
            <MonitorUp className="mb-4 h-14 w-14 text-[#fce8ec]" />
            <p className="text-sm font-black uppercase tracking-widest">Screen Sharing Active</p>
            <p className="mt-2 text-[10px] text-white/50">Students see your shared screen</p>
          </div>
        ) : isCamOn && lecturerStream ? (
          <video ref={lecturerVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#5a0a1e] text-white">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#3d0413] text-2xl font-black border-2 border-[#e8c8cf]/40">
              {initials(lecturerName)}
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.35em] text-white/60">Camera Off</p>
          </div>
        )}

        <span className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg bg-[#c0392b] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white animate-pulse">
          <span className="h-2 w-2 rounded-full bg-white" /> ON AIR
        </span>

        {isScreenSharing && (
          <span className="absolute left-3 top-12 z-10 rounded-lg bg-[#3d0413] px-3 py-1 text-[9px] font-black uppercase text-white">
            Screen Sharing
          </span>
        )}

        <div
          className={`absolute inset-0 pointer-events-none rounded-[2rem] border-4 transition-colors ${
            lecturerSpeaking && isMicOn ? 'border-emerald-500/80' : 'border-transparent'
          }`}
        />

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[rgba(61,4,19,0.9)] to-transparent px-4 pb-4 pt-10">
          <div className="mb-3 flex items-end gap-1 h-6">
            {[0.2, 0.5, 0.85, 0.45, 0.7].map((h, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-full bg-white/80 transition-all ${lecturerSpeaking && isMicOn ? 'animate-pulse' : 'opacity-30'}`}
                style={{ height: lecturerSpeaking && isMicOn ? `${h * 100}%` : '20%' }}
              />
            ))}
          </div>
          <p className="text-[10px] font-bold text-white/90">
            You are live to <span className="font-black">{liveStudentCount}</span> student{liveStudentCount === 1 ? '' : 's'}
          </p>
          <p className="text-[9px] uppercase tracking-widest text-white/50 mt-1">
            {isCamOn ? 'Camera on' : 'Camera off'} · {isMicOn ? 'Mic on' : 'Mic muted'}
          </p>
        </div>

        {controlsSlot && (
          <div className="absolute bottom-20 left-1/2 z-20 w-full max-w-lg -translate-x-1/2 px-4">
            {controlsSlot}
          </div>
        )}
      </div>

      {/* Right: student feeds */}
      <div className="relative flex flex-[2] min-h-[320px] flex-col overflow-hidden rounded-[2rem] border border-[#e8c8cf] bg-white/80 backdrop-blur-md lg:min-h-[420px]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#e8c8cf] px-4 py-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#3d0413]">Live Students</h3>
          <span className="rounded-full bg-[#3d0413] px-2.5 py-0.5 text-[9px] font-black text-white">{cameraLiveCount} live</span>
        </div>

        {raisedHands.length > 0 && (
          <div className="shrink-0 border-b border-[#e8c8cf] bg-[#fef3c7]/30">
            <button
              type="button"
              onClick={() => setHandsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[#92400e]"
            >
              Hands Raised ({raisedHands.length})
              <span>{handsOpen ? '−' : '+'}</span>
            </button>
            {handsOpen && (
              <ul className="space-y-1 px-3 pb-3">
                {raisedHands.map((s) => (
                  <li key={s.userId} className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-2 py-1.5 border border-[#f59e0b]/40">
                    <span className="flex items-center gap-2 text-[10px] font-bold text-[#3d0413] truncate">
                      <Hand size={12} className="text-[#f59e0b]" /> {s.displayName}
                    </span>
                    <button
                      type="button"
                      onClick={() => onModAction('call_on', s.userId)}
                      className="shrink-0 rounded bg-[#3d0413] px-2 py-1 text-[8px] font-black uppercase text-white"
                    >
                      Call on
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="relative flex-1 min-h-0 overflow-y-auto p-3 space-y-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#fdf6f7] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#7a1030]">
          {students.length === 0 ? (
            <p className="py-8 text-center text-[10px] font-black uppercase tracking-widest text-[#3d0413]/40">
              No student cameras yet
            </p>
          ) : (
            students.map((student) => (
              <StudentFeedCard
                key={student.userId}
                student={student}
                onMute={() => onModAction('mute', student.userId)}
                onLowerHand={() => onModAction('lower_hand', student.userId)}
                onRemove={() => {
                  if (window.confirm(`Remove ${student.displayName} from session?`)) {
                    onModAction('kick', student.userId);
                  }
                }}
                onPin={() => setPinnedId(student.userId)}
              />
            ))
          )}
          {hiddenCount > 0 && (
            <p className="text-center text-[9px] font-bold uppercase tracking-widest text-[#3d0413]/50 pb-2">
              +{hiddenCount} more students (camera off)
            </p>
          )}
          <div className="pointer-events-none sticky bottom-0 h-8 bg-gradient-to-t from-white/90 to-transparent" />
        </div>
      </div>

      {pinnedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a0509]/80 p-6" role="dialog">
          <div className="relative w-full max-w-3xl rounded-2xl border border-[#e8c8cf] bg-[#1a0509] p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setPinnedId(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-[#3d0413] p-2 text-white"
              aria-label="Close pin"
            >
              <X size={18} />
            </button>
            <div className="aspect-video min-h-[240px]">
              <VideoTile participant={pinnedStudent} label={pinnedStudent.displayName} className="h-full w-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StudentFeedCardProps {
  student: LiveParticipant;
  onMute: () => void;
  onLowerHand: () => void;
  onRemove: () => void;
  onPin: () => void;
}

const StudentFeedCard: React.FC<StudentFeedCardProps> = ({
  student,
  onMute,
  onLowerHand,
  onRemove,
  onPin,
}) => (
  <div
    className={`group relative h-[160px] overflow-hidden rounded-xl border-2 bg-[#1a0509] transition-all ${
      student.handRaised ? 'border-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.45)]' : 'border-[#e8c8cf]/40'
    } ${student.isSpeaking ? 'border-[#7a1030] ring-2 ring-[#7a1030]' : ''}`}
  >
    <VideoTile participant={student} className="h-full w-full rounded-none border-0" />
    {student.handRaised && (
      <span className="absolute right-2 top-2 z-20 rounded-full bg-[#f59e0b] p-1 text-[#1a0509]">
        <Hand size={12} />
      </span>
    )}
    <div className="absolute inset-0 flex items-center justify-center gap-1 bg-[#3d0413]/0 opacity-0 transition-opacity group-hover:bg-[#3d0413]/50 group-hover:opacity-100">
      <button type="button" onClick={onMute} className="rounded bg-[#3d0413] px-2 py-1 text-[8px] font-black uppercase text-white">Mute</button>
      {student.handRaised && (
        <button type="button" onClick={onLowerHand} className="rounded bg-[#3d0413] px-2 py-1 text-[8px] font-black uppercase text-white">Lower Hand</button>
      )}
      <button type="button" onClick={onPin} className="rounded bg-[#3d0413] px-2 py-1 text-[8px] font-black uppercase text-white">
        <Pin size={10} className="inline" />
      </button>
      <button type="button" onClick={onRemove} className="rounded bg-[#7a0f2a] px-2 py-1 text-[8px] font-black uppercase text-white">Remove</button>
    </div>
  </div>
);

export default LecturerBroadcastView;
