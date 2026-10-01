import { toDateOnly, toIso } from './dates';
import {
  createServicioPaymentRpc,
  createVentaPaymentRpc,
} from './payments-rpc-adapter';

type CicloPago = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export type CreatePagoServicioInput = {
  idempotencyKey?: string;
  servicioId: string;
  categoriaId?: string | null;
  fecha?: Date | string | null;
  descripcion?: string | null;
  cicloPago?: CicloPago | null;
  fechaInicio?: Date | string | null;
  fechaVencimiento?: Date | string | null;
  monto: number;
  /** Monto ya convertido a USD (la conversion vive en modules/payments). */
  montoUsd: number;
  /** Tasa de cambio aplicada (1 para USD). */
  exchangeRate: number;
  metodoPagoId?: string | null;
  metodoPagoNombre?: string | null;
  moneda?: string | null;
  renovacionAutomatica?: boolean | null;
  isPagoInicial?: boolean | null;
  notas?: string | null;
};

export type CreatePagoVentaInput = {
  idempotencyKey?: string;
  ventaId: string;
  clienteId?: string | null;
  clienteNombre?: string | null;
  categoriaId?: string | null;
  fecha?: Date | string | null;
  monto: number;
  /** Monto ya convertido a USD (la conversion vive en modules/payments). */
  montoUsd: number;
  /** Tasa de cambio aplicada (1 para USD). */
  exchangeRate: number;
  precio?: number | null;
  descuento?: number | null;
  metodoPagoId?: string | null;
  metodoPago?: string | null;
  moneda?: string | null;
  notas?: string | null;
  isPagoInicial?: boolean | null;
  cicloPago?: CicloPago | null;
  fechaInicio?: Date | string | null;
  fechaVencimiento?: Date | string | null;
  planId?: string | null;
  planNombre?: string | null;
  planTipoNombre?: string | null;
};

export async function createPagoServicio(payload: CreatePagoServicioInput): Promise<string> {
  const servicioId = String(payload.servicioId ?? '');
  if (!servicioId) throw new Error('servicioId es requerido para pagos_servicio');

  const monto = Number(payload.monto ?? 0);
  const moneda = String(payload.moneda ?? 'USD');

  return createServicioPaymentRpc({
    p_idempotency_key: payload.idempotencyKey,
    p_servicio_id: servicioId,
    p_categoria_id_snapshot: optionalString(payload.categoriaId),
    p_fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
    p_fecha_vencimiento: toDateOnly(payload.fechaVencimiento ?? new Date()),
    p_ciclo_pago: toCicloPago(payload.cicloPago),
    p_costo_original: monto,
    p_moneda_original: moneda,
    p_costo_usd: Number(payload.montoUsd),
    p_exchange_rate: Number(payload.exchangeRate),
    p_renovacion_automatica: Boolean(payload.renovacionAutomatica ?? false),
    p_metodo_pago_id: optionalString(payload.metodoPagoId),
    p_metodo_pago_nombre_snapshot: optionalString(payload.metodoPagoNombre),
    p_fecha_pago: toIso(payload.fecha ?? new Date()),
    p_pago_notas: nullableString(payload.notas),
  });
}

export async function createPagoVenta(payload: CreatePagoVentaInput): Promise<string> {
  const ventaId = String(payload.ventaId ?? '');
  if (!ventaId) throw new Error('ventaId es requerido para pagos_venta');

  const monto = Number(payload.monto ?? 0);
  const precio = Number(payload.precio ?? monto);
  const descuento = Number(payload.descuento ?? 0);
  const moneda = String(payload.moneda ?? 'USD');

  return createVentaPaymentRpc({
    p_idempotency_key: payload.idempotencyKey,
    p_venta_id: ventaId,
    p_fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
    p_fecha_fin: toDateOnly(payload.fechaVencimiento ?? new Date()),
    p_ciclo_pago: toCicloPago(payload.cicloPago),
    p_precio_original: precio,
    p_descuento: descuento,
    p_total_original: monto,
    p_moneda_original: moneda,
    p_total_usd: Number(payload.montoUsd),
    p_exchange_rate: Number(payload.exchangeRate),
    p_metodo_pago_id: optionalString(payload.metodoPagoId),
    p_metodo_pago_nombre_snapshot: optionalString(payload.metodoPago),
    p_fecha_pago: toIso(payload.fecha ?? new Date()),
    p_pago_notas: nullableString(payload.notas),
    p_plan_id: optionalString(payload.planId),
    p_plan_nombre_snapshot: optionalString(payload.planNombre),
    p_plan_tipo_nombre_snapshot: optionalString(payload.planTipoNombre),
  });
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
