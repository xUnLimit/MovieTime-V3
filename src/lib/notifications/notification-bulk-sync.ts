import { addDays } from 'date-fns';

import { queryMetodosPago } from '@/platform/supabase/catalogos-repository';
import { queryNotificaciones } from '@/platform/supabase/notifications-repository';
import { queryServicios } from '@/platform/supabase/servicios-repository';
import { queryVentas } from '@/platform/supabase/ventas-repository';
import { limpiarNotificacionesHuerfanas } from '@/lib/notifications/notification-cleanup';
import { procesarNotificacionReposo } from '@/lib/notifications/reposo-notification-sync';
import { procesarNotificacionServicio } from '@/lib/notifications/servicio-notification-sync';
import { procesarNotificacionVenta } from '@/lib/notifications/venta-notification-sync';
import type { MetodoPago } from '@/types/metodos-pago';
import type {
  NotificacionReposo,
  NotificacionServicio,
  NotificacionVenta,
} from '@/types/notificaciones';
import type { Servicio } from '@/types/servicios';
import type { VentaDoc } from '@/types/ventas';

export async function runBulkNotificationSync(forzarActualizacion: boolean) {
  const fechaLimite = addDays(new Date(), 7);

  const [
    todasNotifVentas,
    todasNotifServicios,
    todasNotifReposo,
    ventasProximas,
    serviciosProximos,
    serviciosEnReposo,
    metodosPago,
  ] = await Promise.all([
    queryNotificaciones([{ field: 'entidad', operator: '==', value: 'venta' }]) as Promise<
      (NotificacionVenta & { id: string })[]
    >,
    queryNotificaciones([{ field: 'entidad', operator: '==', value: 'servicio' }]) as Promise<
      (NotificacionServicio & { id: string })[]
    >,
    queryNotificaciones([{ field: 'entidad', operator: '==', value: 'reposo' }]) as Promise<
      (NotificacionReposo & { id: string })[]
    >,
    queryVentas([
      { field: 'estado', operator: '==', value: 'activo' },
      { field: 'fechaFin', operator: '<=', value: fechaLimite },
    ]) as Promise<VentaDoc[]>,
    queryServicios([
      { field: 'activo', operator: '==', value: true },
      { field: 'fechaVencimiento', operator: '<=', value: fechaLimite },
    ]) as Promise<Servicio[]>,
    queryServicios([{ field: 'enReposo', operator: '==', value: true }]) as Promise<Servicio[]>,
    queryMetodosPago() as Promise<MetodoPago[]>,
  ]);

  const mapNotifVentas = new Map(todasNotifVentas.map((notificacion) => [notificacion.ventaId, notificacion]));
  const mapNotifServicios = new Map(
    todasNotifServicios.map((notificacion) => [notificacion.servicioId, notificacion]),
  );
  const mapNotifReposo = new Map(todasNotifReposo.map((notificacion) => [notificacion.servicioId, notificacion]));
  const mapMetodosPago = new Map(metodosPago.map((metodo) => [metodo.id, metodo]));

  let huboFallosParciales = false;

  const promesasVentas = ventasProximas.map((venta) =>
    procesarNotificacionVenta(venta, mapNotifVentas.get(venta.id), forzarActualizacion, mapMetodosPago)
      .catch((error) => {
        huboFallosParciales = true;
        console.error(`[NotificationSync] Error processing venta ${venta.id}:`, error);
      }),
  );

  const promesasServicios = serviciosProximos.map((servicio) =>
    procesarNotificacionServicio(servicio, mapNotifServicios.get(servicio.id), forzarActualizacion, mapMetodosPago)
      .catch((error) => {
        huboFallosParciales = true;
        console.error(`[NotificationSync] Error processing servicio ${servicio.id}:`, error);
      }),
  );

  const promesasReposo = serviciosEnReposo.map((servicio) =>
    procesarNotificacionReposo(servicio, mapNotifReposo.get(servicio.id), forzarActualizacion)
      .catch((error) => {
        huboFallosParciales = true;
        console.error(`[NotificationSync] Error processing reposo ${servicio.id}:`, error);
      }),
  );

  await Promise.all([...promesasVentas, ...promesasServicios, ...promesasReposo]);

  await limpiarNotificacionesHuerfanas(
    ventasProximas,
    serviciosProximos,
    serviciosEnReposo,
    todasNotifVentas,
    todasNotifServicios,
    todasNotifReposo,
  );

  return { huboFallosParciales };
}
