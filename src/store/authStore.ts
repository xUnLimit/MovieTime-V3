import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { User } from '@/types';
import {
  loadActiveProfileUseCase,
  onAuthStateChangeUseCase,
  signInUseCase,
  signOutUseCase,
} from '@/lib/use-cases/auth-use-cases';
import {
  clearOfflineAuthUser,
  getOfflineAuthDecision,
  loadOfflineAuthUser,
  saveOfflineAuthUser,
  setOfflineAuthSessionActive,
} from '@/lib/pwa/offline-auth';
import { logAsyncSideEffectError } from '@/lib/utils/safety';

const REMEMBER_KEY = 'auth-remember';
const DASHBOARD_TOAST_SESSION_KEY = 'movietime:dashboard-toast-state';
let authListenerInitialized = false;

/** Clear auth data from both storages. Preserves the rememberMe preference
 * so the next login defaults to the user's last choice. */
function clearAllAuthStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth-storage');
  sessionStorage.removeItem('auth-storage');
  clearOfflineAuthUser();
}

function clearDashboardToastSessionState() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DASHBOARD_TOAST_SESSION_KEY);
}

function isBrowserOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

type AuthSetter = (partial: Partial<AuthState>) => void;

/**
 * Intenta preservar la sesion offline en memoria cuando no se puede validar el perfil
 * (sin conexion). Devuelve true si manejo el estado (preserve/keep), false si se debe limpiar.
 * Centraliza la decision que antes estaba duplicada en ambas ramas de onAuthStateChange.
 */
function tryPreserveOfflineSession(set: AuthSetter): boolean {
  const current = useAuthStore.getState();
  const offlineUser = current.user ?? loadOfflineAuthUser();
  const decision = getOfflineAuthDecision({
    isOnline: isBrowserOnline(),
    hasPersistedUser: Boolean(offlineUser),
  });

  if (decision === 'clear') return false;

  set({
    user: offlineUser,
    isAuthenticated: decision === 'preserve',
    isLoading: false,
    isHydrated: true,
  });
  setOfflineAuthSessionActive(decision === 'preserve');
  return true;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;

  // Actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  restoreOfflineSession: () => void;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  checkAuth: () => void;
  setHydrated: (hydrated: boolean) => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isHydrated: false,

        login: async (email: string, password: string, rememberMe: boolean = false) => {
          set({ isLoading: true });

          try {
            // Clear stale client auth state before Supabase writes a fresh session.
            clearAllAuthStorage();
            clearDashboardToastSessionState();
            if (rememberMe) {
              localStorage.setItem(REMEMBER_KEY, 'true');
            } else {
              localStorage.removeItem(REMEMBER_KEY);
            }

            await signInUseCase(email, password);
            const user = await loadActiveProfileUseCase();

            saveOfflineAuthUser(user);
            setOfflineAuthSessionActive(false);

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              isHydrated: true,
            });
          } catch (error) {
            await signOutUseCase().catch((signOutError) => {
              logAsyncSideEffectError(signOutError, {
                operation: 'supabaseSignOutAfterLoginFailure',
                entity: 'auth',
              });
            });
            set({ isLoading: false, isHydrated: true });
            const message = error instanceof Error ? error.message : 'Error al iniciar sesion';
            throw new Error(message);
          }
        },

        restoreOfflineSession: () => {
          if (isBrowserOnline()) {
            throw new Error('El acceso offline solo aplica cuando no hay conexion.');
          }

          const user = loadOfflineAuthUser();
          if (!user) {
            throw new Error('Este dispositivo no tiene un usuario offline guardado. Inicia sesion con internet primero.');
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            isHydrated: true,
          });
          setOfflineAuthSessionActive(true);
        },

        logout: async () => {
          try {
            await signOutUseCase();
            clearAllAuthStorage();
            clearDashboardToastSessionState();
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              isHydrated: true,
            });
          } catch (error) {
            logAsyncSideEffectError(error, { operation: 'logout', entity: 'auth' });
            const message = error instanceof Error ? error.message : 'Error al cerrar sesion';
            throw new Error(message);
          }
        },

        setUser: (user: User | null) => {
          set({ user, isAuthenticated: !!user });
        },

        checkAuth: () => {
          const state = useAuthStore.getState();
          if (!state.user) {
            set({ isAuthenticated: false });
          }
        },

        setHydrated: (hydrated: boolean) => {
          set({ isHydrated: hydrated });
        },

        initAuth: () => {
          if (authListenerInitialized) {
            set({ isHydrated: true });
            return;
          }
          authListenerInitialized = true;
          clearAllAuthStorage();
          onAuthStateChangeUseCase(async (session) => {
            if (session) {
              try {
                const user = await loadActiveProfileUseCase();
                saveOfflineAuthUser(user);
                setOfflineAuthSessionActive(false);
                set({ user, isAuthenticated: true, isLoading: false, isHydrated: true });
              } catch (error) {
                void error;
                // Offline profile checks can fail even when the persisted session is valid.
                if (tryPreserveOfflineSession(set)) return;

                await signOutUseCase().catch((signOutError) => {
                  logAsyncSideEffectError(signOutError, {
                    operation: 'supabaseSignOutAfterProfileFailure',
                    entity: 'auth',
                  });
                });
                clearAllAuthStorage();
                set({ user: null, isAuthenticated: false, isLoading: false, isHydrated: true });
              }
            } else {
              // Keep the in-memory user while offline so read-only navigation keeps working.
              if (tryPreserveOfflineSession(set)) return;

              clearAllAuthStorage();
              set({ user: null, isAuthenticated: false, isLoading: false, isHydrated: true });
            }
          });
        },
      })
  )
);
