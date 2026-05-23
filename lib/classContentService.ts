import { requireSupabaseAuth } from './supabaseAuthClient';

export interface ClassMaterial {
  id: string;
  classId: string;
  week: number;
  name: string;
  type: string;
  size: string;
  uploadedBy: string;
  date: string;
  fileUrl?: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  fileName: string;
  submittedAt: string;
  grade?: number;
  feedback?: string;
  status: string;
}

export interface ClassAssignment {
  id: string;
  classId: string;
  title: string;
  description: string;
  dueDate: string;
  status: string;
  weight: string;
  maxGrade: number;
  submittedFile?: string;
  submittedDate?: string;
  grade?: number;
  feedback?: string;
}

export interface ClassGradeEntry {
  id: string;
  classId: string;
  title: string;
  entryType: string;
  date: string;
  score: number;
  maxScore: number;
  weight: string;
}

export interface GradeComponent {
  component: string;
  weight: number;
  earned: number | null;
}

export interface ClassGradeSummary {
  gradeEntries: ClassGradeEntry[];
  scheme: GradeComponent[];
  overall?: number;
  attendance?: number;
}

export interface ClassScheduleSession {
  id: string;
  classId: string;
  day: string;
  startTime: string;
  endTime: string;
  sessionType: string;
  room: string;
  topic: string;
  week: number;
}

export interface ClassScheduleEvent {
  id: string;
  classId: string;
  date: string;
  label: string;
  eventType: string;
  note?: string;
}

export interface ClassSchedulePayload {
  weeklySessions: ClassScheduleSession[];
  upcomingEvents: ClassScheduleEvent[];
}

function getStudentId(): string {
  const raw = typeof window !== 'undefined' ? localStorage.getItem('poly_student_profile') : null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.schoolRegistryId === 'string' && parsed.schoolRegistryId.trim()) {
        return parsed.schoolRegistryId;
      }
    } catch {
      // ignore
    }
  }
  return 'anonymous-student';
}

export async function fetchClassMaterials(classId: string): Promise<ClassMaterial[]> {
  try {
    const supabase = requireSupabaseAuth();
    const { data, error } = await supabase
      .from('class_materials')
      .select('*')
      .eq('class_id', classId)
      .order('week', { ascending: true })
      .order('uploaded_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ClassMaterial[];
  } catch (error) {
    console.warn('fetchClassMaterials failed', error);
    return [];
  }
}

export async function fetchClassAssignments(classId: string): Promise<ClassAssignment[]> {
  try {
    const supabase = requireSupabaseAuth();
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('class_assignments')
      .select('*')
      .eq('class_id', classId)
      .order('due_date', { ascending: true });
    if (assignmentError) throw assignmentError;

    const assignments = (assignmentData ?? []) as Array<Record<string, unknown>>;
    const assignmentIds = assignments.map((assignment) => String(assignment.id));
    const studentId = getStudentId();

    const { data: submissionData, error: submissionError } = await supabase
      .from('assignment_submissions')
      .select('*')
      .eq('student_id', studentId)
      .in('assignment_id', assignmentIds);
    if (submissionError) throw submissionError;

    const submissions = (submissionData ?? []) as Array<Record<string, unknown>>;
    return assignments.map((assignment) => {
      const attached = submissions.find((submission) => String(submission.assignment_id) === String(assignment.id));
      return {
        id: String(assignment.id),
        classId: String(assignment.class_id),
        title: String(assignment.title ?? ''),
        description: String(assignment.description ?? ''),
        dueDate: String(assignment.due_date ?? ''),
        status: attached ? String(attached.status ?? 'SUBMITTED') : String(assignment.status ?? 'PENDING'),
        weight: String(assignment.weight ?? '0%'),
        maxGrade: Number(assignment.max_grade ?? 100),
        submittedFile: attached ? String(attached.file_name ?? '') : undefined,
        submittedDate: attached ? new Date(String(attached.submitted_at)).toLocaleDateString() : undefined,
        grade: attached?.grade !== undefined ? Number(attached.grade) : undefined,
        feedback: attached ? String(attached.feedback ?? '') : undefined,
      };
    });
  } catch (error) {
    console.warn('fetchClassAssignments failed', error);
    return [];
  }
}

export async function submitAssignment(payload: {
  classId: string;
  assignmentId: string;
  uploadedFile: string;
  submittedDate: string;
  studentId?: string;
}): Promise<ClassAssignment | null> {
  try {
    const supabase = requireSupabaseAuth();
    const studentId = payload.studentId ?? getStudentId();
    const { data, error } = await supabase
      .from('assignment_submissions')
      .upsert(
        {
          assignment_id: payload.assignmentId,
          student_id: studentId,
          file_name: payload.uploadedFile,
          submitted_at: payload.submittedDate,
          status: 'SUBMITTED',
        },
        { onConflict: 'assignment_id,student_id' },
      )
      .select('*')
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: String(data.id),
      classId: payload.classId,
      title: '',
      description: '',
      dueDate: '',
      status: String(data.status ?? 'SUBMITTED'),
      weight: '0%',
      maxGrade: 100,
      submittedFile: String(data.file_name ?? ''),
      submittedDate: new Date(String(data.submitted_at)).toLocaleDateString(),
      grade: data.grade !== undefined ? Number(data.grade) : undefined,
      feedback: String(data.feedback ?? ''),
    };
  } catch (error) {
    console.warn('submitAssignment failed', error);
    return null;
  }
}

export async function fetchClassGrades(classId: string): Promise<ClassGradeSummary> {
  try {
    const supabase = requireSupabaseAuth();
    const { data, error } = await supabase
      .from('class_grade_entries')
      .select('*')
      .eq('class_id', classId)
      .order('date', { ascending: true });
    if (error) throw error;

    const gradeEntries = (data ?? []) as ClassGradeEntry[];
    const scheme: GradeComponent[] = [
      { component: 'CATs (×2)', weight: 30, earned: 23.7 },
      { component: 'Assignments', weight: 20, earned: 17.6 },
      { component: 'Lab Reports (×2)', weight: 20, earned: 16.9 },
      { component: 'Final Project', weight: 30, earned: null },
    ];

    return {
      gradeEntries,
      scheme,
      overall: gradeEntries.length > 0 ? Math.round(
        gradeEntries.reduce((sum, entry) => sum + entry.score, 0) / gradeEntries.length,
      ) : undefined,
      attendance: 90,
    };
  } catch (error) {
    console.warn('fetchClassGrades failed', error);
    return { gradeEntries: [], scheme: [], overall: undefined, attendance: undefined };
  }
}

export async function fetchClassSchedule(classId: string): Promise<ClassSchedulePayload> {
  try {
    const supabase = requireSupabaseAuth();
    const [{ data: sessionData, error: sessionError }, { data: eventData, error: eventError }] = await Promise.all([
      supabase.from('class_schedule').select('*').eq('class_id', classId).order('week', { ascending: true }),
      supabase.from('class_schedule_events').select('*').eq('class_id', classId).order('date', { ascending: true }),
    ]);

    if (sessionError) throw sessionError;
    if (eventError) throw eventError;

    return {
      weeklySessions: (sessionData ?? []) as ClassScheduleSession[],
      upcomingEvents: (eventData ?? []) as ClassScheduleEvent[],
    };
  } catch (error) {
    console.warn('fetchClassSchedule failed', error);
    return { weeklySessions: [], upcomingEvents: [] };
  }
}
