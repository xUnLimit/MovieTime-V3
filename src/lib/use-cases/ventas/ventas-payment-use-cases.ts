import { format } from 'date-fns';

import { toDateOnly } from '@/lib/supabase/dates';
import {
  getPagoVentaById,
  removePagoVenta,
  updateVenta,
  updateVentaPaymentAndPeriod,
} from '@/lib/supabase/ventas-repository';
import {
  adjustIngresosStats,
  getDiaKeyFromDate,
  getMesKeyFromDate,
  upsertVentaPronostico,
} from '@/lib/services/dashboardStatsService';
import { crearPagoRenovacion } from '@/lib/services/pagosVentaService';
import { syncTerceroMetodoPago } from '@/lib/services/terceroMetodoPagoSyncService';
import { safeAsyncSideEffect } from '@/lib/utils/safety';
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
  if (!venta.id) throw new Error('Venta sin id');
  const { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda } = getPagoValues(venta, input);
  const planId = input.planId ?? venta.planId;
  const planNombre = input.planNombre ?? venta.planNombre;
  const planTipoNombre = input.planTipoNombre ?? venta.planTipoNombre;
  if (!planId || !planNombre) {
    throw new Error('Una renovación debe tener un plan seleccionado.');
  }

  await crearPagoRenovacion(
    venta.id,
    venta.clienteId || '',
    venta.clienteNombre,
    venta.categoriaId || '',
    monto,
    metodoPagoNombre,
    input.metodoPagoId,
    moneda,
    input.periodoRenovacion as VentaDoc['cicloPago'],
    notaPrincipal,
    input.fechaInicio,
    input.fechaVencimiento,
    costo,
    descuentoNumero,
    planId,
    planNombre,
    planTipoNombre
  );

  await updateVenta(venta.id, { notas: notaPrincipal });

  let syncPaymentMethodFailed = false;
  try {
    await syncTerceroMetodoPago({
      terceroId: venta.clienteId,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      moneda,
    });
  } catch (error) {
    syncPaymentMethodFailed = true;
    console.error('[VentasUseCases] Error syncing user payment method:', error);
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

  safeAsyncSideEffect(upsertVentaPronostico(pronostico, venta.id), {
    operation: 'upsertVentaPronostico',
    entity: 'venta',
    entityId: venta.id,
  });
  safeAsyncSideEffect(adjustIngresosStats({
    delta: monto,
    moneda,
    mes: getMesKeyFromDate(input.fechaInicio),
    dia: getDiaKeyFromDate(input.fechaInicio),
    categoriaId: venta.categoriaId ?? '',
    categoriaNombre: venta.categoriaNombre ?? '',
  }), {
    operation: 'adjustIngresosStats',
    entity: 'venta',
    entityId: venta.id,
  });

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
    await syncTerceroMetodoPago({
      terceroId: venta.clienteId,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre,
      moneda,
    });
  } catch (error) {
    syncPaymentMethodFailed = true;
    console.error('[VentasUseCases] Error syncing user payment method:', error);
  }

  const ventaActualizada = await getVentaConPagoActualUseCase(venta.id);
  const pronostico = ventaActualizada ? toVentaPronostico(ventaActualizada) : null;
  safeAsyncSideEffect(upsertVentaPronostico(pronostico, venta.id), {
    operation: 'upsertVentaPronostico',
    entity: 'venta',
    entityId: venta.id,
  });

  return { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda, syncPaymentMethodFailed, pronostico };
}

export async function deleteVentaPagoUseCase(ventaId: string, pagoId: string) {
  await removePagoVenta(pagoId);
  const ventaActualizada = await getVentaConPagoActualUseCase(ventaId);
  const pronostico = ventaActualizada ? toVentaPronostico(ventaActualizada) : null;
  safeAsyncSideEffect(upsertVentaPronostico(pronostico, ventaId), {
    operation: 'upsertVentaPronostico',
    entity: 'venta',
    entityId: ventaId,
  });

  return { ventaActualizada, pronostico };
}
