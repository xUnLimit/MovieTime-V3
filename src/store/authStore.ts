import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User } from '@/types';
import { 
  signIn, 
  signOut as firebaseSignOut, 
  onAuthStateChange, 
  convertFirebaseUser,
  convertFirebaseUserAsync 
} from '@/lib/firebase/auth';

const STORAGE_KEY = 'auth-storage';
const REMEMBER_KEY = 'auth-remember';
let authListenerInitialized = false;

/**
 * Returns the active storage based on the "Recordarme" flag.
 * - rememberMe = true  → localStorage  (persists across browser close)
 * - rememberMe = false → sessionStorage (cleared on browser close)
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
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;

  // Actions
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  checkAuth: () => void;
  setHydrated: (hydrated: boolean) => void;
  initAuth: () => void;
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
            const firebaseUser = await signIn(email, password, rememberMe);
            // Use async version to get latest custom claims
            const user = await convertFirebaseUserAsync(firebaseUser);

            // Clear old data from both storages first
            clearAllAuthStorage();

            // Set the remember flag BEFORE Zustand persists (so getActiveStorage picks it up)
            if (rememberMe) {
              localStorage.setItem(REMEMBER_KEY, 'true');
            }

            set({
              user,
              isAuthenticated: true,
              isLoading: false
            });
          } catch (error) {
            set({ isLoading: false });
            const message = error instanceof Error ? error.message : 'Error al iniciar sesión';
            throw new Error(message);
          }
        },

        logout: async () => {
          try {
            await firebaseSignOut();
            clearAllAuthStorage();
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false
            });
          } catch (error) {
            console.error('Error logging out:', error);
            const message = error instanceof Error ? error.message : 'Error al cerrar sesión';
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
          onAuthStateChange(async (firebaseUser) => {
            if (firebaseUser) {
              try {
                // IMPORTANT: Fetch claims asynchronously to ensure correct role
                const user = await convertFirebaseUserAsync(firebaseUser);
                set({ user, isAuthenticated: true, isLoading: false });
              } catch (error) {
                console.error('Error hydrating user claims:', error);
                // Fallback to sync version if async fails
                const user = convertFirebaseUser(firebaseUser);
                set({ user, isAuthenticated: true, isLoading: false });
              }
            } else {
              // Firebase has no user — clear everything
              clearAllAuthStorage();
              set({ user: null, isAuthenticated: false, isLoading: false });
            }
          });
        }
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
          isAuthenticated: state.isAuthenticated
        }) as AuthState,
        onRehydrateStorage: () => {
          return (state) => {
            state?.setHydrated(true);
          };
        }
      }
    )
  )
);
