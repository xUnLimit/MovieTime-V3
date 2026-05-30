import { format } from 'date-fns';

import { convertToUSD } from '@/lib/payments';
import { getVentaConPagoActual } from '@/lib/ventas/ventas-read-adapter';
import { calculateDiscountedAmount, roundToDecimals } from '@/platform/utils/calculations';
import { toMoneyNumber } from '@/platform/utils/safety';
import { isPendingTerceroPaymentMethodId } from '@/platform/utils/terceroMetodoPago';
import type { ActivityLog, PagoVenta, VentaDoc } from '@/types';
import type { VentaPronostico } from '@/types/dashboard';

export type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
export type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;

export type VentaInput = Omit<VentaDoc, 'id' | 'createdAt' | 'updatedAt'> & {
  pagos?: Array<{
    fecha?: Date | null;
    total?: number;
    notas?: string;
  }>;
};

export type VentaPagoInput = {
  periodoRenovacion: string;
  metodoPagoId: string;
  metodoPagoNombre?: string;
  moneda?: string;
  costo: number;
  descuento?: number;
  fechaInicio: Date;
  fechaVencimiento: Date;
  notas?: string;
  planId?: string;
  planNombre?: string;
  planTipoNombre?: string;
};

export type VentaPagoResult = {
  costo: number;
  descuentoNumero: number;
  monto: number;
  notaPrincipal: string;
  metodoPagoNombre: string;
  moneda: string;
  pronostico: VentaPronostico;
  syncPaymentMethodFailed: boolean;
};

const VENTA_TABLE_UPDATE_KEYS = [
  'clienteId',
  'servicioId',
  'categoriaId',
  'estado',
  'perfilNumero',
  'perfilNombre',
  'codigo',
  'cortadaAt',
  'cortadaBy',
  'motivoCorte',
  'archivadoAt',
  'archivadoBy',
  'motivoArchivado',
  'notas',
] as const satisfies ReadonlyArray<keyof VentaDoc>;

export function getVentaTableUpdates(updates: Partial<VentaDoc>): Partial<VentaDoc> {
  const result: Partial<VentaDoc> = {};
  for (const key of VENTA_TABLE_UPDATE_KEYS) {
    assignDefined(result, updates, key);
  }
  return result;
}

function assignDefined<T extends object, K extends keyof T>(
  target: Partial<T>,
  source: Partial<T>,
  key: K,
) {
  const value = source[key];
  if (value !== undefined) target[key] = value;
}

export async function getUsdValues(amount: number, moneda: string) {
  const normalizedAmount = toMoneyNumber(amount);
  const usd = await convertToUSD(normalizedAmount, moneda);
  return {
    usd,
    rate: moneda === 'USD' || normalizedAmount === 0 || usd === 0 ? 1 : normalizedAmount / usd,
  };
}

export function nullableMetodoPagoId(id?: string | null) {
  return isPendingTerceroPaymentMethodId(id) ? null : id ?? null;
}

export function nullableUuid(id?: string | null) {
  if (!id) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

export function getPagoValues(venta: VentaDoc, input: VentaPagoInput) {
  const costo = roundToDecimals(input.costo);
  const descuentoNumero = roundToDecimals(Number(input.descuento) || 0);
  const monto = calculateDiscountedAmount(costo, descuentoNumero);
  const notaPrincipal = input.notas?.trim() ?? '';
  const metodoPagoNombre = input.metodoPagoNombre || venta.metodoPagoNombre || '';
  const moneda = input.moneda || venta.moneda || 'USD';

  return { costo, descuentoNumero, monto, notaPrincipal, metodoPagoNombre, moneda };
}

export function getPagoSignedUsd(pago: PagoVenta) {
  const amount = toMoneyNumber((pago as PagoVenta & { montoUsd?: number }).montoUsd ?? pago.monto ?? 0);
  return pago.estado === 'reembolsado' ? -amount : pago.estado === 'anulado' ? 0 : amount;
}

export function getNetPaidAmount(pagos: PagoVenta[]) {
  return roundToDecimals(pagos.reduce((sum, pago) => sum + getPagoSignedUsd(pago), 0));
}

export function toVentaPronostico(v: VentaDoc): VentaPronostico | null {
  const precioFinal = v.precioFinal ?? v.precio ?? 0;
  if (v.estado === 'inactivo' || !v.fechaFin || !v.cicloPago || precioFinal <= 0) return null;
  return {
    id: v.id,
    categoriaId: v.categoriaId ?? '',
    fechaInicio: v.fechaInicio instanceof Date ? format(v.fechaInicio, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaInicio ?? new Date()),
    fechaFin: v.fechaFin instanceof Date ? format(v.fechaFin, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaFin),
    cicloPago: v.cicloPago,
    precioFinal,
    moneda: v.moneda || 'USD',
  };
}

export async function getVentaConPagoActualUseCase(id: string): Promise<VentaDoc | null> {
  return getVentaConPagoActual(id);
}
