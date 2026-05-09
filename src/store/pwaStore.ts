import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { getOfflineSnapshotMeta } from '@/lib/pwa/offline-read';
import { syncOfflineSnapshot } from '@/lib/pwa/offline-sync';
import type { OfflineSyncStatus } from '@/lib/pwa/offline-types';

interface PwaState {
  isOnline: boolean;
  isSupported: boolean;
  isPushSupported: boolean;
  isInstalled: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  lastSyncAt: Date | null;
  syncStatus: OfflineSyncStatus;
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
      isOfflineReady: false,
      error: null,
      setNetworkStatus: (isOnline) => set({ isOnline }),
      setInstalled: (isInstalled) => set({ isInstalled }),
      setNotificationPermission: (notificationPermission) => set({ notificationPermission }),
      hydrateOfflineState: async () => {
        const meta = await getOfflineSnapshotMeta();
        set({
          lastSyncAt: meta?.syncedAt ? new Date(meta.syncedAt) : null,
          isOfflineReady: Boolean(meta?.syncedAt),
        });
      },
      syncOfflineData: async () => {
        set({ syncStatus: 'syncing', error: null });
        try {
          const snapshot = await syncOfflineSnapshot();
          set({
            syncStatus: 'ready',
            lastSyncAt: new Date(snapshot.syncedAt),
            isOfflineReady: true,
            error: null,
          });
        } catch (error) {
          set({
            syncStatus: 'error',
            error: error instanceof Error ? error.message : 'No se pudo sincronizar el modo offline.',
          });
          throw error;
        }
      },
    }),
    { name: 'pwa-store' }
  )
);
