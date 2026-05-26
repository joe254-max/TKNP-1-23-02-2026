// Shared bridge for cross-tab live session communication
// Used by both Classnet (lecturer) and StudentClasses (student)

export const LIVE_SESSION_STORAGE_KEY = 'poly_live_session';
export const LIVE_BRIDGE_CHANNEL = 'poly_live_bridge';

export interface LiveSessionBridgePayload {
  classId: string;       // matches cls.id in StudentClasses myClasses
  classTitle: string;    // normalized UPPERCASE title, for fuzzy matching
  title: string;         // live session display title
  teacher: string;       // lecturer name
  isLive: boolean;
  startedAt: string;
  inviteCode?: string;
}

// Called by the LECTURER side when going live or ending
export function broadcastLiveSession(payload: LiveSessionBridgePayload): void {
  // 1. Write to localStorage so the 3s polling in StudentClasses picks it up
  localStorage.setItem(LIVE_SESSION_STORAGE_KEY, JSON.stringify(payload));

  // 2. Fire a storage event manually for same-tab listeners
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: LIVE_SESSION_STORAGE_KEY,
      newValue: JSON.stringify(payload),
    })
  );

  // 3. BroadcastChannel for instant cross-tab delivery (no polling delay)
  try {
    const ch = new BroadcastChannel(LIVE_BRIDGE_CHANNEL);
    ch.postMessage(payload);
    ch.close();
  } catch {
    // BroadcastChannel not supported — localStorage fallback is enough
  }
}

// Called by the LECTURER side when ending the session
export function clearLiveSession(): void {
  broadcastLiveSession({
    classId: '',
    classTitle: '',
    title: '',
    teacher: '',
    isLive: false,
    startedAt: new Date().toISOString(),
  });
  localStorage.removeItem(LIVE_SESSION_STORAGE_KEY);
}

// Normalize a class title for fuzzy matching
export function normalizeTitle(t: string): string {
  return t.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
