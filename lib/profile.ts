import { UserRole, type UserProfile } from '../types';

import { requireSupabaseAuth } from './supabaseAuthClient';

const profileCache = new Map<string, UserProfile>();

const REQUIRED_STUDENT_PROFILE_FIELDS: Array<keyof UserProfile> = [
  'fullName',
  'schoolRegistryId',
  'phone',
  'gender',
  'class',
  'department',
  'year',
  'age',
];
const REQUIRED_STAFF_PROFILE_FIELDS: Array<keyof UserProfile> = [
  'fullName',
  'schoolRegistryId',
  'phone',
  'gender',
  'department',
];

export function getStoredProfile(userId: string): UserProfile | null {
  return profileCache.get(userId) ?? null;
}

export function isProfileComplete(profile: UserProfile | null | undefined, role?: UserRole): boolean {
  if (!profile) return false;
  const requiredFields =
    role === UserRole.STUDENT ? REQUIRED_STUDENT_PROFILE_FIELDS : REQUIRED_STAFF_PROFILE_FIELDS;
  return requiredFields.every((field) => {
    const value = profile[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/**
 * Loads the user's profile from Supabase into the in-memory cache.
 * This is used so components can keep their current synchronous `getStoredProfile` calls.
 */
export async function primeProfileCache(userId: string, fullName?: string): Promise<void> {
  if (profileCache.has(userId)) return;

  const supabase = requireSupabaseAuth();
  const { data: row, error } = await supabase
    .from('tknp_profiles')
    .select(
      'user_id, full_name, school_registry_id, phone, gender, class_name, department, year, age, photo_data_url'
    )
    .eq('user_id', userId)
    .maybeSingle();

  // Any DB/network issue should not block login flow completely.
  if (error) {
    console.error('Profile cache prime failed', error);
    return;
  }

  const resolvedFullName = fullName ?? '';
  let effectiveRow = row;

  if (!row) {
    const { data: insertedRow, error: upsertErr } = await supabase
      .from('tknp_profiles')
      .upsert(
        {
          user_id: userId,
          full_name: resolvedFullName,
          school_registry_id: '',
          phone: '',
          gender: '',
          class_name: '',
          department: '',
          year: '',
          age: '',
          photo_data_url: '',
        },
        { onConflict: 'user_id' },
      )
      .select(
        'user_id, full_name, school_registry_id, phone, gender, class_name, department, year, age, photo_data_url'
      )
      .single();
    if (upsertErr) {
      console.error('Profile row bootstrap failed', upsertErr);
      return;
    }
    effectiveRow = insertedRow;
  }

  const p: UserProfile = {
    fullName: effectiveRow?.full_name ?? resolvedFullName,
    schoolRegistryId: effectiveRow?.school_registry_id ?? '',
    phone: effectiveRow?.phone ?? '',
    gender: effectiveRow?.gender ?? '',
    class: effectiveRow?.class_name ?? '',
    department: effectiveRow?.department ?? '',
    year: effectiveRow?.year ?? '',
    age: effectiveRow?.age ?? '',
    photoDataUrl: effectiveRow?.photo_data_url ?? '',
  };

  profileCache.set(userId, p);
}

export async function saveStoredProfile(userId: string, profile: UserProfile): Promise<void> {
  const supabase = requireSupabaseAuth();

  const upsertPayload = {
    user_id: userId,
    full_name: profile.fullName,
    school_registry_id: profile.schoolRegistryId,
    phone: profile.phone,
    gender: profile.gender,
    class_name: profile.class,
    department: profile.department,
    year: profile.year,
    age: profile.age,
    photo_data_url: profile.photoDataUrl,
  };

  const { error } = await supabase.from('tknp_profiles').upsert(upsertPayload, { onConflict: 'user_id' });
  if (error) throw error;

  profileCache.set(userId, profile);
}

export const DEFAULT_PROFILE: UserProfile = {
  fullName: '',
  schoolRegistryId: '',
  phone: '',
  gender: '',
  class: '',
  department: '',
  year: '',
  age: '',
  photoDataUrl: '',
};
