import { getServicios } from '@/platform/supabase/servicios-repository';
import { queryVentas } from '@/platform/supabase/ventas-repository';
import { storeEventBus } from '@/platform/events/store-event-bus';
import { sincronizarNotificacionesForzado, sincronizarUnServicio, sincronizarUnaVenta } from '@/modules/notifications';
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
  ventaIds: string[];
  cacheInvalidations: Array<{ entity: 'servicio' | 'venta'; entityId?: string }>;
  notificationRefresh: boolean;
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
  const outcome = await planServicioDependencySync(nextServicio, {
    refreshNotifications,
  });

  await applyServicioDependencySyncReactions(nextServicio.id, outcome, { emitEvents });

  return outcome;
}

export async function planServicioDependencySync(
  nextServicio: ServicioDenormalizedSnapshot,
  options: Pick<SyncServicioDependenciasOptions, 'refreshNotifications'> = {}
): Promise<SyncServicioDependenciasResult> {
  const ventasDelServicio = await queryVentas<{ id: string }>([
    { field: 'servicioId', operator: '==', value: nextServicio.id },
  ]);
  const ventaIds = ventasDelServicio.map((venta) => venta.id);

  return {
    ventasActualizadas: 0,
    ventaIds,
    cacheInvalidations: [
      { entity: 'servicio', entityId: nextServicio.id },
      ...ventaIds.map((ventaId) => ({ entity: 'venta' as const, entityId: ventaId })),
    ],
    notificationRefresh: options.refreshNotifications ?? true,
  };
}

export async function applyServicioDependencySyncReactions(
  servicioId: string,
  outcome: SyncServicioDependenciasResult,
  options: Pick<SyncServicioDependenciasOptions, 'emitEvents'> = {}
) {
  if (outcome.notificationRefresh) {
    await sincronizarUnServicio(servicioId);

    if (outcome.ventaIds.length > 0) {
      await Promise.all(
        outcome.ventaIds.map((id) => sincronizarUnaVenta(id))
      );
    }
  }

  if (options.emitEvents ?? true) {
    emitServicioSyncEvents(servicioId, outcome.ventaIds);
  }
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

  emitServicioSyncEvents(null, []);

  return {
    serviciosRevisados: servicios.length,
    ventasActualizadas: 0,
  };
}
