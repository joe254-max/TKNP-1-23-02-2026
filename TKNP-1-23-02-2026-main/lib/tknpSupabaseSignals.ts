import { PostgrestSingleResponse } from '@supabase/supabase-js';
import { requireSupabaseAuth } from './supabaseAuthClient';

type SignalingPayload = {
  type: string;
  classId?: string;
  role: string;
  from?: string;
  to?: string;
  name?: string;
  sdp?: { type: string; sdp: string } | null;
  candidate?: unknown | null;
};

type SignalDoc = {
  id: string;
  type: string;
  classId: string;
  role: string;
  from?: string;
  to?: string;
  name?: string;
  sdp?: { type: string; sdp: string } | null;
  candidate?: unknown | null;
};

const broadcastChannelName = (classId: string) => `tknp_rtc_${classId}`;
const processedSignalIds = new Set<string>();

async function hasAuthenticatedSession(): Promise<boolean> {
  try {
    const supabase = requireSupabaseAuth();
    const { data: { session } } = await supabase.auth.getSession();
    return Boolean(session);
  } catch {
    return false;
  }
}

function toSignalDoc(id: string, payload: SignalingPayload, classId: string): SignalDoc {
  return {
    id,
    type: payload.type,
    classId,
    role: payload.role,
    from: payload.from,
    to: payload.to,
    name: payload.name,
    sdp: payload.sdp ?? null,
    candidate: payload.candidate ?? null,
  };
}

function emitSignal(
  onUpdate: (snapshot: { docChanges: () => Array<{ type: 'added'; doc: { id: string; data: () => SignalDoc } }> }) => void,
  id: string,
  msg: SignalDoc,
) {
  if (processedSignalIds.has(id)) return;
  processedSignalIds.add(id);
  onUpdate({
    docChanges: () => [
      {
        type: 'added',
        doc: {
          id,
          data: () => msg,
        },
      },
    ],
  });
}

async function addSignalSupabase(classId: string, payload: SignalingPayload) {
  const supabase = requireSupabaseAuth();

  const insertPayload = {
    class_id: classId,
    type: payload.type,
    role: payload.role,
    from_id: payload.from ?? null,
    to_id: payload.to ?? null,
    name: payload.name ?? null,
    sdp: payload.sdp ?? null,
    candidate: payload.candidate ?? null,
  };

  const res: PostgrestSingleResponse<{ id: string }> = await supabase
    .from('tknp_signals')
    .insert(insertPayload)
    .select('id')
    .single();

  if (res.error) throw res.error;
  return res.data;
}

function addSignalBroadcast(classId: string, payload: SignalingPayload) {
  const id = crypto.randomUUID();
  const msg = toSignalDoc(id, payload, classId);
  try {
    const channel = new BroadcastChannel(broadcastChannelName(classId));
    channel.postMessage({ action: 'signal', id, payload: msg });
    channel.close();
  } catch {
    // BroadcastChannel unavailable
  }
  return { id };
}

function listenSupabase(
  classId: string,
  onUpdate: (snapshot: { docChanges: () => Array<{ type: 'added'; doc: { id: string; data: () => SignalDoc } }> }) => void,
) {
  const supabase = requireSupabaseAuth();

  const channel = supabase
    .channel(`tknp_signals:${classId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'tknp_signals',
        filter: `class_id=eq.${classId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (!row) return;

        const msg: SignalDoc = {
          id: String(row.id),
          type: String(row.type),
          classId: String(row.class_id),
          role: String(row.role),
          from: row.from_id ? String(row.from_id) : undefined,
          to: row.to_id ? String(row.to_id) : undefined,
          name: row.name ? String(row.name) : undefined,
          sdp: (row.sdp as SignalDoc['sdp']) ?? null,
          candidate: row.candidate ?? null,
        };

        emitSignal(onUpdate, msg.id, msg);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

function listenBroadcast(
  classId: string,
  onUpdate: (snapshot: { docChanges: () => Array<{ type: 'added'; doc: { id: string; data: () => SignalDoc } }> }) => void,
) {
  const channel = new BroadcastChannel(broadcastChannelName(classId));
  channel.onmessage = (event: MessageEvent<{ action?: string; id?: string; payload?: SignalDoc }>) => {
    const data = event.data;
    if (!data || data.action !== 'signal' || !data.id || !data.payload) return;
    emitSignal(onUpdate, data.id, data.payload);
  };

  return () => {
    channel.close();
  };
}

/** Always posts to BroadcastChannel (same-browser tabs). Also writes to Supabase when signed in. */
export async function addSignal(classId: string, payload: SignalingPayload) {
  const broadcastResult = addSignalBroadcast(classId, payload);

  if (await hasAuthenticatedSession()) {
    try {
      return await addSignalSupabase(classId, payload);
    } catch {
      return broadcastResult;
    }
  }

  return broadcastResult;
}

/** Listens on BroadcastChannel always; adds Supabase realtime when signed in. */
export async function createSignalListener(
  classId: string,
  onUpdate: (snapshot: { docChanges: () => Array<{ type: 'added'; doc: any }> }) => void,
): Promise<() => void> {
  const unsubs: Array<() => void> = [listenBroadcast(classId, onUpdate)];

  if (await hasAuthenticatedSession()) {
    try {
      unsubs.push(listenSupabase(classId, onUpdate));
    } catch {
      // Broadcast-only is enough for local demo tabs.
    }
  }

  return () => {
    for (const unsub of unsubs) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
  };
}

export function listenSignals(
  classId: string,
  onUpdate: (snapshot: { docChanges: () => Array<{ type: 'added'; doc: any }> }) => void,
) {
  let unsubscribe: (() => void) | null = null;
  let active = true;

  void createSignalListener(classId, onUpdate).then((unsub) => {
    if (!active) {
      unsub();
      return;
    }
    unsubscribe = unsub;
  });

  return () => {
    active = false;
    unsubscribe?.();
  };
}

export async function removeSignal(classId: string, docId: string) {
  processedSignalIds.add(docId);
  if (await hasAuthenticatedSession()) {
    try {
      const supabase = requireSupabaseAuth();
      const { error } = await supabase
        .from('tknp_signals')
        .delete()
        .eq('id', docId)
        .eq('class_id', classId);
      if (error) throw error;
    } catch {
      // ignore
    }
  }
}
