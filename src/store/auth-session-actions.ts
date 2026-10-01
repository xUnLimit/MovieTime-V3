import { TerminalAuthError, clearLocalSessionUseCase, getCurrentSessionUseCase, loadActiveProfileUseCase, signOutUseCase } from '@/application/use-cases/auth-use-cases';
import { logAsyncSideEffectError } from '@/platform/utils/safety';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { AuthSetter, AuthState } from './auth-store-types';

const DASHBOARD_TOAST_SESSION_KEY = 'movietime:dashboard-toast-state';
const AUTH_RECOVERY_MESSAGE =
  'No pudimos validar tu sesión. Revisa la conexión e inténtalo nuevamente.';
const PROFILE_RETRY_DELAYS_MS = [0, 250, 750] as const;
let authListenerInitialized = false;
let authRevision = 0;
let profileRetryTimer: ReturnType<typeof setTimeout> | null = null;

/** Clear auth data from both storages. Preserves the rememberMe preference
 * so the next login defaults to the user's last choice. */
export function clearAllAuthStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth-storage');
  sessionStorage.removeItem('auth-storage');
}

export function clearDashboardToastSessionState() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DASHBOARD_TOAST_SESSION_KEY);
}


export function cancelProfileRetry() {
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

export function setSignedOutState(set: AuthSetter) {
  clearDeviceAuthStorage();
  set({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isHydrated: true,
    authRecoveryError: null,
  });
}

export function scheduleProfileLoad(
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

export function handleAuthEvent(set: AuthSetter, getState: () => AuthState, event: AuthChangeEvent, session: Session | null) {
  const revision = ++authRevision;
  const current = getState();
  if (event === 'SIGNED_IN' && session && current.isLoading) {
    return;
  }

  cancelProfileRetry();

  if (!session) {
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

export function retryCurrentSession(set: AuthSetter) {
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

export function nextAuthRevision() { return ++authRevision; }
export function isAuthListenerInitialized() { return authListenerInitialized; }
export function markAuthListenerInitialized() { authListenerInitialized = true; }
