import { differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Calcula el monto sin consumir de una venta basado en días calendar
 * Usa differenceInCalendarDays para consistencia con módulo de Terceros
 */
export function calcularMontoSinConsumir(
  fechaInicio: Date,
  fechaFin: Date,
  montoTotal: number,
  fechaCalculo: Date = new Date()
): number {
  // Calcular días usando differenceInCalendarDays (días completos)
  const totalDias = Math.max(differenceInCalendarDays(fechaFin, fechaInicio), 0);
  const diasRestantes = Math.max(differenceInCalendarDays(fechaFin, fechaCalculo), 0);

  if (totalDias === 0) return 0;
  if (diasRestantes <= 0) return 0;
  if (diasRestantes >= totalDias) return montoTotal;

  // Calcular ratio restante (no consumido)
  const ratioRestante = diasRestantes / totalDias;
  return Math.max(montoTotal * ratioRestante, 0);
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

