import { differenceInDays, startOfDay } from 'date-fns';

import { createNotificacion, updateNotificacion } from '@/platform/supabase/notifications-repository';
import { prioridadSubio } from '@/modules/notifications/notification-calculator';
import type { NotificacionReposo } from '@/types/notificaciones';
import type { Servicio } from '@/types/servicios';
export async function procesarNotificacionReposo(
  servicio: Servicio,
  notifExistente?: NotificacionReposo & { id: string },
  forzarActualizacion = false
): Promise<void> {
  if (!servicio.fechaFinReposo) return;

  const diasRestantes = differenceInDays(startOfDay(new Date(servicio.fechaFinReposo)), startOfDay(new Date()));

  // Only notify when reposo is completed or about to complete (within 7 days)
  if (diasRestantes > 7) return;

  const nuevaPrioridad = diasRestantes <= 0 ? 'critica' : diasRestantes <= 3 ? 'alta' : 'media';
  const titulo = diasRestantes <= 0
    ? `Reposo completado — ${servicio.nombre}`
    : `Reposo finaliza en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''} — ${servicio.nombre}`;

  const datosNotificacion: Omit<NotificacionReposo, 'id' | 'createdAt'> = {
    entidad: 'reposo',
    tipo: 'sistema',
    prioridad: nuevaPrioridad,
    titulo,
    diasRestantes,
    leida: false,
    resaltada: false,
    servicioId: servicio.id,
    categoriaId: servicio.categoriaId,
    servicioNombre: servicio.nombre,
    categoriaNombre: servicio.categoriaNombre || '',
    correo: servicio.correo,
    fechaInicio: servicio.fechaInicio,
    fechaFin: servicio.fechaVencimiento,
    diasReposo: servicio.diasReposo || 28,
    fechaInicioReposo: servicio.fechaInicioReposo!,
    fechaFinReposo: servicio.fechaFinReposo,
    updatedAt: new Date(),
  };

  if (notifExistente) {
    const debeActualizar =
      forzarActualizacion ||
      notifExistente.diasRestantes !== diasRestantes ||
      notifExistente.titulo !== titulo;

    if (debeActualizar) {
      const aumentoPrioridad = prioridadSubio(notifExistente.prioridad, nuevaPrioridad);
      await updateNotificacion(notifExistente.id, {
        ...datosNotificacion,
        leida: aumentoPrioridad ? false : notifExistente.leida,
        resaltada: notifExistente.resaltada,
      });
    }
  } else {
    await createNotificacion(datosNotificacion as Record<string, unknown>);
  }
}

/**
 * Remove notifications whose venta/servicio no longer exists or is no longer active
 * This handles the case where a venta/servicio was deleted outside of the notification flow
 */
