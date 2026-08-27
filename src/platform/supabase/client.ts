import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import {
  AUTH_REMEMBER_KEY,
  createRememberAwareStorage,
  getSupabaseAuthStorageKey,
  migrateLegacyAuthCookies,
} from './auth-storage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient<Database> | null = null;

function isRemembered(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(AUTH_REMEMBER_KEY) === 'true';
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local.'
    );
  }

  if (!browserClient) {
    const storageKey = getSupabaseAuthStorageKey(supabaseUrl);
    const browserStorage =
      typeof window === 'undefined'
        ? undefined
        : createRememberAwareStorage({
            localStorage: window.localStorage,
            sessionStorage: window.sessionStorage,
            isRemembered,
          });

    if (typeof window !== 'undefined') {
      migrateLegacyAuthCookies({
        storageKey,
        localStorage: window.localStorage,
        sessionStorage: window.sessionStorage,
        isRemembered,
        cookieDocument: window.document,
        secure: window.location.protocol === 'https:',
      });
    }

    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: browserStorage,
        storageKey,
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
