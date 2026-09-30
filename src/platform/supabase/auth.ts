import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { clearBrowserSessionArtifacts, supabase } from './client';
import type { User } from '@/types';

const INVALID_AUTH_CODES = new Set([
  'bad_jwt',
  'invalid_jwt',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
]);

type AuthFailure = {
  status?: number;
  code?: string;
  name?: string;
  message?: string;
};

export class InvalidAuthSessionError extends Error {
  constructor(message = 'La sesion guardada ya no es valida.') {
    super(message);
    this.name = 'InvalidAuthSessionError';
  }
}

function isInvalidAuthSession(error: AuthFailure): boolean {
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.name === 'AuthSessionMissingError' ||
    (typeof error.code === 'string' && INVALID_AUTH_CODES.has(error.code))
  );
}
/**
 * Sign in with email/password using the remember-aware browser storage.
 */
export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('No se pudo iniciar sesion');
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw new Error(error.message);
}

export function clearLocalSession(): void {
  clearBrowserSessionArtifacts();
}
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}

export async function getCurrentSupabaseUser(): Promise<SupabaseUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (isInvalidAuthSession(error)) throw new InvalidAuthSessionError(error.message);
    throw error;
  }
  return data.user;
}

/**
 * Subscribe to auth state changes. Returns the unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Read the app user row for the current auth user. Includes `role` (admin |
 * operador) and `display_name`. Returns null if not signed in.
 */
export async function getCurrentProfile(): Promise<User | null> {
  const supaUser = await getCurrentSupabaseUser();
  if (!supaUser) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', supaUser.id)
    .maybeSingle();

  if (error) throw error;
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
