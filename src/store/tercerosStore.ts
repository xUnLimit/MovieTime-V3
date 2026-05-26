import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { Tercero } from '@/types';

interface TercerosState {
  error: string | null;
  selectedTercero: Tercero | null;
  setError: (error: string | null) => void;
  setSelectedTercero: (usuario: Tercero | null) => void;
}

export const useTercerosStore = create<TercerosState>()(
  devtools(
    (set) => ({
      error: null,
      selectedTercero: null,
      setError: (error) => set({ error }),
      setSelectedTercero: (usuario) => set({ selectedTercero: usuario }),
    }),
    { name: 'terceros-store' }
  )
);
