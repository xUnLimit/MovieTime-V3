import { config } from 'dotenv';
import { getSupabaseAdmin } from './supabase-admin';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const CONFIRM_VALUE = 'RESET_SUPABASE_STAGING';
const DEFAULT_BLOCKED_PROJECT_REFS = new Set(['prod', 'production']);

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

function getProjectRefFromUrl(rawUrl: string | undefined) {
  if (!rawUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  const url = new URL(rawUrl);
  const [projectRef] = url.hostname.split('.');
  if (!projectRef) throw new Error(`Could not determine Supabase project ref from ${url.hostname}`);
  return { projectRef, hostname: url.hostname };
}

function parseAllowlist() {
  return new Set(
    (process.env.SUPABASE_STAGING_PROJECT_REFS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function assertStagingTarget() {
  const { projectRef, hostname } = getProjectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const allowlist = parseAllowlist();
  if (DEFAULT_BLOCKED_PROJECT_REFS.has(projectRef.toLowerCase())) {
    throw new Error(`Refusing to reset blocked Supabase project ref: ${projectRef}`);
  }
  if (!allowlist.has(projectRef)) {
    throw new Error(
      `Refusing to reset Supabase project ${projectRef} (${hostname}). ` +
      'Add it to SUPABASE_STAGING_PROJECT_REFS to mark it as a staging target.'
    );
  }
  return { projectRef, hostname };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const target = assertStagingTarget();
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
        target,
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
