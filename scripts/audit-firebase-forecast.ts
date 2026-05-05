import { config as loadEnv } from 'dotenv';
import { addMonths, endOfMonth, format, isWithinInterval, startOfMonth } from 'date-fns';
import { getFirestore } from './migrate-to-supabase/clients';

loadEnv({ path: '.env.local' });

const CYCLE_MONTHS: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

function dateFromInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
}

function caeEnMes(fechaBase: Date, cicloPago: string, start: Date, end: Date): boolean {
  const ciclo = CYCLE_MONTHS[cicloPago] ?? 1;
  let fecha = new Date(fechaBase);
  if (fecha > end) return false;
  while (fecha < start) fecha = addMonths(fecha, ciclo);
  return isWithinInterval(fecha, { start, end });
}

async function main() {
  const now = process.env.AUDIT_NOW ? dateFromInput(process.env.AUDIT_NOW) : new Date();
  const target = startOfMonth(now);
  const start = startOfMonth(target);
  const end = endOfMonth(target);
  const doc = await getFirestore().collection('config').doc('dashboard_stats').get();
  const data = doc.data() ?? {};
  const ventas = (data.ventasPronostico ?? []) as Array<{
    id: string;
    fechaFin: string;
    cicloPago: string;
    precioFinal: number;
    moneda: string;
  }>;

  const due = ventas
    .filter((venta) => {
      const fechaFin = dateFromInput(venta.fechaFin);
      if (fechaFin < start) return true;
      return caeEnMes(fechaFin, venta.cicloPago, start, end);
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(
    JSON.stringify(
      {
        mes: format(start, 'yyyy-MM'),
        count: due.length,
        total: Number(due.reduce((sum, venta) => sum + Number(venta.precioFinal || 0), 0).toFixed(2)),
        nonIntegerPrices: due
          .filter((venta) => Number(venta.precioFinal || 0) % 1 !== 0)
          .map((venta) => ({
            id: venta.id,
            precioFinal: venta.precioFinal,
            fechaFin: venta.fechaFin,
            cicloPago: venta.cicloPago,
          })),
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
