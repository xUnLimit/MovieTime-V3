import { addDays, startOfDay } from 'date-fns';

import { createLogger } from '@/platform/observability/logger';

import { queryMetodosPago } from '@/platform/supabase/catalogos-repository';
import { queryNotificaciones, removeNotificacion } from '@/platform/supabase/notifications-repository';
import { getServicioById } from '@/platform/supabase/servicios-repository';
import { getVentaById } from '@/platform/supabase/ventas-repository';
import { procesarNotificacionReposo } from '@/modules/notifications/reposo-notification-sync';
import { procesarNotificacionServicio } from '@/modules/notifications/servicio-notification-sync';
import { procesarNotificacionVenta } from '@/modules/notifications/venta-notification-sync';
import type { MetodoPago } from '@/types/metodos-pago';
import type {
  Notificacion,
  NotificacionReposo,
  NotificacionServicio,
  NotificacionVenta,
} from '@/types/notificaciones';
import type { Servicio } from '@/types/servicios';
import type { VentaDoc } from '@/types/ventas';

const log = createLogger('NotificationSync');

export async function runVentaNotificationSync(ventaId: string): Promise<void> {
  try {
    const [venta, notificacionesExistentes] = await Promise.all([
      getVentaById<VentaDoc>(ventaId),
      queryNotificaciones([
        { field: 'entidad', operator: '==', value: 'venta' },
        { field: 'ventaId', operator: '==', value: ventaId },
      ]) as Promise<(NotificacionVenta & { id: string })[]>,
    ]);

    if (!venta || venta.estado === 'inactivo') {
      if (notificacionesExistentes.length > 0) {
        await Promise.all(notificacionesExistentes.map((notificacion) => removeNotificacion(notificacion.id)));
      }
      return;
    }

    const fechaLimite = addDays(new Date(), 7);
    const esProxima = venta.fechaFin && startOfDay(new Date(venta.fechaFin)) <= startOfDay(fechaLimite);

    if (esProxima) {
      const metodosPago = await queryMetodosPago() as MetodoPago[];
      await procesarNotificacionVenta(
        venta,
        notificacionesExistentes[0],
        true,
        new Map(metodosPago.map((metodo) => [metodo.id, metodo])),
      );
    } else if (notificacionesExistentes.length > 0) {
      await Promise.all(notificacionesExistentes.map((notificacion) => removeNotificacion(notificacion.id)));
    }
  } catch (error) {
    log.error('Error in surgical sync for venta', { ventaId, error });
  }
}

export async function runServicioNotificationSync(servicioId: string): Promise<void> {
  try {
    const [servicio, notifServicioExistentes, notifReposoExistentes] = await Promise.all([
      getServicioById<Servicio>(servicioId),
      queryNotificaciones([
        { field: 'entidad', operator: '==', value: 'servicio' },
        { field: 'servicioId', operator: '==', value: servicioId },
      ]) as Promise<(NotificacionServicio & { id: string })[]>,
      queryNotificaciones([
        { field: 'entidad', operator: '==', value: 'reposo' },
        { field: 'servicioId', operator: '==', value: servicioId },
      ]) as Promise<(NotificacionReposo & { id: string })[]>,
    ]);

    if (!servicio) {
      const allToDelete: (Notificacion & { id: string })[] = [
        ...notifServicioExistentes,
        ...notifReposoExistentes,
      ];
      if (allToDelete.length > 0) {
        await Promise.all(allToDelete.map((notificacion) => removeNotificacion(notificacion.id)));
      }
      return;
    }

    const fechaLimite = addDays(new Date(), 7);
    const esProximo = servicio.activo &&
      servicio.fechaVencimiento &&
      startOfDay(new Date(servicio.fechaVencimiento)) <= startOfDay(fechaLimite);

    if (esProximo) {
      await procesarNotificacionServicio(servicio, notifServicioExistentes[0], true);
    } else if (notifServicioExistentes.length > 0) {
      await Promise.all(notifServicioExistentes.map((notificacion) => removeNotificacion(notificacion.id)));
    }

    if (servicio.enReposo && servicio.fechaFinReposo) {
      await procesarNotificacionReposo(servicio, notifReposoExistentes[0], true);
    } else if (notifReposoExistentes.length > 0) {
      await Promise.all(notifReposoExistentes.map((notificacion) => removeNotificacion(notificacion.id)));
    }
  } catch (error) {
    log.error('Error in surgical sync for servicio', { servicioId, error });
  }
}
