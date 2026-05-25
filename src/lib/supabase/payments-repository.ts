import { toDateOnly, toIso } from './dates';
import { convertToUSD } from '@/lib/payments';
import { assertOnlineMutation } from '@/lib/pwa/mutation-guard';
import {
  createServicioPaymentRpc,
  createVentaPaymentRpc,
} from './payments-rpc-adapter';

type CicloPago = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export async function createPagoServicio(payload: Record<string, unknown>): Promise<string> {
  assertOnlineMutation();
  const servicioId = String(payload.servicioId ?? '');
  if (!servicioId) throw new Error('servicioId es requerido para pagos_servicio');

  const monto = Number(payload.monto ?? 0);
  const moneda = String(payload.moneda ?? 'USD');
  const { usd, rate } = await convertAmountToUSD(monto, moneda);

  return createServicioPaymentRpc({
    p_servicio_id: servicioId,
    p_categoria_id_snapshot: optionalString(payload.categoriaId),
    p_fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
    p_fecha_vencimiento: toDateOnly(payload.fechaVencimiento ?? new Date()),
    p_ciclo_pago: toCicloPago(payload.cicloPago),
    p_costo_original: monto,
    p_moneda_original: moneda,
    p_costo_usd: usd,
    p_exchange_rate: rate,
    p_renovacion_automatica: Boolean(payload.renovacionAutomatica ?? false),
    p_metodo_pago_id: optionalString(payload.metodoPagoId),
    p_metodo_pago_nombre_snapshot: optionalString(payload.metodoPagoNombre),
    p_fecha_pago: toIso(payload.fecha ?? new Date()),
    p_pago_notas: nullableString(payload.notas),
  });
}

export async function createPagoVenta(payload: Record<string, unknown>): Promise<string> {
  assertOnlineMutation();
  const ventaId = String(payload.ventaId ?? '');
  if (!ventaId) throw new Error('ventaId es requerido para pagos_venta');

  const monto = Number(payload.monto ?? 0);
  const precio = Number(payload.precio ?? monto);
  const descuento = Number(payload.descuento ?? 0);
  const moneda = String(payload.moneda ?? 'USD');
  const { usd, rate } = await convertAmountToUSD(monto, moneda);

  return createVentaPaymentRpc({
    p_venta_id: ventaId,
    p_fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
    p_fecha_fin: toDateOnly(payload.fechaVencimiento ?? new Date()),
    p_ciclo_pago: toCicloPago(payload.cicloPago),
    p_precio_original: precio,
    p_descuento: descuento,
    p_total_original: monto,
    p_moneda_original: moneda,
    p_total_usd: usd,
    p_exchange_rate: rate,
    p_metodo_pago_id: optionalString(payload.metodoPagoId),
    p_metodo_pago_nombre_snapshot: optionalString(payload.metodoPago),
    p_fecha_pago: toIso(payload.fecha ?? new Date()),
    p_pago_notas: nullableString(payload.notas),
    p_plan_id: optionalString(payload.planId),
    p_plan_nombre_snapshot: optionalString(payload.planNombre),
    p_plan_tipo_nombre_snapshot: optionalString(payload.planTipoNombre),
  });
}

async function convertAmountToUSD(amount: number, moneda: string) {
  const usd = await convertToUSD(amount, moneda);
  return {
    usd,
    rate: moneda === 'USD' || amount === 0 || usd === 0 ? 1 : amount / usd,
  };
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function nullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

function toCicloPago(value: unknown): CicloPago {
  return value === 'trimestral' || value === 'semestral' || value === 'anual'
    ? value
    : 'mensual';
}
