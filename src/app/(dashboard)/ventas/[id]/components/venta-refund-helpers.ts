import { calcularMontoSinConsumir, roundToDecimals } from '@/platform/utils/calculations';
import type { VentaDoc } from '@/types';

export function parseRefundDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateSuggestedRefundForDate(venta: VentaDoc, dateValue: string): number {
  const refundDate = parseRefundDate(dateValue);
  if (
    !refundDate ||
    !venta.fechaInicio ||
    !venta.fechaFin ||
    typeof venta.precioFinal !== 'number' ||
    !Number.isFinite(venta.precioFinal) ||
    venta.precioFinal <= 0 ||
    venta.estado === 'inactivo'
  ) {
    return 0;
  }

  return roundToDecimals(calcularMontoSinConsumir(
    new Date(venta.fechaInicio),
    new Date(venta.fechaFin),
    venta.precioFinal,
    refundDate,
  ));
}
