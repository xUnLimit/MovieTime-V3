import { writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { addMonths, endOfMonth, isWithinInterval, startOfMonth } from 'date-fns';
import { getFirestore } from './migrate-to-supabase/clients';

loadEnv({ path: '.env.local' });

const OUTPUT = 'scripts/firebase-forecast-compare.sql';
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

function sql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  const now = process.env.AUDIT_NOW ? dateFromInput(process.env.AUDIT_NOW) : new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const doc = await getFirestore().collection('config').doc('dashboard_stats').get();
  const data = doc.data() ?? {};
  const ventas = (data.ventasPronostico ?? []) as Array<{
    id: string;
    fechaFin: string;
    cicloPago: string;
    precioFinal: number;
  }>;

  const due = ventas
    .filter((venta) => {
      const fechaFin = dateFromInput(venta.fechaFin);
      if (fechaFin < start) return true;
      return caeEnMes(fechaFin, venta.cicloPago, start, end);
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const values = due.map((venta) => `(${sql(venta.id)}, ${Number(venta.precioFinal || 0)})`);
  const sqlText = `
WITH firebase(id, precio_final) AS (
  VALUES
  ${values.join(',\n  ')}
),
supabase_items AS (
  SELECT item ->> 'id' AS id, (item ->> 'precioFinal')::numeric AS precio_final
  FROM dashboard_stats ds, jsonb_array_elements(ds.ventas_pronostico) item
  WHERE ds.id = 'singleton'
    AND (item ->> 'fechaFin')::timestamp::date <= date '${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}'
),
diffs AS (
  SELECT
    COALESCE(f.id, s.id) AS id,
    f.precio_final AS firebase_precio,
    s.precio_final AS supabase_precio,
    COALESCE(f.precio_final, 0) - COALESCE(s.precio_final, 0) AS diff
  FROM firebase f
  FULL JOIN supabase_items s ON s.id = f.id
)
SELECT *
FROM diffs
WHERE abs(diff) > 0.0001
   OR firebase_precio IS NULL
   OR supabase_precio IS NULL
ORDER BY abs(diff) DESC, id;
`;

  writeFileSync(OUTPUT, sqlText.trim() + '\n', 'utf8');
  console.log(JSON.stringify({ output: OUTPUT, count: due.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
