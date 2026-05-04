import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { MetodoPago } from '@/types';
import { getAll, getCount, queryDocuments, create as createDoc, update, remove, COLLECTIONS, logCacheHit } from '@/lib/firebase/firestore';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';

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
          logCacheHit(COLLECTIONS.METODOS_PAGO);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const metodosPago = await getAll<MetodoPago>(COLLECTIONS.METODOS_PAGO);
          set({ metodosPago, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar métodos de pago';
          console.error('Error fetching metodos pago:', error);
          set({ metodosPago: [], isLoading: false, error: errorMessage });
        }
      },

      fetchMetodosPagoUsuarios: async () => {
        try {
          const metodos = await queryDocuments<MetodoPago>(COLLECTIONS.METODOS_PAGO, [
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
          const metodos = await queryDocuments<MetodoPago>(COLLECTIONS.METODOS_PAGO, [
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
            getCount(COLLECTIONS.METODOS_PAGO, []),
            getCount(COLLECTIONS.METODOS_PAGO, [{ field: 'asociadoA', operator: '==', value: 'usuario' }]),
            getCount(COLLECTIONS.METODOS_PAGO, [{ field: 'asociadoA', operator: '==', value: 'servicio' }]),
          ]);
          set({ totalMetodos, metodosUsuarios, metodosServicios });
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalMetodos: 0, metodosUsuarios: 0, metodosServicios: 0 });
        }
      },

      createMetodoPago: async (metodoData) => {
        try {
          const id = await createDoc(COLLECTIONS.METODOS_PAGO, metodoData as Omit<MetodoPago, 'id'>);

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
            detalles: `Método de pago creado: "${metodoData.nombre}"`,
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

          await update(COLLECTIONS.METODOS_PAGO, id, updates);

          // Si cambió el nombre o la moneda, sincronizar en cascada todas las entidades que usan este método
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

            // Actualizar contadores si cambió el asociadoA
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
            detalles: `Método de pago actualizado: "${oldMetodo?.nombre}"`,
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
          if (!metodo) throw new Error('Método de pago no encontrado');

          const newActivo = !metodo.activo;
          await update(COLLECTIONS.METODOS_PAGO, id, { activo: newActivo });

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
          await remove(COLLECTIONS.METODOS_PAGO, id);

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
            detalles: `Método de pago eliminado: "${metodoEliminado?.nombre}"`,
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
