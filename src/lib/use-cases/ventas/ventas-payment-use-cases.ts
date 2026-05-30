import { format } from 'date-fns';

import { ValidationError } from '@/platform/errors/domain-errors';
import { toDateOnly } from '@/platform/supabase/dates';
import { logAsyncSideEffectError } from '@/platform/utils/safety';
import {
  getPagoVentaById,
  queryPagosVenta,
  removePagoVenta,
  updateLatestVentaPeriodo,
  updateVenta,
  updateVentaPaymentAndPeriod,
} from '@/platform/supabase/ventas-repository';
import { financialPayments } from '@/lib/payments';
import { syncTerceroMetodoPagoUseCase } from '@/lib/use-cases/terceros/tercero-metodo-pago-use-cases';
import type { PagoVenta, VentaDoc } from '@/types';
import {
  getPagoValues,
  getUsdValues,
  getVentaConPagoActualUseCase,
  toVentaPronostico,
  type LogContext,
  type RecordActivityLog,
  type VentaPagoInput,
  type VentaPagoResult,
} from '@/lib/use-cases/ventas/ventas-shared';
import { updateVentaUseCase } from '@/lib/use-cases/ventas/ventas-write-use-cases';

export { getVentaConPagoActualUseCase };

export async function renewVentaUseCase(
  venta: VentaDoc,
  input: VentaPagoInput,
  options: {
    logContext?: LogContext;
    recordActivityLog?: RecordActivityLog;
    logPrefix?: string;
  } = {}
): Promise<VentaPagoResult> {
  if (!venta.id) throw new ValidationError('Venta sin id');
  const { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda } = getPagoValues(venta, input);
  const planId = input.planId ?? venta.planId;
  const planNombre = input.planNombre ?? venta.planNombre;
  const planTipoNombre = input.planTipoNombre ?? venta.planTipoNombre;
  if (!planId || !planNombre) {
    throw new ValidationError('Una renovación debe tener un plan seleccionado.');
  }

  await financialPayments.registerRenewalVentaPayment({
    ventaId: venta.id,
    clienteId: venta.clienteId || '',
    clienteNombre: venta.clienteNombre,
    categoriaId: venta.categoriaId || '',
    total: monto,
    metodoPagoNombre,
    metodoPagoId: input.metodoPagoId,
    moneda,
    cicloPago: input.periodoRenovacion as VentaDoc['cicloPago'],
    notas: notaPrincipal,
    fechaInicio: input.fechaInicio,
    fechaVencimiento: input.fechaVencimiento,
    precio: costo,
    descuento: descuentoNumero,
    planId,
    planNombre,
    planTipoNombre,
  });

  await updateVenta(venta.id, { notas: notaPrincipal });

  let syncPaymentMethodFailed = false;
  try {
    await syncTerceroMetodoPagoUseCase({
      terceroId: venta.clienteId,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      moneda,
    });
  } catch (error) {
    syncPaymentMethodFailed = true;
    logAsyncSideEffectError(error, {
      operation: 'syncTerceroMetodoPago',
      entity: 'venta',
      entityId: venta.id,
    });
  }

  const pronostico = {
    id: venta.id,
    categoriaId: venta.categoriaId ?? '',
    fechaInicio: input.fechaInicio.toISOString(),
    fechaFin: input.fechaVencimiento.toISOString(),
    cicloPago: input.periodoRenovacion,
    precioFinal: monto,
    moneda,
  };

  await options.recordActivityLog?.({
    ...(options.logContext ?? { usuarioId: 'sistema', usuarioEmail: 'sistema' }),
    accion: 'renovacion',
    entidad: 'venta',
    entidadId: venta.id,
    entidadNombre: `${venta.clienteNombre} - ${venta.servicioNombre}`,
    detalles: `${options.logPrefix ?? 'Venta renovada'}: ${venta.clienteNombre} / ${venta.servicioNombre} - ${moneda} ${monto.toFixed(2)} - hasta ${format(input.fechaVencimiento, 'dd/MM/yyyy')} (${input.periodoRenovacion})`,
    metadata: {
      monto,
      moneda,
      cicloPago: input.periodoRenovacion,
      fechaInicio: toDateOnly(input.fechaInicio),
      fechaFin: toDateOnly(input.fechaVencimiento),
      descuento: descuentoNumero,
      origen: 'renewVentaUseCase',
    },
  });

  return { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda, pronostico, syncPaymentMethodFailed };
}

export async function updateVentaPagoUseCase(
  venta: VentaDoc,
  pagoId: string,
  input: VentaPagoInput
) {
  const { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda } = getPagoValues(venta, input);
  const { usd, rate } = await getUsdValues(monto, moneda);
  const pago = await getPagoVentaById<PagoVenta & { ventaPeriodoId?: string }>(pagoId);

  if (pago?.ventaPeriodoId) {
    await updateVentaPaymentAndPeriod(pagoId, {
      precio: costo,
      descuento: descuentoNumero,
      monto,
      moneda,
      montoUsd: usd,
      exchangeRate: rate,
      cicloPago: (input.periodoRenovacion || 'mensual') as NonNullable<VentaDoc['cicloPago']>,
      fechaInicio: input.fechaInicio,
      fechaVencimiento: input.fechaVencimiento,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      notas: notaPrincipal,
    });
  }

  let syncPaymentMethodFailed = false;
  try {
    await syncTerceroMetodoPagoUseCase({
      terceroId: venta.clienteId,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      moneda,
    });
  } catch (error) {
    syncPaymentMethodFailed = true;
    logAsyncSideEffectError(error, {
      operation: 'syncTerceroMetodoPago',
      entity: 'venta',
      entityId: venta.id,
    });
  }

  const ventaActualizada = await getVentaConPagoActualUseCase(venta.id);
  const pronostico = ventaActualizada ? toVentaPronostico(ventaActualizada) : null;

  return { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda, syncPaymentMethodFailed, pronostico };
}

export async function deleteVentaPagoUseCase(ventaId: string, pagoId: string) {
  await removePagoVenta(pagoId);
  const ventaActualizada = await getVentaConPagoActualUseCase(ventaId);
  const pronostico = ventaActualizada ? toVentaPronostico(ventaActualizada) : null;

  return { ventaActualizada, pronostico };
}

export async function updateVentaWithLatestPagoUseCase(
  id: string,
  updates: Partial<VentaDoc>,
  pagoUpdates: {
    precio: number;
    descuento: number;
    monto: number;
    metodoPagoId: string;
    metodoPago: string;
    moneda: string;
    cicloPago?: VentaDoc['cicloPago'];
    fechaInicio: Date;
    fechaVencimiento: Date;
    planId?: string | null;
    planNombre?: string | null;
    planTipoNombre?: string | null;
  },
  options: {
    currentVenta?: VentaDoc;
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
) {
  const result = await updateVentaUseCase(id, updates, options);
  const { usd, rate } = await getUsdValues(pagoUpdates.monto, pagoUpdates.moneda);
  const cicloPago = (pagoUpdates.cicloPago || 'mensual') as NonNullable<VentaDoc['cicloPago']>;

  const pagos = await queryPagosVenta<PagoVenta>([{ field: 'ventaId', operator: '==', value: id }]);

  if (pagos.length > 0) {
    const pagoMasReciente = [...pagos].sort((a, b) => {
      const dateA = a.fecha instanceof Date ? a.fecha : new Date(a.fecha);
      const dateB = b.fecha instanceof Date ? b.fecha : new Date(b.fecha);
      return dateB.getTime() - dateA.getTime();
    })[0];

    await updateVentaPaymentAndPeriod(pagoMasReciente.id, {
      precio: pagoUpdates.precio,
      descuento: pagoUpdates.descuento,
      monto: pagoUpdates.monto,
      moneda: pagoUpdates.moneda,
      montoUsd: usd,
      exchangeRate: rate,
      cicloPago,
      fechaInicio: pagoUpdates.fechaInicio,
      fechaVencimiento: pagoUpdates.fechaVencimiento,
      metodoPagoId: pagoUpdates.metodoPagoId,
      metodoPagoNombre: pagoUpdates.metodoPago,
      planId: pagoUpdates.planId,
      planNombre: pagoUpdates.planNombre,
      planTipoNombre: pagoUpdates.planTipoNombre,
    });
  } else {
    await updateLatestVentaPeriodo(id, {
      precio: pagoUpdates.precio,
      descuento: pagoUpdates.descuento,
      monto: pagoUpdates.monto,
      moneda: pagoUpdates.moneda,
      montoUsd: usd,
      exchangeRate: rate,
      cicloPago,
      fechaInicio: pagoUpdates.fechaInicio,
      fechaVencimiento: pagoUpdates.fechaVencimiento,
      planId: pagoUpdates.planId,
      planNombre: pagoUpdates.planNombre,
      planTipoNombre: pagoUpdates.planTipoNombre,
    });
  }

  if (updates.clienteId && updates.metodoPagoId) {
    try {
      await syncTerceroMetodoPagoUseCase({
        terceroId: updates.clienteId,
        metodoPagoId: updates.metodoPagoId,
        metodoPagoNombre: updates.metodoPagoNombre,
        moneda: updates.moneda,
      });
    } catch (error) {
      logAsyncSideEffectError(error, {
        operation: 'syncTerceroMetodoPago',
        entity: 'venta',
        entityId: id,
      });
      return { ...result, syncPaymentMethodFailed: true };
    }
  }

  return { ...result, syncPaymentMethodFailed: false };
}
