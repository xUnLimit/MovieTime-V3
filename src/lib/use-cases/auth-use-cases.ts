import {
  getCurrentProfile,
  onAuthStateChange,
  signIn,
  signOut,
} from '@/lib/supabase/auth';
import type { User } from '@/types';

export function signInUseCase(email: string, password: string) {
  return signIn(email, password);
}

export function signOutUseCase() {
  return signOut();
}

export async function loadActiveProfileUseCase(): Promise<User> {
  const user = await getCurrentProfile();
  if (!user) {
    throw new Error('No se encontro un perfil activo para este usuario.');
  }
  if (!user.active) {
    throw new Error('Este usuario esta inactivo.');
  }
  return user;
}

export { onAuthStateChange as onAuthStateChangeUseCase };
