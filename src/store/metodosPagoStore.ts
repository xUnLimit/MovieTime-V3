import { countMetodosPago, createMetodoPago, ENTITIES, getMetodosPago, logCacheHit, queryMetodosPago, removeMetodoPago, updateMetodoPago } from '@/lib/supabase/catalogos-repository';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

void queryMetodosPago;

import {
  afterMetodoPagoCreated,
  afterMetodoPagoDeleted,
  afterMetodoPagoUpdated,
} from '@/lib/store-reactions/catalogos-mutation-reactions';
import { CACHE_TTL_MS } from '@/lib/constants';
import {
  queryMetodosPagoServiciosRead,
  queryMetodosPagoTercerosRead,
} from '@/lib/supabase/domain-read-adapters';
import type { MetodoPago } from '@/types';

interface MetodosPagoState {
  metodosPago: MetodoPago[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  selectedMetodo: MetodoPago | null;

  // Counts for metrics (free queries)
  totalMetodos: number;
  metodosTerceros: number;
  metodosServicios: number;

  // Actions
  fetchMetodosPago: (force?: boolean) => Promise<void>;
  fetchMetodosPagoTerceros: () => Promise<MetodoPago[]>;
  fetchMetodosPagoServicios: () => Promise<MetodoPago[]>;
  fetchCounts: () => Promise<void>;
  createMetodoPago: (metodo: Omit<MetodoPago, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateMetodoPago: (id: string, updates: Partial<MetodoPago>) => Promise<void>;
  toggleActivo: (id: string) => Promise<void>;
  deleteMetodoPago: (id: string) => Promise<void>;
  setSelectedMetodo: (metodo: MetodoPago | null) => void;
  getMetodoPago: (id: string) => MetodoPago | undefined;
  getMetodosPagoTerceros: () => MetodoPago[];
  getMetodosPagoServicios: () => MetodoPago[];
}

const CACHE_TIMEOUT = CACHE_TTL_MS;

export const useMetodosPagoStore = create<MetodosPagoState>()(
  devtools(
    (set, get) => ({
      metodosPago: [],
      isLoading: false,
      error: null,
      lastFetch: null,
      selectedMetodo: null,
      totalMetodos: 0,
      metodosTerceros: 0,
      metodosServicios: 0,

      fetchMetodosPago: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && (Date.now() - lastFetch) < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.METODOS_PAGO);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const metodosPago = await getMetodosPago<MetodoPago>();
          set({ metodosPago, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar métodos de pago';
          console.error('Error fetching metodos pago:', error);
          set({ metodosPago: [], isLoading: false, error: errorMessage });
        }
      },

      fetchMetodosPagoTerceros: async () => {
        try {
          const metodos = await queryMetodosPagoTercerosRead({ soloActivos: true });
          return metodos;
        } catch (error) {
          console.error('Error fetching metodos pago terceros:', error);
          return [];
        }
      },

      fetchMetodosPagoServicios: async () => {
        try {
          const metodos = await queryMetodosPagoServiciosRead({ soloActivos: true });
          return metodos;
        } catch (error) {
          console.error('Error fetching metodos pago servicios:', error);
          return [];
        }
      },

      fetchCounts: async () => {
        try {
          const [totalMetodos, metodosTerceros, metodosServicios] = await Promise.all([
            countMetodosPago([{ field: 'asociadoA', operator: 'in', value: ['tercero', 'servicio'] }]),
            countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'tercero' }]),
            countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'servicio' }]),
          ]);
          set({ totalMetodos, metodosTerceros, metodosServicios });
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalMetodos: 0, metodosTerceros: 0, metodosServicios: 0 });
        }
      },

      createMetodoPago: async (metodoData) => {
        try {
          const id = await createMetodoPago(metodoData as Omit<MetodoPago, 'id'>);

          const newMetodo: MetodoPago = {
            ...metodoData,
            id,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          set((state) => ({
            metodosPago: [...state.metodosPago, newMetodo]
          }));

          await afterMetodoPagoCreated(newMetodo);
        } catch (error) {
          console.error('Error creating metodo pago:', error);
          throw error;
        }
      },

      updateMetodoPago: async (id, updates) => {
        try {
          const oldMetodo = get().metodosPago.find(m => m.id === id);
          const cambioAsociado = oldMetodo && updates.asociadoA && oldMetodo.asociadoA !== updates.asociadoA;

          await updateMetodoPago(id, updates);
          await afterMetodoPagoUpdated({ metodoId: id, oldMetodo, updates });

          set((state) => {
            const updatedMetodos = state.metodosPago.map((metodo) =>
              metodo.id === id
                ? { ...metodo, ...updates, updatedAt: new Date() }
                : metodo
            );

            // Actualizar contadores si cambió el asociadoA
            let newMetodosTerceros = state.metodosTerceros;
            let newMetodosServicios = state.metodosServicios;

            if (cambioAsociado && oldMetodo) {
              if (oldMetodo.asociadoA === 'tercero' && updates.asociadoA === 'servicio') {
                newMetodosTerceros--;
                newMetodosServicios++;
              } else if (oldMetodo.asociadoA === 'servicio' && updates.asociadoA === 'tercero') {
                newMetodosTerceros++;
                newMetodosServicios--;
              }
            }

            return {
              metodosPago: updatedMetodos,
              metodosTerceros: newMetodosTerceros,
              metodosServicios: newMetodosServicios
            };
          });

        } catch (error) {
          console.error('Error updating metodo pago:', error);
          throw error;
        }
      },

      toggleActivo: async (id) => {
        try {
          const metodo = get().metodosPago.find((m) => m.id === id);
          if (!metodo) throw new Error('Método de pago no encontrado');

          const newActivo = !metodo.activo;
          await updateMetodoPago(id, { activo: newActivo });

          set((state) => ({
            metodosPago: state.metodosPago.map((m) =>
              m.id === id
                ? { ...m, activo: newActivo, updatedAt: new Date() }
                : m
            )
          }));
        } catch (error) {
          console.error('Error toggling activo:', error);
          throw error;
        }
      },

      deleteMetodoPago: async (id) => {
        const metodoEliminado = get().metodosPago.find(m => m.id === id);

        try {
          await removeMetodoPago(id);

          set((state) => ({
            metodosPago: state.metodosPago.filter((metodo) => metodo.id !== id)
          }));

          await afterMetodoPagoDeleted(id, metodoEliminado);
        } catch (error) {
          console.error('Error deleting metodo pago:', error);
          throw error;
        }
      },

      setSelectedMetodo: (metodo) => {
        set({ selectedMetodo: metodo });
      },

      getMetodoPago: (id) => {
        return get().metodosPago.find((metodo) => metodo.id === id);
      },

      getMetodosPagoTerceros: () => {
        return get().metodosPago.filter((metodo) => metodo.asociadoA === 'tercero' && metodo.activo);
      },

      getMetodosPagoServicios: () => {
        return get().metodosPago.filter((metodo) => metodo.asociadoA === 'servicio' && metodo.activo);
      }
    }),
    { name: 'metodos-pago-store' }
  )
);
