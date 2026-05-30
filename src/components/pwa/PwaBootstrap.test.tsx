import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/config', () => ({
  env: {
    isDevelopment: true,
    enableDevServiceWorker: false,
  },
}));

const pwaStoreMocks = vi.hoisted(() => ({
  hydrateOfflineState: vi.fn(),
  setInstalled: vi.fn(),
  setNetworkStatus: vi.fn(),
  setNotificationPermission: vi.fn(),
}));

vi.mock('@/store/pwaStore', () => ({
  usePwaStore: () => ({
    hydrateOfflineState: pwaStoreMocks.hydrateOfflineState,
    isSupported: true,
    setInstalled: pwaStoreMocks.setInstalled,
    setNetworkStatus: pwaStoreMocks.setNetworkStatus,
    setNotificationPermission: pwaStoreMocks.setNotificationPermission,
  }),
}));

import { PwaBootstrap } from './PwaBootstrap';

describe('PwaBootstrap', () => {
  const register = vi.fn();
  const unregister = vi.fn();
  const getRegistrations = vi.fn();
  const cachesKeys = vi.fn();
  const cachesDelete = vi.fn();

  beforeEach(() => {
    pwaStoreMocks.hydrateOfflineState.mockReset().mockResolvedValue(undefined);
    pwaStoreMocks.setInstalled.mockReset();
    pwaStoreMocks.setNetworkStatus.mockReset();
    pwaStoreMocks.setNotificationPermission.mockReset();
    register.mockReset();
    unregister.mockReset().mockResolvedValue(true);
    getRegistrations.mockReset().mockResolvedValue([{ unregister }]);
    cachesKeys.mockReset().mockResolvedValue(['movietime-pwa-v3', 'other-cache']);
    cachesDelete.mockReset().mockResolvedValue(true);

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register,
        getRegistrations,
      },
    });

    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: cachesKeys,
        delete: cachesDelete,
      },
    });
  });

  it('does not register the service worker in development without the opt-in flag', async () => {
    render(<PwaBootstrap />);

    await waitFor(() => {
      expect(getRegistrations).toHaveBeenCalled();
    });

    expect(register).not.toHaveBeenCalled();
    expect(unregister).toHaveBeenCalled();
    expect(cachesDelete).toHaveBeenCalledWith('movietime-pwa-v3');
    expect(cachesDelete).not.toHaveBeenCalledWith('other-cache');
  });
});
