import { invalidateDashboardCache } from '@/lib/commands/client-cache';
import { getActivityLogOptions } from '@/lib/activity/activity-log-writer';
import { getTerceroUseCase } from '@/lib/use-cases/terceros-use-cases';
import { updateVentaUseCase } from '@/lib/use-cases/ventas/ventas-write-use-cases';
import type {
  ServicioDetalleWorkflowDeps,
  ServicioDetalleWorkflowOutcome,
} from '@/lib/use-cases/servicios/servicio-detail-types';
import type { Servicio, VentaDoc } from '@/types';

export async function cutVentaFromServicioDetalleWorkflow({
  deps,
  motivoCorte,
  venta,
}: {
  deps: Pick<ServicioDetalleWorkflowDeps, 'deleteNotificacionesPorVenta' | 'invalidateNotifications' | 'updatePerfilOcupado'>;
  motivoCorte: string;
  venta: VentaDoc;
}): Promise<ServicioDetalleWorkflowOutcome> {
  const { serviceProfileDelta } = await updateVentaUseCase(
    venta.id,
    {
      estado: 'inactivo',
      cortadaAt: new Date(),
      motivoCorte,
    },
    {
      currentVenta: venta,
      ...getActivityLogOptions(),
    },
  );

  if (serviceProfileDelta) {
    await deps.updatePerfilOcupado(serviceProfileDelta.servicioId, serviceProfileDelta.shouldIncrement);
  }

  invalidateDashboardCache({ entity: 'venta', entityId: venta.id });
  await deps.deleteNotificacionesPorVenta(venta.id);
  await deps.invalidateNotifications();

  return {
    type: 'servicioVentaCut',
    ventaId: venta.id,
    serviceProfileUpdated: Boolean(serviceProfileDelta),
  };
}

export async function transferVentaFromServicioDetalleWorkflow({
  codigo,
  deps,
  notificarWhatsApp,
  perfilNombre,
  perfilNumero,
  targetServicio,
  venta,
}: {
  codigo?: string;
  deps: Pick<ServicioDetalleWorkflowDeps, 'invalidateNotifications' | 'updatePerfilOcupado'>;
  notificarWhatsApp: boolean;
  perfilNombre?: string;
  perfilNumero?: number | null;
  targetServicio: Servicio;
  venta: VentaDoc;
}): Promise<ServicioDetalleWorkflowOutcome> {
  await updateVentaUseCase(
    venta.id,
    {
      servicioId: targetServicio.id,
      perfilNumero,
      perfilNombre,
      codigo,
    },
    {
      currentVenta: venta,
      ...getActivityLogOptions(),
    },
  );

  if ((venta.estado ?? 'activo') !== 'inactivo') {
    await Promise.all([
      deps.updatePerfilOcupado(venta.servicioId, false),
      deps.updatePerfilOcupado(targetServicio.id, true),
    ]);
  }

  invalidateDashboardCache({ entity: 'venta', entityId: venta.id });
  await deps.invalidateNotifications();

  const tercero = notificarWhatsApp && venta.clienteId
    ? await getTerceroUseCase(venta.clienteId)
    : undefined;

  return {
    type: 'servicioVentaTransferred',
    ventaId: venta.id,
    targetServicioId: targetServicio.id,
    whatsappRequested: notificarWhatsApp,
    tercero,
  };
}
