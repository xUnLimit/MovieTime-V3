// Contrato de entorno E2E_* (lo define el CI con `supabase start`). Falla con un mensaje claro si falta algo.
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Las pruebas autenticadas se ejecutan con \`npm run test:e2e:auth\`.`);
  }
  return value;
}

export function e2eEnv() {
  return {
    supabaseUrl: required('E2E_SUPABASE_URL'),
    anonKey: required('E2E_SUPABASE_ANON_KEY'),
    serviceRoleKey: required('E2E_SUPABASE_SERVICE_ROLE_KEY'),
    adminEmail: required('E2E_ADMIN_EMAIL'),
    adminPassword: required('E2E_ADMIN_PASSWORD'),
    operatorEmail: required('E2E_OPERATOR_EMAIL'),
    operatorPassword: required('E2E_OPERATOR_PASSWORD'),
    whatsappAppSecret: required('E2E_WHATSAPP_APP_SECRET'),
  };
}

/** Id corto y unico para nombres de datos de prueba (evita colisiones entre specs y ejecuciones). */
export function uniqueId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
