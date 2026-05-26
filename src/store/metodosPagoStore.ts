import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { MetodoPago } from '@/types';

interface MetodosPagoState {
  error: string | null;
  selectedMetodo: MetodoPago | null;
  setError: (error: string | null) => void;
  setSelectedMetodo: (metodo: MetodoPago | null) => void;
}

export const useMetodosPagoStore = create<MetodosPagoState>()(
  devtools(
    (set) => ({
      error: null,
      selectedMetodo: null,
      setError: (error) => set({ error }),
      setSelectedMetodo: (metodo) => set({ selectedMetodo: metodo }),
    }),
    { name: 'metodos-pago-store' }
  )
);
