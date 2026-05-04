import { COLLECTIONS, getAll, queryDocuments, update } from '@/lib/firebase/firestore';
import { sincronizarUnServicio, sincronizarUnaVenta, sincronizarNotificacionesForzado } from '@/lib/services/notificationSyncService';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { useVentasStore } from '@/store/ventasStore';
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

function buildServicioVentaSnapshotUpdates(
  servicio: ServicioDenormalizedSnapshot
): Partial<VentaDoc> {
  return {
    servicioNombre: servicio.nombre,
    servicioCorreo: servicio.correo,
    servicioContrasena: servicio.contrasena,
    categoriaId: servicio.categoriaId,
    categoriaNombre: servicio.categoriaNombre,
  };
}

function getServicioVentaUpdates(
  previousServicio: ServicioDenormalizedSnapshot,
  nextServicio: ServicioDenormalizedSnapshot
): Partial<VentaDoc> {
  const updates: Partial<VentaDoc> = {};

  if (previousServicio.nombre !== nextServicio.nombre) {
    updates.servicioNombre = nextServicio.nombre;
  }

  if (previousServicio.correo !== nextServicio.correo) {
    updates.servicioCorreo = nextServicio.correo;
  }

  if (previousServicio.contrasena !== nextServicio.contrasena) {
    updates.servicioContrasena = nextServicio.contrasena;
  }

  if (previousServicio.categoriaId !== nextServicio.categoriaId) {
    updates.categoriaId = nextServicio.categoriaId;
  }

  if (previousServicio.categoriaNombre !== nextServicio.categoriaNombre) {
    updates.categoriaNombre = nextServicio.categoriaNombre;
  }

  return updates;
}

function updateVentasStoreFromServicioSync(servicioId: string, ventaUpdates: Partial<VentaDoc>) {
  if (Object.keys(ventaUpdates).length === 0) {
    return;
  }

  useVentasStore.setState((state) => ({
    ventas: state.ventas.map((venta) =>
      venta.servicioId === servicioId
        ? { ...venta, ...ventaUpdates, updatedAt: new Date() }
        : venta
    ),
    selectedVenta:
      state.selectedVenta?.servicioId === servicioId
        ? { ...state.selectedVenta, ...ventaUpdates, updatedAt: new Date() }
        : state.selectedVenta,
  }));
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
 * Synchronize all dependencies of a service (mainly denormalized data in sales)
 */
export async function syncServicioDependencias(
  previousServicio: ServicioDenormalizedSnapshot,
  nextServicio: ServicioDenormalizedSnapshot,
  options: SyncServicioDependenciasOptions = {}
): Promise<SyncServicioDependenciasResult> {
  const { refreshNotifications = true, emitEvents = true } = options;
  const ventaUpdates = getServicioVentaUpdates(previousServicio, nextServicio);
  let ventasActualizadas = 0;
  let ventasDelServicioIds: string[] = [];

  if (Object.keys(ventaUpdates).length > 0) {
    const ventasDelServicio = await queryDocuments<{ id: string }>(COLLECTIONS.VENTAS, [
      { field: 'servicioId', operator: '==', value: nextServicio.id },
    ]);

    ventasActualizadas = ventasDelServicio.length;
    ventasDelServicioIds = ventasDelServicio.map(v => v.id);

    await Promise.all(
      ventasDelServicio.map((venta) => update(COLLECTIONS.VENTAS, venta.id, ventaUpdates))
    );

    updateVentasStoreFromServicioSync(nextServicio.id, ventaUpdates);
  }

  if (refreshNotifications) {
    // Surgical sync for the service notification
    await sincronizarUnServicio(nextServicio.id);
    
    // Surgical sync for each associated sale (only if they were actually updated)
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
    emitServicioSyncEvents(ventasActualizadas > 0);
  }

  return { ventasActualizadas };
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
  const servicios = preFetchedData?.servicios || await getAll<Servicio>(COLLECTIONS.SERVICIOS);
  const todasLasVentas = preFetchedData?.ventas || await getAll<VentaDoc>(COLLECTIONS.VENTAS);
  let ventasActualizadas = 0;

  // Build a map of ventas by servicioId for O(n) access
  const ventasPorServicio = new Map<string, VentaDoc[]>();
  for (const v of todasLasVentas) {
    if (!v.servicioId) continue;
    if (!ventasPorServicio.has(v.servicioId)) {
      ventasPorServicio.set(v.servicioId, []);
    }
    ventasPorServicio.get(v.servicioId)!.push(v);
  }

  for (const servicio of servicios) {
    const ventasDelServicio = ventasPorServicio.get(servicio.id) || [];

    if (ventasDelServicio.length === 0) {
      continue;
    }

    const updates = buildServicioVentaSnapshotUpdates(servicio);
    const ventasParaActualizar = ventasDelServicio.filter((v) => {
      return (
        v.servicioNombre !== updates.servicioNombre ||
        v.servicioCorreo !== updates.servicioCorreo ||
        v.servicioContrasena !== updates.servicioContrasena ||
        v.categoriaId !== updates.categoriaId ||
        v.categoriaNombre !== updates.categoriaNombre
      );
    });

    if (ventasParaActualizar.length > 0) {
      await Promise.all(
        ventasParaActualizar.map((venta) => update(COLLECTIONS.VENTAS, venta.id, updates))
      );

      updateVentasStoreFromServicioSync(servicio.id, updates);
      ventasActualizadas += ventasParaActualizar.length;
    }
  }

  // Full forced sync is appropriate for a full resync
  await sincronizarNotificacionesForzado();
  await Promise.all([
    useNotificacionesStore.getState().fetchNotificaciones(true),
    useNotificacionesStore.getState().fetchCounts(),
  ]);

  emitServicioSyncEvents(ventasActualizadas > 0);

  return {
    serviciosRevisados: servicios.length,
    ventasActualizadas,
  };
}
