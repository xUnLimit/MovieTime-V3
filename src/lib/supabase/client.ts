import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const REMEMBER_KEY = 'auth-remember';

let browserClient: SupabaseClient<Database> | null = null;

function isRemembered(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(REMEMBER_KEY) === 'true';
}

// Storage adapter that routes Supabase auth tokens to localStorage when
// "Recordarme" is on, or sessionStorage otherwise. The active storage is
// resolved on every call so toggling rememberMe before signIn is enough.
const rememberAwareStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return (
      window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
    );
  },
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    if (isRemembered()) {
      window.sessionStorage.removeItem(key);
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
      window.sessionStorage.setItem(key, value);
    }
  },
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local.'
    );
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: rememberAwareStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver);
  },
});

export type { Database } from './database.types';
