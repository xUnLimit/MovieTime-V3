import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface GastosState {
  error: string | null;
  setError: (error: string | null) => void;
}

export const useGastosStore = create<GastosState>()(
  devtools(
    (set) => ({
      error: null,
      setError: (error) => set({ error }),
    }),
    { name: 'gastos-store' }
  )
);
