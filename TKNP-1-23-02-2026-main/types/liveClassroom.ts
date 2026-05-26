export type ParticipantRole = 'lecturer' | 'student';

export interface LiveParticipant {
  userId: string;
  displayName: string;
  role: ParticipantRole;
  stream: MediaStream | null;
  isMuted: boolean;
  isSpeaking: boolean;
  isVideoOn: boolean;
  handRaised?: boolean;
  handRaisedAt?: number;
}

export type ModAction = 'mute' | 'lower_hand' | 'kick' | 'call_on';
