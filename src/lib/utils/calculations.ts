import { addMonths, differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
type CicloPago = 'mensual' | 'trimestral' | 'semestral' | 'anual';
type EstadoSuscripcion = 'activa' | 'suspendida' | 'inactiva' | 'vencida';

/**
 * Calcula la fecha de vencimiento basada en fecha de inicio y ciclo de pago
 */
export function calcularFechaVencimiento(
  fechaInicio: Date,
  cicloPago: CicloPago
): Date {
  const meses = cicloPago === 'mensual' ? 1 : cicloPago === 'trimestral' ? 3 : cicloPago === 'semestral' ? 6 : 12;
  return addMonths(fechaInicio, meses);
}

/**
 * Calcula el porcentaje de consumo de una suscripción basado en fechas
 */
export function calcularConsumo(
  fechaInicio: Date,
  fechaVencimiento: Date
): number {
  const hoy = new Date();
  const totalDias = differenceInCalendarDays(fechaVencimiento, fechaInicio);
  const diasTranscurridos = differenceInCalendarDays(hoy, fechaInicio);

  if (totalDias === 0) return 0;
  if (diasTranscurridos <= 0) return 0;
  if (diasTranscurridos >= totalDias) return 100;

  return Math.round((diasTranscurridos / totalDias) * 100);
}

/**
 * Calcula el monto restante de una suscripción
 */
export function calcularMontoRestante(
  montoTotal: number,
  consumoPorcentaje: number
): number {
  return montoTotal * (1 - consumoPorcentaje / 100);
}

/**
 * Calcula el monto sin consumir de una venta basado en días calendar
 * Usa differenceInCalendarDays para consistencia con módulo de Usuarios
 */
export function calcularMontoSinConsumir(
  fechaInicio: Date,
  fechaFin: Date,
  montoTotal: number
): number {
  const hoy = new Date();

  // Calcular días usando differenceInCalendarDays (días completos)
  const totalDias = Math.max(differenceInCalendarDays(fechaFin, fechaInicio), 0);
  const diasRestantes = Math.max(differenceInCalendarDays(fechaFin, hoy), 0);

  if (totalDias === 0) return 0;
  if (diasRestantes <= 0) return 0;
  if (diasRestantes >= totalDias) return montoTotal;

  // Calcular ratio restante (no consumido)
  const ratioRestante = diasRestantes / totalDias;
  return Math.max(montoTotal * ratioRestante, 0);
}

/**
 * Determina el estado de una suscripción basado en fecha de vencimiento
 */
export function calcularEstadoSuscripcion(fechaVencimiento: Date): EstadoSuscripcion {
  const hoy = new Date();
  return hoy > fechaVencimiento ? 'vencida' : 'activa';
}

export function calcularDiasRelativosCalendario(
  fecha: Date | string | null | undefined
): number | null {
  if (!fecha) return null;

  const fechaNormalizada = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(fechaNormalizada.getTime())) return null;

  return differenceInCalendarDays(fechaNormalizada, new Date());
}

/**
 * Calcula los días de retraso de una suscripción vencida
 */
export function calcularDiasRetraso(fechaVencimiento: Date): number {
  const dias = calcularDiasRelativosCalendario(fechaVencimiento);
  return Math.max(0, Math.abs(Math.min(dias ?? 0, 0)));
}

/**
 * Calcula días restantes hasta el vencimiento
 */
export function calcularDiasRestantes(fechaVencimiento: Date): number {
  const dias = calcularDiasRelativosCalendario(fechaVencimiento);
  return Math.max(0, dias ?? 0);
}

/**
 * Formatea un número como moneda USD
 */
export function formatearMoneda(monto: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(monto);
}

/**
 * Redondea números decimales para evitar ruido de coma flotante en montos y porcentajes.
 */
export function roundToDecimals(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Calcula un monto final después de descuento y lo normaliza a 2 decimales.
 */
export function calculateDiscountedAmount(baseAmount: number, discountPercentage = 0): number {
  return roundToDecimals(Math.max(baseAmount * (1 - discountPercentage / 100), 0));
}

/**
 * Formatea una fecha en formato legible
 */
export function formatearFecha(fecha: Date): string {
  return format(fecha, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Formatea una fecha con hora en formato legible (d de MMMM de yyyy, hh:mm a)
 */
export function formatearFechaHora(fecha: Date): string {
  return format(fecha, "d 'de' MMMM 'de' yyyy, hh:mm a", { locale: es });
}

/**
 * Formatea una fecha en formato corto
 */
export function formatearFechaCorta(fecha: Date): string {
  return format(fecha, 'dd/MM/yyyy');
}

/**
 * Convierte moneda usando tasa de cambio
 */
export function convertirMoneda(
  monto: number,
  monedaOrigen: string,
  monedaDestino: string,
  tasas: Record<string, number>
): number {
  if (monedaOrigen === monedaDestino) return monto;

  // Convertir primero a USD si no es USD
  let montoUSD = monto;
  if (monedaOrigen !== 'USD') {
    const tasaKey = `USD_${monedaOrigen}`;
    const tasa = tasas[tasaKey] || 1;
    montoUSD = monto / tasa;
  }

  // Convertir de USD a moneda destino
  if (monedaDestino === 'USD') return montoUSD;

  const tasaKey = `USD_${monedaDestino}`;
  const tasa = tasas[tasaKey] || 1;
  return montoUSD * tasa;
}

/**
 * Calcula el costo total de un servicio
 */
export function calcularCostoServicio(
  perfiles: number,
  costoPorPerfil: number
): number {
  return perfiles * costoPorPerfil;
}

/**
 * Calcula la comisión de un revendedor
 */
export function calcularComision(
  monto: number,
  porcentajeComision: number
): number {
  return monto * (porcentajeComision / 100);
}

/**
 * Calcula rentabilidad porcentual
 */
export function calcularRentabilidad(
  ingresos: number,
  gastos: number
): number {
  if (gastos === 0) return 0;
  return ((ingresos - gastos) / gastos) * 100;
}

/**
 * Determina el color del badge según estado de suscripción
 */
export function getColorEstado(estado: EstadoSuscripcion): string {
  const colores: Record<EstadoSuscripcion, string> = {
    activa: 'bg-green-500',
    suspendida: 'bg-yellow-500',
    inactiva: 'bg-gray-500',
    vencida: 'bg-red-500'
  };

  return colores[estado] || 'bg-gray-500';
}

/**
 * Determina el color del badge según días de retraso
 */
export function getColorDiasRetraso(dias: number): string {
  if (dias >= 100) return 'bg-red-600';
  if (dias >= 11) return 'bg-red-500';
  if (dias >= 8) return 'bg-orange-500';
  if (dias >= 7) return 'bg-orange-400';
  if (dias >= 3) return 'bg-yellow-500';
  if (dias >= 2) return 'bg-yellow-400';
  if (dias >= 1) return 'bg-yellow-300';
  return 'bg-green-500';
}

/**
 * Obtiene el texto descriptivo de días de retraso
 */
export function getTextoDiasRetraso(dias: number): string {
  if (dias >= 100) return `${dias} días vencido`;
  if (dias >= 1) return `${dias} días para vencer`;
  return 'Activo';
}

export function deriveTopLevelFromPagos(pagos: Array<{
  fecha?: Date | null;
  precio?: number;
  descuento?: number;
  total?: number;
  metodoPagoId?: string | null;
  metodoPagoNombre?: string;
  moneda?: string;
  cicloPago?: string | null;
  fechaInicio?: Date | null;
  fechaVencimiento?: Date | null;
}>) {
  if (!pagos || pagos.length === 0) return {};

  const sorted = [...pagos].sort((a, b) => {
    const aTime = a.fecha ? new Date(a.fecha).getTime() : 0;
    const bTime = b.fecha ? new Date(b.fecha).getTime() : 0;
    return bTime - aTime;
  });

  const latest = sorted[0];
  return {
    metodoPagoId: latest.metodoPagoId ?? null,
    metodoPagoNombre: latest.metodoPagoNombre ?? 'Sin método',
    moneda: latest.moneda ?? 'USD',
    cicloPago: latest.cicloPago ?? null,
    fechaInicio: latest.fechaInicio ?? null,
    fechaFin: latest.fechaVencimiento ?? null,
    precio: latest.precio ?? 0,
    descuento: latest.descuento ?? 0,
    precioFinal: latest.total ?? 0,
  };
}

// ===========================
// MULTI-CURRENCY CONVERSION HELPERS
// ===========================

import { currencyService } from '@/lib/services/currencyService';

/**
 * Sum array of monetary amounts, converting each to USD
 * Used for: VentasMetrics totals, payment history totals, service cost aggregations
 *
 * @param items - Array of objects with monto and optional moneda
 * @returns Total sum in USD
 *
 * @example
 * const pagos = [
 *   { monto: 75, moneda: 'TRY' },
 *   { monto: 1500, moneda: 'ARS' },
 *   { monto: 10, moneda: 'USD' }
 * ];
 * const total = await sumInUSD(pagos); // Returns ~17.00
 */
export async function sumInUSD(
  items: Array<{ monto: number; moneda?: string }>
): Promise<number> {
  let totalUSD = 0;

  for (const item of items) {
    const amountUSD = await currencyService.convertToUSD(
      item.monto,
      item.moneda || 'USD'
    );
    totalUSD += amountUSD;
  }

  return totalUSD;
}

/**
 * Convert single amount to USD (wrapper for currencyService)
 *
 * @param amount - Amount in source currency
 * @param fromCurrency - Source currency code (default: 'USD')
 * @returns Amount in USD
 */
export async function convertToUSD(
  amount: number,
  fromCurrency: string = 'USD'
): Promise<number> {
  return currencyService.convertToUSD(amount, fromCurrency);
}

/**
 * Format aggregate total with USD label
 * Always shows "USD" suffix for clarity in mixed-currency contexts
 *
 * @param amount - Amount in USD
 * @returns Formatted string like "$1,234.56 USD"
 */
export function formatAggregateInUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} USD`;
}
