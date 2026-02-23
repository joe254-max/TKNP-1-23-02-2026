import { User, UserRole } from './types';

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

export function registerUserInDb(user: {
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  admissionNo?: string;
  password: string;
}): User {
  const db = loadDb();
  const existing = db.users.find(
    u => u.email.toLowerCase() === user.email.toLowerCase(),
  );
  if (existing) {
    throw new Error('User with this email already exists');
  }

  const now = new Date().toISOString();
  const stored: StoredUser = {
    id: generateId(),
    name: user.name || 'Institutional User',
    email: user.email,
    role: user.role,
    department: user.department,
    admissionNo: user.admissionNo,
    password: user.password,
  };

  db.users.push(stored);
  db.changes.push({
    id: generateId(),
    userId: stored.id,
    type: 'REGISTER',
    createdAt: now,
    payload: { role: stored.role, department: stored.department },
  });

  saveDb(db);
  const { password, ...publicUser } = stored;
  return publicUser;
}

export function authenticateUserFromDb(email: string, password: string): User | null {
  const db = loadDb();
  const found = db.users.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
  );
  if (!found) return null;

  const { password: _pw, ...publicUser } = found;
  db.changes.push({
    id: generateId(),
    userId: found.id,
    type: 'LOGIN',
    createdAt: new Date().toISOString(),
  });
  saveDb(db);
  return publicUser;
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

