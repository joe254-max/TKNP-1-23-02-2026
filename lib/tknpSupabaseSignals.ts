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

export async function addSignal(classId: string, payload: SignalingPayload) {
  const supabase = requireSupabaseAuth();

  // Map app message fields to SQL column names.
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

export function listenSignals(
  classId: string,
  onUpdate: (snapshot: { docChanges: () => Array<{ type: 'added'; doc: any }> }) => void,
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
        const row = payload.new as any;
        if (!row) return;

        const msg = {
          // Keep existing Firestore message shape expected by components.
          id: row.id,
          type: row.type,
          classId: row.class_id,
          role: row.role,
          from: row.from_id,
          to: row.to_id,
          name: row.name,
          sdp: row.sdp,
          candidate: row.candidate,
        };

        onUpdate({
          docChanges: () => [
            {
              type: 'added',
              doc: {
                id: row.id,
                data: () => msg,
              },
            },
          ],
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function removeSignal(classId: string, docId: string) {
  const supabase = requireSupabaseAuth();
  const { error } = await supabase
    .from('tknp_signals')
    .delete()
    .eq('id', docId)
    .eq('class_id', classId);

  // ignore "not found" errors to match Firebase behavior.
  if (error) throw error;
}

