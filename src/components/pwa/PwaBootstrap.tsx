'use client';

import { useEffect } from 'react';

import { useAuthStore } from '@/store/authStore';
import { usePwaStore } from '@/store/pwaStore';

const OFFLINE_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 min

export function PwaBootstrap() {
  const { isAuthenticated, isHydrated } = useAuthStore();
  const {
    hydrateOfflineState,
    isOnline,
    isSupported,
    lastSyncAt,
    syncStatus,
    setInstalled,
    setNetworkStatus,
    setNotificationPermission,
    syncOfflineData,
  } = usePwaStore();

  useEffect(() => {
    hydrateOfflineState().catch(() => undefined);
  }, [hydrateOfflineState]);

  useEffect(() => {
    if (!isSupported || typeof navigator === 'undefined') return;

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Error registering service worker:', error);
    });
  }, [isSupported]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateInstalledState = () => {
      setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    };

    const updateNetworkStatus = () => {
      setNetworkStatus(navigator.onLine);
    };

    updateInstalledState();
    updateNetworkStatus();
    setNotificationPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    window.addEventListener('appinstalled', updateInstalledState);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      window.removeEventListener('appinstalled', updateInstalledState);
    };
  }, [setInstalled, setNetworkStatus, setNotificationPermission]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !isOnline) {
      return;
    }
    if (syncStatus === 'syncing') return;

    const stale = !lastSyncAt || Date.now() - lastSyncAt.getTime() > OFFLINE_SYNC_INTERVAL_MS;
    if (!stale) return;

    syncOfflineData().catch((error) => {
      console.error('Error syncing offline data:', error);
    });
  }, [isAuthenticated, isHydrated, isOnline, lastSyncAt, syncOfflineData, syncStatus]);

  return null;
}
