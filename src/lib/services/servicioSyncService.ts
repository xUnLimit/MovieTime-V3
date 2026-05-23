import { getServicios } from '@/lib/supabase/servicios-repository';
import { queryVentas } from '@/lib/supabase/ventas-repository';
import { storeEventBus } from '@/lib/events/store-event-bus';
import { sincronizarUnServicio, sincronizarUnaVenta, sincronizarNotificacionesForzado } from '@/lib/services/notificationSyncService';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import type { Servicio, VentaDoc } from '@/types';

type ServicioDenormalizedSnapshot = Pick<
  Servicio,
  'id' | 'nombre' | 'correo' | 'contrasena' | 'categoriaId' | 'categoriaNombre'
>;

interface SyncServicioDependenciasOptions {
  refreshNotifications?: boolean;
  emitEvents?: boolean;
}

export interface SyncServicioDependenciasResult {
  ventasActualizadas: number;
}

function emitServicioSyncEvents(servicioId: string | null, ventaIds: string[]) {
  if (servicioId) {
    storeEventBus.emit({ type: 'SERVICIO_UPDATED', servicioId });
  } else {
    storeEventBus.emit({ type: 'SERVICIOS_INVALIDATED' });
  }

  ventaIds.forEach((ventaId) => {
    storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId });
  });

}

/**
 * Refresh dependencies of a service.
 *
 * In Supabase V2, sales read service display fields from views and historical
 * category data remains a snapshot. There are no denormalized sale fields to
 * propagate here.
 */
export async function syncServicioDependencias(
  _previousServicio: ServicioDenormalizedSnapshot,
  nextServicio: ServicioDenormalizedSnapshot,
  options: SyncServicioDependenciasOptions = {}
): Promise<SyncServicioDependenciasResult> {
  void _previousServicio;
  const { refreshNotifications = true, emitEvents = true } = options;
  let ventasDelServicioIds: string[] = [];

  const ventasDelServicio = await queryVentas<{ id: string }>([
    { field: 'servicioId', operator: '==', value: nextServicio.id },
  ]);
  ventasDelServicioIds = ventasDelServicio.map((venta) => venta.id);

  if (refreshNotifications) {
    await sincronizarUnServicio(nextServicio.id);

    if (ventasDelServicioIds.length > 0) {
      await Promise.all(
        ventasDelServicioIds.map((id) => sincronizarUnaVenta(id))
      );
    }

    await Promise.all([
      useNotificacionesStore.getState().fetchNotificaciones(true),
      useNotificacionesStore.getState().fetchCounts(),
    ]);
  }

  if (emitEvents) {
    emitServicioSyncEvents(nextServicio.id, ventasDelServicioIds);
  }

  return { ventasActualizadas: 0 };
}

/**
 * Full resync of denormalized service data in all sales
 */
export async function resyncServiciosDenormalizedData(preFetchedData?: {
  servicios?: Servicio[];
  ventas?: VentaDoc[];
}): Promise<{
  serviciosRevisados: number;
  ventasActualizadas: number;
}> {
  const servicios = preFetchedData?.servicios || await getServicios<Servicio>();
  void preFetchedData?.ventas;

  await sincronizarNotificacionesForzado();
  await Promise.all([
    useNotificacionesStore.getState().fetchNotificaciones(true),
    useNotificacionesStore.getState().fetchCounts(),
  ]);

  emitServicioSyncEvents(null, []);

  return {
    serviciosRevisados: servicios.length,
    ventasActualizadas: 0,
  };
}
