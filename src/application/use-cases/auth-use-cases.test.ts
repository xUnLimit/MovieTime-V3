import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@/types';

const authMocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/platform/supabase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/supabase/auth')>()),
  ...authMocks,
}));

import { InvalidAuthSessionError } from '@/platform/supabase/auth';
import { readChatDraft, writeChatDraft } from '@/modules/whatsapp/chat-drafts';

import {
  TerminalAuthError,
  clearLocalSessionUseCase,
  getCurrentSessionUseCase,
  loadActiveProfileUseCase,
} from './auth-use-cases';

const activeUser: User = {
  id: 'user-1',
  email: 'admin@movietime.test',
  displayName: 'Admin',
  role: 'admin',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

// Storage en memoria real (con length/key), a diferencia del mock global del
// proyecto que no implementa esas dos propiedades.
function fakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
  };
}

describe('auth use cases', () => {
  beforeEach(() => {
    authMocks.getCurrentProfile.mockReset();
    authMocks.getCurrentSession.mockReset();
  });

  it('clears chat drafts (which may hold a filled-in service password) on logout', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    writeChatDraft('507', 'Clave: clave-demo');

    clearLocalSessionUseCase();

    expect(readChatDraft('507')).toBe('');
    vi.unstubAllGlobals();
  });

  it('returns the current persisted session', async () => {
    const session = { access_token: 'access-token' };
    authMocks.getCurrentSession.mockResolvedValue(session);

    await expect(getCurrentSessionUseCase()).resolves.toBe(session);
  });

  it('classifies a missing profile as a terminal auth failure', async () => {
    authMocks.getCurrentProfile.mockResolvedValue(null);

    await expect(loadActiveProfileUseCase()).rejects.toBeInstanceOf(TerminalAuthError);
  });

  it('classifies an inactive profile as a terminal auth failure', async () => {
    authMocks.getCurrentProfile.mockResolvedValue({ ...activeUser, active: false });

    await expect(loadActiveProfileUseCase()).rejects.toBeInstanceOf(TerminalAuthError);
  });

  it('does not turn transient profile errors into terminal failures', async () => {
    const transientError = new Error('fetch failed');
    authMocks.getCurrentProfile.mockRejectedValue(transientError);

    await expect(loadActiveProfileUseCase()).rejects.toBe(transientError);
  });

  it('classifies a rejected persisted token as a terminal auth failure', async () => {
    authMocks.getCurrentProfile.mockRejectedValue(
      new InvalidAuthSessionError('La sesion guardada ya no es valida.')
    );

    await expect(loadActiveProfileUseCase()).rejects.toBeInstanceOf(TerminalAuthError);
  });
});
