import { createLogger } from '@/platform/observability/logger';
import { storeEventBus } from '@/platform/events/store-event-bus';
import {
  sincronizarNotificacionesForzado,
  sincronizarUnaVenta,
  sincronizarUnServicio,
} from '@/modules/notifications/notification-sync-orchestrator';

const log = createLogger('NotificationEventListener');

export function initializeNotificationEventListeners() {
  // Listen for SERVICIO changes and resync notifications
  storeEventBus.on('SERVICIO_CREATED', async (event) => {
    await sincronizarUnServicio(event.servicioId).catch((error) => {
      log.error('Failed to sync after SERVICIO_CREATED', { servicioId: event.servicioId, error });
    });
  });

  storeEventBus.on('SERVICIO_UPDATED', async (event) => {
    await sincronizarUnServicio(event.servicioId).catch((error) => {
      log.error('Failed to sync after SERVICIO_UPDATED', { servicioId: event.servicioId, error });
    });
  });

  storeEventBus.on('SERVICIO_DELETED', async () => {
    // Deletion is handled by RPC cascade; just invalidate cache
    await sincronizarNotificacionesForzado().catch((error) => {
      log.error('Failed to sync after SERVICIO_DELETED', { error });
    });
  });

  storeEventBus.on('SERVICIO_ARCHIVED', async (event) => {
    await sincronizarUnServicio(event.servicioId).catch((error) => {
      log.error('Failed to sync after SERVICIO_ARCHIVED', { servicioId: event.servicioId, error });
    });
  });

  // Listen for VENTA changes
  storeEventBus.on('VENTA_CREATED', async (event) => {
    await sincronizarUnaVenta(event.ventaId).catch((error) => {
      log.error('Failed to sync after VENTA_CREATED', { ventaId: event.ventaId, error });
    });
  });

  storeEventBus.on('VENTA_UPDATED', async (event) => {
    await sincronizarUnaVenta(event.ventaId).catch((error) => {
      log.error('Failed to sync after VENTA_UPDATED', { ventaId: event.ventaId, error });
    });
  });

  storeEventBus.on('VENTA_DELETED', async () => {
    await sincronizarNotificacionesForzado().catch((error) => {
      log.error('Failed to sync after VENTA_DELETED', { error });
    });
  });

  // Listen for full invalidation signals
  storeEventBus.on('NOTIFICACIONES_INVALIDATED', async () => {
    await sincronizarNotificacionesForzado().catch((error) => {
      log.error('Failed to sync after NOTIFICACIONES_INVALIDATED', { error });
    });
  });

  storeEventBus.on('TERCERO_DELETED', async () => {
    // Tercero deletion cascades in RPC; full resync recommended
    await sincronizarNotificacionesForzado().catch((error) => {
      log.error('Failed to sync after TERCERO_DELETED', { error });
    });
  });
}
