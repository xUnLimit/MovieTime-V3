import { toast } from 'sonner';

import type { EnrichedPagoDialogFormData } from '@/components/shared/PagoDialog';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import {
  invalidateDashboardCache,
  refreshCategoriasCache,
} from '@/lib/commands/client-cache';
import { syncVentaForecastReadModels } from '@/lib/forecasting';
import {
  getCategoriaPlanesRead,
  getServicioRead,
  getServicioTipoRead,
  queryMetodosPagoServiciosRead,
  queryMetodosPagoTercerosRead,
} from '@/lib/supabase/domain-read-adapters';
import { renewServicioUseCase } from '@/lib/use-cases/servicios/servicios-payment-use-cases';
import { renewVentaUseCase } from '@/lib/use-cases/ventas/ventas-payment-use-cases';
import { withPendingTerceroPaymentMethod } from '@/lib/utils/terceroMetodoPago';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import type { MetodoPago, NotificacionServicio, NotificacionVenta, Servicio, VentaDoc } from '@/types';
import type { Plan } from '@/types/categorias';

type NotificacionVentaConId = NotificacionVenta & { id: string };
type NotificacionServicioConId = NotificacionServicio & { id: string };

type RefreshNotificationCaches = () => Promise<void>;

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
  notif,
  refreshNotificationCaches,
}: {
  data: EnrichedPagoDialogFormData;
  notif: NotificacionVentaConId;
  refreshNotificationCaches: RefreshNotificationCaches;
}) {
  const { metodosPago } = useMetodosPagoStore.getState();
  const metodoPagoSeleccionado = metodosPago.find(
    (m) => m.id === data.metodoPagoId,
  );
  const renovacion = await renewVentaUseCase(
    toVentaDocFromNotification(notif),
    {
      ...data,
      metodoPagoNombre:
        metodoPagoSeleccionado?.nombre || data.metodoPagoNombre || '',
      moneda: data.moneda || metodoPagoSeleccionado?.moneda || notif.moneda || 'USD',
    },
    getActivityLogOptions(),
  );

  if (renovacion.syncPaymentMethodFailed) {
    toast.warning('Venta renovada con advertencia', {
      description:
        'La renovacion se guardo, pero no se pudo actualizar el metodo de pago en terceros.',
    });
  }

  void renovacion.pronostico;
  syncVentaForecastReadModels(notif.ventaId);
  invalidateDashboardCache({
    entity: 'venta',
    entityId: notif.ventaId,
  });
  await useNotificacionesStore.getState().deleteNotificacionesPorVenta(notif.ventaId);
  await refreshNotificationCaches();

  void import('@/store/ventasStore').then(({ useVentasStore }) =>
    useVentasStore.getState().fetchVentas(true),
  );
  showRenewalSuccessToast(notif, data);
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
  metodosPagoServicio,
  refreshNotificationCaches,
  servicio,
}: {
  data: EnrichedPagoDialogFormData;
  metodosPagoServicio: MetodoPago[];
  refreshNotificationCaches: RefreshNotificationCaches;
  servicio: Servicio;
}) {
  const metodoPagoSeleccionado = metodosPagoServicio.find(
    (metodo) => metodo.id === data.metodoPagoId,
  );
  await renewServicioUseCase(servicio, data, {
    metodoPago: metodoPagoSeleccionado,
    ...getActivityLogOptions(),
    logPrefix: 'Servicio renovado desde notificaciones',
  });

  invalidateDashboardCache({ entity: 'servicio', entityId: servicio.id });
  await useNotificacionesStore.getState().deleteNotificacionesPorServicio(servicio.id);
  await refreshNotificationCaches();
  refreshCategoriasCache({ entity: 'servicio', entityId: servicio.id });
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

function showRenewalSuccessToast(
  notif: NotificacionVentaConId,
  data: EnrichedPagoDialogFormData,
) {
  if (data.notificarWhatsApp && data.mensajeWhatsApp) {
    const phone = notif.clienteTelefono
      ? notif.clienteTelefono.replace(/[^\d+]/g, '')
      : '';
    const mensajeAEnviar = data.mensajeWhatsApp;
    toast.success('Venta renovada exitosamente', {
      duration: Infinity,
      action: {
        label: 'Enviar WhatsApp',
        onClick: () => {
          const base = phone
            ? `https://web.whatsapp.com/send?phone=${phone}&text=`
            : `https://web.whatsapp.com/send?text=`;
          window.open(
            base + encodeURIComponent(mensajeAEnviar),
            '_blank',
            'noopener,noreferrer',
          );
        },
      },
      actionButtonStyle: { backgroundColor: '#15803d', color: '#fff' },
    });
    return;
  }

  toast.success('Venta renovada exitosamente');
}
