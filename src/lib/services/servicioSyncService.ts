import { ENTITIES, getAll, queryDocuments } from '@/lib/supabase/servicios-repository';
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

function emitServicioSyncEvents(ventasWereUpdated: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  const syncTimestamp = Date.now().toString();
  window.localStorage.setItem('servicio-updated', syncTimestamp);
  window.dispatchEvent(new Event('servicio-updated'));

  if (ventasWereUpdated) {
    window.localStorage.setItem('venta-updated', syncTimestamp);
    window.dispatchEvent(new Event('venta-updated'));
  }
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

  const ventasDelServicio = await queryDocuments<{ id: string }>(ENTITIES.VENTAS, [
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
    emitServicioSyncEvents(ventasDelServicioIds.length > 0);
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
  const servicios = preFetchedData?.servicios || await getAll<Servicio>(ENTITIES.SERVICIOS);
  void preFetchedData?.ventas;

  await sincronizarNotificacionesForzado();
  await Promise.all([
    useNotificacionesStore.getState().fetchNotificaciones(true),
    useNotificacionesStore.getState().fetchCounts(),
  ]);

  emitServicioSyncEvents(false);

  return {
    serviciosRevisados: servicios.length,
    ventasActualizadas: 0,
  };
}
