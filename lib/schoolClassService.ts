import { requireSupabaseAuth } from './supabaseAuthClient';

export interface SchoolClassRecord {
  class_key: string;
  code: string;
  title: string;
  department: string;
  class_mode: 'PHYSICAL' | 'ONLINE';
  room_or_platform: string;
  teacher_name: string;
  student_count: number;
  owner_id?: string | null;
}

export interface SchoolStudentRecord {
  class_key: string;
  student_id: string;
  adm_no: string;
  student_name: string;
  phone: string;
  status: string;
  attendance: number;
  grade_average: number;
}

export async function fetchAllSchoolClasses(): Promise<SchoolClassRecord[]> {
  try {
    const supabase = requireSupabaseAuth();
    const { data, error } = await supabase
      .from('tknp_school_classes')
      .select('class_key,code,title,department,class_mode,room_or_platform,teacher_name,student_count,owner_id')
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as SchoolClassRecord[];
  } catch (error) {
    console.warn('fetchAllSchoolClasses failed', error);
    return [];
  }
}

export async function upsertSchoolClassIndex(records: SchoolClassRecord[]): Promise<void> {
  if (records.length === 0) return;
  try {
    const supabase = requireSupabaseAuth();
    const { data: auth } = await supabase.auth.getUser();
    const ownerId = auth.user?.id ?? null;
    const payload = records.map((record) => ({
      ...record,
      owner_id: record.owner_id ?? ownerId,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('tknp_school_classes').upsert(payload, { onConflict: 'class_key' });
    if (error) throw error;
  } catch (error) {
    console.warn('upsertSchoolClassIndex failed', error);
  }
}

export async function searchSchoolClasses(query: string): Promise<SchoolClassRecord[]> {
  try {
    const supabase = requireSupabaseAuth();
    const trimmed = query.trim();
    let builder = supabase
      .from('tknp_school_classes')
      .select('class_key,code,title,department,class_mode,room_or_platform,teacher_name,student_count')
      .order('updated_at', { ascending: false })
      .limit(12);
    if (trimmed) {
      const escaped = trimmed.replace(/[%_]/g, '');
      builder = builder.or(
        `code.ilike.%${escaped}%,title.ilike.%${escaped}%,department.ilike.%${escaped}%,teacher_name.ilike.%${escaped}%`,
      );
    }
    const { data, error } = await builder;
    if (error) throw error;
    return (data ?? []) as SchoolClassRecord[];
  } catch (error) {
    console.warn('searchSchoolClasses failed', error);
    return [];
  }
}

export async function fetchOwnedSchoolClasses(): Promise<SchoolClassRecord[]> {
  try {
    const supabase = requireSupabaseAuth();
    const { data: auth } = await supabase.auth.getUser();
    const ownerId = auth.user?.id;
    if (!ownerId) return [];
    const { data, error } = await supabase
      .from('tknp_school_classes')
      .select('class_key,code,title,department,class_mode,room_or_platform,teacher_name,student_count,owner_id')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SchoolClassRecord[];
  } catch (error) {
    console.warn('fetchOwnedSchoolClasses failed', error);
    return [];
  }
}

export function subscribeSchoolClasses(onChange: () => void): () => void {
  try {
    const supabase = requireSupabaseAuth();
    const channel = supabase
      .channel('school-classes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tknp_school_classes' },
        () => onChange(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  } catch (error) {
    console.warn('subscribeSchoolClasses skipped because Supabase is unavailable', error);
    return () => undefined;
  }
}

export async function fetchOwnedSchoolStudents(): Promise<SchoolStudentRecord[]> {
  try {
    const supabase = requireSupabaseAuth();
    const ownedClasses = await fetchOwnedSchoolClasses();
    const classKeys = ownedClasses.map((c) => c.class_key);
    if (classKeys.length === 0) return [];

    const { data, error } = await supabase
      .from('tknp_school_class_students')
      .select('class_key,student_id,adm_no,student_name,phone,status,attendance,grade_average')
      .in('class_key', classKeys)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as SchoolStudentRecord[];
  } catch (error) {
    console.warn('fetchOwnedSchoolStudents failed', error);
    return [];
  }
}

export async function upsertSchoolStudents(records: SchoolStudentRecord[]): Promise<void> {
  if (records.length === 0) return;
  try {
    const supabase = requireSupabaseAuth();
    const payload = records.map((record) => ({
      ...record,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('tknp_school_class_students')
      .upsert(payload, { onConflict: ['class_key', 'adm_no'] });
    if (error) throw error;
  } catch (error) {
    console.warn('upsertSchoolStudents failed', error);
  }
}
