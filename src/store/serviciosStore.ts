import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { ENTITIES, getServicioById, getServicios, logCacheHit } from '@/lib/supabase/servicios-repository';
import { countVentasActivasByServicioUseCase } from '@/lib/use-cases/ventas-use-cases';
import {
  createServicioUseCase,
  deleteServicioUseCase,
  fetchServiciosCountsUseCase,
  resyncServicioReferenciasUseCase,
  updateServicioUseCase,
} from '@/lib/use-cases/servicios-use-cases';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import type { Servicio } from '@/types/servicios';
import type { ServicioPronostico } from '@/types/dashboard';

function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

function syncServicioPronosticoLocal(servicioId: string, pronostico: ServicioPronostico | null | undefined) {
  if (pronostico === undefined) return;

  import('./dashboardStore').then(({ useDashboardStore }) => {
    const store = useDashboardStore.getState();
    const currentStats = store.stats;
    if (!currentStats) return;

    const existing = currentStats.serviciosPronostico ?? [];
    const updated = pronostico
      ? existing.some((servicio) => servicio.id === servicioId)
        ? existing.map((servicio) => (servicio.id === servicioId ? pronostico : servicio))
        : [...existing, pronostico]
      : existing.filter((servicio) => servicio.id !== servicioId);

    useDashboardStore.setState({
      stats: { ...currentStats, serviciosPronostico: updated },
    });
    store.invalidateCache();
  }).catch(() => {});
}

function dispatchServicioDeleted() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('servicio-deleted', Date.now().toString());
  window.dispatchEvent(new Event('servicio-deleted'));
}

interface ServiciosState {
  servicios: Servicio[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  lastCountsFetch: number | null;
  selectedServicio: Servicio | null;

  totalServicios: number;
  serviciosActivos: number;
  totalCategoriasActivas: number;

  fetchServicios: (force?: boolean) => Promise<void>;
  fetchCounts: (force?: boolean) => Promise<void>;
  createServicio: (servicio: Omit<Servicio, 'id' | 'createdAt' | 'updatedAt' | 'perfilesOcupados'>) => Promise<void>;
  updateServicio: (id: string, updates: Partial<Servicio>) => Promise<void>;
  deleteServicio: (id: string, deletePayments?: boolean) => Promise<void>;
  setSelectedServicio: (servicio: Servicio | null) => void;
  getServicio: (id: string) => Servicio | undefined;
  getServiciosByCategoria: (categoriaId: string) => Servicio[];
  getServiciosDisponibles: () => Servicio[];
  updatePerfilOcupado: (id: string, shouldIncrement: boolean) => Promise<void>;
  resyncPerfilesDisponiblesTotal: () => Promise<{ categoriasActualizadas: number; serviciosCorregidos: number }>;
  resyncServicioReferencias: () => Promise<{ serviciosRevisados: number; ventasActualizadas: number }>;
}

const CACHE_TIMEOUT = 5 * 60 * 1000;

export const useServiciosStore = create<ServiciosState>()(
  devtools(
    (set, get) => ({
      servicios: [],
      isLoading: false,
      error: null,
      lastFetch: null,
      lastCountsFetch: null,
      selectedServicio: null,
      totalServicios: 0,
      serviciosActivos: 0,
      totalCategoriasActivas: 0,

      fetchServicios: async (force = false) => {
        const { lastFetch } = get();
        if (!force && lastFetch && Date.now() - lastFetch < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.SERVICIOS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const servicios = await getServicios<Servicio>();
          set({ servicios, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar servicios';
          console.error('Error fetching servicios:', error);
          set({ servicios: [], isLoading: false, error: errorMessage });
        }
      },

      fetchCounts: async (force = false) => {
        const { lastCountsFetch } = get();
        if (!force && lastCountsFetch && Date.now() - lastCountsFetch < CACHE_TIMEOUT) {
          logCacheHit('servicios-counts');
          return;
        }

        try {
          set({
            ...(await fetchServiciosCountsUseCase()),
            lastCountsFetch: Date.now(),
          });
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalServicios: 0, serviciosActivos: 0, totalCategoriasActivas: 0 });
        }
      },

      createServicio: async (servicioData) => {
        try {
          const { servicio, pronostico } = await createServicioUseCase(servicioData, {
            logContext: getLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          set((state) => ({
            servicios: [...state.servicios, servicio],
            error: null,
          }));
          syncServicioPronosticoLocal(servicio.id, pronostico);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear servicio';
          set({ error: errorMessage });
          console.error('Error creating servicio:', error);
          throw error;
        }
      },

      updateServicio: async (id, updates) => {
        try {
          const { servicioActualizado, pronostico } = await updateServicioUseCase(id, updates, {
            logContext: getLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          set((state) => ({
            servicios: state.servicios.map((servicio) =>
              servicio.id === id ? servicioActualizado : servicio
            ),
            selectedServicio:
              state.selectedServicio?.id === id ? servicioActualizado : state.selectedServicio,
            error: null,
          }));

          syncServicioPronosticoLocal(id, pronostico);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar servicio';
          set({ error: errorMessage });
          console.error('Error updating servicio:', error);
          throw error;
        }
      },

      deleteServicio: async (id, deletePayments = false) => {
        const currentServicios = get().servicios;
        set((state) => ({
          servicios: state.servicios.filter((servicio) => servicio.id !== id),
        }));

        try {
          await deleteServicioUseCase(id, {
            deletePayments,
            logContext: getLogContext(),
            recordActivityLog: useActivityLogStore.getState().addLog,
          });

          try {
            const { useNotificacionesStore } = await import('./notificacionesStore');
            await useNotificacionesStore.getState().deleteNotificacionesPorServicio(id);
          } catch {
            // Notifications cleanup is best-effort.
          }

          syncServicioPronosticoLocal(id, null);
          dispatchServicioDeleted();
          set({ error: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar servicio';
          set({ servicios: currentServicios, error: errorMessage });
          console.error('Error deleting servicio:', error);
          throw error;
        }
      },

      setSelectedServicio: (servicio) => {
        set({ selectedServicio: servicio });
      },

      getServicio: (id) => {
        return get().servicios.find((servicio) => servicio.id === id);
      },

      getServiciosByCategoria: (categoriaId) => {
        return get().servicios.filter(
          (servicio) => servicio.categoriaId === categoriaId && servicio.activo && !servicio.enReposo
        );
      },

      getServiciosDisponibles: () => {
        return get().servicios.filter(
          (servicio) =>
            servicio.activo &&
            !servicio.enReposo &&
            servicio.perfilesOcupados < servicio.perfilesDisponibles
        );
      },

      updatePerfilOcupado: async (id, shouldIncrement) => {
        const delta = shouldIncrement ? 1 : -1;

        try {
          let servicio = get().servicios.find((item) => item.id === id);

          if (!servicio) {
            const servicioDoc = await getServicioById<Servicio>(id);
            if (!servicioDoc) {
              console.error('Servicio not found in Supabase for updatePerfilOcupado');
              return;
            }
            servicio = servicioDoc;
          }

          const previousCount = servicio.perfilesOcupados || 0;
          const fallbackCount = Math.max(0, previousCount + delta);

          if (get().servicios.find((item) => item.id === id)) {
            set((state) => ({
              servicios: state.servicios.map((item) =>
                item.id === id
                  ? { ...item, perfilesOcupados: fallbackCount, updatedAt: new Date() }
                  : item
              ),
            }));
          }

          let realCount = fallbackCount;
          try {
            realCount = await countVentasActivasByServicioUseCase(id);
          } catch (countError) {
            console.error('Error counting active ventas for perfil ocupado:', countError);
          }

          if (get().servicios.find((item) => item.id === id)) {
            set((state) => ({
              servicios: state.servicios.map((item) =>
                item.id === id
                  ? { ...item, perfilesOcupados: realCount, updatedAt: new Date() }
                  : item
              ),
            }));
          }
        } catch (error) {
          console.error('Error updating perfil ocupado:', error);
          if (get().servicios.find((item) => item.id === id)) {
            set((state) => ({
              servicios: state.servicios.map((item) =>
                item.id === id ? { ...item, perfilesOcupados: Math.max(0, item.perfilesOcupados - delta) } : item
              ),
            }));
          }
        }
      },

      resyncPerfilesDisponiblesTotal: async () => {
        await get().fetchServicios(true);
        return { categoriasActualizadas: 0, serviciosCorregidos: 0 };
      },

      resyncServicioReferencias: async () => {
        return resyncServicioReferenciasUseCase();
      },
    }),
    { name: 'servicios-store' }
  )
);
