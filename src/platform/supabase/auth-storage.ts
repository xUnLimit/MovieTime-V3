export const AUTH_REMEMBER_KEY = 'auth-remember';

const BASE64_PREFIX = 'base64-';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type CookieDocument = {
  cookie: string;
};

type RememberAwareStorageInput = {
  localStorage: StorageLike;
  sessionStorage: StorageLike;
  isRemembered: () => boolean;
};

type LegacyCookieMigrationInput = RememberAwareStorageInput & {
  storageKey: string;
  cookieDocument: CookieDocument;
  secure: boolean;
};

type SupabaseAuthCleanupInput = {
  storageKey: string;
  localStorage: StorageLike;
  sessionStorage: StorageLike;
  cookieDocument: CookieDocument;
  secure: boolean;
};
type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<StoredSession>;
  return (
    typeof session.access_token === 'string' &&
    session.access_token.length > 0 &&
    typeof session.refresh_token === 'string' &&
    session.refresh_token.length > 0 &&
    typeof session.expires_at === 'number' &&
    Number.isFinite(session.expires_at)
  );
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookies(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    cookies.set(name, safeDecodeURIComponent(part.slice(separator + 1).trim()));
  }
  return cookies;
}

function getLegacyCookieParts(cookies: Map<string, string>, storageKey: string) {
  const wholeValue = cookies.get(storageKey);
  if (wholeValue !== undefined) {
    return [{ name: storageKey, value: wholeValue }];
  }

  const chunkPrefix = `${storageKey}.`;
  const chunks = [...cookies.entries()]
    .map(([name, value]) => {
      if (!name.startsWith(chunkPrefix)) return null;
      const suffix = name.slice(chunkPrefix.length);
      return /^\d+$/.test(suffix) ? { name, value, index: Number(suffix) } : null;
    })
    .filter((chunk): chunk is { name: string; value: string; index: number } => chunk !== null)
    .sort((left, right) => left.index - right.index);

  if (chunks.length === 0 || chunks.some((chunk, index) => chunk.index !== index)) {
    return [];
  }
  return chunks.map(({ name, value }) => ({ name, value }));
}

function decodeBase64Url(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeLegacyCookieValue(value: string): string {
  return value.startsWith(BASE64_PREFIX)
    ? decodeBase64Url(value.slice(BASE64_PREFIX.length))
    : value;
}

function expireCookie(name: string, cookieDocument: CookieDocument, secure: boolean) {
  cookieDocument.cookie = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function getSupabaseAuthStorageKey(supabaseUrl: string): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${projectRef}-auth-token`;
}

export function createRememberAwareStorage({
  localStorage,
  sessionStorage,
  isRemembered,
}: RememberAwareStorageInput) {
  const getLayers = () =>
    isRemembered()
      ? { primary: localStorage, secondary: sessionStorage }
      : { primary: sessionStorage, secondary: localStorage };

  return {
    getItem(key: string): string | null {
      const { primary, secondary } = getLayers();
      return primary.getItem(key) ?? secondary.getItem(key);
    },
    setItem(key: string, value: string): void {
      const { primary, secondary } = getLayers();
      primary.setItem(key, value);
      if (primary.getItem(key) === value) {
        secondary.removeItem(key);
      }
    },
    removeItem(key: string): void {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    },
  };
}

export function migrateLegacyAuthCookies({
  storageKey,
  localStorage,
  sessionStorage,
  isRemembered,
  cookieDocument,
  secure,
}: LegacyCookieMigrationInput): boolean {
  if (localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey)) {
    return false;
  }

  const parts = getLegacyCookieParts(parseCookies(cookieDocument.cookie), storageKey);
  if (parts.length === 0) return false;

  try {
    const rawSession = decodeLegacyCookieValue(parts.map((part) => part.value).join(''));
    if (!isStoredSession(JSON.parse(rawSession))) return false;

    const destination = isRemembered() ? localStorage : sessionStorage;
    destination.setItem(storageKey, rawSession);
    if (destination.getItem(storageKey) !== rawSession) return false;

    for (const part of parts) {
      expireCookie(part.name, cookieDocument, secure);
    }
    return true;
  } catch {
    return false;
  }
}

function clearLegacyAuthCookies(
  storageKey: string,
  cookieDocument: CookieDocument = document,
  secure = typeof location !== 'undefined' && location.protocol === 'https:'
): void {
  const cookiePrefix = `${storageKey}.`;
  const cookies = parseCookies(cookieDocument.cookie);
  for (const name of cookies.keys()) {
    const suffix = name.startsWith(cookiePrefix) ? name.slice(cookiePrefix.length) : '';
    if (name === storageKey || /^\d+$/.test(suffix)) {
      expireCookie(name, cookieDocument, secure);
    }
  }
}

export function clearSupabaseAuthArtifacts({
  storageKey,
  localStorage,
  sessionStorage,
  cookieDocument,
  secure,
}: SupabaseAuthCleanupInput): void {
  const authKeys = [storageKey, `${storageKey}-code-verifier`, `${storageKey}-user`];

  for (const key of authKeys) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    clearLegacyAuthCookies(key, cookieDocument, secure);
  }
}
