import { differenceInDays, startOfDay } from 'date-fns';

import { createNotificacion, updateNotificacion } from '@/lib/supabase/notifications-repository';
import {
  calcularPrioridad,
  generarTitulo,
  prioridadSubio,
} from '@/lib/notifications/notification-calculator';
import type { MetodoPago } from '@/types/metodos-pago';
import type { NotificacionVenta } from '@/types/notificaciones';
import type { VentaDoc } from '@/types/ventas';
export async function procesarNotificacionVenta(
  venta: VentaDoc,
  notifExistente?: NotificacionVenta & { id: string },
  forzarActualizacion = false,
  metodosPagoById?: Map<string, MetodoPago>
): Promise<void> {
  // Validate required denormalized field (fechaFin es el único crítico para calcular diasRestantes)
  if (!venta.fechaFin) {
    console.warn(
      `[NotificationSync] Venta ${venta.id} missing fechaFin. Skipping.`
    );
    return;
  }

  const diasRestantes = differenceInDays(startOfDay(new Date(venta.fechaFin)), startOfDay(new Date()));
  const nuevaPrioridad = calcularPrioridad(diasRestantes);
  const metodoPago = venta.metodoPagoId ? metodosPagoById?.get(venta.metodoPagoId) : undefined;

  // Prepare denormalized data
  const datosNotificacion: Omit<NotificacionVenta, 'id' | 'createdAt'> = {
    entidad: 'venta',
    tipo: 'sistema',
    prioridad: nuevaPrioridad,
    titulo: generarTitulo(diasRestantes, 'venta'),
    diasRestantes,
    leida: false,
    resaltada: false,

    // References
    ventaId: venta.id,
    clienteId: venta.clienteId || '',
    servicioId: venta.servicioId,
    categoriaId: venta.categoriaId,

    // Denormalized from VentaDoc
    clienteNombre: venta.clienteNombre,
    clienteTelefono: venta.clienteTelefono,  // For WhatsApp notifications
    servicioNombre: venta.servicioNombre,
    servicioCorreo: venta.servicioCorreo,  // For WhatsApp messages
    servicioContrasena: venta.servicioContrasena,  // For WhatsApp messages
    categoriaNombre: venta.categoriaNombre || '',
    perfilNombre: venta.perfilNombre,
    codigo: venta.codigo,  // For WhatsApp messages
    estado: venta.estado || 'activo',

    // Denormalized from PagoVenta (denormalized en VentaDoc)
    cicloPago: venta.cicloPago,
    fechaInicio: venta.fechaInicio,
    fechaFin: venta.fechaFin,
    precioFinal: venta.precioFinal, // Final price after discount
    metodoPagoId: venta.metodoPagoId, // For renewals
    metodoPagoNombre: venta.metodoPagoNombre || metodoPago?.nombre,
    moneda: venta.moneda, // Currency

    updatedAt: new Date(),
  };

  if (notifExistente) {
    // Update existing notification
    // Update if diasRestantes changed, or if forced refresh
    if (forzarActualizacion || notifExistente.diasRestantes !== diasRestantes) {
      const aumentoPrioridad = prioridadSubio(notifExistente.prioridad, nuevaPrioridad);

      await updateNotificacion(notifExistente.id, {
        ...datosNotificacion,
        leida: aumentoPrioridad ? false : notifExistente.leida, // Mark as unread if priority increased
        resaltada: notifExistente.resaltada, // Always preserve highlighted state
      });
    }
  } else {
    // Create new notification
    await createNotificacion(datosNotificacion as Record<string, unknown>);
  }
}

/**
 * Process a single servicio and create/update notification
 *
 * @param servicio - Servicio document
 * @param notifExistente - Pre-fetched existing notification if any
 */
