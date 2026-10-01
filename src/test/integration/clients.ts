import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { integrationEnv } from './env';

// Sin persistencia ni refresco: cada cliente vive solo durante la suite.
const AUTH_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Cliente service-role: omite RLS; solo para fixtures y verificaciones. */
export function createServiceClient(): SupabaseClient {
  const env = integrationEnv();
  return createClient(env.url, env.serviceRoleKey, AUTH_OPTIONS);
}

/** Cliente anonimo (sin sesion). */
export function createAnonClient(): SupabaseClient {
  const env = integrationEnv();
  return createClient(env.url, env.anonKey, AUTH_OPTIONS);
}

/** Cliente con sesion real de un usuario (`signInWithPassword`); Realtime usa su JWT. */
export async function createUserClient(email: string, password: string): Promise<SupabaseClient> {
  const env = integrationEnv();
  const client = createClient(env.url, env.anonKey, AUTH_OPTIONS);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`No se pudo iniciar sesion de prueba: ${error?.message ?? 'sin sesion'}`);
  await client.realtime.setAuth(data.session.access_token);
  return client;
}
