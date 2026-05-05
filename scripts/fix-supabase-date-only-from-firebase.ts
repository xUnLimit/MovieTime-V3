import { writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { getFirestore } from './migrate-to-supabase/clients';

loadEnv({ path: '.env.local' });

type Doc = Record<string, unknown> & { id: string };

const TIME_ZONE = 'America/Bogota';
const OUTPUT = 'scripts/fix-supabase-date-only-from-firebase.sql';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

async function readCollection(name: string): Promise<Doc[]> {
  const snapshot = await getFirestore().collection(name).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function localDateOnly(value: unknown): string | null {
  if (!value) return null;
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    date = value.toDate();
  } else {
    date = new Date(String(value));
  }
  if (Number.isNaN(date.getTime())) return null;

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function sql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function line(comment: string): string {
  return `\n-- ${comment}\n`;
}

async function main() {
  const [ventas, pagosVenta, servicios, pagosServicio, gastos] = await Promise.all([
    readCollection('ventas'),
    readCollection('pagosVenta'),
    readCollection('servicios'),
    readCollection('pagosServicio'),
    readCollection('gastos'),
  ]);

  const ventasById = new Map(ventas.map((venta) => [venta.id, venta]));
  const serviciosById = new Map(servicios.map((servicio) => [servicio.id, servicio]));
  const statements: string[] = [
    'BEGIN;',
    line(`Generated from Firebase local dates (${TIME_ZONE}).`),
  ];

  statements.push(line('venta_periodos with canonical pagosVenta dates'));
  for (const pago of pagosVenta) {
    const venta = ventasById.get(String(pago.ventaId ?? ''));
    const inicio = localDateOnly(pago.fechaInicio ?? venta?.fechaInicio);
    const fin = localDateOnly(pago.fechaVencimiento ?? venta?.fechaFin);
    if (!inicio || !fin) continue;
    statements.push(
      `UPDATE venta_periodos SET fecha_inicio = DATE ${sql(inicio)}, fecha_fin = DATE ${sql(fin)} WHERE id = (SELECT venta_periodo_id FROM pagos_venta WHERE id = ${sql(pago.id)});`
    );
  }

  statements.push(line('venta_periodos without pagosVenta fallback to venta dates'));
  for (const venta of ventas) {
    const inicio = localDateOnly(venta.fechaInicio);
    const fin = localDateOnly(venta.fechaFin);
    if (!inicio || !fin) continue;
    statements.push(
      `UPDATE venta_periodos vp SET fecha_inicio = DATE ${sql(inicio)}, fecha_fin = DATE ${sql(fin)} WHERE vp.venta_id = ${sql(venta.id)} AND NOT EXISTS (SELECT 1 FROM pagos_venta pv WHERE pv.venta_periodo_id = vp.id);`
    );
  }

  statements.push(line('servicio_periodos with canonical pagosServicio dates'));
  for (const pago of pagosServicio) {
    const servicio = serviciosById.get(String(pago.servicioId ?? ''));
    const inicio = localDateOnly(pago.fechaInicio ?? servicio?.fechaInicio);
    const fin = localDateOnly(pago.fechaVencimiento ?? servicio?.fechaVencimiento);
    if (!inicio || !fin) continue;
    statements.push(
      `UPDATE servicio_periodos SET fecha_inicio = DATE ${sql(inicio)}, fecha_vencimiento = DATE ${sql(fin)} WHERE id = (SELECT servicio_periodo_id FROM pagos_servicio WHERE id = ${sql(pago.id)});`
    );
  }

  statements.push(line('servicio_periodos without pagosServicio fallback to servicio dates'));
  for (const servicio of servicios) {
    const inicio = localDateOnly(servicio.fechaInicio);
    const fin = localDateOnly(servicio.fechaVencimiento);
    if (!inicio || !fin) continue;
    statements.push(
      `UPDATE servicio_periodos sp SET fecha_inicio = DATE ${sql(inicio)}, fecha_vencimiento = DATE ${sql(fin)} WHERE sp.servicio_id = ${sql(servicio.id)} AND NOT EXISTS (SELECT 1 FROM pagos_servicio ps WHERE ps.servicio_periodo_id = sp.id);`
    );
  }

  statements.push(line('servicios reposo date-only fields'));
  for (const servicio of servicios) {
    const inicioReposo = localDateOnly(servicio.fechaInicioReposo);
    const finReposo = localDateOnly(servicio.fechaFinReposo);
    if (!inicioReposo && !finReposo) continue;
    statements.push(
      `UPDATE servicios SET fecha_inicio_reposo = ${inicioReposo ? `DATE ${sql(inicioReposo)}` : 'NULL'}, fecha_fin_reposo = ${finReposo ? `DATE ${sql(finReposo)}` : 'NULL'} WHERE id = ${sql(servicio.id)};`
    );
  }

  statements.push(line('manual gastos date-only fields'));
  for (const gasto of gastos) {
    const fecha = localDateOnly(gasto.fecha);
    if (!fecha) continue;
    statements.push(`UPDATE gastos SET fecha = DATE ${sql(fecha)} WHERE id = ${sql(gasto.id)};`);
  }

  statements.push('COMMIT;');
  writeFileSync(OUTPUT, `${statements.join('\n')}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        output: OUTPUT,
        statements: statements.length,
        ventas: ventas.length,
        pagosVenta: pagosVenta.length,
        servicios: servicios.length,
        pagosServicio: pagosServicio.length,
        gastos: gastos.length,
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
