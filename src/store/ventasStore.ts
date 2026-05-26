import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import type { VentaDoc } from '@/types';

interface VentasState {
  error: string | null;
  selectedVenta: VentaDoc | null;
  setError: (error: string | null) => void;
  setSelectedVenta: (venta: VentaDoc | null) => void;
}

export const useVentasStore = create<VentasState>()(
  subscribeWithSelector(devtools(
    (set) => ({
      error: null,
      selectedVenta: null,
      setError: (error) => set({ error }),
      setSelectedVenta: (venta) => set({ selectedVenta: venta }),
    }),
    { name: 'ventas-store' }
  ))
);
