import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { User } from '@/types';
import {
  TerminalAuthError,
  AUTH_REMEMBER_KEY,
  clearLocalSessionUseCase,
  getCurrentSessionUseCase,
  loadActiveProfileUseCase,
  onAuthStateChangeUseCase,
  signInUseCase,
  signOutUseCase,
} from '@/application/use-cases/auth-use-cases';
import {
  clearOfflineAuthUser,
  getOfflineAuthDecision,
  loadOfflineAuthUser,
  saveOfflineAuthUser,
  setOfflineAuthSessionActive,
} from '@/modules/pwa/offline-auth';
import { logAsyncSideEffectError } from '@/platform/utils/safety';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

const DASHBOARD_TOAST_SESSION_KEY = 'movietime:dashboard-toast-state';
const AUTH_RECOVERY_MESSAGE =
  'No pudimos validar tu sesión. Revisa la conexión e inténtalo nuevamente.';
const PROFILE_RETRY_DELAYS_MS = [0, 250, 750] as const;
let authListenerInitialized = false;
let authRevision = 0;
let profileRetryTimer: ReturnType<typeof setTimeout> | null = null;

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
    authRecoveryError: null,
  });
  setOfflineAuthSessionActive(decision === 'preserve');
  return true;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  authRecoveryError: string | null;

  // Actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  restoreOfflineSession: () => void;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  checkAuth: () => void;
  setHydrated: (hydrated: boolean) => void;
  initAuth: () => void;
  retryAuth: () => void;
}

function cancelProfileRetry() {
  if (profileRetryTimer !== null) {
    clearTimeout(profileRetryTimer);
    profileRetryTimer = null;
  }
}

function clearDeviceAuthStorage() {
  try {
    clearLocalSessionUseCase();
  } catch (error) {
    logAsyncSideEffectError(error, {
      operation: 'clearSupabaseLocalSession',
      entity: 'auth',
    });
  }

  try {
    clearAllAuthStorage();
  } catch (error) {
    logAsyncSideEffectError(error, {
      operation: 'clearApplicationAuthStorage',
      entity: 'auth',
    });
  }
}

function setSignedOutState(set: AuthSetter) {
  clearDeviceAuthStorage();
  set({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isHydrated: true,
    authRecoveryError: null,
  });
}

function scheduleProfileLoad(
  set: AuthSetter,
  session: Session,
  revision: number,
  attempt = 0
) {
  cancelProfileRetry();
  profileRetryTimer = setTimeout(() => {
    profileRetryTimer = null;
    void loadProfileForSession(set, session, revision, attempt);
  }, PROFILE_RETRY_DELAYS_MS[attempt]);
}

async function loadProfileForSession(
  set: AuthSetter,
  session: Session,
  revision: number,
  attempt: number
) {
  try {
    const user = await loadActiveProfileUseCase();
    if (revision !== authRevision) return;

    saveOfflineAuthUser(user);
    setOfflineAuthSessionActive(false);
    set({
      user,
      isAuthenticated: true,
      isLoading: false,
      isHydrated: true,
      authRecoveryError: null,
    });
  } catch (error) {
    if (revision !== authRevision) return;

    if (error instanceof TerminalAuthError) {
      await signOutUseCase().catch((signOutError) => {
        logAsyncSideEffectError(signOutError, {
          operation: 'supabaseLocalSignOutAfterTerminalProfileFailure',
          entity: 'auth',
        });
      });
      if (revision !== authRevision) return;
      setSignedOutState(set);
      return;
    }

    const nextAttempt = attempt + 1;
    if (nextAttempt < PROFILE_RETRY_DELAYS_MS.length) {
      scheduleProfileLoad(set, session, revision, nextAttempt);
      return;
    }

    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: true,
      authRecoveryError: AUTH_RECOVERY_MESSAGE,
    });
  }
}

function handleAuthEvent(set: AuthSetter, event: AuthChangeEvent, session: Session | null) {
  const revision = ++authRevision;
  const current = useAuthStore.getState();
  if (event === 'SIGNED_IN' && session && current.isLoading) {
    return;
  }

  cancelProfileRetry();

  if (!session) {
    if (event !== 'SIGNED_OUT' && tryPreserveOfflineSession(set)) return;
    setSignedOutState(set);
    return;
  }

  if (current.isAuthenticated && current.user?.id === session.user.id) {
    set({ isHydrated: true, authRecoveryError: null });
    return;
  }

  set({ isHydrated: false, authRecoveryError: null });
  scheduleProfileLoad(set, session, revision);
}

function retryCurrentSession(set: AuthSetter) {
  const revision = ++authRevision;
  cancelProfileRetry();
  set({ isHydrated: false, authRecoveryError: null });

  void getCurrentSessionUseCase()
    .then((session) => {
      if (revision !== authRevision) return;
      if (!session) {
        setSignedOutState(set);
        return;
      }
      scheduleProfileLoad(set, session, revision);
    })
    .catch(() => {
      if (revision !== authRevision) return;
      set({
        isLoading: false,
        isHydrated: true,
        authRecoveryError: AUTH_RECOVERY_MESSAGE,
      });
    });
}


export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isHydrated: false,
        authRecoveryError: null,

        login: async (email: string, password: string, rememberMe: boolean = false) => {
          set({ isLoading: true, authRecoveryError: null });
          let session: Session | null = null;

          try {
            // Clear stale client auth state before Supabase writes a fresh session.
            clearAllAuthStorage();
            clearDashboardToastSessionState();
            if (rememberMe) {
              localStorage.setItem(AUTH_REMEMBER_KEY, 'true');
            } else {
              localStorage.removeItem(AUTH_REMEMBER_KEY);
            }

            session = await signInUseCase(email, password);
            const user = await loadActiveProfileUseCase();

            saveOfflineAuthUser(user);
            setOfflineAuthSessionActive(false);

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              isHydrated: true,
              authRecoveryError: null,
            });
          } catch (error) {
            if (session && !(error instanceof TerminalAuthError)) {
              const revision = ++authRevision;
              cancelProfileRetry();
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                isHydrated: false,
                authRecoveryError: null,
              });
              scheduleProfileLoad(set, session, revision);
              return;
            }

            if (session) {
              ++authRevision;
              cancelProfileRetry();
              await signOutUseCase().catch((signOutError) => {
                logAsyncSideEffectError(signOutError, {
                  operation: 'supabaseSignOutAfterTerminalLoginFailure',
                  entity: 'auth',
                });
              });
              setSignedOutState(set);
            } else {
              set({ isLoading: false, isHydrated: true, authRecoveryError: null });
            }

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
            authRecoveryError: null,
          });
          setOfflineAuthSessionActive(true);
        },

        logout: async () => {
          try {
            await signOutUseCase();
          } catch (error) {
            logAsyncSideEffectError(error, { operation: 'logout', entity: 'auth' });
          } finally {
            ++authRevision;
            cancelProfileRetry();
            clearDashboardToastSessionState();
            setSignedOutState(set);
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
          if (authListenerInitialized) return;

          authListenerInitialized = true;
          clearAllAuthStorage();
          onAuthStateChangeUseCase((event, session) => {
            handleAuthEvent(set, event, session);
          });
        },

        retryAuth: () => {
          retryCurrentSession(set);
        },
      })
  )
);
