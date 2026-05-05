import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './client';
import type { User } from '@/types';

/**
 * Sign in with email/password. `rememberMe` is honored client-side via the
 * Supabase auth-helpers cookie; for now we just sign in and let the client
 * persist the session (Supabase persists by default).
 */
export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('No se pudo iniciar sesion');
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function sendPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}

export async function getCurrentSupabaseUser(): Promise<SupabaseUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

/**
 * Subscribe to auth state changes. Returns the unsubscribe function.
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Read the profile row for the current auth user. Includes `role` (admin |
 * operador) and `display_name`. Returns null if not signed in.
 */
export async function getCurrentProfile(): Promise<User | null> {
  const supaUser = await getCurrentSupabaseUser();
  if (!supaUser) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', supaUser.id)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;

  return {
    id: data.id,
    email: supaUser.email ?? '',
    displayName: data.display_name,
    role: data.role === 'admin' ? 'admin' : 'operador',
    active: data.active,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}
