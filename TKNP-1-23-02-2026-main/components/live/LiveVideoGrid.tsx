import React, { useMemo } from 'react';
import VideoTile from './VideoTile';
import type { LiveParticipant } from '../../types/liveClassroom';

interface LiveVideoGridProps {
  participants: LiveParticipant[];
  localUserId?: string;
  className?: string;
}

function sortForGrid(list: LiveParticipant[]): LiveParticipant[] {
  const lecturer = list.filter((p) => p.role === 'lecturer');
  const students = list.filter((p) => p.role === 'student');
  return [...lecturer, ...students];
}

function gridLayout(count: number): { className: string; scrollable: boolean; tileMinHeight?: number } {
  if (count <= 1) return { className: 'grid-cols-1 grid-rows-1', scrollable: false };
  if (count === 2) return { className: 'grid-cols-2 grid-rows-1', scrollable: false };
  if (count <= 4) return { className: 'grid-cols-2 grid-rows-2', scrollable: false };
  if (count <= 6) return { className: 'grid-cols-3 grid-rows-2', scrollable: false };
  if (count <= 9) return { className: 'grid-cols-3 grid-rows-3', scrollable: false };
  return { className: 'grid-cols-3 auto-rows-[minmax(200px,1fr)]', scrollable: true, tileMinHeight: 200 };
}

const LiveVideoGrid: React.FC<LiveVideoGridProps> = ({ participants, localUserId, className = '' }) => {
  const active = useMemo(
    () => sortForGrid(participants.filter((p) => p.isVideoOn || p.role === 'lecturer' || p.stream)),
    [participants],
  );

  const displayList = useMemo(() => {
    if (active.length > 0) return active;
    const lecturer = participants.find((p) => p.role === 'lecturer');
    return lecturer ? [lecturer] : participants.slice(0, 1);
  }, [active, participants]);

  const layout = gridLayout(displayList.length);
  const liveCount = participants.filter((p) => p.isVideoOn && p.stream).length;

  const tileLabel = (p: LiveParticipant) => {
    if (localUserId && p.userId === localUserId) return 'You';
    if (p.role === 'lecturer') return p.displayName;
    return p.displayName;
  };

  const tileBadge = (p: LiveParticipant) => {
    if (p.role === 'lecturer') return 'Lecturer';
    if (localUserId && p.userId === localUserId) return undefined;
    return undefined;
  };

  return (
    <div className={`relative flex h-full min-h-0 flex-col ${className}`}>
      {liveCount > 0 && (
        <span className="absolute right-3 top-3 z-20 rounded-full bg-[#3d0413]/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white border border-[#e8c8cf]/40">
          {liveCount} live
        </span>
      )}

      <div
        className={`relative flex-1 min-h-0 ${
          layout.scrollable
            ? 'overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#fdf6f7] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#7a1030]'
            : 'overflow-hidden'
        }`}
      >
        <div className={`grid h-full min-h-[200px] gap-2 p-2 ${layout.className}`}>
          {displayList.map((p, index) => (
            <VideoTile
              key={p.userId}
              participant={p}
              label={tileLabel(p)}
              badge={index === 0 && p.role === 'lecturer' ? 'Lecturer' : tileBadge(p)}
              dominant={index === 0 && p.role === 'lecturer'}
              minHeight={layout.tileMinHeight}
              className="min-h-0 w-full aspect-video md:aspect-auto"
            />
          ))}
        </div>
        {layout.scrollable && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#1a0509] to-transparent" />
        )}
      </div>
    </div>
  );
};

export default LiveVideoGrid;
