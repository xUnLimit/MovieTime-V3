'use client';

import { useEffect } from 'react';

import { env } from '@/platform/config';
import { safeAsyncSideEffect } from '@/platform/utils/safety';
import { usePwaStore } from '@/store/pwaStore';

const MOVIETIME_CACHE_PREFIX = 'movietime-';

async function unregisterDevelopmentServiceWorkers() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (typeof window !== 'undefined' && 'caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(MOVIETIME_CACHE_PREFIX))
        .map((key) => caches.delete(key))
    );
  }
}

export function PwaBootstrap() {
  const {
    isSupported,
    setInstalled,
    setNetworkStatus,
    setNotificationPermission,
  } = usePwaStore();

  useEffect(() => {
    if (!isSupported || typeof navigator === 'undefined') return;

    if (env.isDevelopment && !env.enableDevServiceWorker) {
      safeAsyncSideEffect(unregisterDevelopmentServiceWorkers(), {
        operation: 'unregisterDevelopmentServiceWorkers',
        entity: 'pwa',
      });
      return;
    }

    safeAsyncSideEffect(navigator.serviceWorker.register('/sw.js'), {
      operation: 'registerServiceWorker',
      entity: 'pwa',
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

  return null;
}
