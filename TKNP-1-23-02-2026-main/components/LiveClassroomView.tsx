import React, { useEffect, useMemo, useState } from 'react';
import LiveVideoGrid from './live/LiveVideoGrid';
import type { LiveParticipant } from '../types/liveClassroom';
import { useSpeakingDetection } from '../hooks/useSpeakingDetection';

export interface LiveClassroomLaunch {
  classId: string;
  title: string;
  teacher: string;
  studentId: string;
  studentName: string;
}

interface LiveClassroomViewProps {
  launch: LiveClassroomLaunch;
  lecturerStream: MediaStream | null;
  selfStream: MediaStream | null;
  isSelfCamOn: boolean;
  isSelfMuted?: boolean;
  onLeave: () => void;
  /** Optional extra student/peer participants with video */
  remoteParticipants?: LiveParticipant[];
}

const LiveClassroomView: React.FC<LiveClassroomViewProps> = ({
  launch,
  lecturerStream,
  selfStream,
  isSelfCamOn,
  isSelfMuted = false,
  remoteParticipants = [],
}) => {
  const [lecturerVideoOn, setLecturerVideoOn] = useState(false);

  useEffect(() => {
    setLecturerVideoOn(Boolean(lecturerStream && lecturerStream.getVideoTracks().some((t) => t.readyState === 'live')));
  }, [lecturerStream]);

  const lecturerSpeaking = useSpeakingDetection(lecturerStream, true);
  const selfSpeaking = useSpeakingDetection(selfStream, !isSelfMuted);

  const participants = useMemo((): LiveParticipant[] => {
    const list: LiveParticipant[] = [
      {
        userId: 'lecturer',
        displayName: launch.teacher,
        role: 'lecturer',
        stream: lecturerStream,
        isMuted: false,
        isSpeaking: lecturerSpeaking,
        isVideoOn: lecturerVideoOn,
      },
    ];

    if (isSelfCamOn && selfStream) {
      list.push({
        userId: launch.studentId,
        displayName: launch.studentName,
        role: 'student',
        stream: selfStream,
        isMuted: isSelfMuted,
        isSpeaking: selfSpeaking,
        isVideoOn: true,
      });
    }

    list.push(...remoteParticipants);
    return list;
  }, [
    launch,
    lecturerStream,
    lecturerVideoOn,
    lecturerSpeaking,
    isSelfCamOn,
    selfStream,
    isSelfMuted,
    selfSpeaking,
    remoteParticipants,
  ]);

  return (
    <div className="h-full min-h-[50vh] w-full bg-[#1a0509] md:min-h-0">
      <div className="h-full md:hidden">
        <div className="flex h-full flex-col gap-2 overflow-y-auto p-2">
          {participants.map((p) => (
            <div key={p.userId} className="h-[56vw] min-h-[180px] shrink-0">
              <LiveVideoGrid
                participants={[p]}
                localUserId={launch.studentId}
                className="h-full"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="hidden h-full md:block">
        <LiveVideoGrid participants={participants} localUserId={launch.studentId} className="h-full" />
      </div>
    </div>
  );
};

export default LiveClassroomView;
