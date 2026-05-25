import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { offlineCopy } from '@/lib/pwa/offline-facade';
import type { OfflineSyncProgress, OfflineSyncStatus } from '@/lib/pwa/offline-types';

interface PwaState {
  isOnline: boolean;
  isSupported: boolean;
  isPushSupported: boolean;
  isInstalled: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  lastSyncAt: Date | null;
  syncStatus: OfflineSyncStatus;
  syncProgress: OfflineSyncProgress | null;
  isOfflineReady: boolean;
  error: string | null;
  setNetworkStatus: (isOnline: boolean) => void;
  setInstalled: (installed: boolean) => void;
  setNotificationPermission: (permission: NotificationPermission | 'unsupported') => void;
  hydrateOfflineState: () => Promise<void>;
  syncOfflineData: () => Promise<void>;
}

function getDisplayModeInstalled() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

export const usePwaStore = create<PwaState>()(
  devtools(
    (set) => ({
      isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
      isSupported: typeof window !== 'undefined' && 'serviceWorker' in navigator,
      isPushSupported:
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window,
      isInstalled: getDisplayModeInstalled(),
      notificationPermission:
        typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
      lastSyncAt: null,
      syncStatus: 'idle',
      syncProgress: null,
      isOfflineReady: false,
      error: null,
      setNetworkStatus: (isOnline) => set({ isOnline }),
      setInstalled: (isInstalled) => set({ isInstalled }),
      setNotificationPermission: (notificationPermission) => set({ notificationPermission }),
      hydrateOfflineState: async () => {
        const meta = await offlineCopy.status();
        set({
          lastSyncAt: meta?.syncedAt ? new Date(meta.syncedAt) : null,
          isOfflineReady: meta.isReady,
        });
      },
      syncOfflineData: async () => {
        set({
          syncStatus: 'syncing',
          syncProgress: {
            phase: 'preparing',
            percentage: 0,
            completed: 0,
            total: 1,
            label: 'Preparando sincronizacion offline',
          },
          error: null,
        });
        try {
          const snapshot = await offlineCopy.prepare((syncProgress) => {
            set({ syncProgress });
          });
          set({
            syncStatus: 'ready',
            syncProgress: null,
            lastSyncAt: new Date(snapshot.syncedAt),
            isOfflineReady: true,
            error: null,
          });
        } catch (error) {
          set({
            syncStatus: 'error',
            syncProgress: null,
            error: error instanceof Error ? error.message : 'No se pudo sincronizar el modo offline.',
          });
          throw error;
        }
      },
    }),
    { name: 'pwa-store' }
  )
);
