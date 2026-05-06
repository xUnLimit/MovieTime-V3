import { config } from 'dotenv';
import { getSupabaseAdmin } from './supabase-admin';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const TABLES = [
  'usuarios',
  'servicios',
  'categorias',
  'metodos_pago',
  'tipos_gasto',
  'gastos',
  'templates',
  'activity_log',
  'pagos_servicio',
  'ventas',
  'pagos_venta',
] as const;

const ACCEPTABLE_REPORT_KEYS = new Set([
  'ventas_archivadas_activas',
  'servicios_archivados_activos',
  'periodos_venta_saldo_distinto',
  'periodos_servicio_saldo_distinto',
]);

async function main() {
  const supabase = getSupabaseAdmin();

  const supabaseCounts: Record<string, number> = {};
  for (const table of TABLES) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Count failed for ${table}: ${error.message}`);
    supabaseCounts[table] = count ?? 0;
  }

  const rpc = supabase as unknown as {
    rpc: (fn: string) => Promise<{ data: unknown; error: Error | null }>;
  };
  const { data, error } = await rpc.rpc('run_all_validations');
  if (error) throw new Error(`run_all_validations failed: ${error.message}`);
  const validations = normalizeValidations(data);
  const { data: securityData, error: securityError } = await rpc.rpc('run_security_audit_validations');
  if (securityError) throw new Error(`run_security_audit_validations failed: ${securityError.message}`);
  const securityValidations = normalizeValidations(securityData);
  const blockingFailures = Object.entries(validations).filter(
    ([key, value]) => value > 0 && !ACCEPTABLE_REPORT_KEYS.has(key)
  );
  const securityFailures = Object.entries(securityValidations).filter(([, value]) => value > 0);
  const acceptableReports = Object.fromEntries(
    Object.entries(validations).filter(([key, value]) => value > 0 && ACCEPTABLE_REPORT_KEYS.has(key))
  );

  console.log(
    JSON.stringify(
      {
        supabaseCounts,
        validations,
        securityValidations,
        acceptableReports,
        blockingFailures: Object.fromEntries(blockingFailures),
        securityFailures: Object.fromEntries(securityFailures),
        status: blockingFailures.length === 0 && securityFailures.length === 0 ? 'passed' : 'failed',
      },
      null,
      2
    )
  );

  if (blockingFailures.length > 0 || securityFailures.length > 0) {
    process.exit(1);
  }
}

function normalizeValidations(data: unknown): Record<string, number> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('run_all_validations returned an invalid payload');
  }

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, Number(value ?? 0)])
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
