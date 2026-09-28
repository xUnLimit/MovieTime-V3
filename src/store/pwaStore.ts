import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface PwaState {
  isOnline: boolean;
  isSupported: boolean;
  isPushSupported: boolean;
  isInstalled: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  setNetworkStatus: (isOnline: boolean) => void;
  setInstalled: (installed: boolean) => void;
  setNotificationPermission: (permission: NotificationPermission | 'unsupported') => void;
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
      setNetworkStatus: (isOnline) => set({ isOnline }),
      setInstalled: (isInstalled) => set({ isInstalled }),
      setNotificationPermission: (notificationPermission) => set({ notificationPermission }),
    }),
    { name: 'pwa-store' }
  )
);
