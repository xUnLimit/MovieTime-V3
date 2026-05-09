import type { User } from '@/types';

export type OfflineAuthDecision = 'preserve' | 'clear' | 'ignore';

const OFFLINE_AUTH_USER_KEY = 'movietime-offline-auth-user';
const OFFLINE_AUTH_SESSION_KEY = 'movietime-offline-auth-session';

type OfflineAuthDecisionInput = {
  isOnline: boolean;
  hasPersistedUser: boolean;
};

export function getOfflineAuthDecision({
  isOnline,
  hasPersistedUser,
}: OfflineAuthDecisionInput): OfflineAuthDecision {
  if (isOnline) return 'clear';
  return hasPersistedUser ? 'preserve' : 'ignore';
}

function normalizeDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(typeof value === 'string' || typeof value === 'number' ? value : Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeUser(value: unknown): User | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<User>;
  if (
    typeof record.id !== 'string' ||
    typeof record.email !== 'string' ||
    typeof record.displayName !== 'string' ||
    (record.role !== 'admin' && record.role !== 'operador') ||
    typeof record.active !== 'boolean'
  ) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    role: record.role,
    active: record.active,
    createdAt: normalizeDate(record.createdAt),
    updatedAt: normalizeDate(record.updatedAt),
  };
}

function getOfflineAuthStorage(): Storage | null {
  if (typeof localStorage !== 'undefined') return localStorage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis.localStorage === 'undefined') return null;
  return globalThis.localStorage;
}

export function saveOfflineAuthUser(user: User) {
  getOfflineAuthStorage()?.setItem(OFFLINE_AUTH_USER_KEY, JSON.stringify(user));
}

export function loadOfflineAuthUser(): User | null {
  const raw = getOfflineAuthStorage()?.getItem(OFFLINE_AUTH_USER_KEY);
  if (!raw) return null;

  try {
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function hasOfflineAuthUser(): boolean {
  return loadOfflineAuthUser() !== null;
}

export function clearOfflineAuthUser() {
  const storage = getOfflineAuthStorage();
  storage?.removeItem(OFFLINE_AUTH_USER_KEY);
  storage?.removeItem(OFFLINE_AUTH_SESSION_KEY);
}

export function setOfflineAuthSessionActive(active: boolean) {
  const storage = getOfflineAuthStorage();
  if (!storage) return;
  if (active) {
    storage.setItem(OFFLINE_AUTH_SESSION_KEY, 'true');
  } else {
    storage.removeItem(OFFLINE_AUTH_SESSION_KEY);
  }
}

export function isOfflineAuthSessionActive(): boolean {
  return getOfflineAuthStorage()?.getItem(OFFLINE_AUTH_SESSION_KEY) === 'true';
}
