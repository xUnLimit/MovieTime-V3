import { syncVentaForecastReadModels } from '@/lib/forecasting';
import { deleteVentaNotificationStoreCache } from '@/lib/store-reactions/notification-cache-reactions';
import { safeAsyncSideEffect } from '@/platform/utils/safety';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';

type ServiceProfileDelta = {
  servicioId: string;
  shouldIncrement: boolean;
} | null;

async function applyServiceProfileDelta(delta: ServiceProfileDelta) {
  if (!delta) return;

  await invalidateStoreQueries(['servicios', 'ventas', 'pagination']);
}

function deleteVentaNotifications(ventaId: string) {
  safeAsyncSideEffect(
    Promise.resolve().then(() =>
      deleteVentaNotificationStoreCache(ventaId),
    ),
    {
      operation: 'deleteNotificacionesPorVenta',
      entity: 'venta',
      entityId: ventaId,
      critical: true,
    },
  );
}

// NOTE: estas reacciones NO emiten eventos de dominio (VENTA_CREATED/UPDATED/DELETED).
// El use-case es el unico emisor del hecho de dominio (ver ventas-write-use-cases.ts).
// Aqui solo se aplican efectos derivados: forecast read-models, invalidacion y limpieza de notificaciones.
export async function afterVentaCreated(_ventaId: string) {
  syncVentaForecastReadModels(_ventaId);
}

export async function afterVentaUpdated(ventaId: string, delta: ServiceProfileDelta) {
  await applyServiceProfileDelta(delta);
  syncVentaForecastReadModels(ventaId);
}

export async function afterVentaDeleted(ventaId: string, delta: ServiceProfileDelta) {
  await applyServiceProfileDelta(delta);
  deleteVentaNotifications(ventaId);
  syncVentaForecastReadModels(ventaId);
}
