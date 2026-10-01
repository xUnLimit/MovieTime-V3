import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { User } from '@/types';
import type { AuthState } from './auth-store-types';
import { clearAllAuthStorage, clearDashboardToastSessionState, cancelProfileRetry, handleAuthEvent, isAuthListenerInitialized, markAuthListenerInitialized, nextAuthRevision, retryCurrentSession, scheduleProfileLoad, setSignedOutState } from './auth-session-actions';
import {
  TerminalAuthError,
  AUTH_REMEMBER_KEY,
  loadActiveProfileUseCase,
  onAuthStateChangeUseCase,
  signInUseCase,
  signOutUseCase,
} from '@/application/use-cases/auth-use-cases';
import { logAsyncSideEffectError } from '@/platform/utils/safety';
import type { Session } from '@supabase/supabase-js';

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

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              isHydrated: true,
              authRecoveryError: null,
            });
          } catch (error) {
            if (session && !(error instanceof TerminalAuthError)) {
              const revision = nextAuthRevision();
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
              nextAuthRevision();
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

        logout: async () => {
          try {
            await signOutUseCase();
          } catch (error) {
            logAsyncSideEffectError(error, { operation: 'logout', entity: 'auth' });
          } finally {
            nextAuthRevision();
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
          if (isAuthListenerInitialized()) return;

          markAuthListenerInitialized();
          clearAllAuthStorage();
          onAuthStateChangeUseCase((event, session) => {
            handleAuthEvent(set, useAuthStore.getState, event, session);
          });
        },

        retryAuth: () => {
          retryCurrentSession(set);
        },
      })
  )
);
