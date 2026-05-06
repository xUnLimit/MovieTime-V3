import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { countVentas, ENTITIES, getVentas, logCacheHit } from '@/lib/supabase/ventas-repository';
import {
  createVentaUseCase,
  deleteVentaUseCase,
  updateVentaUseCase,
} from '@/lib/use-cases/ventas-use-cases';
import { syncVentaPronosticoLocal } from '@/lib/commands/client-cache';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { VentaDoc } from '@/types';

function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

function dispatchVentaEvent(name: 'venta-created' | 'venta-updated' | 'venta-deleted') {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(name, Date.now().toString());
  window.dispatchEvent(new Event(name));
}

interface VentasState {
  ventas: VentaDoc[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  selectedVenta: VentaDoc | null;

  totalVentas: number;
  ventasActivas: number;
  ventasInactivas: number;

  fetchVentas: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;
  createVenta: (venta: Omit<VentaDoc, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateVenta: (id: string, updates: Partial<VentaDoc>) => Promise<void>;
  deleteVenta: (id: string, servicioId?: string, perfilNumero?: number | null, deletePagos?: boolean) => Promise<void>;
  setSelectedVenta: (venta: VentaDoc | null) => void;
  getVenta: (id: string) => VentaDoc | undefined;
  getVentasByEstado: (estado: 'activo' | 'inactivo') => VentaDoc[];
}

const CACHE_TIMEOUT = CACHE_TTL_MS;

export const useVentasStore = create<VentasState>()(
  devtools(
    (set, get) => ({
      ventas: [],
      isLoading: false,
      error: null,
      lastFetch: null,
      selectedVenta: null,
      totalVentas: 0,
      ventasActivas: 0,
      ventasInactivas: 0,

      fetchVentas: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.VENTAS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const ventas = await getVentas<VentaDoc>();
          set({ ventas, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar ventas';
          console.error('Error fetching ventas:', error);
          set({ ventas: [], isLoading: false, error: errorMessage });
        }
      },

      fetchCounts: async () => {
        try {
          const [totalVentas, ventasActivas, ventasInactivas] = await Promise.all([
            countVentas([]),
            countVentas([{ field: 'estado', operator: '==', value: 'activo' }]),
            countVentas([{ field: 'estado', operator: '==', value: 'inactivo' }]),
          ]);
          set({ totalVentas, ventasActivas, ventasInactivas });
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalVentas: 0, ventasActivas: 0, ventasInactivas: 0 });
        }
      },

      createVenta: async (ventaData) => {
        try {
          const { venta, pronostico } = await createVentaUseCase(ventaData, {
            logContext: getLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          set((state) => ({
            ventas: [...state.ventas, venta],
            error: null,
          }));

          syncVentaPronosticoLocal(venta.id, pronostico);
          dispatchVentaEvent('venta-created');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear venta';
          set({ error: errorMessage });
          console.error('Error creating venta:', error);
          throw error;
        }
      },

      updateVenta: async (id, updates) => {
        try {
          const currentVenta = get().ventas.find((venta) => venta.id === id);
          const { ventaActualizada, pronostico, serviceProfileDelta } = await updateVentaUseCase(id, updates, {
            currentVenta,
            logContext: getLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          if (serviceProfileDelta) {
            const { useServiciosStore } = await import('./serviciosStore');
            await useServiciosStore
              .getState()
              .updatePerfilOcupado(serviceProfileDelta.servicioId, serviceProfileDelta.shouldIncrement);
          }

          set((state) => ({
            ventas: state.ventas.map((venta) =>
              venta.id === id ? ventaActualizada : venta
            ),
            selectedVenta:
              state.selectedVenta?.id === id ? ventaActualizada : state.selectedVenta,
            error: null,
          }));

          syncVentaPronosticoLocal(id, pronostico);
          dispatchVentaEvent('venta-updated');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar venta';
          set({ error: errorMessage });
          console.error('Error updating venta:', error);
          throw error;
        }
      },

      deleteVenta: async (id, servicioId?, perfilNumero?, deletePagos = false) => {
        const currentVentas = get().ventas;
        const venta = currentVentas.find((item) => item.id === id);

        set((state) => ({
          ventas: state.ventas.filter((item) => item.id !== id),
        }));

        try {
          const { serviceProfileDelta } = await deleteVentaUseCase(id, {
            venta,
            servicioId,
            perfilNumero,
            deletePagos,
            logContext: getLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          if (serviceProfileDelta) {
            const { useServiciosStore } = await import('./serviciosStore');
            await useServiciosStore
              .getState()
              .updatePerfilOcupado(serviceProfileDelta.servicioId, serviceProfileDelta.shouldIncrement);
          }

          try {
            const { useNotificacionesStore } = await import('./notificacionesStore');
            await useNotificacionesStore.getState().deleteNotificacionesPorVenta(id);
          } catch {
            // Notifications cleanup is best-effort.
          }

          syncVentaPronosticoLocal(id, null);
          dispatchVentaEvent('venta-deleted');
          set({ error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar venta';
          set({ ventas: currentVentas, error: errorMessage });
          console.error('Error deleting venta:', error);
          throw error;
        }
      },

      setSelectedVenta: (venta) => {
        set({ selectedVenta: venta });
      },

      getVenta: (id) => {
        return get().ventas.find((venta) => venta.id === id);
      },

      getVentasByEstado: (estado) => {
        return get().ventas.filter((venta) =>
          estado === 'activo' ? venta.estado !== 'inactivo' : venta.estado === 'inactivo'
        );
      },
    }),
    { name: 'ventas-store' }
  )
);
