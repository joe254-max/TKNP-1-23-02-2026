import type { UserProfile } from '../types';

<<<<<<< HEAD
import { requireSupabaseAuth } from './supabaseAuthClient';

const profileCache = new Map<string, UserProfile>();

export function getStoredProfile(userId: string): UserProfile | null {
  return profileCache.get(userId) ?? null;
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
    .single();

  if (error) throw error;

  const resolvedFullName = fullName ?? '';

  if (!row) {
    const { error: upsertErr } = await supabase.from('tknp_profiles').upsert(
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
    );
    if (upsertErr) throw upsertErr;
  }

  const { data: row2 } = await supabase
    .from('tknp_profiles')
    .select(
      'user_id, full_name, school_registry_id, phone, gender, class_name, department, year, age, photo_data_url'
    )
    .eq('user_id', userId)
    .single();

  const p: UserProfile = {
    fullName: row2?.full_name ?? resolvedFullName,
    schoolRegistryId: row2?.school_registry_id ?? '',
    phone: row2?.phone ?? '',
    gender: row2?.gender ?? '',
    class: row2?.class_name ?? '',
    department: row2?.department ?? '',
    year: row2?.year ?? '',
    age: row2?.age ?? '',
    photoDataUrl: row2?.photo_data_url ?? '',
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
=======
const PROFILE_KEY_PREFIX = 'poly_user_profile_';

export function getProfileKey(userId: string): string {
  return `${PROFILE_KEY_PREFIX}${userId}`;
}

export function getStoredProfile(userId: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(getProfileKey(userId));
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function saveStoredProfile(userId: string, profile: UserProfile): void {
  localStorage.setItem(getProfileKey(userId), JSON.stringify(profile));
>>>>>>> a2dc43e97b1949a1efe4afb9dfd445451e85d4d3
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
