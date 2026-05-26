import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface NotificacionesState {
  error: string | null;
  setError: (error: string | null) => void;
}

export const useNotificacionesStore = create<NotificacionesState>()(
  subscribeWithSelector((set) => ({
    error: null,
    setError: (error) => set({ error }),
  }))
);
