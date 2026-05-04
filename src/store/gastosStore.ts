import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { format } from 'date-fns';
import { Gasto, TipoGasto } from '@/types';
import {
  COLLECTIONS,
  create as createDoc,
  getAll,
  getById,
  logCacheHit,
  remove,
  update,
} from '@/lib/firebase/firestore';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import { adjustGastosStats, getDiaKeyFromDate, getMesKeyFromDate } from '@/lib/services/dashboardStatsService';

const CACHE_TIMEOUT = 5 * 60 * 1000;

function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

function sortGastos(gastos: Gasto[]) {
  return [...gastos].sort((a, b) => {
    const diff = b.fecha.getTime() - a.fecha.getTime();
    if (diff !== 0) return diff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

async function getTipoGastoActivo(tipoGastoId: string): Promise<TipoGasto> {
  const tipoGasto = await getById<TipoGasto>(COLLECTIONS.TIPOS_GASTO, tipoGastoId);
  if (!tipoGasto) throw new Error('Tipo de gasto no encontrado');
  if (!tipoGasto.activo) throw new Error('El tipo de gasto seleccionado está inactivo');
  return tipoGasto;
}

async function syncDashboardGasto(gasto: Pick<Gasto, 'fecha' | 'monto'>, sign: 1 | -1) {
  await adjustGastosStats({
    delta: gasto.monto * sign,
    moneda: 'USD',
    mes: getMesKeyFromDate(gasto.fecha),
    dia: getDiaKeyFromDate(gasto.fecha),
  });
}

function invalidateDashboardCache() {
  import('./dashboardStore')
    .then(({ useDashboardStore }) => {
      useDashboardStore.getState().invalidateCache();
    })
    .catch(() => {});
}

interface GastosState {
  gastos: Gasto[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  fetchGastos: (force?: boolean) => Promise<void>;
  createGasto: (gasto: Omit<Gasto, 'id' | 'createdAt' | 'updatedAt' | 'tipoGastoNombre'>) => Promise<void>;
  updateGasto: (id: string, updates: Partial<Omit<Gasto, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteGasto: (id: string) => Promise<void>;
  getGasto: (id: string) => Gasto | undefined;
}

export const useGastosStore = create<GastosState>()(
  devtools(
    (set, get) => ({
      gastos: [],
      isLoading: false,
      error: null,
      lastFetch: null,

      fetchGastos: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit(COLLECTIONS.GASTOS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const gastos = await getAll<Gasto>(COLLECTIONS.GASTOS);
          set({
            gastos: sortGastos(gastos),
            isLoading: false,
            error: null,
            lastFetch: Date.now(),
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al cargar gastos';
          console.error('Error fetching gastos:', error);
          set({ gastos: [], isLoading: false, error: errorMessage });
        }
      },

      createGasto: async (gastoData) => {
        let gastoId: string | null = null;

        try {
          const tipoGasto = await getTipoGastoActivo(gastoData.tipoGastoId);
          const gastoToCreate = {
            ...gastoData,
            tipoGastoNombre: tipoGasto.nombre,
            detalle: gastoData.detalle?.trim() || undefined,
          };

          gastoId = await createDoc(COLLECTIONS.GASTOS, gastoToCreate as Omit<Gasto, 'id'>);

          const newGasto: Gasto = {
            ...gastoData,
            detalle: gastoData.detalle?.trim() || undefined,
            tipoGastoNombre: tipoGasto.nombre,
            id: gastoId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await syncDashboardGasto(newGasto, 1);

          set((state) => ({
            gastos: sortGastos([...state.gastos, newGasto]),
          }));

          invalidateDashboardCache();

          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'creacion',
            entidad: 'gasto',
            entidadId: gastoId,
            entidadNombre: tipoGasto.nombre,
            detalles: `Gasto registrado: ${tipoGasto.nombre} - $${newGasto.monto.toFixed(2)} USD (${format(newGasto.fecha, 'dd/MM/yyyy')})`,
          }).catch(() => {});
        } catch (error) {
          if (gastoId) {
            await remove(COLLECTIONS.GASTOS, gastoId).catch(() => {});
          }
          const errorMessage = error instanceof Error ? error.message : 'Error al crear gasto';
          set({ error: errorMessage });
          console.error('Error creating gasto:', error);
          throw error;
        }
      },

      updateGasto: async (id, updates) => {
        const gastoActual = get().gastos.find((gasto) => gasto.id === id) ?? await getById<Gasto>(COLLECTIONS.GASTOS, id);
        if (!gastoActual) throw new Error('Gasto no encontrado');

        const finalUpdates: Partial<Gasto> = {
          ...updates,
          ...(updates.detalle !== undefined ? { detalle: updates.detalle.trim() || undefined } : {}),
        };

        if (updates.tipoGastoId && updates.tipoGastoId !== gastoActual.tipoGastoId) {
          const tipoGasto = await getTipoGastoActivo(updates.tipoGastoId);
          finalUpdates.tipoGastoNombre = tipoGasto.nombre;
        }

        const gastoActualizado: Gasto = {
          ...gastoActual,
          ...finalUpdates,
          updatedAt: new Date(),
        };

        try {
          const requiereRecalculoDashboard =
            gastoActual.monto !== gastoActualizado.monto ||
            gastoActual.fecha.getTime() !== gastoActualizado.fecha.getTime();

          if (requiereRecalculoDashboard) {
            await syncDashboardGasto(gastoActual, -1);
            try {
              await syncDashboardGasto(gastoActualizado, 1);
            } catch (dashboardError) {
              await syncDashboardGasto(gastoActual, 1).catch(() => {});
              throw dashboardError;
            }
          }

          try {
            await update(COLLECTIONS.GASTOS, id, finalUpdates);
          } catch (persistError) {
            if (requiereRecalculoDashboard) {
              await syncDashboardGasto(gastoActualizado, -1).catch(() => {});
              await syncDashboardGasto(gastoActual, 1).catch(() => {});
            }
            throw persistError;
          }

          set((state) => ({
            gastos: sortGastos(
              state.gastos.map((gasto) =>
                gasto.id === id ? gastoActualizado : gasto
              )
            ),
          }));

          if (requiereRecalculoDashboard) {
            invalidateDashboardCache();
          }

          const cambios = detectarCambios(
            'gasto',
            gastoActual as unknown as Record<string, unknown>,
            gastoActualizado as unknown as Record<string, unknown>
          );
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'actualizacion',
            entidad: 'gasto',
            entidadId: id,
            entidadNombre: gastoActualizado.tipoGastoNombre,
            detalles: `Gasto actualizado: ${gastoActualizado.tipoGastoNombre}`,
            cambios: cambios.length > 0 ? cambios : undefined,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar gasto';
          set({ error: errorMessage });
          console.error('Error updating gasto:', error);
          throw error;
        }
      },

      deleteGasto: async (id) => {
        const gasto = get().gastos.find((item) => item.id === id) ?? await getById<Gasto>(COLLECTIONS.GASTOS, id);
        if (!gasto) throw new Error('Gasto no encontrado');

        try {
          await syncDashboardGasto(gasto, -1);
          try {
            await remove(COLLECTIONS.GASTOS, id);
          } catch (persistError) {
            await syncDashboardGasto(gasto, 1).catch(() => {});
            throw persistError;
          }

          set((state) => ({
            gastos: state.gastos.filter((item) => item.id !== id),
          }));

          invalidateDashboardCache();

          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'eliminacion',
            entidad: 'gasto',
            entidadId: id,
            entidadNombre: gasto.tipoGastoNombre,
            detalles: `Gasto eliminado: ${gasto.tipoGastoNombre} - $${gasto.monto.toFixed(2)} USD`,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar gasto';
          set({ error: errorMessage });
          console.error('Error deleting gasto:', error);
          throw error;
        }
      },

      getGasto: (id) => get().gastos.find((gasto) => gasto.id === id),
    }),
    { name: 'gastos-store' }
  )
);
