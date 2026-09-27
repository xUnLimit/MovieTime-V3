import {
  InvalidAuthSessionError,
  clearLocalSession,
  getCurrentSession,
  getCurrentProfile,
  onAuthStateChange,
  signIn,
  signOut,
} from '@/platform/supabase/auth';
import { clearAllChatDrafts } from '@/modules/whatsapp/chat-drafts';
import type { User } from '@/types';
export { AUTH_REMEMBER_KEY } from '@/platform/supabase/auth-storage';


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

export function clearLocalSessionUseCase() {
  clearLocalSession();
  // Un borrador de chat puede llevar una contrasena de servicio ya llena; no
  // debe sobrevivir a un cierre de sesion en un navegador compartido.
  clearAllChatDrafts();
}

export function getCurrentSessionUseCase() {
  return getCurrentSession();
}

export async function loadActiveProfileUseCase(): Promise<User> {
  let user: User | null;
  try {
    user = await getCurrentProfile();
  } catch (error) {
    if (error instanceof InvalidAuthSessionError) {
      throw new TerminalAuthError(error.message);
    }
    throw error;
  }

  if (!user) {
    throw new TerminalAuthError('No se encontro un perfil activo para este usuario.');
  }
  if (!user.active) {
    throw new TerminalAuthError('Este usuario esta inactivo.');
  }
  return user;
}

export { onAuthStateChange as onAuthStateChangeUseCase };
