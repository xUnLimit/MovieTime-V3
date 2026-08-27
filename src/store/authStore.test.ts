import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from '@supabase/supabase-js';
import type { User } from '@/types';

const authUseCaseMocks = vi.hoisted(() => ({
  clearLocalSessionUseCase: vi.fn(),
  getCurrentSessionUseCase: vi.fn(),
  loadActiveProfileUseCase: vi.fn(),
  onAuthStateChangeUseCase: vi.fn(),
  signInUseCase: vi.fn(),
  signOutUseCase: vi.fn(),
}));

vi.mock('@/application/use-cases/auth-use-cases', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/application/use-cases/auth-use-cases')>();
  return {
    ...original,
    ...authUseCaseMocks,
  };
});

vi.mock('@/modules/pwa/offline-auth', () => ({
  clearOfflineAuthUser: vi.fn(),
  getOfflineAuthDecision: vi.fn(() => 'clear'),
  loadOfflineAuthUser: vi.fn(() => null),
  saveOfflineAuthUser: vi.fn(),
  setOfflineAuthSessionActive: vi.fn(),
}));

vi.mock('@/platform/utils/safety', () => ({
  logAsyncSideEffectError: vi.fn(),
}));

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: 1_900_000_000,
  token_type: 'bearer',
  user: { id: 'user-1' },
} as Session;

const user: User = {
  id: 'user-1',
  email: 'admin@movietime.test',
  displayName: 'Admin',
  role: 'admin',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

type AuthListener = (event: string, session: Session | null) => void;
type AuthStoreModule = typeof import('./authStore');

describe('auth store session initialization', () => {
  let listener: AuthListener;
  let useAuthStore: AuthStoreModule['useAuthStore'];
  let TerminalAuthError: typeof import('@/application/use-cases/auth-use-cases').TerminalAuthError;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
    authUseCaseMocks.signOutUseCase.mockResolvedValue(undefined);
    authUseCaseMocks.clearLocalSessionUseCase.mockImplementation(() => undefined);
    authUseCaseMocks.getCurrentSessionUseCase.mockResolvedValue(session);
    authUseCaseMocks.onAuthStateChangeUseCase.mockImplementation((callback: AuthListener) => {
      listener = callback;
      return vi.fn();
    });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    ({ useAuthStore } = await import('./authStore'));
    ({ TerminalAuthError } = await import('@/application/use-cases/auth-use-cases'));
    useAuthStore.getState().initAuth();
  });

  it('returns from the Supabase callback before loading the profile', async () => {
    authUseCaseMocks.loadActiveProfileUseCase.mockResolvedValue(user);

    const result = listener('INITIAL_SESSION', session);

    expect(result).toBeUndefined();
    expect(authUseCaseMocks.loadActiveProfileUseCase).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(authUseCaseMocks.loadActiveProfileUseCase).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user,
      isAuthenticated: true,
      isHydrated: true,
      authRecoveryError: null,
    });
  });

  it('preserves the stored session and never signs out after recoverable failures', async () => {
    authUseCaseMocks.loadActiveProfileUseCase.mockRejectedValue(new Error('fetch failed'));

    listener('INITIAL_SESSION', session);
    await vi.runAllTimersAsync();

    expect(authUseCaseMocks.loadActiveProfileUseCase).toHaveBeenCalledTimes(3);
    expect(authUseCaseMocks.signOutUseCase).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      isHydrated: true,
      authRecoveryError: 'No pudimos validar tu sesión. Revisa la conexión e inténtalo nuevamente.',
    });
  });

  it('ends only the local session for a confirmed terminal profile failure', async () => {
    authUseCaseMocks.loadActiveProfileUseCase.mockRejectedValue(
      new TerminalAuthError('Este usuario esta inactivo.')
    );

    listener('INITIAL_SESSION', session);
    await vi.runAllTimersAsync();

    expect(authUseCaseMocks.signOutUseCase).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      isHydrated: true,
      authRecoveryError: null,
    });
  });

  it('clears application state immediately on a signed-out event', () => {
    useAuthStore.setState({ user, isAuthenticated: true, isHydrated: true });

    listener('SIGNED_OUT', null);

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      isHydrated: true,
      authRecoveryError: null,
    });
  });

  it('can retry a recoverable restoration without asking for credentials', async () => {
    authUseCaseMocks.loadActiveProfileUseCase
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue(user);

    listener('INITIAL_SESSION', session);
    await vi.runAllTimersAsync();
    useAuthStore.getState().retryAuth();
    await vi.runAllTimersAsync();

    expect(authUseCaseMocks.getCurrentSessionUseCase).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user,
      isAuthenticated: true,
      isHydrated: true,
      authRecoveryError: null,
    });
  });

  it('preserves a newly created session when the first profile request fails transiently', async () => {
    authUseCaseMocks.signInUseCase.mockResolvedValue(session);
    authUseCaseMocks.loadActiveProfileUseCase
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue(user);

    await expect(
      useAuthStore.getState().login('admin@movietime.test', 'secret', true)
    ).resolves.toBeUndefined();
    expect(authUseCaseMocks.signOutUseCase).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    expect(useAuthStore.getState()).toMatchObject({
      user,
      isAuthenticated: true,
      isHydrated: true,
      authRecoveryError: null,
    });
  });

  it('always clears the local session and store even when Supabase sign-out has no network', async () => {
    authUseCaseMocks.signOutUseCase.mockRejectedValue(new Error('network unavailable'));
    useAuthStore.setState({ user, isAuthenticated: true, isHydrated: true });

    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();

    expect(authUseCaseMocks.clearLocalSessionUseCase).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      isHydrated: true,
      authRecoveryError: null,
    });
  });
});
