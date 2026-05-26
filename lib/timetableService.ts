import { requireSupabaseAuth } from './supabaseAuthClient';

export interface TimetableSessionInput {
  id: string;
  day: string;
  time: string;
  venue: string;
  type: 'LECTURE' | 'PRACTICAL' | 'SEMINAR';
}

export interface TimetableSessionRow {
  class_id: string;
  session_id: string;
  day: string;
  time: string;
  venue: string;
  session_type: 'LECTURE' | 'PRACTICAL' | 'SEMINAR';
}

export async function fetchClassSessions(classId: string): Promise<TimetableSessionRow[]> {
  const supabase = requireSupabaseAuth();
  const { data, error } = await supabase
    .from('tknp_timetable_sessions')
    .select('class_id,session_id,day,time,venue,session_type')
    .eq('class_id', classId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TimetableSessionRow[];
}

export async function upsertClassSession(classId: string, session: TimetableSessionInput): Promise<void> {
  const supabase = requireSupabaseAuth();
  const { data: userRes } = await supabase.auth.getUser();
  const createdBy = userRes.user?.id;
  if (!createdBy) throw new Error('Not authenticated.');

  const { error } = await supabase.from('tknp_timetable_sessions').upsert(
    {
      class_id: classId,
      session_id: session.id,
      day: session.day,
      time: session.time,
      venue: session.venue,
      session_type: session.type,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'class_id,session_id' },
  );
  if (error) throw error;
}

export async function deleteClassSession(classId: string, sessionId: string): Promise<void> {
  const supabase = requireSupabaseAuth();
  const { error } = await supabase
    .from('tknp_timetable_sessions')
    .delete()
    .eq('class_id', classId)
    .eq('session_id', sessionId);
  if (error) throw error;
}
