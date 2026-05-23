import { format } from 'date-fns';

import { toDateOnly, toIso } from '@/lib/supabase/dates';
import {
  createVentaRefund,
  getPagoVentaById,
  queryPagosVenta,
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
import { roundToDecimals } from '@/lib/utils/calculations';
import { safeAsyncSideEffect } from '@/lib/utils/safety';
import type { PagoVenta, VentaDoc, VentaReembolsoInput, VentaReembolsoResult } from '@/types';
import {
  getNetPaidAmount,
  getPagoValues,
  getUsdValues,
  getVentaConPagoActualUseCase,
  nullableMetodoPagoId,
  nullableUuid,
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

export async function createVentaRefundUseCase(
  venta: VentaDoc,
  input: VentaReembolsoInput,
  options: {
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
): Promise<VentaReembolsoResult> {
  if (!venta.id) throw new Error('Venta sin id');

  const monto = roundToDecimals(Number(input.monto) || 0);
  if (monto <= 0) throw new Error('El monto del reembolso debe ser mayor a 0.');

  const nota = input.nota?.trim() ?? '';
  const destinoReembolso = input.destinoReembolso?.trim() ?? '';
  if (!destinoReembolso) {
    throw new Error('La cuenta destino del cliente es obligatoria.');
  }
  const notaReembolso = [`Cuenta destino del cliente: ${destinoReembolso}`, nota]
    .filter((line) => line.length > 0)
    .join('\n\n');

  const motivoCorte = input.motivoCorte?.trim() ?? '';
  if (input.cortarServicio && !motivoCorte) {
    throw new Error('El motivo de corte es obligatorio.');
  }

  const moneda = input.moneda || venta.moneda || 'USD';
  const { usd, rate } = await getUsdValues(monto, moneda);
  const pagos = await queryPagosVenta<PagoVenta>([{ field: 'ventaId', operator: '==', value: venta.id }]);
  const saldoDisponibleUsd = getNetPaidAmount(pagos);

  if (usd > saldoDisponibleUsd + 0.0001) {
    throw new Error('El reembolso supera el saldo disponible de la venta.');
  }

  const pagoId = await createVentaRefund({
    p_venta_id: venta.id,
    p_monto_original: monto,
    p_moneda_original: moneda,
    p_monto_usd: usd,
    p_exchange_rate: rate,
    p_metodo_pago_id: nullableMetodoPagoId(input.metodoPagoId),
    p_metodo_pago_nombre_snapshot: input.metodoPagoNombre || venta.metodoPagoNombre || null,
    p_destino_reembolso: destinoReembolso,
    p_fecha_reembolso: toIso(input.fecha),
    p_nota: notaReembolso || null,
    p_cortar: input.cortarServicio,
    p_motivo_corte: motivoCorte || null,
    p_created_by: nullableUuid(options.logContext.usuarioId),
  });

  const ventaActualizada = await getVentaConPagoActualUseCase(venta.id);
  const pronostico = ventaActualizada ? toVentaPronostico(ventaActualizada) : null;
  const serviceProfileDelta = input.cortarServicio && venta.estado !== 'inactivo' && venta.servicioId
    ? { servicioId: venta.servicioId, shouldIncrement: false }
    : null;

  safeAsyncSideEffect(upsertVentaPronostico(pronostico, venta.id), {
    operation: 'upsertVentaPronostico',
    entity: 'venta',
    entityId: venta.id,
  });

  await options.recordActivityLog?.({
    ...options.logContext,
    accion: 'reembolso',
    entidad: 'venta',
    entidadId: venta.id,
    entidadNombre: `${venta.clienteNombre} - ${venta.servicioNombre}`,
    detalles: input.cortarServicio
      ? `Venta reembolsada y cortada: ${venta.clienteNombre} / ${venta.servicioNombre} - ${moneda} ${monto.toFixed(2)}`
      : `Venta reembolsada: ${venta.clienteNombre} / ${venta.servicioNombre} - ${moneda} ${monto.toFixed(2)}`,
    metadata: {
      monto,
      montoUsd: usd,
      moneda,
      metodoPagoId: input.metodoPagoId,
      metodoPagoNombre: input.metodoPagoNombre ?? null,
      destinoReembolso,
      fecha: toDateOnly(input.fecha),
      cortarServicio: input.cortarServicio,
      motivoCorte: motivoCorte || null,
      nota: notaReembolso || null,
      origen: 'createVentaRefundUseCase',
    },
  });

  return {
    pagoId,
    monto,
    montoUsd: usd,
    moneda,
    ventaActualizada,
    pronostico,
    serviceProfileDelta,
  };
}
