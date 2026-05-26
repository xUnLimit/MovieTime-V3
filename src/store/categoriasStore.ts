import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import type { Categoria } from '@/types';

interface CategoriasState {
  error: string | null;
  selectedCategoria: Categoria | null;
  setError: (error: string | null) => void;
  setSelectedCategoria: (categoria: Categoria | null) => void;
}

export const useCategoriasStore = create<CategoriasState>()(
  subscribeWithSelector(devtools(
    (set) => ({
      error: null,
      selectedCategoria: null,
      setError: (error) => set({ error }),
      setSelectedCategoria: (categoria) => set({ selectedCategoria: categoria }),
    }),
    { name: 'categorias-store' }
  ))
);
