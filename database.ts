import { User, UserRole } from './types';
import { requireSupabaseAuth } from './lib/supabaseAuthClient';

interface StoredUser extends User {
  password: string;
}

interface UserFileRecord {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  metadata?: Record<string, unknown>;
}

interface UserClassRecord {
  id: string;
  userId: string;
  classId: string;
  className: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

interface UserChangeRecord {
  id: string;
  userId: string;
  type: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

interface DatabaseShape {
  users: StoredUser[];
  files: UserFileRecord[];
  classes: UserClassRecord[];
  changes: UserChangeRecord[];
}

const DB_KEY = 'poly_library_database_v1';

function loadDb(): DatabaseShape {
  if (typeof window === 'undefined') {
    return { users: [], files: [], classes: [], changes: [] };
  }
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) {
      return { users: [], files: [], classes: [], changes: [] };
    }
    return JSON.parse(raw) as DatabaseShape;
  } catch {
    return { users: [], files: [], classes: [], changes: [] };
  }
}

function saveDb(db: DatabaseShape) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

export async function registerUserInDb(user: {
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  admissionNo?: string;
  password: string;
}): Promise<User> {
  const supabase = requireSupabaseAuth();

  const {
    data: signUpData,
    error: signUpError,
  } = await supabase.auth.signUp({
    email: user.email,
    password: user.password,
    options: {
      data: {
        role: user.role,
        name: user.name || 'Institutional User',
        department: user.department ?? null,
        admission_no: user.admissionNo ?? null,
      },
    },
  });

  if (signUpError) throw signUpError;
  if (!signUpData.user) throw new Error('Supabase signUp did not return a user.');

  // Ensure we have a session immediately (in case the project is configured to require confirmation).
  if (!signUpData.session) {
    const signInRes = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (signInRes.error) throw signInRes.error;
  }

  const portalName = user.name || 'Institutional User';

  const { error: upsertError } = await supabase.from('tknp_users').upsert(
    {
      user_id: signUpData.user.id,
      name: portalName,
      email: user.email,
      role: user.role,
      department: user.department ?? null,
      admission_no: user.admissionNo ?? null,
    },
    { onConflict: 'user_id' },
  );

  if (upsertError) throw upsertError;

  return {
    id: signUpData.user.id,
    name: portalName,
    email: user.email,
    role: user.role,
    department: user.department,
    admissionNo: user.admissionNo,
  };
}

export async function authenticateUserFromDb(email: string, password: string): Promise<User | null> {
  const supabase = requireSupabaseAuth();

  const signInRes = await supabase.auth.signInWithPassword({ email, password });
  if (signInRes.error) return null;

  const authUser = signInRes.data.user;
  if (!authUser) return null;

  // Read the portal profile row created at registration/OAuth time.
  const { data: row, error: fetchError } = await supabase
    .from('tknp_users')
    .select('user_id,name,email,role,department,admission_no')
    .eq('user_id', authUser.id)
    .single();

  if (fetchError || !row) {
    // Fallback: create a minimal row so the UI still works.
    const fallbackRole = UserRole.LECTURER;
    const derivedName = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Institutional User';

    const { error: upsertError } = await supabase.from('tknp_users').upsert(
      {
        user_id: authUser.id,
        name: derivedName,
        email,
        role: fallbackRole,
        department: null,
        admission_no: null,
      },
      { onConflict: 'user_id' },
    );
    if (upsertError) throw upsertError;

    return {
      id: authUser.id,
      name: derivedName,
      email,
      role: fallbackRole,
    };
  }

  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    department: row.department ?? undefined,
    admissionNo: row.admission_no ?? undefined,
  };
}

export function recordUserFileUpload(input: {
  userId: string;
  fileName: string;
  fileType: string;
  metadata?: Record<string, unknown>;
}) {
  const db = loadDb();
  const id = generateId();
  const now = new Date().toISOString();
  db.files.push({
    id,
    userId: input.userId,
    fileName: input.fileName,
    fileType: input.fileType,
    uploadedAt: now,
    metadata: input.metadata,
  });
  db.changes.push({
    id: generateId(),
    userId: input.userId,
    type: 'FILE_UPLOAD',
    createdAt: now,
    payload: { fileId: id, fileName: input.fileName },
  });
  saveDb(db);
}

export function recordUserClassUpdate(input: {
  userId: string;
  classId: string;
  className: string;
  metadata?: Record<string, unknown>;
}) {
  const db = loadDb();
  const now = new Date().toISOString();
  const existing = db.classes.find(
    c => c.userId === input.userId && c.classId === input.classId,
  );
  if (existing) {
    existing.className = input.className;
    existing.updatedAt = now;
    existing.metadata = { ...(existing.metadata || {}), ...(input.metadata || {}) };
  } else {
    db.classes.push({
      id: generateId(),
      userId: input.userId,
      classId: input.classId,
      className: input.className,
      updatedAt: now,
      metadata: input.metadata,
    });
  }
  db.changes.push({
    id: generateId(),
    userId: input.userId,
    type: 'CLASS_UPDATE',
    createdAt: now,
    payload: { classId: input.classId, className: input.className },
  });
  saveDb(db);
}

export function recordUserChange(input: {
  userId: string;
  type: string;
  payload?: Record<string, unknown>;
}) {
  const db = loadDb();
  db.changes.push({
    id: generateId(),
    userId: input.userId,
    type: input.type,
    createdAt: new Date().toISOString(),
    payload: input.payload,
  });
  saveDb(db);
}

