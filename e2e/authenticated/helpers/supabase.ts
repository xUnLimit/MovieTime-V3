import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { e2eEnv, uniqueId } from './env';

const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Cliente con service role: salta RLS. Solo para sembrar datos y verificar resultados. */
export function serviceClient(): SupabaseClient {
  const env = e2eEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, CLIENT_OPTIONS);
}

/** Cliente autenticado como un usuario real (anon key + contrasena), sujeto a RLS. */
async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const env = e2eEnv();
  const client = createClient(env.supabaseUrl, env.anonKey, CLIENT_OPTIONS);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`No se pudo iniciar sesion como ${email}: ${error.message}`);
  return client;
}

export async function adminUserClient(): Promise<SupabaseClient> {
  const env = e2eEnv();
  return signedInClient(env.adminEmail, env.adminPassword);
}

export type AppRole = 'admin' | 'operador';

/**
 * Crea (o actualiza) un usuario de Auth con su fila en `usuarios`. Idempotente por correo: si ya
 * existe, restablece la contrasena y el rol. Devuelve el id de Auth.
 */
export async function ensureUser(
  admin: SupabaseClient,
  user: { email: string; password: string; role: AppRole; active?: boolean; displayName?: string },
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });
  let userId = created.data.user?.id;
  if (!userId) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listed.error) throw new Error(`No se pudo listar usuarios: ${listed.error.message}`);
    const existing = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === user.email.toLowerCase());
    if (!existing) throw new Error(`No se pudo crear el usuario ${user.email}: ${created.error?.message ?? 'sin detalle'}`);
    userId = existing.id;
    const updated = await admin.auth.admin.updateUserById(userId, { password: user.password, email_confirm: true });
    if (updated.error) throw new Error(`No se pudo actualizar ${user.email}: ${updated.error.message}`);
  }
  const profile = await admin.from('usuarios').upsert(
    { id: userId, display_name: user.displayName ?? user.email.split('@')[0], role: user.role, active: user.active ?? true },
    { onConflict: 'id' },
  );
  if (profile.error) throw new Error(`No se pudo guardar el perfil de ${user.email}: ${profile.error.message}`);
  return userId;
}

export type TestUser = { id: string; email: string; password: string };

/** Usuario efimero (correo unico) para pruebas que lo desactivan o cierran su sesion. */
export async function createTempUser(admin: SupabaseClient, role: AppRole, active = true): Promise<TestUser> {
  const email = `e2e-${role}-${uniqueId()}@example.com`;
  const password = `E2e-${uniqueId()}-Pass1!`;
  const id = await ensureUser(admin, { email, password, role, active });
  return { id, email, password };
}

export async function deleteTempUser(admin: SupabaseClient, user: TestUser): Promise<void> {
  await bestEffort(`borrar usuario ${user.email}`, async () => {
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error) throw new Error(result.error.message);
  });
}

/** La limpieza nunca debe romper una prueba que ya paso: se registra la advertencia y se sigue. */
export async function bestEffort(label: string, action: () => PromiseLike<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.warn(`[e2e cleanup] ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Lanza si una consulta de PostgREST devolvio error (los clientes de supabase-js no lanzan por si solos). */
export function assertOk<T extends { error: { message: string } | null }>(result: T, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

export function assertRow<T extends { error: { message: string } | null; data: object | null }>(result: T, label: string): T & { data: NonNullable<T['data']> } {
  assertOk(result, label);
  if (!result.data) throw new Error(label + ': no devolvio fila');
  return result as T & { data: NonNullable<T['data']> };
}
