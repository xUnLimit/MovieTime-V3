import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import type { Servicio } from '@/types/servicios';

interface ServiciosState {
  error: string | null;
  selectedServicio: Servicio | null;
  setError: (error: string | null) => void;
  setSelectedServicio: (servicio: Servicio | null) => void;
}

export const useServiciosStore = create<ServiciosState>()(
  subscribeWithSelector(devtools(
    (set) => ({
      error: null,
      selectedServicio: null,
      setError: (error) => set({ error }),
      setSelectedServicio: (servicio) => set({ selectedServicio: servicio }),
    }),
    { name: 'servicios-store' }
  ))
);
