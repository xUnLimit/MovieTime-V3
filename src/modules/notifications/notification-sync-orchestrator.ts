import { createLogger } from '@/platform/observability/logger';
import { runBulkNotificationSync } from '@/modules/notifications/notification-bulk-sync';
import {
  isNotificationSyncRunning,
  markNotificationsSynced,
  resetNotificationsSyncMarker,
  setNotificationSyncRunning,
  shouldSyncNotifications,
} from '@/modules/notifications/notification-sync-state';
import {
  runServicioNotificationSync,
  runVentaNotificationSync,
} from '@/modules/notifications/notification-surgical-sync';

const log = createLogger('NotificationSync');

export async function sincronizarNotificaciones(forzarActualizacion = false): Promise<void> {
  if (!forzarActualizacion && !shouldSyncNotifications()) {
    return;
  }

  if (isNotificationSyncRunning()) {
    return;
  }

  setNotificationSyncRunning(true);

  try {
    if (!forzarActualizacion) {
      markNotificationsSynced();
    }

    const { huboFallosParciales } = await runBulkNotificationSync(forzarActualizacion);

    if (huboFallosParciales && !forzarActualizacion && typeof window !== 'undefined') {
      resetNotificationsSyncMarker();
      log.warn('Partial failures detected; sync will retry on next load');
    }
  } catch (error) {
    if (!forzarActualizacion && typeof window !== 'undefined') {
      resetNotificationsSyncMarker();
    }
    log.error('Error during synchronization', { error });
    throw error;
  } finally {
    setNotificationSyncRunning(false);
  }
}

export async function sincronizarNotificacionesForzado(): Promise<void> {
  resetNotificationsSyncMarker();
  setNotificationSyncRunning(false);

  await sincronizarNotificaciones(true);
}

export async function sincronizarUnaVenta(ventaId: string): Promise<void> {
  await runVentaNotificationSync(ventaId);
}

export async function sincronizarUnServicio(servicioId: string): Promise<void> {
  await runServicioNotificationSync(servicioId);
}
