import { storeEventBus } from '@/lib/events/store-event-bus';
import {
  sincronizarNotificacionesForzado,
  sincronizarUnaVenta,
  sincronizarUnServicio,
} from '@/lib/notifications/notification-sync-orchestrator';

export function initializeNotificationEventListeners() {
  // Listen for SERVICIO changes and resync notifications
  storeEventBus.on('SERVICIO_CREATED', async (event) => {
    await sincronizarUnServicio(event.servicioId).catch((error) => {
      console.error('[NotificationEventListener] Failed to sync SERVICIO_CREATED:', error);
    });
  });

  storeEventBus.on('SERVICIO_UPDATED', async (event) => {
    await sincronizarUnServicio(event.servicioId).catch((error) => {
      console.error('[NotificationEventListener] Failed to sync SERVICIO_UPDATED:', error);
    });
  });

  storeEventBus.on('SERVICIO_DELETED', async (event) => {
    // Deletion is handled by RPC cascade; just invalidate cache
    await sincronizarNotificacionesForzado().catch((error) => {
      console.error('[NotificationEventListener] Failed to sync SERVICIO_DELETED:', error);
    });
  });

  storeEventBus.on('SERVICIO_ARCHIVED', async (event) => {
    await sincronizarUnServicio(event.servicioId).catch((error) => {
      console.error('[NotificationEventListener] Failed to sync SERVICIO_ARCHIVED:', error);
    });
  });

  // Listen for VENTA changes
  storeEventBus.on('VENTA_CREATED', async (event) => {
    await sincronizarUnaVenta(event.ventaId).catch((error) => {
      console.error('[NotificationEventListener] Failed to sync VENTA_CREATED:', error);
    });
  });

  storeEventBus.on('VENTA_UPDATED', async (event) => {
    await sincronizarUnaVenta(event.ventaId).catch((error) => {
      console.error('[NotificationEventListener] Failed to sync VENTA_UPDATED:', error);
    });
  });

  storeEventBus.on('VENTA_DELETED', async (event) => {
    await sincronizarNotificacionesForzado().catch((error) => {
      console.error('[NotificationEventListener] Failed to sync VENTA_DELETED:', error);
    });
  });

  // Listen for full invalidation signals
  storeEventBus.on('NOTIFICACIONES_INVALIDATED', async (event) => {
    await sincronizarNotificacionesForzado().catch((error) => {
      console.error('[NotificationEventListener] Failed to sync NOTIFICACIONES_INVALIDATED:', error);
    });
  });

  storeEventBus.on('TERCERO_DELETED', async () => {
    // Tercero deletion cascades in RPC; full resync recommended
    await sincronizarNotificacionesForzado().catch((error) => {
      console.error('[NotificationEventListener] Failed to sync TERCERO_DELETED:', error);
    });
  });
}
