import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import {
  createCategoriaUseCase,
  deleteCategoriaUseCase,
  fetchCategoriasCounts,
  fetchCategoriasFull,
  updateCategoriaUseCase,
} from '@/lib/use-cases/categorias-use-cases';
import { emitLegacyBrowserEvent, storeEventBus } from '@/lib/events/store-event-bus';
import { ENTITIES, logCacheHit } from '@/lib/supabase/categorias-repository';
import { getStoreLogContext } from '@/lib/utils/storeHelpers';
import { useActivityLogStore } from '@/store/activityLogStore';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { Categoria } from '@/types';

interface CategoriasState {
  categorias: Categoria[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  selectedCategoria: Categoria | null;

  totalCategorias: number;
  categoriasClientes: number;
  categoriasRevendedores: number;

  fetchCategorias: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;
  createCategoria: (categoria: Omit<Categoria, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCategoria: (id: string, updates: Partial<Categoria>) => Promise<void>;
  deleteCategoria: (id: string) => Promise<void>;
  setSelectedCategoria: (categoria: Categoria | null) => void;
  getCategoria: (id: string) => Categoria | undefined;
  getCategoriasByTipo: (tipo: 'cliente' | 'revendedor') => Categoria[];
  resyncContadoresCategorias: () => Promise<{ categoriasCorregidas: number }>;
}

const CACHE_TIMEOUT = CACHE_TTL_MS;

export const useCategoriasStore = create<CategoriasState>()(
  subscribeWithSelector(devtools(
    (set, get) => ({
      categorias: [],
      isLoading: false,
      error: null,
      lastFetch: null,
      selectedCategoria: null,
      totalCategorias: 0,
      categoriasClientes: 0,
      categoriasRevendedores: 0,

      fetchCategorias: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.CATEGORIAS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const categorias = await fetchCategoriasFull();
          set({ categorias, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar categorias';
          console.error('Error fetching categorias:', error);
          set({ categorias: [], isLoading: false, error: errorMessage });
        }
      },

      fetchCounts: async () => {
        try {
          set(await fetchCategoriasCounts());
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalCategorias: 0, categoriasClientes: 0, categoriasRevendedores: 0 });
        }
      },

      createCategoria: async (categoriaData) => {
        try {
          const newCategoria = await createCategoriaUseCase(categoriaData, {
            logContext: getStoreLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          set((state) => ({
            categorias: [...state.categorias, newCategoria],
            error: null,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear categoria';
          set({ error: errorMessage });
          console.error('Error creating categoria:', error);
          throw error;
        }
      },

      updateCategoria: async (id, updates) => {
        try {
          const oldCategoria = get().categorias.find((categoria) => categoria.id === id);
          const updatedCategoria = await updateCategoriaUseCase(id, updates, {
            oldCategoria,
            logContext: getStoreLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          set((state) => ({
            categorias: state.categorias.map((categoria) =>
              categoria.id === id ? updatedCategoria : categoria
            ),
            error: null,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar categoria';
          set({ error: errorMessage });
          console.error('Error updating categoria:', error);
          throw error;
        }
      },

      deleteCategoria: async (id) => {
        const currentCategorias = get().categorias;
        const categoriaEliminada = currentCategorias.find((categoria) => categoria.id === id);
        set((state) => ({ categorias: state.categorias.filter((categoria) => categoria.id !== id) }));

        try {
          await deleteCategoriaUseCase(id, {
            categoria: categoriaEliminada,
            logContext: getStoreLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          storeEventBus.emit({ type: 'CATEGORIA_DELETED', categoriaId: id });

          emitLegacyBrowserEvent('categoria-deleted');

          set({ error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar categoria';
          set({ categorias: currentCategorias, error: errorMessage });
          console.error('Error deleting categoria:', error);
          throw error;
        }
      },

      setSelectedCategoria: (categoria) => set({ selectedCategoria: categoria }),

      getCategoria: (id) => get().categorias.find((categoria) => categoria.id === id),

      getCategoriasByTipo: (tipo) =>
        get().categorias.filter((categoria) => categoria.tipo === tipo),

      resyncContadoresCategorias: async () => {
        await get().fetchCategorias(true);
        return { categoriasCorregidas: 0 };
      },
    }),
    { name: 'categorias-store' }
  ))
);
