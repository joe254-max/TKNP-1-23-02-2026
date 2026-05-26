import { createClient } from '@supabase/supabase-js';

const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase client configured for auth-based SPAs:
 * - persistSession: keep the session in localStorage
 * - detectSessionInUrl: handle OAuth redirect code exchange automatically
 */
export const supabaseAuth =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function requireSupabaseAuth() {
  if (!supabaseAuth) {
    throw new Error('Supabase auth client is not configured (missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY).');
  }
  return supabaseAuth;
}

