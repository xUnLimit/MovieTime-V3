import { supabase } from './client';
import { toCamelCase, toSnakeCase } from './mappers';
import type { Database } from './database.types';
import { assertOnlineMutation } from '@/lib/pwa/mutation-guard';

type PublicTableName = keyof Database['public']['Tables'];
type PublicViewName = keyof Database['public']['Views'];
type PublicEntity = PublicTableName | PublicViewName;

/**
 * Generic CRUD helpers for tables in the `public` schema.
 *
 * - All keys are converted to/from snake_case at the boundary.
 * - These wrap PostgREST and respect RLS. For service-role operations (e.g.
 *   the migrator), use the dedicated service-role client instead of these.
 * - Reads return camelCase domain shapes (typed as the caller provides);
 *   writes accept camelCase and translate down.
 */

export async function getById<T = Record<string, unknown>>(
  table: PublicEntity,
  id: string,
  select = '*'
): Promise<T | null> {
  const { data, error } = await supabase
    .from(table as never)
    .select(select)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCamelCase<T>(data) : null;
}

export async function getAll<T = Record<string, unknown>>(
  table: PublicEntity,
  select = '*',
  orderByField = 'created_at',
  orderDirection: 'asc' | 'desc' = 'desc'
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table as never)
    .select(select)
    .order(orderByField, { ascending: orderDirection === 'asc' });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toCamelCase<T>(r));
}

export async function insert<TIn extends Record<string, unknown>, TOut = TIn>(
  table: PublicTableName,
  payload: TIn,
  select = '*'
): Promise<TOut> {
  assertOnlineMutation();
  const snake = toSnakeCase<Record<string, unknown>>(payload);
  const { data, error } = await supabase
    .from(table as never)
    .insert(snake as never)
    .select(select)
    .single();
  if (error) throw new Error(error.message);
  return toCamelCase<TOut>(data);
}

export async function update<TIn extends Record<string, unknown>, TOut = TIn>(
  table: PublicTableName,
  id: string,
  payload: Partial<TIn>,
  select = '*'
): Promise<TOut> {
  assertOnlineMutation();
  const snake = toSnakeCase<Record<string, unknown>>(payload);
  const { data, error } = await supabase
    .from(table as never)
    .update(snake as never)
    .eq('id', id)
    .select(select)
    .single();
  if (error) throw new Error(error.message);
  return toCamelCase<TOut>(data);
}

export async function remove(
  table: PublicTableName,
  id: string
): Promise<void> {
  assertOnlineMutation();
  const { error } = await supabase
    .from(table as never)
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Call a Postgres function (RPC). Returns the parsed result in camelCase.
 */
export async function rpc<TArgs extends Record<string, unknown> | undefined, TResult>(
  fn: keyof Database['public']['Functions'],
  args?: TArgs
): Promise<TResult> {
  assertOnlineMutation();
  const snake = args ? toSnakeCase<Record<string, unknown>>(args) : undefined;
  const { data, error } = await supabase.rpc(fn as never, snake as never);
  if (error) throw new Error(error.message);
  return toCamelCase<TResult>(data);
}
