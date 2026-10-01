// Funciones puras del gate E2E autenticado (`run-auth-gate.mjs`): contrato de entorno,
// variables del servidor `next start` y argumentos de Playwright. Sin efectos secundarios.

/** Variables que define el CI (`supabase start` + usuarios de prueba). Todas son obligatorias. */
export const REQUIRED_E2E_VARS = [
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_SUPABASE_SERVICE_ROLE_KEY',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_OPERATOR_EMAIL',
  'E2E_OPERATOR_PASSWORD',
  'E2E_WHATSAPP_APP_SECRET',
];

const DEFAULT_AUTH_GATE_PORT = '3211';

/** Devuelve los nombres de las variables E2E_* ausentes o vacias. */
export function missingE2eVars(env) {
  return REQUIRED_E2E_VARS.filter((name) => !String(env[name] ?? '').trim());
}

/** Mensaje de error accionable cuando faltan variables. */
export function missingE2eVarsMessage(missing) {
  return [
    `Faltan variables de entorno para las pruebas E2E autenticadas: ${missing.join(', ')}.`,
    'Define el contrato E2E_* (ver scripts/README.md) o ejecuta `supabase start` y exporta sus claves locales.',
  ].join('\n');
}

/** Puerto local del servidor; `AUTH_GATE_PORT` permite cambiarlo y por defecto es 3211 (nunca 3000). */
export function resolvePort(env) {
  const port = String(env.AUTH_GATE_PORT ?? '').trim();
  return /^\d{2,5}$/.test(port) && port !== '3000' ? port : DEFAULT_AUTH_GATE_PORT;
}

/**
 * Entorno de `next start` con las claves REALES de Supabase (no placeholders). Los placeholders
 * solo se usan para integraciones que estas pruebas no ejercitan (push).
 */
export function buildServerEnv(env, baseUrl) {
  return {
    ...env,
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: baseUrl,
    NEXT_PUBLIC_SUPABASE_URL: env.E2E_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.E2E_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.E2E_SUPABASE_SERVICE_ROLE_KEY,
    WHATSAPP_APP_SECRET: env.E2E_WHATSAPP_APP_SECRET,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'auth-gate-vapid-public-placeholder',
    VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY || 'auth-gate-vapid-private-placeholder',
    PUSH_CRON_SECRET: env.PUSH_CRON_SECRET || 'auth-gate-cron-secret',
  };
}

/**
 * Argumentos para `playwright test`. `--visual` (propio de este script) agrega el proyecto `visual`
 * y activa `VISUAL_SNAPSHOTS=1`; si no hay ningun `--project`, se ejecuta `authenticated`.
 */
export function buildPlaywrightArgs(argv) {
  const visual = argv.includes('--visual') || argv.includes('--project=visual') || argv.some((arg, index) => arg === '--project' && argv[index + 1] === 'visual');
  const passthrough = argv.filter((arg) => arg !== '--visual');
  const hasProject = passthrough.some((arg) => arg === '--project' || arg.startsWith('--project='));
  const projects = hasProject ? [] : ['--project=authenticated'];
  if (visual && !passthrough.includes('--project=visual')) projects.push('--project=visual');
  return { args: ['test', ...projects, ...passthrough], visual };
}
