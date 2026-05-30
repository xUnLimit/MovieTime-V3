import type { ActivityLogOptions } from '@/lib/activity/activity-log-writer';
import { syncVentaForecastReadModels } from '@/lib/forecasting';
import {
  getCategoriaPlanesRead,
  getServicioRead,
  getServicioTipoRead,
  queryMetodosPagoServiciosRead,
  queryMetodosPagoTercerosRead,
} from '@/platform/supabase/domain-read-adapters';
import { renewServicioUseCase } from '@/lib/use-cases/servicios/servicios-payment-use-cases';
import { renewVentaUseCase } from '@/lib/use-cases/ventas/ventas-payment-use-cases';
import { withPendingTerceroPaymentMethod } from '@/platform/utils/terceroMetodoPago';
import {
  deleteServicioNotificationsStoreWorkflow,
  deleteVentaNotificationsStoreWorkflow,
  getCurrentMetodosPagoStoreSnapshot,
  refreshVentasStoreCache,
} from '@/lib/store-reactions/notificaciones-workflow-reactions';
import type { MetodoPago, NotificacionServicio, NotificacionVenta, Servicio, VentaDoc } from '@/types';
import type { Plan } from '@/types/categorias';

type NotificacionVentaConId = NotificacionVenta & { id: string };
type NotificacionServicioConId = NotificacionServicio & { id: string };

export type NotificationRenewalInput = {
  metodoPagoId: string;
  metodoPagoNombre?: string;
  moneda?: string;
  periodoRenovacion?: string;
  costo?: number;
  fechaInicio?: Date;
  fechaVencimiento?: Date;
  planId?: string;
  planNombre?: string;
  planTipoNombre?: string;
  notificarWhatsApp?: boolean;
  mensajeWhatsApp?: string;
};

type RefreshNotificationCaches = () => Promise<void>;

export type NotificationRenewalOutcome = {
  renewed: true;
  warnings: string[];
  cacheInvalidations: Array<{ entity: 'venta' | 'servicio'; entityId: string }>;
  notificationInvalidationNeeded: boolean;
  storeRefreshes: Array<'ventas' | 'servicios' | 'notificaciones' | 'categorias'>;
  whatsappMessage?: {
    phone: string;
    message: string;
  };
};

export async function loadVentaRenewalOptionsUseCase(
  notif: NotificacionVentaConId,
): Promise<{
  categoriaPlanes: Plan[];
  metodosPagoTerceros: MetodoPago[];
  servicioTipoSeleccionado?: string;
}> {
  const [metodosPago, categoriaPlanes, servicioTipoSeleccionado] = await Promise.all([
    queryMetodosPagoTercerosRead(),
    notif.categoriaId ? getCategoriaPlanesRead(notif.categoriaId) : Promise.resolve([]),
    notif.servicioId ? getServicioTipoRead(notif.servicioId) : Promise.resolve(undefined),
  ]);

  return {
    categoriaPlanes,
    metodosPagoTerceros: withPendingTerceroPaymentMethod(metodosPago),
    servicioTipoSeleccionado,
  };
}

export async function confirmVentaRenewalFromNotificationUseCase({
  data,
  log,
  notif,
  refreshNotificationCaches,
}: {
  data: NotificationRenewalInput;
  log: ActivityLogOptions;
  notif: NotificacionVentaConId;
  refreshNotificationCaches: RefreshNotificationCaches;
}): Promise<NotificationRenewalOutcome> {
  const metodosPago = getCurrentMetodosPagoStoreSnapshot();
  const metodoPagoSeleccionado = metodosPago.find(
    (m) => m.id === data.metodoPagoId,
  );
  const renovacion = await renewVentaUseCase(
    toVentaDocFromNotification(notif),
    {
      ...data,
      periodoRenovacion: data.periodoRenovacion ?? notif.cicloPago ?? 'mensual',
      costo: data.costo ?? notif.precioFinal ?? 0,
      fechaInicio: data.fechaInicio ?? notif.fechaInicio ?? new Date(),
      fechaVencimiento: data.fechaVencimiento ?? notif.fechaFin,
      planId: data.planId,
      planNombre: data.planNombre,
      planTipoNombre: data.planTipoNombre,
      metodoPagoNombre:
        metodoPagoSeleccionado?.nombre || data.metodoPagoNombre || '',
      moneda: data.moneda || metodoPagoSeleccionado?.moneda || notif.moneda || 'USD',
    },
    log,
  );

  const warnings: string[] = [];
  if (renovacion.syncPaymentMethodFailed) {
    warnings.push('sync_payment_method_failed');
  }

  void renovacion.pronostico;
  syncVentaForecastReadModels(notif.ventaId);
  await deleteVentaNotificationsStoreWorkflow(notif.ventaId);
  await refreshNotificationCaches();

  refreshVentasStoreCache();

  return {
    renewed: true,
    warnings,
    cacheInvalidations: [{ entity: 'venta', entityId: notif.ventaId }],
    notificationInvalidationNeeded: true,
    storeRefreshes: ['ventas', 'notificaciones'],
    whatsappMessage: data.notificarWhatsApp && data.mensajeWhatsApp
      ? {
          phone: notif.clienteTelefono ? notif.clienteTelefono.replace(/[^\d+]/g, '') : '',
          message: data.mensajeWhatsApp,
        }
      : undefined,
  };
}

export async function loadServicioRenewalOptionsUseCase(
  notif: NotificacionServicioConId,
  currentMetodosPago: MetodoPago[],
): Promise<{
  servicio: Servicio;
  metodosPagoServicio: MetodoPago[];
}> {
  const [servicio, metodosPagoServicio] = await Promise.all([
    getServicioRead(notif.servicioId),
    currentMetodosPago.length > 0
      ? Promise.resolve(currentMetodosPago)
      : queryMetodosPagoServiciosRead(),
  ]);

  if (!servicio) {
    throw new Error('No se pudo cargar el servicio para renovar.');
  }

  return { servicio, metodosPagoServicio };
}

export async function confirmServicioRenewalFromNotificationUseCase({
  data,
  log,
  metodosPagoServicio,
  refreshNotificationCaches,
  servicio,
}: {
  data: NotificationRenewalInput;
  log: ActivityLogOptions;
  metodosPagoServicio: MetodoPago[];
  refreshNotificationCaches: RefreshNotificationCaches;
  servicio: Servicio;
}): Promise<NotificationRenewalOutcome> {
  const metodoPagoSeleccionado = metodosPagoServicio.find(
    (metodo) => metodo.id === data.metodoPagoId,
  );
  await renewServicioUseCase(servicio, {
    ...data,
    periodoRenovacion: data.periodoRenovacion ?? servicio.cicloPago ?? 'mensual',
    costo: data.costo ?? servicio.costoServicio ?? 0,
    fechaInicio: data.fechaInicio ?? servicio.fechaInicio ?? new Date(),
    fechaVencimiento: data.fechaVencimiento ?? servicio.fechaVencimiento ?? new Date(),
    metodoPagoNombre: data.metodoPagoNombre ?? servicio.metodoPagoNombre,
    moneda: data.moneda ?? servicio.moneda,
  }, {
    metodoPago: metodoPagoSeleccionado,
    ...log,
    logPrefix: 'Servicio renovado desde notificaciones',
  });

  await deleteServicioNotificationsStoreWorkflow(servicio.id);
  await refreshNotificationCaches();

  return {
    renewed: true,
    warnings: [],
    cacheInvalidations: [{ entity: 'servicio', entityId: servicio.id }],
    notificationInvalidationNeeded: true,
    storeRefreshes: ['servicios', 'notificaciones', 'categorias'],
  };
}

function toVentaDocFromNotification(notif: NotificacionVentaConId): VentaDoc {
  return {
    id: notif.ventaId,
    clienteId: notif.clienteId,
    clienteNombre: notif.clienteNombre,
    categoriaId: notif.categoriaId || '',
    categoriaNombre: notif.categoriaNombre,
    servicioId: notif.servicioId,
    servicioNombre: notif.servicioNombre,
    servicioCorreo: notif.servicioCorreo,
    servicioContrasena: notif.servicioContrasena,
    clienteTelefono: notif.clienteTelefono,
    perfilNombre: notif.perfilNombre,
    codigo: notif.codigo,
    notas: notif.notas,
    metodoPagoId: notif.metodoPagoId,
    moneda: notif.moneda,
    precioFinal: notif.precioFinal,
    estado: 'activo',
  } as VentaDoc;
}

