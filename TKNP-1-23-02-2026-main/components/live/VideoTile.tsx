import React, { useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';
import type { LiveParticipant } from '../../types/liveClassroom';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface VideoTileProps {
  participant: LiveParticipant;
  label?: string;
  badge?: string;
  className?: string;
  minHeight?: number;
  dominant?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  label,
  badge,
  className = '',
  minHeight,
  dominant = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = participant.isVideoOn && participant.stream;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (showVideo && participant.stream) {
      el.srcObject = participant.stream;
      void el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [participant.stream, showVideo]);

  const speaking = participant.isSpeaking;

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[#1a0509] border-2 transition-shadow duration-300 ${
        speaking ? 'border-[#7a1030] ring-2 ring-[#7a1030] animate-pulse' : 'border-[#e8c8cf]/40'
      } ${dominant ? 'col-span-1 row-span-1' : ''} ${className}`}
      style={minHeight ? { minHeight } : undefined}
    >
      {showVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={participant.role === 'student'} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#5a0a1e] text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#3d0413] text-lg font-black border-2 border-[#e8c8cf]/50">
            {initials(participant.displayName)}
          </div>
          {!participant.isVideoOn && (
            <p className="mt-2 text-[9px] font-bold uppercase tracking-widest text-white/60">Camera Off</p>
          )}
        </div>
      )}

      {badge && (
        <span className="absolute left-2 top-2 z-10 rounded-md bg-[#3d0413] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
          {badge}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[rgba(61,4,19,0.85)] to-transparent px-2 pb-2 pt-8">
        <div className="flex items-end justify-between gap-2">
          <span className="truncate text-[11px] font-bold text-white">{label ?? participant.displayName}</span>
          {participant.isMuted && <MicOff size={14} className="shrink-0 text-red-400" aria-label="Muted" />}
        </div>
      </div>
    </div>
  );
};

export default VideoTile;
