import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Servicio, MetodoPago, VentaDoc } from '@/types';
import { getAll, getById, getCount, create as createDoc, update, remove, COLLECTIONS, logCacheHit, adjustCategoriaGastos, queryDocuments } from '@/lib/firebase/firestore';
import { adjustGastosStats, getMesKeyFromDate, getDiaKeyFromDate, upsertServicioPronostico } from '@/lib/services/dashboardStatsService';
import { currencyService } from '@/lib/services/currencyService';
import { resyncServiciosDenormalizedData, syncServicioDependencias } from '@/lib/services/servicioSyncService';
import type { ServicioPronostico } from '@/types/dashboard';

function toServicioPronostico(s: Servicio): ServicioPronostico | null {
  if (!s.activo || s.enReposo || !s.fechaVencimiento || !s.cicloPago || s.costoServicio <= 0) return null;
  return {
    id: s.id,
    fechaVencimiento: s.fechaVencimiento instanceof Date
      ? s.fechaVencimiento.toISOString()
      : String(s.fechaVencimiento),
    cicloPago: s.cicloPago,
    costoServicio: s.costoServicio,
    moneda: s.moneda || 'USD',
  };
}
import { doc as firestoreDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { crearPagoInicial } from '@/lib/services/pagosServicioService';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import { sincronizarUnServicio } from '@/lib/services/notificationSyncService';

// Helper para obtener contexto de usuario
function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

interface ServiciosState {
  servicios: Servicio[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  lastCountsFetch: number | null; // Cache para fetchCounts
  selectedServicio: Servicio | null;

  // Counts for metrics (free queries)
  totalServicios: number;
  serviciosActivos: number;
  totalCategoriasActivas: number;

  // Actions
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
  resyncPerfilesDisponiblesTotal: (preFetchedData?: { ventas?: VentaDoc[]; servicios?: Servicio[]; categorias?: { id: string }[] }) => Promise<{ categoriasActualizadas: number; serviciosCorregidos: number }>;
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
        if (!force && lastFetch && (Date.now() - lastFetch) < CACHE_TIMEOUT) {
          logCacheHit(COLLECTIONS.SERVICIOS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const servicios = await getAll<Servicio>(COLLECTIONS.SERVICIOS);
          set({ servicios, isLoading: false, error: null, lastFetch: Date.now() });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al cargar servicios';
          console.error('Error fetching servicios:', error);
          set({ servicios: [], isLoading: false, error: errorMessage });
        }
      },

      fetchCounts: async (force = false) => {
        const { lastCountsFetch } = get();

        // Cache de 5 minutos
        if (!force && lastCountsFetch && (Date.now() - lastCountsFetch) < CACHE_TIMEOUT) {
          logCacheHit('servicios-counts');
          return;
        }

        try {
          const [
            totalServiciosRaw,
            serviciosEnReposo,
            serviciosActivosRaw,
            serviciosEnReposoDocs,
            totalCategoriasActivas
          ] = await Promise.all([
            getCount(COLLECTIONS.SERVICIOS, []),
            getCount(COLLECTIONS.SERVICIOS, [{ field: 'enReposo', operator: '==', value: true }]),
            getCount(COLLECTIONS.SERVICIOS, [{ field: 'activo', operator: '==', value: true }]),
            queryDocuments<Servicio>(COLLECTIONS.SERVICIOS, [{ field: 'enReposo', operator: '==', value: true }]),
            getCount(COLLECTIONS.CATEGORIAS, [{ field: 'activo', operator: '==', value: true }]),
          ]);
          const serviciosActivosEnReposo = serviciosEnReposoDocs.filter((s) => s.activo).length;
          const totalServicios = Math.max(0, totalServiciosRaw - serviciosEnReposo);
          const serviciosActivos = Math.max(0, serviciosActivosRaw - serviciosActivosEnReposo);
          set({
            totalServicios,
            serviciosActivos,
            totalCategoriasActivas,
            lastCountsFetch: Date.now()
          });
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalServicios: 0, serviciosActivos: 0, totalCategoriasActivas: 0 });
        }
      },

      createServicio: async (servicioData) => {
        try {
          // Obtener método de pago completo para denormalizar
          let metodoPagoNombre: string | undefined;
          let moneda: string | undefined;
          if (servicioData.metodoPagoId) {
            const metodoPago = await getById<MetodoPago>(COLLECTIONS.METODOS_PAGO, servicioData.metodoPagoId);
            metodoPagoNombre = metodoPago?.nombre;
            moneda = metodoPago?.moneda;
          }

          const id = await createDoc(COLLECTIONS.SERVICIOS, {
            ...servicioData,
            metodoPagoNombre,  // Denormalizado
            moneda,            // Denormalizado
            perfilesOcupados: 0,
            gastosTotal: servicioData.costoServicio ?? 0,
          });

          // Create initial PagoServicio record usando el servicio dedicado
          await crearPagoInicial(
            id,
            servicioData.categoriaId,
            servicioData.costoServicio ?? 0,
            servicioData.metodoPagoId || '',
            metodoPagoNombre || '',
            moneda || 'USD',
            servicioData.cicloPago ?? 'mensual',
            servicioData.fechaInicio ?? new Date(),
            servicioData.fechaVencimiento ?? new Date(),
            servicioData.notas
          );

          // Actualizar contadores de la categoría
          const categoriaRef = firestoreDoc(db, COLLECTIONS.CATEGORIAS, servicioData.categoriaId);
          const isContableEnServicios = !servicioData.enReposo;
          const isActivoContable = isContableEnServicios && servicioData.activo !== false;
          await updateDoc(categoriaRef, {
            totalServicios: increment(isContableEnServicios ? 1 : 0),
            serviciosActivos: increment(isActivoContable ? 1 : 0),
            perfilesDisponiblesTotal: increment(isActivoContable ? (servicioData.perfilesDisponibles ?? 0) : 0),
          });
          // Denormalizar gasto inicial en la categoría (convertido a USD)
          if (servicioData.costoServicio) {
            const costoUSD = await currencyService.convertToUSD(servicioData.costoServicio, moneda ?? 'USD');
            await adjustCategoriaGastos(servicioData.categoriaId, costoUSD);
          }

          // Actualizar estadísticas del dashboard (non-blocking)
          adjustGastosStats({
            delta: servicioData.costoServicio ?? 0,
            moneda: moneda ?? 'USD',
            mes: getMesKeyFromDate(servicioData.fechaInicio ?? new Date()),
            dia: getDiaKeyFromDate(servicioData.fechaInicio ?? new Date()),
            categoriaId: servicioData.categoriaId,
            categoriaNombre: servicioData.categoriaNombre,
          }).catch((err) => console.error('[ServiciosStore] Error updating dashboard gastos:', err));

          const newServicio: Servicio = {
            ...servicioData,
            id,
            perfilesOcupados: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          } as Servicio;

          set((state) => ({
            servicios: [...state.servicios, newServicio],
            error: null
          }));

          // Actualizar dashboard store local INMEDIATAMENTE + persistir a Firestore en background
          const servicioPronostico = toServicioPronostico(newServicio);
          if (servicioPronostico) {
            import('./dashboardStore').then(({ useDashboardStore }) => {
              const currentStats = useDashboardStore.getState().stats;
              if (currentStats) {
                const existing = currentStats.serviciosPronostico ?? [];
                const updated = [...existing.filter(s => s.id !== newServicio.id), servicioPronostico];
                useDashboardStore.setState({
                  stats: { ...currentStats, serviciosPronostico: updated },
                });
              }
            }).catch(() => {});
            upsertServicioPronostico(servicioPronostico, newServicio.id).catch((err) => console.error('[ServiciosStore] Error upserting pronostico:', err));
          }

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'creacion',
            entidad: 'servicio',
            entidadId: id,
            entidadNombre: `${servicioData.nombre} [${servicioData.correo}]`,
            detalles: `Servicio creado: "${servicioData.nombre}" [${servicioData.correo}] (${servicioData.tipo}) — $${servicioData.costoServicio ?? 0} ${moneda ?? 'USD'} (${servicioData.cicloPago ?? 'mensual'})`,
          }).catch(() => {});

          // ✅ Sync notifications for this new service (non-blocking)
          sincronizarUnServicio(id).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear servicio';
          set({ error: errorMessage });
          console.error('Error creating servicio:', error);
          throw error;
        }
      },

      updateServicio: async (id, updates) => {
        try {
          // Obtener el servicio directamente de Firestore (no del store local)
          const servicio = await getById<Servicio>(COLLECTIONS.SERVICIOS, id);
          if (!servicio) throw new Error('Servicio not found');

          let finalUpdates = { ...updates };

          // Si cambia metodoPagoId, actualizar campos denormalizados
          if (updates.metodoPagoId !== undefined) {
            const metodoPago = updates.metodoPagoId
              ? await getById<MetodoPago>(COLLECTIONS.METODOS_PAGO, updates.metodoPagoId)
              : null;

            finalUpdates = {
              ...finalUpdates,
              metodoPagoNombre: metodoPago?.nombre,
              moneda: metodoPago?.moneda,
            };
          }

          await update(COLLECTIONS.SERVICIOS, id, finalUpdates);

          // Recalcular contadores de categoria (total/activos/perfiles) excluyendo servicios en reposo
          {
            const prevEnReposo = !!servicio.enReposo;
            const nextEnReposo = !!(finalUpdates.enReposo ?? servicio.enReposo);
            const prevActivo = !!servicio.activo;
            const nextActivo = !!(finalUpdates.activo ?? servicio.activo);
            const prevCategoriaId = servicio.categoriaId;
            const nextCategoriaId = finalUpdates.categoriaId ?? servicio.categoriaId;
            const prevContable = !prevEnReposo;
            const nextContable = !nextEnReposo;
            const prevActivoContable = prevContable && prevActivo;
            const nextActivoContable = nextContable && nextActivo;
            const nextPerfilesDisponibles = finalUpdates.perfilesDisponibles ?? servicio.perfilesDisponibles;
            const nextPerfilesOcupados = finalUpdates.perfilesOcupados ?? servicio.perfilesOcupados;
            const perfilesLibresPrev = prevActivoContable
              ? Math.max((servicio.perfilesDisponibles || 0) - (servicio.perfilesOcupados || 0), 0)
              : 0;
            const perfilesLibresNext = nextActivoContable
              ? Math.max((nextPerfilesDisponibles || 0) - (nextPerfilesOcupados || 0), 0)
              : 0;
            if (prevCategoriaId !== nextCategoriaId) {
              const categoriaAnteriorRef = firestoreDoc(db, COLLECTIONS.CATEGORIAS, prevCategoriaId);
              const categoriaNuevaRef = firestoreDoc(db, COLLECTIONS.CATEGORIAS, nextCategoriaId);

              await Promise.all([
                updateDoc(categoriaAnteriorRef, {
                  totalServicios: increment(prevContable ? -1 : 0),
                  serviciosActivos: increment(prevActivoContable ? -1 : 0),
                  perfilesDisponiblesTotal: increment(-perfilesLibresPrev),
                }),
                updateDoc(categoriaNuevaRef, {
                  totalServicios: increment(nextContable ? 1 : 0),
                  serviciosActivos: increment(nextActivoContable ? 1 : 0),
                  perfilesDisponiblesTotal: increment(perfilesLibresNext),
                }),
              ]);
            } else {
              const deltaTotalServicios = (nextContable ? 1 : 0) - (prevContable ? 1 : 0);
              const deltaServiciosActivos = (nextActivoContable ? 1 : 0) - (prevActivoContable ? 1 : 0);
              const deltaPerfilesDisponibles = perfilesLibresNext - perfilesLibresPrev;

              if (deltaTotalServicios !== 0 || deltaServiciosActivos !== 0 || deltaPerfilesDisponibles !== 0) {
                const categoriaRef = firestoreDoc(db, COLLECTIONS.CATEGORIAS, servicio.categoriaId);
                await updateDoc(categoriaRef, {
                  totalServicios: increment(deltaTotalServicios),
                  serviciosActivos: increment(deltaServiciosActivos),
                  perfilesDisponiblesTotal: increment(deltaPerfilesDisponibles),
                });
              }
            }
          }

          const servicioActualizado = {
            ...servicio,
            ...finalUpdates,
          } as Servicio;

          await syncServicioDependencias(
            {
              id: servicio.id,
              nombre: servicio.nombre,
              correo: servicio.correo,
              contrasena: servicio.contrasena,
              categoriaId: servicio.categoriaId,
              categoriaNombre: servicio.categoriaNombre,
            },
            {
              id: servicioActualizado.id,
              nombre: servicioActualizado.nombre,
              correo: servicioActualizado.correo,
              contrasena: servicioActualizado.contrasena,
              categoriaId: servicioActualizado.categoriaId,
              categoriaNombre: servicioActualizado.categoriaNombre,
            }
          );

          // Sync dashboard forecast when activo/enReposo changes
          if (
            (updates.activo !== undefined && updates.activo !== servicio.activo) ||
            (updates.enReposo !== undefined && updates.enReposo !== servicio.enReposo)
          ) {
            const servicioPronostico = toServicioPronostico(servicioActualizado);

            // Update local dashboard state immediately + invalidate cache
            import('./dashboardStore').then(({ useDashboardStore }) => {
              const store = useDashboardStore.getState();
              const currentStats = store.stats;
              if (currentStats) {
                const existing = currentStats.serviciosPronostico ?? [];
                const updated = servicioPronostico
                  ? existing.some(s => s.id === id)
                    ? existing.map(s => s.id === id ? servicioPronostico : s)
                    : [...existing, servicioPronostico]
                  : existing.filter(s => s.id !== id);
                useDashboardStore.setState({
                  stats: { ...currentStats, serviciosPronostico: updated },
                });
              }
              store.invalidateCache();
            }).catch(() => {});

            upsertServicioPronostico(servicioPronostico, id).catch(() => {});
          }

          // Detectar cambios para el log
          const cambios = detectarCambios('servicio', servicio, {
            ...servicio,
            ...finalUpdates
          });

          set((state) => ({
            servicios: state.servicios.map((s) =>
              s.id === id
                ? { ...s, ...finalUpdates, updatedAt: new Date() }
                : s
            ),
            selectedServicio:
              state.selectedServicio?.id === id
                ? { ...state.selectedServicio, ...finalUpdates, updatedAt: new Date() }
                : state.selectedServicio,
            error: null
          }));

          // Registrar en log de actividad con cambios
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'actualizacion',
            entidad: 'servicio',
            entidadId: id,
            entidadNombre: `${servicio.nombre} [${servicio.correo}]`,
            detalles: `Servicio actualizado: "${servicio.nombre}" [${servicio.correo}]`,
            cambios: cambios.length > 0 ? cambios : undefined,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar servicio';
          set({ error: errorMessage });
          console.error('Error updating servicio:', error);
          throw error;
        }
      },

      deleteServicio: async (id, deletePayments = false) => {
        try {
          // Obtener el servicio directamente de Firestore (no del store local)
          const servicio = await getById<Servicio>(COLLECTIONS.SERVICIOS, id);
          if (!servicio) throw new Error('Servicio not found');

          // Optimistic update del store local (si existe)
          set((state) => ({
            servicios: state.servicios.filter((s) => s.id !== id)
          }));

          // Calcular gastosTotal real desde pagos antes de eliminarlos
          // (el valor denormalizado puede estar desincronizado si el usuario borró pagos individualmente)
          let gastosRealUSD = 0;
          {
            const pagosActuales = await queryDocuments<{ id: string; monto: number; moneda?: string }>(
              COLLECTIONS.PAGOS_SERVICIO,
              [{ field: 'servicioId', operator: '==', value: id }]
            );
            const conversiones = pagosActuales.map(async (p) => {
              const usd = await currencyService.convertToUSD(p.monto, p.moneda ?? 'USD');
              gastosRealUSD += usd;
            });
            await Promise.all(conversiones);

            // Si se solicita, eliminar todos los pagos del servicio
            if (deletePayments) {
              const { remove: removeDoc } = await import('@/lib/firebase/firestore');
              await Promise.all(pagosActuales.map(pago => removeDoc(COLLECTIONS.PAGOS_SERVICIO, pago.id)));
            }
          }

          // Eliminar el servicio de Firestore
          await remove(COLLECTIONS.SERVICIOS, id);

          // Decrementar contadores de la categoría
          const categoriaRef = firestoreDoc(db, COLLECTIONS.CATEGORIAS, servicio.categoriaId);
          const isContableEnServicios = !servicio.enReposo;
          const isActivoContable = isContableEnServicios && servicio.activo;
          const perfilesDisponibles = isActivoContable
            ? Math.max((servicio.perfilesDisponibles || 0) - (servicio.perfilesOcupados || 0), 0)
            : 0;
          await updateDoc(categoriaRef, {
            totalServicios: increment(isContableEnServicios ? -1 : 0),
            serviciosActivos: increment(isActivoContable ? -1 : 0),
            perfilesDisponiblesTotal: increment(-perfilesDisponibles),
          });
          // Restar el gastosTotal REAL (recalculado desde pagos) de la categoría
          if (gastosRealUSD > 0) {
            await adjustCategoriaGastos(servicio.categoriaId, -gastosRealUSD);
          }

          // Restar de estadísticas del dashboard (non-blocking)
          if (servicio.costoServicio) {
            adjustGastosStats({
              delta: -(servicio.costoServicio),
              moneda: servicio.moneda ?? 'USD',
              mes: getMesKeyFromDate(servicio.fechaInicio ?? new Date()),
              dia: getDiaKeyFromDate(servicio.fechaInicio ?? new Date()),
              categoriaId: servicio.categoriaId,
              categoriaNombre: servicio.categoriaNombre,
            }).catch((err) => console.error('[ServiciosStore] Error reverting dashboard gastos:', err));
          }

          // Eliminar notificaciones asociadas a este servicio
          try {
            const { useNotificacionesStore } = await import('./notificacionesStore');
            await useNotificacionesStore.getState().deleteNotificacionesPorServicio(id);
          } catch {
            // Notifications cleanup is best-effort, don't fail the delete
          }

          // Actualizar dashboard store local INMEDIATAMENTE + persistir a Firestore en background
          import('./dashboardStore').then(({ useDashboardStore }) => {
            const currentStats = useDashboardStore.getState().stats;
            if (currentStats) {
              const updated = (currentStats.serviciosPronostico ?? []).filter(s => s.id !== id);
              useDashboardStore.setState({
                stats: { ...currentStats, serviciosPronostico: updated },
              });
            }
          }).catch(() => {});
          upsertServicioPronostico(null, id).catch((err) => console.error('[ServiciosStore] Error removing pronostico:', err));

          // Notificar a otras páginas que se eliminó un servicio
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('servicio-deleted', Date.now().toString());
            window.dispatchEvent(new Event('servicio-deleted'));
          }

          set({ error: null });

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'eliminacion',
            entidad: 'servicio',
            entidadId: id,
            entidadNombre: `${servicio.nombre} [${servicio.correo}]`,
            detalles: `Servicio eliminado: "${servicio.nombre}" (${servicio.correo})`,
          }).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar servicio';
          set({ error: errorMessage });
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
          // Obtener servicio de Firebase si no está en el store
          let servicio = get().servicios.find((s) => s.id === id);

          if (!servicio) {
            // Si no está en el store, obtenerlo de Firebase
            const servicioDoc = await getById<Servicio>(COLLECTIONS.SERVICIOS, id);
            if (!servicioDoc) {
              console.error('Servicio not found in Firebase for updatePerfilOcupado');
              return;
            }
            servicio = servicioDoc;
          }

          // Actualizar en el store local si existe
          if (get().servicios.find((s) => s.id === id)) {
            set((state) => ({
              servicios: state.servicios.map((s) =>
                s.id === id
                  ? { ...s, perfilesOcupados: Math.max(0, s.perfilesOcupados + delta), updatedAt: new Date() }
                  : s
              ),
            }));
          }

          // Actualizar en Firebase
          const docRef = firestoreDoc(db, COLLECTIONS.SERVICIOS, id);
          await updateDoc(docRef, {
            perfilesOcupados: increment(delta),
          });

          // Actualizar perfilesDisponiblesTotal de la categoría (inverso del delta)
          if (servicio.activo && !servicio.enReposo) {
            const categoriaRef = firestoreDoc(db, COLLECTIONS.CATEGORIAS, servicio.categoriaId);
            await updateDoc(categoriaRef, {
              perfilesDisponiblesTotal: increment(-delta), // Si ocupamos +1, disponibles -1
            });
          }
        } catch (error) {
          console.error('Error updating perfil ocupado:', error);
          // Rollback local si existe en el store
          if (get().servicios.find((s) => s.id === id)) {
            set((state) => ({
              servicios: state.servicios.map((s) =>
                s.id === id ? { ...s, perfilesOcupados: Math.max(0, s.perfilesOcupados - delta) } : s
              ),
            }));
          }
        }
      },

      resyncPerfilesDisponiblesTotal: async (preFetchedData?: { ventas?: VentaDoc[], servicios?: Servicio[], categorias?: { id: string }[] }) => {
        // 1. Contar ventas activas (no inactivas) por servicioId desde la fuente de verdad
        const ventasActivas = preFetchedData?.ventas 
          ? preFetchedData.ventas.filter(v => v.estado !== 'inactivo')
          : await queryDocuments<VentaDoc>(COLLECTIONS.VENTAS, [
            { field: 'estado', operator: '!=', value: 'inactivo' },
          ]);

        // Contar perfiles ocupados reales por servicioId (solo ventas con perfilNumero asignado)
        const ocupadosPorServicio = new Map<string, number>();
        for (const v of ventasActivas) {
          if (v.servicioId && v.perfilNumero) {
            ocupadosPorServicio.set(v.servicioId, (ocupadosPorServicio.get(v.servicioId) ?? 0) + 1);
          }
        }

        // 2. Leer todos los servicios y corregir perfilesOcupados donde no coincida
        const servicios = preFetchedData?.servicios || await getAll<Servicio>(COLLECTIONS.SERVICIOS);
        const servicioUpdates: Promise<void>[] = [];

        for (const s of servicios) {
          const ocupadosReal = ocupadosPorServicio.get(s.id) ?? 0;
          if (s.perfilesOcupados !== ocupadosReal) {
            // Corregir en Firebase con set absoluto (no increment)
            const ref = firestoreDoc(db, COLLECTIONS.SERVICIOS, s.id);
            servicioUpdates.push(updateDoc(ref, { perfilesOcupados: ocupadosReal }));
          }
        }
        await Promise.all(servicioUpdates);

        // 3. Recalcular perfilesDisponiblesTotal por categoría usando los valores corregidos
        const totalPorCategoria = new Map<string, number>();
        for (const s of servicios) {
          if (!s.activo || s.enReposo) continue;
          const ocupadosReal = ocupadosPorServicio.get(s.id) ?? 0;
          const libres = Math.max((s.perfilesDisponibles || 0) - ocupadosReal, 0);
          totalPorCategoria.set(s.categoriaId, (totalPorCategoria.get(s.categoriaId) ?? 0) + libres);
        }

        // Sobrescribir el campo en cada categoría afectada
        const categorias = preFetchedData?.categorias || await getAll<{ id: string }>(COLLECTIONS.CATEGORIAS);
        const categoriaUpdates = categorias.map((categoria) => {
          const total = totalPorCategoria.get(categoria.id) ?? 0;
          const ref = firestoreDoc(db, COLLECTIONS.CATEGORIAS, categoria.id);
          return updateDoc(ref, { perfilesDisponiblesTotal: total });
        });
        await Promise.all(categoriaUpdates);

        // 4. Actualizar store local con valores corregidos
        if (servicioUpdates.length > 0) {
          set((state) => ({
            servicios: state.servicios.map((s) => {
              const ocupadosReal = ocupadosPorServicio.get(s.id) ?? 0;
              return s.perfilesOcupados !== ocupadosReal
                ? { ...s, perfilesOcupados: ocupadosReal }
                : s;
            }),
          }));
        }

        return { categoriasActualizadas: categoriaUpdates.length, serviciosCorregidos: servicioUpdates.length };
      },

      resyncServicioReferencias: async () => {
        try {
          return await resyncServiciosDenormalizedData();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al resincronizar referencias de servicios';
          set({ error: errorMessage });
          console.error('[ServiciosStore] Error resyncing servicio references:', error);
          throw error;
        }
      },
    }),
    { name: 'servicios-store' }
  )
);

