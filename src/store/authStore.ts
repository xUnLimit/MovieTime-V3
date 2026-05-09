import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User } from '@/types';
import {
  signIn,
  signOut as supabaseSignOut,
  getCurrentProfile,
  onAuthStateChange,
} from '@/lib/supabase/auth';
import {
  clearOfflineAuthUser,
  getOfflineAuthDecision,
  loadOfflineAuthUser,
  saveOfflineAuthUser,
  setOfflineAuthSessionActive,
} from '@/lib/pwa/offline-auth';

const STORAGE_KEY = 'auth-storage';
const REMEMBER_KEY = 'auth-remember';
let authListenerInitialized = false;

/**
 * Returns the active storage based on the "Recordarme" flag.
 * - rememberMe = true  -> localStorage  (persists across browser close)
 * - rememberMe = false -> sessionStorage (cleared on browser close)
 */
function getActiveStorage(): Storage {
  if (typeof window === 'undefined') return localStorage; // SSR fallback
  return localStorage.getItem(REMEMBER_KEY) === 'true'
    ? localStorage
    : sessionStorage;
}

/** Clear auth data from both storages */
function clearAllAuthStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  clearOfflineAuthUser();
}

function isBrowserOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
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

async function loadActiveProfile(): Promise<User> {
  const user = await getCurrentProfile();
  if (!user) {
    throw new Error('No se encontro un perfil activo para este usuario.');
  }
  if (!user.active) {
    throw new Error('Este usuario esta inactivo.');
  }
  return user;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isHydrated: false,

        login: async (email: string, password: string, rememberMe: boolean = false) => {
          set({ isLoading: true });

          try {
            await signIn(email, password);
            const user = await loadActiveProfile();

            // Clear old data from both storages first
            clearAllAuthStorage();

            // Set the remember flag BEFORE Zustand persists (so getActiveStorage picks it up)
            if (rememberMe) {
              localStorage.setItem(REMEMBER_KEY, 'true');
            }
            saveOfflineAuthUser(user);
            setOfflineAuthSessionActive(false);

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            await supabaseSignOut().catch(() => undefined);
            set({ isLoading: false });
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
          });
          setOfflineAuthSessionActive(true);
        },

        logout: async () => {
          try {
            await supabaseSignOut();
            clearAllAuthStorage();
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          } catch (error) {
            console.error('Error logging out:', error);
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
          if (authListenerInitialized) return;
          authListenerInitialized = true;
          onAuthStateChange(async (session) => {
            if (session) {
              try {
                const user = await loadActiveProfile();
                saveOfflineAuthUser(user);
                setOfflineAuthSessionActive(false);
                set({ user, isAuthenticated: true, isLoading: false });
              } catch (error) {
                void error;
                // Offline profile checks can fail even when the persisted session is valid.
                const current = useAuthStore.getState();
                const offlineUser = current.user ?? loadOfflineAuthUser();
                const decision = getOfflineAuthDecision({
                  isOnline: isBrowserOnline(),
                  hasPersistedUser: Boolean(offlineUser),
                });
                if (decision !== 'clear') {
                  set({
                    user: offlineUser,
                    isAuthenticated: decision === 'preserve',
                    isLoading: false,
                  });
                  setOfflineAuthSessionActive(decision === 'preserve');
                  return;
                }
                await supabaseSignOut().catch(() => undefined);
                clearAllAuthStorage();
                set({ user: null, isAuthenticated: false, isLoading: false });
              }
            } else {
              // Keep persisted auth while offline so read-only navigation keeps working.
              const current = useAuthStore.getState();
              const offlineUser = current.user ?? loadOfflineAuthUser();
              const decision = getOfflineAuthDecision({
                isOnline: isBrowserOnline(),
                hasPersistedUser: Boolean(offlineUser),
              });
              if (decision !== 'clear') {
                set({
                  user: offlineUser,
                  isAuthenticated: decision === 'preserve',
                  isLoading: false,
                });
                setOfflineAuthSessionActive(decision === 'preserve');
                return;
              }
              clearAllAuthStorage();
              set({ user: null, isAuthenticated: false, isLoading: false });
            }
          });
        },
      }),
      {
        name: STORAGE_KEY,
        storage: {
          getItem: (name) => {
            if (typeof window === 'undefined') return null;
            // Try localStorage first (remembered), then sessionStorage
            const raw = localStorage.getItem(name) ?? sessionStorage.getItem(name);
            return raw ? JSON.parse(raw) : null;
          },
          setItem: (name, value) => {
            if (typeof window === 'undefined') return;
            const storage = getActiveStorage();
            storage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => {
            if (typeof window === 'undefined') return;
            localStorage.removeItem(name);
            sessionStorage.removeItem(name);
          },
        },
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }) as AuthState,
        onRehydrateStorage: () => {
          return (state) => {
            if (state && !state.user && !isBrowserOnline()) {
              const offlineUser = loadOfflineAuthUser();
              if (offlineUser) {
                state.user = offlineUser;
                state.isAuthenticated = true;
                setOfflineAuthSessionActive(true);
              }
            }
            state?.setHydrated(true);
          };
        },
      }
    )
  )
);
