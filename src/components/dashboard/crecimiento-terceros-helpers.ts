import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';

import type { ChurnMes, TercerosDia, TercerosMes } from '@/types/dashboard';

export type CrecimientoPeriod = 'actual' | '3meses' | '6meses' | '12meses';

export type TercerosGrowthPoint = {
  dia: string;
  fullDate: string;
  clientes: number;
  revendedores: number;
};

export type ChurnPoint = {
  mes: string;
  fullDate: string;
  perdidos: number;
  activosInicio: number;
  churnPct: number;
};

export type BalancePoint = {
  mes: string;
  fullDate: string;
  ganados: number;
  perdidos: number;
};

export function buildTercerosGrowthData({
  currentDate = new Date(),
  selectedPeriod,
  tercerosPorDia,
  tercerosPorMes,
}: {
  currentDate?: Date;
  selectedPeriod: CrecimientoPeriod;
  tercerosPorDia: TercerosDia[];
  tercerosPorMes: TercerosMes[];
}): TercerosGrowthPoint[] {
  if (selectedPeriod === 'actual') {
    const days = eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    });
    const diaMap = new Map(tercerosPorDia.map((dia) => [dia.dia, dia]));

    return days.map((day) => {
      const diaKey = format(day, 'yyyy-MM-dd');
      const entry = day > currentDate ? undefined : diaMap.get(diaKey);
      return {
        dia: day.getDate().toString(),
        fullDate: format(day, 'd MMM yyyy', { locale: es }),
        clientes: entry?.clientes ?? 0,
        revendedores: entry?.revendedores ?? 0,
      };
    });
  }

  const monthsBack = selectedPeriod === '3meses' ? 3 : selectedPeriod === '6meses' ? 6 : 12;
  const startDate = subMonths(currentDate, monthsBack - 1);
  const months = eachMonthOfInterval({
    start: startOfMonth(startDate),
    end: currentDate,
  });
  const mesMap = new Map(tercerosPorMes.map((mes) => [mes.mes, mes]));

  return months.map((month) => {
    const mesKey = format(month, 'yyyy-MM');
    const entry = mesMap.get(mesKey);
    return {
      dia: format(month, 'MMM', { locale: es }),
      fullDate: format(month, 'MMMM yyyy', { locale: es }),
      clientes: entry?.clientes ?? 0,
      revendedores: entry?.revendedores ?? 0,
    };
  });
}

export function buildChurnData(porMes: ChurnMes[] = []): ChurnPoint[] {
  return porMes.map((entry) => {
    const monthDate = new Date(`${entry.mes}-01T00:00:00`);
    return {
      mes: format(monthDate, 'MMM', { locale: es }),
      fullDate: format(monthDate, 'MMMM yyyy', { locale: es }),
      perdidos: entry.perdidos,
      activosInicio: entry.activosInicio,
      churnPct: entry.churnPct,
    };
  });
}

export function buildBalanceData({
  churnPorMes = [],
  tercerosPorMes,
}: {
  churnPorMes?: ChurnMes[];
  tercerosPorMes: TercerosMes[];
}): BalancePoint[] {
  const altasPorMes = new Map(
    tercerosPorMes.map((entry) => [
      entry.mes,
      (entry.clientes ?? 0) + (entry.revendedores ?? 0),
    ]),
  );

  return churnPorMes.map((entry) => {
    const monthDate = new Date(`${entry.mes}-01T00:00:00`);
    return {
      mes: format(monthDate, 'MMM', { locale: es }),
      fullDate: format(monthDate, 'MMMM yyyy', { locale: es }),
      ganados: altasPorMes.get(entry.mes) ?? 0,
      perdidos: entry.perdidos,
    };
  });
}
