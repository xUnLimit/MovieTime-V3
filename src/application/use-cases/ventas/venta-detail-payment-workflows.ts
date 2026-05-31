import { CYCLE_MONTHS } from '@/platform/constants';
import { invalidateDashboardCache } from '@/platform/commands/client-cache';
import { syncVentaForecastReadModels } from '@/modules/forecasting';
import type { ActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import { emitVentaUpdated } from '@/platform/events/cache-reactions';
import { createVentaRefundUseCase } from '@/application/use-cases/ventas/ventas-refund-use-cases';
import {
  deleteVentaPagoUseCase,
  renewVentaUseCase,
  updateVentaPagoUseCase,
} from '@/application/use-cases/ventas/ventas-payment-use-cases';
import { fetchVentaDetalleQuery } from '@/application/use-cases/ventas/venta-detail-query-use-cases';
import type {
  VentaDetalleWorkflowDeps,
  VentaDetalleWorkflowOutcome,
  VentaPagoWorkflowInput,
  VentaRefundWorkflowInput,
} from '@/application/use-cases/ventas/venta-detail-types';
import type { MetodoPago, PagoVenta, VentaDoc, VentaPago } from '@/types';

export async function renewVentaDetalleWorkflow({
  deps,
  id,
  input,
  log,
  metodosPago,
  venta,
}: {
  deps: Pick<VentaDetalleWorkflowDeps, 'deleteNotificacionesPorVenta' | 'invalidateNotifications' | 'refreshPagos'>;
  id: string;
  input: VentaPagoWorkflowInput;
  log: ActivityLogOptions;
  metodosPago: MetodoPago[];
  venta: VentaDoc;
}): Promise<VentaDetalleWorkflowOutcome> {
  const metodoPagoSeleccionado = metodosPago.find((metodo) => metodo.id === input.metodoPagoId);
  const renovacion = await renewVentaUseCase(venta, {
    ...input,
    metodoPagoNombre: metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
    moneda: input.moneda || metodoPagoSeleccionado?.moneda || venta.moneda,
  }, log);

  void renovacion.pronostico;
  syncVentaForecastReadModels(id);
  invalidateDashboardCache({ entity: 'venta', entityId: id });

  const { venta: ventaActualizada } = await fetchVentaDetalleQuery(id);
  deps.refreshPagos();
  await deps.deleteNotificacionesPorVenta(id);
  await deps.invalidateNotifications();
  emitVentaUpdated(id);

  return {
    type: 'ventaRenewed',
    monto: renovacion.monto,
    syncPaymentMethodFailed: renovacion.syncPaymentMethodFailed,
    ventaActualizada,
    whatsappRequested: Boolean(input.notificarWhatsApp),
  };
}

export async function refundVentaDetalleWorkflow({
  deps,
  id,
  input,
  log,
  venta,
}: {
  deps: Pick<VentaDetalleWorkflowDeps, 'deleteNotificacionesPorVenta' | 'invalidateNotifications' | 'refreshPagos' | 'updatePerfilOcupado'>;
  id: string;
  input: VentaRefundWorkflowInput;
  log: ActivityLogOptions;
  venta: VentaDoc;
}): Promise<VentaDetalleWorkflowOutcome> {
  const result = await createVentaRefundUseCase(
    venta,
    {
      ventaId: venta.id,
      monto: input.monto,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre: input.metodoPagoNombre ?? '',
      destinoReembolso: input.destinoReembolso,
      moneda: input.moneda ?? venta.moneda ?? 'USD',
      fecha: input.fecha,
      nota: input.nota,
      cortarServicio: input.cortarServicio,
      motivoCorte: input.motivoCorte,
    },
    log,
  );

  if (result.serviceProfileDelta) {
    await deps.updatePerfilOcupado(
      result.serviceProfileDelta.servicioId,
      result.serviceProfileDelta.shouldIncrement,
    );
  }

  deps.refreshPagos();
  void result.pronostico;
  syncVentaForecastReadModels(id);
  invalidateDashboardCache({ entity: 'venta', entityId: id });

  if (input.cortarServicio) {
    await deps.deleteNotificacionesPorVenta(id);
    await deps.invalidateNotifications();
  }

  emitVentaUpdated(id);

  return {
    type: 'ventaRefunded',
    cut: input.cortarServicio,
    ventaActualizada: result.ventaActualizada ?? null,
  };
}

export async function updateVentaPagoDetalleWorkflow({
  id,
  input,
  metodosPago,
  pagoId,
  venta,
}: {
  id: string;
  input: VentaPagoWorkflowInput;
  metodosPago: MetodoPago[];
  pagoId: string;
  venta: VentaDoc;
}): Promise<VentaDetalleWorkflowOutcome> {
  const metodoPagoSeleccionado = metodosPago.find((metodo) => metodo.id === input.metodoPagoId);
  const updateResult = await updateVentaPagoUseCase(venta, pagoId, {
    ...input,
    metodoPagoNombre:
      input.metodoPagoNombre || metodoPagoSeleccionado?.nombre || venta.metodoPagoNombre,
    moneda: input.moneda || metodoPagoSeleccionado?.moneda || venta.moneda,
  });

  const { venta: ventaActualizada } = await fetchVentaDetalleQuery(id);

  return {
    type: 'ventaPaymentUpdated',
    syncPaymentMethodFailed: updateResult.syncPaymentMethodFailed,
    ventaActualizada,
  };
}

export async function deleteVentaPagoDetalleWorkflow({
  id,
  pagoId,
}: {
  id: string;
  pagoId: string;
}): Promise<VentaDetalleWorkflowOutcome> {
  const { ventaActualizada } = await deleteVentaPagoUseCase(id, pagoId);
  return {
    type: 'ventaPaymentDeleted',
    ventaActualizada: ventaActualizada ?? null,
  };
}

export function buildVentaPaymentRows({
  loadingPagos,
  pagosVenta,
  venta,
}: {
  loadingPagos: boolean;
  pagosVenta: PagoVenta[];
  venta: VentaDoc | null;
}): VentaPago[] {
  if (!venta || loadingPagos) return [];

  if (pagosVenta.length > 0) {
    return pagosVenta.map((p, index) => {
      let fechaInicio = p.fechaInicio;
      let fechaVencimiento = p.fechaVencimiento;

      if (!fechaInicio || !fechaVencimiento) {
        if (p.isPagoInicial) {
          fechaInicio = venta.fechaInicio ?? p.fecha;
          fechaVencimiento = venta.fechaFin ?? p.fecha;
        } else {
          const pagoAnterior = pagosVenta[index + 1];
          if (pagoAnterior?.fechaVencimiento) {
            fechaInicio = pagoAnterior.fechaVencimiento;
            const mesesCiclo = p.cicloPago ? CYCLE_MONTHS[p.cicloPago as keyof typeof CYCLE_MONTHS] : 1;
            const fechaVenc = new Date(fechaInicio);
            fechaVenc.setMonth(fechaVenc.getMonth() + mesesCiclo);
            fechaVencimiento = fechaVenc;
          } else {
            fechaInicio = p.fecha;
            fechaVencimiento = p.fecha;
          }
        }
      }

      return {
        id: p.id,
        fecha: p.fecha,
        descripcion: p.descripcion ?? (p.isPagoInicial ? 'Pago Inicial' : 'Renovacion'),
        precio: p.precio ?? p.monto,
        descuento: p.descuento ?? 0,
        total: p.monto,
        metodoPagoNombre: p.metodoPago,
        destinoReembolso: p.destinoReembolso,
        moneda: p.moneda ?? venta.moneda,
        isPagoInicial: p.isPagoInicial,
        notas: p.notas,
        cicloPago: p.cicloPago,
        metodoPagoId: p.metodoPagoId,
        fechaInicio,
        fechaVencimiento,
        estado: p.estado,
        motivoAnulacion: p.motivoAnulacion,
      } as VentaPago;
    });
  }

  return [
    {
      id: 'synthetic-initial',
      fecha: venta.createdAt || venta.fechaInicio || new Date(),
      descripcion: 'Pago Inicial',
      precio: venta.precio ?? 0,
      descuento: venta.descuento ?? 0,
      total: venta.precioFinal ?? 0,
      metodoPagoId: venta.metodoPagoId ?? null,
      metodoPagoNombre: venta.metodoPagoNombre,
      moneda: venta.moneda,
      isPagoInicial: true,
      estado: 'registrado' as const,
    },
  ];
}
