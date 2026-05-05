import { config as loadEnv } from 'dotenv';
import { addMonths, endOfMonth, format, isWithinInterval, startOfMonth } from 'date-fns';
import { getFirestore, getSupabase } from './migrate-to-supabase/clients';

loadEnv({ path: '.env.local' });

const CYCLE_MONTHS: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

type ForecastSale = {
  id: string;
  fechaFin: string;
  cicloPago: string;
  precioFinal: number;
  moneda: string;
};

type ForecastService = {
  id: string;
  fechaVencimiento: string;
  cicloPago: string;
  costoServicio: number;
  moneda: string;
};

type DashboardStatsLike = {
  gastosTotal?: number;
  ingresosTotal?: number;
  gastos_total?: number | string;
  ingresos_total?: number | string;
  ingresosPorMes?: unknown[];
  ingresos_por_mes?: unknown[];
  ingresosPorDia?: unknown[];
  ingresos_por_dia?: unknown[];
  ventasPronostico?: ForecastSale[];
  ventas_pronostico?: ForecastSale[];
  serviciosPronostico?: ForecastService[];
  servicios_pronostico?: ForecastService[];
};

function toNumber(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function dateFromInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
}

function caeEnMes(fechaBase: Date, cicloPago: string, start: Date, end: Date): boolean {
  const ciclo = CYCLE_MONTHS[cicloPago] ?? 1;
  let fecha = new Date(fechaBase);
  if (fecha > end) return false;
  while (fecha < start) {
    fecha = addMonths(fecha, ciclo);
  }
  return isWithinInterval(fecha, { start, end });
}

function convert(amount: number, currency: string, rates: Map<string, number>): number {
  const normalized = (currency || 'USD').toUpperCase();
  if (normalized === 'USD' || normalized === 'PAB') return amount;
  const direct = rates.get(`${normalized}_USD`);
  if (direct && direct > 0) return amount * direct;
  const inverse = rates.get(`USD_${normalized}`);
  if (inverse && inverse > 0) return amount / inverse;
  return amount;
}

function forecast(stats: DashboardStatsLike, rates: Map<string, number>, now: Date) {
  const ventas = stats.ventasPronostico ?? stats.ventas_pronostico ?? [];
  const servicios = stats.serviciosPronostico ?? stats.servicios_pronostico ?? [];
  const currentMonthStart = startOfMonth(now);

  return Array.from({ length: 4 }, (_, offset) => {
    const target = addMonths(startOfMonth(now), offset);
    const start = startOfMonth(target);
    const end = endOfMonth(target);

    const ingresos = ventas
      .filter((venta) => {
        if (!venta.fechaFin || !venta.cicloPago) return false;
        const fechaFin = dateFromInput(venta.fechaFin);
        if (offset === 0 && fechaFin < currentMonthStart) return true;
        return caeEnMes(fechaFin, venta.cicloPago, start, end);
      })
      .reduce((sum, venta) => sum + convert(Number(venta.precioFinal || 0), venta.moneda, rates), 0);

    const gastos = servicios
      .filter((servicio) => {
        if (!servicio.fechaVencimiento || !servicio.cicloPago) return false;
        return caeEnMes(dateFromInput(servicio.fechaVencimiento), servicio.cicloPago, start, end);
      })
      .reduce((sum, servicio) => sum + convert(Number(servicio.costoServicio || 0), servicio.moneda, rates), 0);

    return {
      mes: format(target, 'yyyy-MM'),
      ingresos: toNumber(ingresos),
      gastos: toNumber(gastos),
      ganancias: toNumber(ingresos - gastos),
    };
  });
}

function normalizeFinancial(stats: DashboardStatsLike) {
  return {
    ingresosTotal: toNumber(stats.ingresosTotal ?? stats.ingresos_total),
    gastosTotal: toNumber(stats.gastosTotal ?? stats.gastos_total),
    ingresosPorMes: stats.ingresosPorMes ?? stats.ingresos_por_mes ?? [],
    ingresosPorDia: stats.ingresosPorDia ?? stats.ingresos_por_dia ?? [],
    ventasPronosticoCount: (stats.ventasPronostico ?? stats.ventas_pronostico ?? []).length,
    serviciosPronosticoCount: (stats.serviciosPronostico ?? stats.servicios_pronostico ?? []).length,
  };
}

async function main() {
  const firestoreDoc = await getFirestore().collection('config').doc('dashboard_stats').get();
  if (!firestoreDoc.exists) throw new Error('Missing Firebase config/dashboard_stats');
  const firebaseStats = firestoreDoc.data() as DashboardStatsLike;

  const { data: supabaseStats, error } = await getSupabase()
    .from('dashboard_stats')
    .select('*')
    .eq('id', 'singleton')
    .single();
  if (error) throw error;

  const { data: ratesRows, error: ratesError } = await getSupabase()
    .from('exchange_rates')
    .select('currency_pair, rate');
  if (ratesError) throw ratesError;

  const rates = new Map((ratesRows ?? []).map((row) => [row.currency_pair, Number(row.rate)]));
  const now = process.env.AUDIT_NOW ? dateFromInput(process.env.AUDIT_NOW) : new Date();

  const normalizedSupabaseStats = supabaseStats as unknown as DashboardStatsLike;

  console.log(
    JSON.stringify(
      {
        auditDate: format(now, 'yyyy-MM-dd'),
        firebase: {
          ...normalizeFinancial(firebaseStats),
          forecast: forecast(firebaseStats, rates, now),
        },
        supabase: {
          ...normalizeFinancial(normalizedSupabaseStats),
          forecast: forecast(normalizedSupabaseStats, rates, now),
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
