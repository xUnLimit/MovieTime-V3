import { queryNotificationIdsRead } from '@/platform/supabase/domain-read-adapters';
import { removeNotificacion, updateNotificacion } from '@/platform/supabase/notifications-repository';
import { isValidPaymentPromiseDate } from './payment-promise';

export async function toggleNotificacionLeidaUseCase(
  notifId: string,
  leida: boolean,
) {
  await updateNotificacion(notifId, {
    leida,
    updatedAt: new Date(),
  });
}

export async function toggleNotificacionResaltadaUseCase(
  notifId: string,
  resaltada: boolean,
) {
  await updateNotificacion(notifId, {
    resaltada,
    updatedAt: new Date(),
  });
}

export async function setVentaPaymentPromiseUseCase(
  notifId: string,
  promisedDate: Date | null,
  now = new Date(),
) {
  if (promisedDate && !isValidPaymentPromiseDate(promisedDate)) {
    throw new Error('La fecha prometida no es válida');
  }

  if (promisedDate) {
    await updateNotificacion(notifId, {
      fechaPrometidaPago: promisedDate,
      leida: true,
      updatedAt: now,
    });
    return;
  }

  await updateNotificacion(notifId, {
    fechaPrometidaPago: null,
    updatedAt: now,
  });
}

export async function deleteNotificacionUseCase(notifId: string) {
  await removeNotificacion(notifId);
}

export async function deleteNotificacionesPorVentaUseCase(ventaId: string) {
  const notifsToDelete = await queryNotificationIdsRead([
    { field: 'entidad', operator: '==', value: 'venta' },
    { field: 'ventaId', operator: '==', value: ventaId },
  ]);

  await Promise.all(notifsToDelete.map((notificacion) => removeNotificacion(notificacion.id)));
}

export async function deleteNotificacionesPorServicioUseCase(servicioId: string) {
  const notifsToDelete = await queryNotificationIdsRead([
    { field: 'servicioId', operator: '==', value: servicioId },
  ]);

  await Promise.all(notifsToDelete.map((notificacion) => removeNotificacion(notificacion.id)));
}
