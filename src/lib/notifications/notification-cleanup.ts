import { removeNotificacion } from '@/lib/supabase/notifications-repository';
import type {
  Notificacion,
  NotificacionReposo,
  NotificacionServicio,
  NotificacionVenta,
} from '@/types/notificaciones';
import type { Servicio } from '@/types/servicios';
import type { VentaDoc } from '@/types/ventas';
export async function limpiarNotificacionesHuerfanas(
  ventasActivas: VentaDoc[],
  serviciosActivos: Servicio[],
  serviciosReposo: Servicio[],
  notifExistentesVenta: (NotificacionVenta & { id: string })[],
  notifExistentesServicio: (NotificacionServicio & { id: string })[],
  notifExistentesReposo: (NotificacionReposo & { id: string })[]
): Promise<void> {
  try {
    const ventaIdsActivos = new Set(ventasActivas.map(v => v.id));
    const servicioIdsActivos = new Set(serviciosActivos.map(s => s.id));
    const reposoIdsActivos = new Set(serviciosReposo.map(s => s.id));

    const huerfanas: (Notificacion & { id: string })[] = [
      ...notifExistentesVenta.filter(n => !ventaIdsActivos.has(n.ventaId)),
      ...notifExistentesServicio.filter(n => !servicioIdsActivos.has(n.servicioId)),
      ...notifExistentesReposo.filter(n => !reposoIdsActivos.has(n.servicioId)),
    ];

    if (huerfanas.length > 0) {
      // Use parallel deletion
      await Promise.all(huerfanas.map(notif => removeNotificacion(notif.id)));
    }
  } catch (error) {
    // Cleanup is best-effort, don't fail the sync
    console.warn('[NotificationSync] Error cleaning up orphan notifications:', error);
  }
}

/**
 * Main synchronization function
 * Call this once per page load (e.g., in dashboard layout useEffect)
 * Uses localStorage cache to prevent multiple syncs per day
 *
 * Performance: ~1-2 seconds with bulk reads and parallel writes.
 */
