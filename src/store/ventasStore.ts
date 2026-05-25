import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import { countVentas, ENTITIES, getVentas, logCacheHit } from '@/lib/supabase/ventas-repository';
import {
  createVentaUseCase,
  deleteVentaUseCase,
  updateVentaUseCase,
} from '@/lib/use-cases/ventas/ventas-write-use-cases';
import {
  afterVentaCreated,
  afterVentaDeleted,
  afterVentaUpdated,
} from '@/lib/store-reactions/ventas-mutation-reactions';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import { CACHE_TTL_MS } from '@/lib/constants';
import type { VentaDoc } from '@/types';

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
  subscribeWithSelector(devtools(
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
          const { venta, pronostico } = await createVentaUseCase(ventaData, getActivityLogOptions());

          set((state) => ({
            ventas: [...state.ventas, venta],
            error: null,
          }));

          void pronostico;
          await afterVentaCreated(venta.id);
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
            ...getActivityLogOptions(),
          });

          set((state) => ({
            ventas: state.ventas.map((venta) =>
              venta.id === id ? ventaActualizada : venta
            ),
            selectedVenta:
              state.selectedVenta?.id === id ? ventaActualizada : state.selectedVenta,
            error: null,
          }));

          void pronostico;
          await afterVentaUpdated(id, serviceProfileDelta);
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
            ...getActivityLogOptions(),
          });

          await afterVentaDeleted(id, serviceProfileDelta);
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
  ))
);
