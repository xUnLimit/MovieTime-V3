import { InsufficientFundsError, ValidationError } from '@/platform/errors/domain-errors';
import { toDateOnly, toIso } from '@/platform/supabase/dates';
import {
  createVentaRefund,
  queryPagosVenta,
} from '@/platform/supabase/ventas-repository';
import { roundToDecimals } from '@/platform/utils/calculations';
import type { PagoVenta, VentaDoc, VentaReembolsoInput, VentaReembolsoResult } from '@/types';
import {
  getNetPaidAmount,
  getUsdValues,
  getVentaConPagoActualUseCase,
  nullableMetodoPagoId,
  toVentaPronostico,
  type LogContext,
  type RecordActivityLog,
} from '@/lib/use-cases/ventas/ventas-shared';

export async function createVentaRefundUseCase(
  venta: VentaDoc,
  input: VentaReembolsoInput,
  options: {
    logContext: LogContext;
    recordActivityLog?: RecordActivityLog;
  }
): Promise<VentaReembolsoResult> {
  if (!venta.id) throw new ValidationError('Venta sin id');

  const monto = roundToDecimals(Number(input.monto) || 0);
  if (monto <= 0) throw new ValidationError('El monto del reembolso debe ser mayor a 0.');

  const nota = input.nota?.trim() ?? '';
  const destinoReembolso = input.destinoReembolso?.trim() ?? '';
  if (!destinoReembolso) {
    throw new ValidationError('La cuenta destino del cliente es obligatoria.');
  }
  const notaReembolso = [`Cuenta destino del cliente: ${destinoReembolso}`, nota]
    .filter((line) => line.length > 0)
    .join('\n\n');

  const motivoCorte = input.motivoCorte?.trim() ?? '';
  if (input.cortarServicio && !motivoCorte) {
    throw new ValidationError('El motivo de corte es obligatorio.');
  }

  const moneda = input.moneda || venta.moneda || 'USD';
  const { usd, rate } = await getUsdValues(monto, moneda);
  const pagos = await queryPagosVenta<PagoVenta>([{ field: 'ventaId', operator: '==', value: venta.id }]);
  const saldoDisponibleUsd = getNetPaidAmount(pagos);

  if (usd > saldoDisponibleUsd + 0.0001) {
    throw new InsufficientFundsError('El reembolso supera el saldo disponible de la venta.', {
      ventaId: venta.id,
      montoUsd: usd,
      saldoDisponibleUsd,
    });
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
  });

  const ventaActualizada = await getVentaConPagoActualUseCase(venta.id);
  const pronostico = ventaActualizada ? toVentaPronostico(ventaActualizada) : null;
  const serviceProfileDelta = input.cortarServicio && venta.estado !== 'inactivo' && venta.servicioId
    ? { servicioId: venta.servicioId, shouldIncrement: false }
    : null;

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
