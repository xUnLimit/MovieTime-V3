import { describe, expect, it } from 'vitest';

import {
  createRememberAwareStorage,
  getSupabaseAuthStorageKey,
  migrateLegacyAuthCookies,
} from './auth-storage';

const AUTH_KEY = 'sb-project-auth-token';
const SESSION_JSON = JSON.stringify({
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_at: 1_900_000_000,
  token_type: 'bearer',
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function toBase64Url(value: string) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function createCookieDocument(initialCookie: string) {
  const writes: string[] = [];
  return {
    document: {
      get cookie() {
        return initialCookie;
      },
      set cookie(value: string) {
        writes.push(value);
      },
    },
    writes,
  };
}

describe('remember-aware Supabase auth storage', () => {
  it('derives the same auth key Supabase uses for a project URL', () => {
    expect(getSupabaseAuthStorageKey('https://project.supabase.co')).toBe(AUTH_KEY);
  });

  it('stores remembered sessions in localStorage and removes stale session copies', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    sessionStorage.setItem(AUTH_KEY, 'stale-session');
    const storage = createRememberAwareStorage({
      localStorage,
      sessionStorage,
      isRemembered: () => true,
    });

    storage.setItem(AUTH_KEY, SESSION_JSON);

    expect(localStorage.getItem(AUTH_KEY)).toBe(SESSION_JSON);
    expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('stores non-remembered sessions in sessionStorage and removes stale local copies', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    localStorage.setItem(AUTH_KEY, 'stale-local');
    const storage = createRememberAwareStorage({
      localStorage,
      sessionStorage,
      isRemembered: () => false,
    });

    storage.setItem(AUTH_KEY, SESSION_JSON);

    expect(sessionStorage.getItem(AUTH_KEY)).toBe(SESSION_JSON);
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
  });

  it('falls back to either storage and removes auth values from both', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    sessionStorage.setItem(AUTH_KEY, SESSION_JSON);
    const storage = createRememberAwareStorage({
      localStorage,
      sessionStorage,
      isRemembered: () => true,
    });

    expect(storage.getItem(AUTH_KEY)).toBe(SESSION_JSON);
    storage.removeItem(AUTH_KEY);

    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
  });
});

describe('legacy Supabase cookie migration', () => {
  it('reassembles and migrates a valid chunked cookie before expiring its chunks', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const encoded = `base64-${toBase64Url(SESSION_JSON)}`;
    const midpoint = Math.ceil(encoded.length / 2);
    const { document: cookieDocument, writes } = createCookieDocument(
      `${AUTH_KEY}.0=${encoded.slice(0, midpoint)}; ${AUTH_KEY}.1=${encoded.slice(midpoint)}`
    );

    const migrated = migrateLegacyAuthCookies({
      storageKey: AUTH_KEY,
      localStorage,
      sessionStorage,
      isRemembered: () => true,
      cookieDocument,
      secure: true,
    });

    expect(migrated).toBe(true);
    expect(localStorage.getItem(AUTH_KEY)).toBe(SESSION_JSON);
    expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
    expect(writes).toHaveLength(2);
    expect(writes[0]).toContain(`${AUTH_KEY}.0=;`);
    expect(writes[0]).toContain('Max-Age=0');
    expect(writes[0]).toContain('Secure');
    expect(writes[1]).toContain(`${AUTH_KEY}.1=;`);
  });

  it('does not overwrite storage or delete cookies when the legacy payload is invalid', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    const { document: cookieDocument, writes } = createCookieDocument(
      `${AUTH_KEY}=base64-${toBase64Url(JSON.stringify({ access_token: 'missing-fields' }))}`
    );

    const migrated = migrateLegacyAuthCookies({
      storageKey: AUTH_KEY,
      localStorage,
      sessionStorage,
      isRemembered: () => true,
      cookieDocument,
      secure: false,
    });

    expect(migrated).toBe(false);
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
    expect(writes).toEqual([]);
  });

  it('does not replace a session already stored by the new client', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();
    localStorage.setItem(AUTH_KEY, SESSION_JSON);
    const { document: cookieDocument, writes } = createCookieDocument(
      `${AUTH_KEY}=base64-${toBase64Url(SESSION_JSON)}`
    );

    const migrated = migrateLegacyAuthCookies({
      storageKey: AUTH_KEY,
      localStorage,
      sessionStorage,
      isRemembered: () => true,
      cookieDocument,
      secure: false,
    });

    expect(migrated).toBe(false);
    expect(writes).toEqual([]);
  });
});
