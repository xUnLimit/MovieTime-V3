import type { User } from '@/types';

export type OfflineAuthDecision = 'preserve' | 'clear' | 'ignore';

const OFFLINE_AUTH_USER_KEY = 'movietime-offline-auth-user';
const OFFLINE_AUTH_SESSION_KEY = 'movietime-offline-auth-session';

let offlineAuthSessionActive = false;

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

function getOfflineAuthStorage(): Storage | null {
  if (typeof localStorage !== 'undefined') return localStorage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis.localStorage === 'undefined') return null;
  return globalThis.localStorage;
}

export function saveOfflineAuthUser(user: User) {
  void user;
  clearOfflineAuthUser();
}

export function loadOfflineAuthUser(): User | null {
  clearOfflineAuthUser();
  return null;
}

export function hasOfflineAuthUser(): boolean {
  clearOfflineAuthUser();
  return false;
}

export function clearOfflineAuthUser() {
  const storage = getOfflineAuthStorage();
  storage?.removeItem(OFFLINE_AUTH_USER_KEY);
  storage?.removeItem(OFFLINE_AUTH_SESSION_KEY);
  offlineAuthSessionActive = false;
}

export function setOfflineAuthSessionActive(active: boolean) {
  offlineAuthSessionActive = active;
  getOfflineAuthStorage()?.removeItem(OFFLINE_AUTH_SESSION_KEY);
}

export function isOfflineAuthSessionActive(): boolean {
  return offlineAuthSessionActive;
}
