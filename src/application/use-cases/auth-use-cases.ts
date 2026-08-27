import {
  getCurrentSession,
  getCurrentProfile,
  onAuthStateChange,
  signIn,
  signOut,
} from '@/platform/supabase/auth';
import type { User } from '@/types';

export class TerminalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TerminalAuthError';
  }
}


export function signInUseCase(email: string, password: string) {
  return signIn(email, password);
}

export function signOutUseCase() {
  return signOut();
}

export function getCurrentSessionUseCase() {
  return getCurrentSession();
}

export async function loadActiveProfileUseCase(): Promise<User> {
  const user = await getCurrentProfile();
  if (!user) {
    throw new TerminalAuthError('No se encontro un perfil activo para este usuario.');
  }
  if (!user.active) {
    throw new TerminalAuthError('Este usuario esta inactivo.');
  }
  return user;
}

export { onAuthStateChange as onAuthStateChangeUseCase };
