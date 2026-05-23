import { startOfDay } from 'date-fns';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { storeEventBus } from '@/lib/events/store-event-bus';
import { ENTITIES, getTerceros, logCacheHit } from '@/lib/supabase/terceros-repository';
import {
  createTerceroUseCase,
  deleteTerceroUseCase,
  fetchTercerosCountsUseCase,
  resolveTerceroForDelete,
  updateTerceroUseCase,
} from '@/lib/use-cases/terceros-use-cases';
import { getStoreLogContext } from '@/lib/utils/storeHelpers';
import { useActivityLogStore } from '@/store/activityLogStore';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { Tercero } from '@/types';

function dispatchTerceroEvent(name: 'tercero-deleted' | 'tercero-nombre-updated', terceroId: string) {
  if (name === 'tercero-deleted') storeEventBus.emit({ type: 'TERCERO_DELETED', terceroId });
  if (name === 'tercero-nombre-updated') storeEventBus.emit({ type: 'TERCERO_NOMBRE_UPDATED', terceroId });

  if (typeof window === 'undefined') return;
  if (name === 'tercero-deleted') {
    window.localStorage.setItem(name, Date.now().toString());
  }
  window.dispatchEvent(new Event(name));
}

interface TercerosState {
  terceros: Tercero[];
  totalClientes: number;
  totalRevendedores: number;
  totalNuevosHoy: number;
  totalTercerosActivos: number;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  lastCountsFetch: number | null;
  selectedTercero: Tercero | null;

  fetchTerceros: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;
  resyncServiciosActivos: () => Promise<{ tercerosReparados: number }>;
  createTercero: (usuario: Omit<Tercero, 'id' | 'createdAt' | 'updatedAt' | 'serviciosActivos'>) => Promise<void>;
  updateTercero: (id: string, updates: Partial<Tercero>) => Promise<void>;
  deleteTercero: (id: string, usuarioData?: { tipo: 'cliente' | 'revendedor'; nombre?: string; createdAt?: Date; serviciosActivos?: number }) => Promise<void>;
  setSelectedTercero: (usuario: Tercero | null) => void;
  getTercero: (id: string) => Tercero | undefined;
  getClientes: () => Tercero[];
  getRevendedores: () => Tercero[];
}

const CACHE_TIMEOUT = CACHE_TTL_MS;

export const useTercerosStore = create<TercerosState>()(
  devtools(
    (set, get) => ({
      terceros: [],
      totalClientes: 0,
      totalRevendedores: 0,
      totalNuevosHoy: 0,
      totalTercerosActivos: 0,
      isLoading: false,
      error: null,
      lastFetch: null,
      lastCountsFetch: null,
      selectedTercero: null,

      fetchTerceros: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.TERCEROS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const terceros = await getTerceros<Tercero>();
          set({ terceros, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar terceros';
          console.error('Error fetching terceros:', error);
          set({ terceros: [], isLoading: false, error: errorMessage });
        }
      },

      fetchCounts: async () => {
        const { lastCountsFetch } = get();
        if (lastCountsFetch && Date.now() - lastCountsFetch < CACHE_TIMEOUT) {
          logCacheHit('terceros-counts');
          return;
        }

        try {
          set({
            ...(await fetchTercerosCountsUseCase()),
            lastCountsFetch: Date.now(),
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al cargar conteos';
          set({ error: errorMessage });
          console.error('Error fetching counts:', error);
        }
      },

      resyncServiciosActivos: async () => {
        await get().fetchTerceros(true);
        return { tercerosReparados: 0 };
      },

      createTercero: async (usuarioData) => {
        try {
          const usuario = await createTerceroUseCase(usuarioData, {
            logContext: getStoreLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          set((state) => ({
            terceros: [...state.terceros, usuario],
            totalClientes: usuarioData.tipo === 'cliente' ? state.totalClientes + 1 : state.totalClientes,
            totalRevendedores: usuarioData.tipo === 'revendedor' ? state.totalRevendedores + 1 : state.totalRevendedores,
            totalNuevosHoy: state.totalNuevosHoy + 1,
            error: null,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear tercero';
          set({ error: errorMessage });
          console.error('Error creating tercero:', error);
          throw error;
        }
      },

      updateTercero: async (id, updates) => {
        try {
          const oldTercero = get().terceros.find((usuario) => usuario.id === id);
          const cambioTipo = oldTercero && updates.tipo && oldTercero.tipo !== updates.tipo;
          const cambioServiciosActivos =
            oldTercero && updates.serviciosActivos !== undefined && oldTercero.serviciosActivos !== updates.serviciosActivos;

          const { shouldRefreshNotificaciones, shouldDispatchTerceroNombreUpdated } = await updateTerceroUseCase(id, updates, {
            oldTercero,
            logContext: getStoreLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          if (shouldRefreshNotificaciones) {
            const { useNotificacionesStore } = await import('@/store/notificacionesStore');
            await useNotificacionesStore.getState().fetchNotificaciones(true);
          }

          if (shouldDispatchTerceroNombreUpdated) {
            dispatchTerceroEvent('tercero-nombre-updated', id);
          }

          set((state) => {
            const updatedTerceros = state.terceros.map((usuario) =>
              usuario.id === id ? { ...usuario, ...updates, updatedAt: new Date() } : usuario
            );

            let newTotalClientes = state.totalClientes;
            let newTotalRevendedores = state.totalRevendedores;
            let newTotalTercerosActivos = state.totalTercerosActivos;

            if (cambioTipo && oldTercero) {
              if (oldTercero.tipo === 'cliente' && updates.tipo === 'revendedor') {
                newTotalClientes--;
                newTotalRevendedores++;
              } else if (oldTercero.tipo === 'revendedor' && updates.tipo === 'cliente') {
                newTotalClientes++;
                newTotalRevendedores--;
              }
            }

            if (cambioServiciosActivos && oldTercero) {
              const oldActivo = (oldTercero.serviciosActivos ?? 0) > 0;
              const newActivo = (updates.serviciosActivos ?? 0) > 0;

              if (oldActivo && !newActivo) {
                newTotalTercerosActivos--;
              } else if (!oldActivo && newActivo) {
                newTotalTercerosActivos++;
              }
            }

            return {
              terceros: updatedTerceros,
              totalClientes: newTotalClientes,
              totalRevendedores: newTotalRevendedores,
              totalTercerosActivos: newTotalTercerosActivos,
              error: null,
            };
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar tercero';
          set({ error: errorMessage });
          console.error('Error updating tercero:', error);
          throw error;
        }
      },

      deleteTercero: async (id, usuarioData) => {
        const currentTerceros = get().terceros;
        const deletedUser = await resolveTerceroForDelete(
          id,
          usuarioData,
          currentTerceros.find((usuario) => usuario.id === id)
        );

        const today = startOfDay(new Date());
        const wasCreatedToday =
          deletedUser.createdAt && startOfDay(new Date(deletedUser.createdAt)).getTime() === today.getTime();
        const wasActive = (deletedUser.serviciosActivos ?? 0) > 0;
        const currentState = {
          totalClientes: get().totalClientes,
          totalRevendedores: get().totalRevendedores,
          totalNuevosHoy: get().totalNuevosHoy,
          totalTercerosActivos: get().totalTercerosActivos,
          terceros: currentTerceros,
        };

        set((state) => ({
          terceros: state.terceros.filter((usuario) => usuario.id !== id),
          totalClientes: deletedUser.tipo === 'cliente' ? state.totalClientes - 1 : state.totalClientes,
          totalRevendedores: deletedUser.tipo === 'revendedor' ? state.totalRevendedores - 1 : state.totalRevendedores,
          totalNuevosHoy: wasCreatedToday ? state.totalNuevosHoy - 1 : state.totalNuevosHoy,
          totalTercerosActivos: wasActive ? state.totalTercerosActivos - 1 : state.totalTercerosActivos,
        }));

        try {
          await deleteTerceroUseCase(id, deletedUser, {
            logContext: getStoreLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          dispatchTerceroEvent('tercero-deleted', id);
          set({ error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar tercero';
          set({
            terceros: currentState.terceros,
            totalClientes: currentState.totalClientes,
            totalRevendedores: currentState.totalRevendedores,
            totalNuevosHoy: currentState.totalNuevosHoy,
            totalTercerosActivos: currentState.totalTercerosActivos,
            error: errorMessage,
          });
          console.error('Error deleting tercero:', error);
          throw error;
        }
      },

      setSelectedTercero: (usuario) => {
        set({ selectedTercero: usuario });
      },

      getTercero: (id) => {
        return get().terceros.find((usuario) => usuario.id === id);
      },

      getClientes: () => {
        return get().terceros.filter((usuario) => usuario.tipo === 'cliente');
      },

      getRevendedores: () => {
        return get().terceros.filter((usuario) => usuario.tipo === 'revendedor');
      },
    }),
    { name: 'terceros-store' }
  )
);
