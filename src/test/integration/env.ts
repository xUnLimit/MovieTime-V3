// Variables que el job `database` de CI obtiene de `supabase status -o env`.
export type IntegrationEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

const VARIABLES = [
  'INTEGRATION_SUPABASE_URL',
  'INTEGRATION_SUPABASE_ANON_KEY',
  'INTEGRATION_SUPABASE_SERVICE_ROLE_KEY',
] as const;

let warned = false;

function readEnv(): IntegrationEnv | null {
  const [url, anonKey, serviceRoleKey] = VARIABLES.map((name) => process.env[name]?.trim());
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url, anonKey, serviceRoleKey };
}

/**
 * Puerta de entrada de cada suite: `describe.skipIf(requireIntegrationEnv() === null)(...)`.
 * - Con variables: devuelve la configuracion.
 * - Sin variables y con CI: FALLA (un job que no ejecuta las pruebas no puede quedar en verde).
 * - Sin variables y sin CI: devuelve null y avisa una vez; las suites se saltan.
 */
export function requireIntegrationEnv(): IntegrationEnv | null {
  const env = readEnv();
  if (env) return env;
  if (process.env.CI) {
    throw new Error(
      `Faltan variables para las pruebas de integracion (${VARIABLES.join(', ')}). ` +
        'Ejecuta `npx supabase start` y exporta los valores de `supabase status -o env`.'
    );
  }
  if (!warned) {
    warned = true;
    console.warn(
      '[integration] Sin INTEGRATION_SUPABASE_* y sin CI: las suites de integracion se saltan. ' +
        'Levanta Supabase local (`npx supabase start`) para ejecutarlas.'
    );
  }
  return null;
}

/** Uso dentro de las pruebas, cuando la suite ya paso la puerta anterior. */
export function integrationEnv(): IntegrationEnv {
  const env = readEnv();
  if (!env) throw new Error('integrationEnv() requiere INTEGRATION_SUPABASE_* (la suite debia saltarse).');
  return env;
}
