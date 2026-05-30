import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearOfflineAuthUser,
  getOfflineAuthDecision,
  hasOfflineAuthUser,
  isOfflineAuthSessionActive,
  loadOfflineAuthUser,
  saveOfflineAuthUser,
  setOfflineAuthSessionActive,
} from './offline-auth';

const user = {
  id: 'user-1',
  email: 'admin@movietime.test',
  displayName: 'Admin',
  role: 'admin' as const,
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('getOfflineAuthDecision', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation((key) => storage.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key) => {
      storage.delete(key);
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage.clear();
    });
  });

  it('preserves persisted auth when the app is offline', () => {
    expect(getOfflineAuthDecision({ isOnline: false, hasPersistedUser: true })).toBe('preserve');
  });

  it('ignores offline auth loss when no user was persisted', () => {
    expect(getOfflineAuthDecision({ isOnline: false, hasPersistedUser: false })).toBe('ignore');
  });

  it('clears auth on online auth loss or profile failure', () => {
    expect(getOfflineAuthDecision({ isOnline: true, hasPersistedUser: true })).toBe('clear');
  });

  it('does not persist a local user fallback in browser storage', () => {
    saveOfflineAuthUser(user);

    expect(hasOfflineAuthUser()).toBe(false);
    expect(loadOfflineAuthUser()).toBeNull();
  });

  it('clears the local user fallback on logout', () => {
    saveOfflineAuthUser(user);
    setOfflineAuthSessionActive(true);
    clearOfflineAuthUser();

    expect(hasOfflineAuthUser()).toBe(false);
    expect(isOfflineAuthSessionActive()).toBe(false);
  });

  it('tracks when the current auth state is local offline only', () => {
    expect(isOfflineAuthSessionActive()).toBe(false);

    setOfflineAuthSessionActive(true);
    expect(isOfflineAuthSessionActive()).toBe(true);

    setOfflineAuthSessionActive(false);
    expect(isOfflineAuthSessionActive()).toBe(false);
  });
});
