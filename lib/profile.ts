import type { UserProfile } from '../types';

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
