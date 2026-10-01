import type { User } from '@/types';

export type AuthSetter = (partial: Partial<AuthState>) => void;

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  authRecoveryError: string | null;

  // Actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  checkAuth: () => void;
  setHydrated: (hydrated: boolean) => void;
  initAuth: () => void;
  retryAuth: () => void;
}
