import { addMonths, endOfMonth, format, isWithinInterval, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

import { CYCLE_MONTHS, type CicloPago } from '@/platform/constants';
import type { PronosticoMensual, ServicioPronostico, VentaPronostico } from '@/types/dashboard';

export interface MesPronostico extends PronosticoMensual {
  mesKey: string;
}

export type FinancialForecastInput = {
  ventas: VentaPronostico[];
  servicios: ServicioPronostico[];
  monthsCount?: number;
  endAtCurrentYear?: boolean;
  now?: Date;
  convertToUSD: (amount: number, currency: string) => number;
};

type ForecastSourceInput = Pick<FinancialForecastInput, 'ventas' | 'servicios'>;

function isCicloPago(value: string | null | undefined): value is CicloPago {
  return typeof value === 'string' && value in CYCLE_MONTHS;
}

export function occursInMonth(
  fechaBase: Date,
  cicloPago: CicloPago,
  start: Date,
  end: Date,
): boolean {
  const ciclo = CYCLE_MONTHS[cicloPago];
  let fecha = new Date(fechaBase);
  if (fecha > end) return false;
  while (fecha < start) {
    fecha = addMonths(fecha, ciclo);
  }
  return isWithinInterval(fecha, { start, end });
}

export function buildPronosticoSignature({ ventas, servicios }: ForecastSourceInput): string {
  return [
    ...ventas.map((venta) =>
      [
        'v',
        venta.id,
        venta.fechaFin,
        venta.cicloPago,
        venta.precioFinal,
        venta.moneda ?? 'USD',
      ].join(':'),
    ),
    ...servicios.map((servicio) =>
      [
        's',
        servicio.id,
        servicio.fechaVencimiento,
        servicio.cicloPago,
        servicio.costoServicio,
        servicio.moneda ?? 'USD',
      ].join(':'),
    ),
  ].join('|');
}

export function calculateFinancialForecast({
  ventas,
  servicios,
  monthsCount = 4,
  endAtCurrentYear = false,
  now = new Date(),
  convertToUSD,
}: FinancialForecastInput): MesPronostico[] {
  if (ventas.length === 0 && servicios.length === 0) {
    return [];
  }

  const inicioMesActual = startOfMonth(now);
  const totalMeses = Math.max(
    1,
    Math.floor(endAtCurrentYear ? 12 - now.getMonth() : monthsCount),
  );

  return Array.from({ length: totalMeses }, (_, offset) => {
    const targetMonth = addMonths(startOfMonth(now), offset);
    const inicioMes = startOfMonth(targetMonth);
    const finMes = endOfMonth(targetMonth);

    const ventasDelMes = ventas.filter((venta) => {
      if (!venta.fechaFin || !isCicloPago(venta.cicloPago)) return false;
      const fechaFin = new Date(venta.fechaFin);
      if (offset === 0 && fechaFin < inicioMesActual) return true;
      return occursInMonth(fechaFin, venta.cicloPago, inicioMes, finMes);
    });

    const serviciosDelMes = servicios.filter((servicio) => {
      if (!servicio.fechaVencimiento || !isCicloPago(servicio.cicloPago)) return false;
      return occursInMonth(
        new Date(servicio.fechaVencimiento),
        servicio.cicloPago,
        inicioMes,
        finMes,
      );
    });

    const ingresos = ventasDelMes.reduce(
      (sum, venta) => sum + convertToUSD(venta.precioFinal || 0, venta.moneda || 'USD'),
      0,
    );
    const gastos = serviciosDelMes.reduce(
      (sum, servicio) => sum + convertToUSD(servicio.costoServicio || 0, servicio.moneda || 'USD'),
      0,
    );

    const mes = format(targetMonth, 'MMMM yyyy', { locale: es }).replace(/^\w/, (c) =>
      c.toUpperCase(),
    );
    const mesKey = format(targetMonth, 'yyyy-MM');

    return { mes, mesKey, ingresos, gastos, ganancias: ingresos - gastos };
  });
}
