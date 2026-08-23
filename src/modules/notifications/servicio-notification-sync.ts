import { differenceInDays, startOfDay } from 'date-fns';

import { createLogger } from '@/platform/observability/logger';
import { createNotificacion, updateNotificacion } from '@/platform/supabase/notifications-repository';
import { getMetodoPagoById } from '@/platform/supabase/catalogos-repository';
import {
  calcularPrioridad,
  generarTitulo,
} from '@/modules/notifications/notification-calculator';
import type { MetodoPago } from '@/types/metodos-pago';
import type { NotificacionServicio } from '@/types/notificaciones';
import type { Servicio } from '@/types/servicios';

const log = createLogger('NotificationSync');

function obtenerTerminacionTarjeta(metodoPago?: Pick<MetodoPago, 'numeroTarjeta'> | null): string {
  return metodoPago?.numeroTarjeta?.replace(/\D/g, '').slice(-4) || '';
}

function obtenerAliasMetodoPago(metodoPago?: Pick<MetodoPago, 'alias'> | null): string {
  return metodoPago?.alias?.trim() || '';
}
export async function procesarNotificacionServicio(
  servicio: Servicio,
  notifExistente?: NotificacionServicio & { id: string },
  forzarActualizacion = false,
  metodosPagoById?: Map<string, MetodoPago>
): Promise<void> {
  if (!servicio.fechaVencimiento) {
    log.warn('Servicio missing fechaVencimiento; skipping notification', { servicioId: servicio.id });
    return;
  }

  const diasRestantes = differenceInDays(startOfDay(new Date(servicio.fechaVencimiento)), startOfDay(new Date()));
  const nuevaPrioridad = calcularPrioridad(diasRestantes);
  const metodoPago = servicio.metodoPagoId
    ? metodosPagoById?.get(servicio.metodoPagoId) ?? await getMetodoPagoById<MetodoPago>(servicio.metodoPagoId)
    : null;
  const metodoPagoAlias = obtenerAliasMetodoPago(metodoPago);
  const metodoPagoTarjetaTerminacion = obtenerTerminacionTarjeta(metodoPago);
  const renovacionAutomatica = servicio.renovacionAutomatica === true;

  // Prepare denormalized data
  const datosNotificacion: Omit<NotificacionServicio, 'id' | 'createdAt'> = {
    entidad: 'servicio',
    tipo: 'sistema',
    prioridad: nuevaPrioridad,
    titulo: generarTitulo(diasRestantes, 'servicio'),
    diasRestantes,
    leida: false,
    resaltada: false,

    // References
    servicioId: servicio.id,
    categoriaId: servicio.categoriaId,

    // Denormalized from Servicio
    servicioNombre: servicio.nombre,
    categoriaNombre: servicio.categoriaNombre || '',
    tipoServicio: servicio.tipo,
    correo: servicio.correo,
    contrasena: servicio.contrasena,
    metodoPagoNombre: servicio.metodoPagoNombre || '',
    metodoPagoAlias,
    metodoPagoTarjetaTerminacion,
    moneda: servicio.moneda || 'USD',
    costoServicio: servicio.costoServicio,
    cicloPago: servicio.cicloPago || 'mensual',
    fechaVencimiento: servicio.fechaVencimiento,
    renovacionAutomatica,

    updatedAt: new Date(),
  };

  if (notifExistente) {
    // Update existing
    // Update if status or denormalized display data changed, or if forced refresh
    const debeActualizar =
      forzarActualizacion ||
      notifExistente.diasRestantes !== diasRestantes ||
      notifExistente.metodoPagoNombre !== datosNotificacion.metodoPagoNombre ||
      (notifExistente.metodoPagoAlias || '') !== metodoPagoAlias ||
      (notifExistente.metodoPagoTarjetaTerminacion || '') !== metodoPagoTarjetaTerminacion ||
      (notifExistente.renovacionAutomatica ?? false) !== renovacionAutomatica;

    if (debeActualizar) {
      await updateNotificacion(notifExistente.id, {
        ...datosNotificacion,
        leida: notifExistente.leida,
        resaltada: notifExistente.resaltada, // Always preserve highlighted state
      });
    }
  } else {
    // Create new
    await createNotificacion(datosNotificacion as Record<string, unknown>);
  }
}

/**
 * Process a reposo service and create/update completion notification
 * Only creates notification when fechaFinReposo <= today (reposo completed)
 */
