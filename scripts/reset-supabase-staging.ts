import { config } from 'dotenv';
import { getSupabaseAdmin } from './supabase-admin';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const CONFIRM_VALUE = 'RESET_SUPABASE_STAGING';

const TABLES_IN_DELETE_ORDER: { table: string; pk: string }[] = [
  { table: 'notificaciones_reposo', pk: 'notificacion_id' },
  { table: 'notificaciones_servicio', pk: 'notificacion_id' },
  { table: 'notificaciones_venta', pk: 'notificacion_id' },
  { table: 'notificaciones', pk: 'id' },
  { table: 'pagos_venta', pk: 'id' },
  { table: 'venta_periodos', pk: 'id' },
  { table: 'ventas', pk: 'id' },
  { table: 'pagos_servicio', pk: 'id' },
  { table: 'servicio_periodos', pk: 'id' },
  { table: 'gastos', pk: 'id' },
  { table: 'servicios', pk: 'id' },
  { table: 'planes', pk: 'id' },
  { table: 'planes_tipos', pk: 'id' },
  { table: 'terceros', pk: 'id' },
  { table: 'tipos_gasto', pk: 'id' },
  { table: 'templates', pk: 'id' },
  { table: 'activity_log', pk: 'id' },
  { table: 'metodos_pago', pk: 'id' },
  { table: 'categorias', pk: 'id' },
  { table: 'exchange_rates', pk: 'currency_pair' },
  { table: 'currencies', pk: 'code' },
];

function parseArgs(argv: string[]) {
  const confirmArg = argv.find((arg) => arg.startsWith('--confirm='));
  return {
    apply: confirmArg?.slice('--confirm='.length) === CONFIRM_VALUE,
  };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const supabase = getSupabaseAdmin() as unknown as {
    from: (table: string) => {
      select: (columns: string, options: { count: 'exact'; head: true }) => Promise<{ count: number | null; error: Error | null }>;
      delete: () => {
        neq: (column: string, value: string) => Promise<{ error: Error | null }>;
      };
    };
  };

  const before: Record<string, number> = {};
  const deleted: Record<string, number> = {};

  for (const { table, pk } of TABLES_IN_DELETE_ORDER) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Could not count ${table}: ${error.message}`);
    before[table] = count ?? 0;

    if (apply && before[table] > 0) {
      const result = await supabase.from(table).delete().neq(pk, '__codex_never_matches__');
      if (result.error) throw new Error(`Could not delete ${table}: ${result.error.message}`);
      deleted[table] = before[table];
    } else {
      deleted[table] = 0;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        confirmRequiredForApply: CONFIRM_VALUE,
        before,
        deleted,
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
