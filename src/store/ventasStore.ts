import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { VentaDoc, MetodoPago, PagoVenta } from '@/types';
import { getAll, getById, getCount, create as createDoc, update, remove, ENTITIES, logCacheHit, adjustServiciosActivos, queryDocuments, adjustCategoriaSuscripciones } from '@/lib/supabase/ventas-repository';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';
import { format } from 'date-fns';
import { detectarCambios } from '@/lib/utils/activityLogHelpers';
import { sincronizarUnaVenta } from '@/lib/services/notificationSyncService';
import { adjustIngresosStats, getMesKeyFromDate, getDiaKeyFromDate, upsertVentaPronostico } from '@/lib/services/dashboardStatsService';
import type { VentaPronostico } from '@/types/dashboard';
import { currencyService } from '@/lib/services/currencyService';
import { toast } from 'sonner';

function toVentaPronostico(v: VentaDoc): VentaPronostico | null {
  if (v.estado === 'inactivo' || !v.fechaFin || !v.cicloPago) return null;
  return {
    id: v.id,
    categoriaId: v.categoriaId ?? '',
    fechaInicio: v.fechaInicio instanceof Date ? format(v.fechaInicio, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaInicio ?? new Date()),
    fechaFin: v.fechaFin instanceof Date ? format(v.fechaFin, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaFin),
    cicloPago: v.cicloPago,
    precioFinal: v.precio || v.precioFinal || 0,
    moneda: v.moneda || 'USD',
  };
}

// Helper para obtener contexto de usuario
function getLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}

interface VentasState {
  ventas: VentaDoc[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  selectedVenta: VentaDoc | null;

  // Counts for metrics (free queries)
  totalVentas: number;
  ventasActivas: number;
  ventasInactivas: number;

  // Actions
  fetchVentas: (force?: boolean) => Promise<void>;
  fetchCounts: () => Promise<void>;
  createVenta: (venta: Omit<VentaDoc, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateVenta: (id: string, updates: Partial<VentaDoc>) => Promise<void>;
  deleteVenta: (id: string, servicioId?: string, perfilNumero?: number | null, deletePagos?: boolean) => Promise<void>;
  setSelectedVenta: (venta: VentaDoc | null) => void;
  getVenta: (id: string) => VentaDoc | undefined;
  getVentasByEstado: (estado: 'activo' | 'inactivo') => VentaDoc[];
}

const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

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
        if (!force && lastFetch && (Date.now() - lastFetch) < CACHE_TIMEOUT) {
          logCacheHit(ENTITIES.VENTAS);
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const ventas = await getAll<VentaDoc>(ENTITIES.VENTAS);
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
            getCount(ENTITIES.VENTAS, []),
            getCount(ENTITIES.VENTAS, [{ field: 'estado', operator: '==', value: 'activo' }]),
            getCount(ENTITIES.VENTAS, [{ field: 'estado', operator: '==', value: 'inactivo' }]),
          ]);
          set({ totalVentas, ventasActivas, ventasInactivas });
        } catch (error) {
          console.error('Error fetching counts:', error);
          set({ totalVentas: 0, ventasActivas: 0, ventasInactivas: 0 });
        }
      },

      createVenta: async (ventaData) => {
        try {
          // Extraer solo el campo pagos que NO va en VentaDoc
          const {
            pagos,
            ...ventaDataLimpia
          } = ventaData;

          // Paso 1: Crear la venta CON todos los campos denormalizados necesarios para notificaciones
          // Incluye: fechaInicio, fechaFin, cicloPago, precio, descuento, precioFinal, metodoPagoId, metodoPagoNombre, moneda
          const ventaDocData = {
            ...ventaDataLimpia,
          };

          const ventaId = await createDoc(ENTITIES.VENTAS, ventaDocData);

          // Paso 2: Crear el pago inicial en la colección separada (fuente de verdad)
          if (pagos && pagos.length > 0) {
            const pagoInicial = pagos[0];
            await createDoc(ENTITIES.PAGOS_VENTA, {
              ventaId,
              clienteId: ventaData.clienteId || '',
              clienteNombre: ventaData.clienteNombre,
              categoriaId: ventaData.categoriaId,  // Denormalizado para queries
              fecha: pagoInicial.fecha || new Date(),
              monto: pagoInicial.total || ventaData.precioFinal,
              precio: ventaData.precio,                         // Precio original
              descuento: ventaData.descuento,                   // Porcentaje de descuento
              metodoPagoId: ventaData.metodoPagoId,             // Denormalizado
              metodoPago: ventaData.metodoPagoNombre,
              moneda: ventaData.moneda,                         // Denormalizado
              notas: pagoInicial.notas ?? '',
              isPagoInicial: true,
              cicloPago: ventaData.cicloPago,
              fechaInicio: ventaData.fechaInicio,
              fechaVencimiento: ventaData.fechaFin,
            });
          }

          const newVenta: VentaDoc = {
            ...ventaDataLimpia,
            id: ventaId,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          set((state) => ({
            ventas: [...state.ventas, newVenta]
          }));

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'creacion',
            entidad: 'venta',
            entidadId: ventaId,
            entidadNombre: `${ventaData.clienteNombre} — ${ventaData.servicioNombre}`,
            detalles: `Venta creada: ${ventaData.clienteNombre} / ${ventaData.servicioNombre} — $${ventaData.precioFinal ?? 0} ${ventaData.moneda ?? 'USD'} — ${format(ventaData.fechaInicio ?? new Date(), 'dd/MM/yyyy')} al ${format(ventaData.fechaFin ?? new Date(), 'dd/MM/yyyy')} (${ventaData.cicloPago})`,
          }).catch(() => {});

          // Actualizar contadores de la categoría (convertir precio a USD)
          if (ventaDataLimpia.categoriaId && ventaData.precioFinal) {
            const precioFinalUSD = await currencyService.convertToUSD(ventaData.precioFinal, ventaData.moneda ?? 'USD');
            await adjustCategoriaSuscripciones(ventaDataLimpia.categoriaId, 1, precioFinalUSD);
          }

          // Actualizar estadísticas del dashboard (non-blocking)
          adjustIngresosStats({
            delta: ventaData.precioFinal ?? 0,
            moneda: ventaData.moneda ?? 'USD',
            mes: getMesKeyFromDate(ventaData.fechaInicio ?? new Date()),
            dia: getDiaKeyFromDate(ventaData.fechaInicio ?? new Date()),
            categoriaId: ventaData.categoriaId ?? '',
            categoriaNombre: ventaData.categoriaNombre ?? '',
          }).catch((err) => console.error('[VentasStore] Error updating dashboard ingresos:', err));

          // Actualizar dashboard store local INMEDIATAMENTE + upsert a Supabase en background
          const ventaPronostico = toVentaPronostico(newVenta);
          if (ventaPronostico) {
            // 1. Actualizar estado local del dashboard de inmediato (antes de que el usuario navegue)
            import('./dashboardStore').then(({ useDashboardStore }) => {
              const currentStats = useDashboardStore.getState().stats;
              if (currentStats) {
                const existing = currentStats.ventasPronostico ?? [];
                const updated = [...existing.filter(v => v.id !== newVenta.id), ventaPronostico];
                useDashboardStore.setState({
                  stats: { ...currentStats, ventasPronostico: updated },
                });
              }
            }).catch(() => {});

            // 2. Persistir a Supabase en background (non-blocking)
            upsertVentaPronostico(ventaPronostico, newVenta.id).catch((err) => {
              console.error('[VentasStore] Error upserting pronostico:', err);
              toast.warning('El pronóstico del dashboard puede estar desactualizado', { duration: 4000 });
            });
          }

          // Dispatch event for cross-component updates
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('venta-created', Date.now().toString());
            window.dispatchEvent(new Event('venta-created'));
          }

          // ✅ Sync notifications for this new venta (non-blocking)
          sincronizarUnaVenta(ventaId).catch(() => {});
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear venta';
          set({ error: errorMessage });
          console.error('Error creating venta:', error);
          throw error;
        }
      },

      updateVenta: async (id, updates) => {
        try {
          // Obtener la venta actual para comparar valores
          const ventaActual = get().ventas.find(v => v.id === id);
          if (!ventaActual) {
            const ventaDoc = await getById<VentaDoc>(ENTITIES.VENTAS, id);
            if (!ventaDoc) throw new Error('Venta no encontrada');
          }

          let finalUpdates = { ...updates };

          // Si cambia metodoPagoId, actualizar campos denormalizados
          if (updates.metodoPagoId !== undefined) {
            const metodoPago = updates.metodoPagoId
              ? await getById<MetodoPago>(ENTITIES.METODOS_PAGO, updates.metodoPagoId)
              : null;

            finalUpdates = {
              ...finalUpdates,
              metodoPagoNombre: metodoPago?.nombre,
              moneda: metodoPago?.moneda,
            };
          }

          await update(ENTITIES.VENTAS, id, finalUpdates);

          // Actualizar contadores de categoría y usuario si cambió el estado, precio o la categoría
          const ventaAnterior = ventaActual || await getById<VentaDoc>(ENTITIES.VENTAS, id);
          if (ventaAnterior) {
            const precioAnterior = ventaAnterior.precioFinal || 0;
            const precioNuevo = updates.precioFinal !== undefined ? updates.precioFinal : precioAnterior;
            const categoriaAnterior = ventaAnterior.categoriaId;
            const categoriaNueva = updates.categoriaId || categoriaAnterior;
            const estadoAnterior = ventaAnterior.estado || 'activo';
            const estadoNuevo = updates.estado || estadoAnterior;

            // 1. Sincronizar serviciosActivos del USUARIO si cambió el estado
            if (updates.estado !== undefined && estadoAnterior !== estadoNuevo) {
              const clienteId = ventaAnterior.clienteId;
              if (clienteId) {
                if (estadoNuevo === 'inactivo') {
                  // Pasó de activo a inactivo -> restar 1
                  await adjustServiciosActivos(clienteId, -1);
                } else if (estadoAnterior === 'inactivo') {
                  // Pasó de inactivo a activo -> sumar 1
                  await adjustServiciosActivos(clienteId, 1);
                }
              }
            }

            // 2. Sincronizar perfilesOcupados del SERVICIO si cambió el estado
            if (updates.estado !== undefined && estadoAnterior !== estadoNuevo && ventaAnterior.servicioId) {
              // NOTE: Dynamic import is intentional to avoid a circular module dependency.
              // serviciosStore → (via syncServicioDependencias) → ventasStore creates a cycle.
              // Lazy import breaks this cycle by deferring resolution until runtime.
              const { useServiciosStore } = await import('./serviciosStore');
              if (estadoNuevo === 'inactivo') {
                await useServiciosStore.getState().updatePerfilOcupado(ventaAnterior.servicioId, false);
              } else if (estadoAnterior === 'inactivo') {
                await useServiciosStore.getState().updatePerfilOcupado(ventaAnterior.servicioId, true);
              }
            }

            // 3. Sincronizar contadores de la CATEGORÍA
            if (updates.categoriaId && categoriaAnterior !== categoriaNueva) {
              // Si cambió la categoría: restar de la anterior y sumar a la nueva
              if (categoriaAnterior) {
                const precioUSD = await currencyService.convertToUSD(precioAnterior, ventaAnterior.moneda ?? 'USD');
                await adjustCategoriaSuscripciones(categoriaAnterior, -1, -precioUSD);
              }
              if (categoriaNueva) {
                const precioUSD = await currencyService.convertToUSD(precioNuevo, updates.moneda ?? ventaAnterior.moneda ?? 'USD');
                await adjustCategoriaSuscripciones(categoriaNueva, 1, precioUSD);
              }
            } else if (estadoAnterior !== estadoNuevo) {
              // Si cambió el estado (misma categoría): sumar/restar 1 venta e ingresos
              if (categoriaAnterior) {
                const precioUSD = await currencyService.convertToUSD(precioNuevo, updates.moneda ?? ventaAnterior.moneda ?? 'USD');
                const delta = estadoNuevo === 'inactivo' ? -1 : 1;
                await adjustCategoriaSuscripciones(categoriaAnterior, delta, delta * precioUSD);
              }
            } else if (updates.precioFinal !== undefined && precioAnterior !== precioNuevo) {
              // Si solo cambió el precio (misma categoría, mismo estado): ajustar solo ingresos
              const diffOriginal = precioNuevo - precioAnterior;
              const diffUSD = await currencyService.convertToUSD(diffOriginal, updates.moneda ?? ventaAnterior.moneda ?? 'USD');
              if (categoriaAnterior && diffUSD !== 0) {
                await adjustCategoriaSuscripciones(categoriaAnterior, 0, diffUSD);
              }
            }
          }

          // Detectar cambios para el log
          const cambios = ventaAnterior ? detectarCambios('venta', ventaAnterior, {
            ...ventaAnterior,
            ...finalUpdates
          }) : [];

          set((state) => ({
            ventas: state.ventas.map((venta) =>
              venta.id === id
                ? { ...venta, ...finalUpdates, updatedAt: new Date() }
                : venta
            )
          }));

          // Registrar en log de actividad con cambios
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'actualizacion',
            entidad: 'venta',
            entidadId: id,
            entidadNombre: (ventaAnterior?.clienteNombre && ventaAnterior?.servicioNombre)
              ? `${ventaAnterior.clienteNombre} — ${ventaAnterior.servicioNombre}`
              : '',
            detalles: `Venta actualizada: ${ventaAnterior?.clienteNombre ?? '—'} / ${ventaAnterior?.servicioNombre ?? '—'}`,
            cambios: cambios.length > 0 ? cambios : undefined,
          }).catch(() => {});

          // Actualizar dashboard store local INMEDIATAMENTE + upsert a Supabase en background
          const ventaActualizada = get().ventas.find((v) => v.id === id);
          if (ventaActualizada) {
            const ventaPronostico = toVentaPronostico(ventaActualizada);
            // 1. Actualizar estado local del dashboard de inmediato
            import('./dashboardStore').then(({ useDashboardStore }) => {
              const currentStats = useDashboardStore.getState().stats;
              if (currentStats) {
                const existing = currentStats.ventasPronostico ?? [];
                const updated = ventaPronostico
                  ? existing.some(v => v.id === id)
                    ? existing.map(v => v.id === id ? ventaPronostico : v)
                    : [...existing, ventaPronostico]
                  : existing.filter(v => v.id !== id);
                useDashboardStore.setState({
                  stats: { ...currentStats, ventasPronostico: updated },
                });
              }
            }).catch(() => {});

            // 2. Persistir a Supabase en background (non-blocking)
            upsertVentaPronostico(ventaPronostico, id).catch((err) => {
              console.error('[VentasStore] Error upserting pronostico:', err);
              toast.warning('El pronóstico del dashboard puede estar desactualizado', { duration: 4000 });
            });
          }

          // Dispatch event for cross-component updates
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('venta-updated', Date.now().toString());
            window.dispatchEvent(new Event('venta-updated'));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar venta';
          set({ error: errorMessage });
          console.error('Error updating venta:', error);
          throw error;
        }
      },

      deleteVenta: async (id, servicioId?, perfilNumero?, deletePagos = false) => {
        // Save current state for rollback
        const currentVentas = get().ventas;

        // Buscar la venta en memoria primero, si no está, buscar en Supabase
        let ventaEliminada = currentVentas.find(v => v.id === id);
        if (!ventaEliminada) {
          // La página de ventas usa paginación, el store puede no tener la venta cargada
          const ventaDoc = await getById<VentaDoc>(ENTITIES.VENTAS, id);
          if (ventaDoc) {
            ventaEliminada = ventaDoc;
          }
        }

        // Optimistic update
        set((state) => ({
          ventas: state.ventas.filter((venta) => venta.id !== id)
        }));

        try {
          // Si se solicita eliminar pagos, eliminar primero todos los PagoVenta asociados
          if (deletePagos) {
            const pagos = await queryDocuments<PagoVenta>(ENTITIES.PAGOS_VENTA, [
              { field: 'ventaId', operator: '==', value: id }
            ]);

            // Eliminar todos los pagos en paralelo
            await Promise.all(
              pagos.map(pago => remove(ENTITIES.PAGOS_VENTA, pago.id))
            );
          }

          // Eliminar la venta
          await remove(ENTITIES.VENTAS, id);

          // Update service profile occupancy if applicable
          if (servicioId && perfilNumero) {
            const { useServiciosStore } = await import('./serviciosStore');
            await useServiciosStore.getState().updatePerfilOcupado(servicioId, false);
          }

          // Decrementar serviciosActivos si la venta eliminada era activa
          if (ventaEliminada?.clienteId && (ventaEliminada.estado ?? 'activo') !== 'inactivo') {
            await adjustServiciosActivos(ventaEliminada.clienteId, -1);
          }

          // Decrementar contadores de la categoría (convertir precio a USD)
          if (ventaEliminada?.categoriaId && ventaEliminada?.precioFinal) {
            const precioFinalUSD = await currencyService.convertToUSD(ventaEliminada.precioFinal, ventaEliminada.moneda ?? 'USD');
            await adjustCategoriaSuscripciones(
              ventaEliminada.categoriaId,
              -1,
              -precioFinalUSD
            );
          }

          // Restar de estadísticas del dashboard (non-blocking)
          if (ventaEliminada?.precioFinal) {
            adjustIngresosStats({
              delta: -(ventaEliminada.precioFinal),
              moneda: ventaEliminada.moneda ?? 'USD',
              mes: getMesKeyFromDate(ventaEliminada.fechaInicio ?? new Date()),
              dia: getDiaKeyFromDate(ventaEliminada.fechaInicio ?? new Date()),
              categoriaId: ventaEliminada.categoriaId ?? '',
              categoriaNombre: ventaEliminada.categoriaNombre ?? '',
            }).catch((err) => console.error('[VentasStore] Error reverting dashboard ingresos:', err));
          }

          // Eliminar notificaciones asociadas a esta venta
          try {
            const { useNotificacionesStore } = await import('./notificacionesStore');
            await useNotificacionesStore.getState().deleteNotificacionesPorVenta(id);
          } catch {
            // Notifications cleanup is best-effort, don't fail the delete
          }

          // Registrar en log de actividad
          useActivityLogStore.getState().addLog({
            ...getLogContext(),
            accion: 'eliminacion',
            entidad: 'venta',
            entidadId: id,
            entidadNombre: `${ventaEliminada?.clienteNombre ?? ''} — ${ventaEliminada?.servicioNombre ?? ''}`,
            detalles: `Venta eliminada: ${ventaEliminada?.clienteNombre} / ${ventaEliminada?.servicioNombre}`,
          }).catch(() => {});

          // Actualizar dashboard store local INMEDIATAMENTE + persistir a Supabase en background
          import('./dashboardStore').then(({ useDashboardStore }) => {
            const currentStats = useDashboardStore.getState().stats;
            if (currentStats) {
              const updated = (currentStats.ventasPronostico ?? []).filter(v => v.id !== id);
              useDashboardStore.setState({
                stats: { ...currentStats, ventasPronostico: updated },
              });
            }
          }).catch(() => {});
          upsertVentaPronostico(null, id).catch((err) => {
            console.error('[VentasStore] Error removing pronostico:', err);
            toast.warning('El pronóstico del dashboard puede estar desactualizado', { duration: 4000 });
          });

          // Notificar que se eliminó una venta
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('venta-deleted', Date.now().toString());
            window.dispatchEvent(new Event('venta-deleted'));
          }
        } catch (error) {
          // Rollback on error
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
      }
    }),
    { name: 'ventas-store' }
  )
);
