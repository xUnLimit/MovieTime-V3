import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface TiposGastoState {
  error: string | null;
  setError: (error: string | null) => void;
}

export const useTiposGastoStore = create<TiposGastoState>()(
  devtools(
    (set) => ({
      error: null,
      setError: (error) => set({ error }),
    }),
    { name: 'tipos-gasto-store' }
  )
);
