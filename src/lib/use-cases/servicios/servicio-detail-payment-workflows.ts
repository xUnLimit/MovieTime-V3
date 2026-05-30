import { invalidateDashboardCache, refreshCategoriasCache } from '@/platform/commands/client-cache';
import {
  deleteServicioPagoUseCase,
  renewServicioUseCase,
  updateServicioPagoUseCase,
} from '@/lib/use-cases/servicios/servicios-payment-use-cases';
import type {
  ServicioDetalleWorkflowDeps,
  ServicioDetalleWorkflowOutcome,
  ServicioPagoWorkflowInput,
} from '@/lib/use-cases/servicios/servicio-detail-types';
import type { MetodoPago, PagoServicio, Servicio } from '@/types';

export async function updateServicioPagoDetalleWorkflow({
  data,
  metodosPago,
  pago,
  pagosOrdenados,
  servicio,
}: {
  data: ServicioPagoWorkflowInput;
  metodosPago: MetodoPago[];
  pago: PagoServicio;
  pagosOrdenados: PagoServicio[];
  servicio: Servicio;
}): Promise<ServicioDetalleWorkflowOutcome> {
  const metodoPagoSeleccionado = metodosPago.find((item) => item.id === data.metodoPagoId);
  const esUltimoPago = pagosOrdenados[0]?.id === pago.id;
  const { servicioActualizado } = await updateServicioPagoUseCase(
    servicio,
    pago,
    data,
    {
      metodoPago: metodoPagoSeleccionado,
      isLatestPayment: esUltimoPago,
    },
  );

  return { type: 'servicioPaymentUpdated', servicioActualizado };
}

export async function deleteServicioPagoDetalleWorkflow({
  deps,
  fallbackMoneda,
  id,
  pago,
  pagosOrdenados,
  pagosServicio,
  servicio,
}: {
  deps: Pick<ServicioDetalleWorkflowDeps, 'invalidateCategorias' | 'refreshPagos'>;
  fallbackMoneda?: string;
  id: string;
  pago: PagoServicio;
  pagosOrdenados: PagoServicio[];
  pagosServicio: PagoServicio[];
  servicio: Servicio;
}): Promise<ServicioDetalleWorkflowOutcome> {
  const eraUltimaRenovacion = pagosOrdenados[0]?.id === pago.id;
  const pagosActualizados = pagosServicio.filter((item) => item.id !== pago.id);
  const { servicioActualizado } = await deleteServicioPagoUseCase(
    servicio,
    pago,
    pagosActualizados,
    {
      isLatestPayment: eraUltimaRenovacion,
      fallbackMoneda,
    },
  );

  invalidateDashboardCache({ entity: 'servicio', entityId: id });
  refreshCategoriasCache({ entity: 'servicio', entityId: id });
  await deps.invalidateCategorias();
  await deps.refreshPagos();

  return {
    type: 'servicioPaymentDeleted',
    servicioActualizado,
    latestPayment: eraUltimaRenovacion,
  };
}

export async function renewServicioDetalleWorkflow({
  data,
  deps,
  id,
  metodosPago,
  renovaciones,
  servicio,
}: {
  data: ServicioPagoWorkflowInput;
  deps: Pick<ServicioDetalleWorkflowDeps, 'deleteNotificacionesPorServicio' | 'invalidateNotifications' | 'refreshPagos'>;
  id: string;
  metodosPago: MetodoPago[];
  renovaciones: number;
  servicio: Servicio;
}): Promise<ServicioDetalleWorkflowOutcome> {
  const metodoPagoSeleccionado = metodosPago.find((item) => item.id === data.metodoPagoId);
  const { servicioActualizado } = await renewServicioUseCase(servicio, data, {
    numeroRenovacion: renovaciones + 1,
    metodoPago: metodoPagoSeleccionado,
  });

  invalidateDashboardCache({ entity: 'servicio', entityId: id });
  deps.refreshPagos();
  await deps.deleteNotificacionesPorServicio(id);
  await deps.invalidateNotifications();
  refreshCategoriasCache({ entity: 'servicio', entityId: id });

  return { type: 'servicioRenewed', servicioActualizado };
}
