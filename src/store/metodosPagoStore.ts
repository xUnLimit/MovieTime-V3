import { countMetodosPago, createMetodoPago, ENTITIES, getMetodosPago, logCacheHit, queryMetodosPago, removeMetodoPago, updateMetodoPago } from '@/lib/supabase/catalogos-repository';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import type { MetodoPago } from '@/types';

// Helper para obtener contexto de usuario
function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

interface MetodosPagoState {
  metodosPago: MetodoPago[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  selectedMetodo: MetodoPago | null;

  // Counts for metrics (free queries)
  totalMetodos: number;
  metodosUsuarios: number;
  metodosServicios: number;

  // Actions
  fetchMetodosPago: (force?: boolean) => Promise<void>;
  fetchMetodosPagoUsuarios: () => Promise<MetodoPago[]>;
  fetchMetodosPagoServicios: () => Promise<MetodoPago[]>;
  fetchCounts: () => Promise<void>;
  createMetodoPago: (metodo: Omit<MetodoPago, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateMetodoPago: (id: string, updates: Partial<MetodoPago>) => Promise<void>;
  toggleActivo: (id: string) => Promise<void>;
  deleteMetodoPago: (id: string) => Promise<void>;
  setSelectedMetodo: (metodo: MetodoPago | null) => void;
  getMetodoPago: (id: string) => MetodoPago | undefined;
  getMetodosPagoUsuarios: () => MetodoPago[];
  getMetodosPagoServicios: () => MetodoPago[];
}

const CACHE_TIMEOUT = 5 * 60 * 1000;

function isVisibleMetodoPago(metodo: MetodoPago): boolean {
  return metodo.alias !== 'legacy-placeholder';
}

export const useMetodosPagoStore = create<MetodosPagoState>()(
  devtools(
    (set, get) => ({
      metodosPago: [],
      isLoading: false,
      error: null,
      lastFetch: null,
      selectedMetodo: null,
      totalMetodos: 0,
      metodosUsuarios: 0,
      metodosServicios: 0,

      fetchMetodosPago: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && (Date.now() - lastFetch) < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.METODOS_PAGO);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const metodosPago = (await getMetodosPago<MetodoPago>())
            .filter(isVisibleMetodoPago);
          set({ metodosPago, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar mÃƒÂ©todos de pago';
          console.error('Error fetching metodos pago:', error);
          set({ metodosPago: [], isLoading: false, error: errorMessage });
        }
      },

      fetchMetodosPagoUsuarios: async () => {
        try {
          const metodos = await queryMetodosPago<MetodoPago>([
            { field: 'asociadoA', operator: '==', value: 'usuario' },
            { field: 'activo', operator: '==', value: true }
          ]);
          return metodos;
        } catch (error) {
          console.error('Error fetching metodos pago usuarios:', error);
          return [];
        }
      },

      fetchMetodosPagoServicios: async () => {
        try {
          const metodos = await queryMetodosPago<MetodoPago>([
            { field: 'asociadoA', operator: '==', value: 'servicio' },
            { field: 'activo', operator: '==', value: true }
          ]);
          return metodos;
        } catch (error) {
          console.error('Error fetching metodos pago servicios:', error);
          return [];
        }
      },

      fetchCounts: async () => {
        try {
          const [totalMetodos, metodosUsuarios, metodosServicios] = await Promise.all([
            countMetodosPago([{ field: 'asociadoA', operator: 'in', value: ['usuario', 'servicio'] }]),
            countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'usuario' }]),
            countMetodosPago([{ field: 'asociadoA', operator: '==', value: 'servicio' }]),
          ]);
          set({ totalMetodos, metodosUsuarios, metodosServicios });
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalMetodos: 0, metodosUsuarios: 0, metodosServicios: 0 });
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

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'creacion',
            entidad: 'metodo_pago',
            entidadId: id,
            entidadNombre: metodoData.nombre,
            detalles: `MÃƒÂ©todo de pago creado: "${metodoData.nombre}"`,
          }).catch(() => {});
        } catch (error) {
          console.error('Error creating metodo pago:', error);
          throw error;
        }
      },

      updateMetodoPago: async (id, updates) => {
        try {
          const oldMetodo = get().metodosPago.find(m => m.id === id);
          const cambioAsociado = oldMetodo && updates.asociadoA && oldMetodo.asociadoA !== updates.asociadoA;
          const cambioNombre = oldMetodo && updates.nombre !== undefined && oldMetodo.nombre !== updates.nombre;
          const cambioMoneda = oldMetodo && updates.moneda !== undefined && oldMetodo.moneda !== updates.moneda;

          await updateMetodoPago(id, updates);

          // Si cambiÃƒÂ³ el nombre o la moneda, sincronizar en cascada todas las entidades que usan este mÃƒÂ©todo
          if ((cambioNombre || cambioMoneda) && oldMetodo) {
            const { syncMetodoPagoDependencias } = await import('@/lib/services/metodoPagoSyncService');
            await syncMetodoPagoDependencias({
              id,
              nombre: updates.nombre,
              moneda: updates.moneda,
              nombreAnterior: oldMetodo.nombre,
              monedaAnterior: oldMetodo.moneda,
            });
          }

          // Detectar cambios para el log
          const cambios = oldMetodo ? detectarCambios('metodo_pago', oldMetodo, {
            ...oldMetodo,
            ...updates
          }) : [];

          set((state) => {
            const updatedMetodos = state.metodosPago.map((metodo) =>
              metodo.id === id
                ? { ...metodo, ...updates, updatedAt: new Date() }
                : metodo
            );

            // Actualizar contadores si cambiÃƒÂ³ el asociadoA
            let newMetodosUsuarios = state.metodosUsuarios;
            let newMetodosServicios = state.metodosServicios;

            if (cambioAsociado && oldMetodo) {
              if (oldMetodo.asociadoA === 'usuario' && updates.asociadoA === 'servicio') {
                newMetodosUsuarios--;
                newMetodosServicios++;
              } else if (oldMetodo.asociadoA === 'servicio' && updates.asociadoA === 'usuario') {
                newMetodosUsuarios++;
                newMetodosServicios--;
              }
            }

            return {
              metodosPago: updatedMetodos,
              metodosUsuarios: newMetodosUsuarios,
              metodosServicios: newMetodosServicios
            };
          });

          // Registrar en log de actividad con cambios
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'actualizacion',
            entidad: 'metodo_pago',
            entidadId: id,
            entidadNombre: oldMetodo?.nombre ?? id,
            detalles: `MÃƒÂ©todo de pago actualizado: "${oldMetodo?.nombre}"`,
            cambios: cambios.length > 0 ? cambios : undefined,
          }).catch(() => {});
        } catch (error) {
          console.error('Error updating metodo pago:', error);
          throw error;
        }
      },

      toggleActivo: async (id) => {
        try {
          const metodo = get().metodosPago.find((m) => m.id === id);
          if (!metodo) throw new Error('MÃƒÂ©todo de pago no encontrado');

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

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'eliminacion',
            entidad: 'metodo_pago',
            entidadId: id,
            entidadNombre: metodoEliminado?.nombre ?? id,
            detalles: `MÃƒÂ©todo de pago eliminado: "${metodoEliminado?.nombre}"`,
          }).catch(() => {});
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

      getMetodosPagoUsuarios: () => {
        return get().metodosPago.filter((metodo) => metodo.asociadoA === 'usuario' && metodo.activo);
      },

      getMetodosPagoServicios: () => {
        return get().metodosPago.filter((metodo) => metodo.asociadoA === 'servicio' && metodo.activo);
      }
    }),
    { name: 'metodos-pago-store' }
  )
);
