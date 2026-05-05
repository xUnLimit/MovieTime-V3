import { supabase } from './client';
import {
  ENTITIES,
  readEntity,
  writeTable,
  type CollectionName,
  type QueryBuilder,
  type QueryFilter,
} from './entities';
import { readField, normalizeFilterValue } from './filters';
import { mapReadRow, enrichCategorias, enrichUsuarios } from './read-models';
import { createNotification, queryNotifications, updateNotification } from './notifications-repository';
import { createPagoServicio, createPagoVenta } from './payments-repository';
import { insertRawRow, normalizeWritePayload } from './write-utils';

export { ENTITIES };
export type { CollectionName, QueryFilter };
export { convertTimestamps, timestampToDate } from './dates';

type QueryResult<T> = QueryBuilder & PromiseLike<T>;

export function logCacheHit(collectionName: string) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Supabase cache hit] ${collectionName}`);
  }
}

export async function getAll<T>(collectionName: CollectionName): Promise<T[]> {
  const entity = readEntity(collectionName);
  const { data, error } = await supabase.from(entity as never).select('*');
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapReadRow<T>(collectionName, row));
  return enrichCollectionRows(collectionName, rows);
}

export async function getById<T>(collectionName: CollectionName, id: string): Promise<T | null> {
  const entity = readEntity(collectionName);
  const { data, error } = await supabase
    .from(entity as never)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = mapReadRow<T>(collectionName, data);
  const [enriched] = await enrichCollectionRows(collectionName, [row]);
  return enriched ?? row;
}

export async function queryDocuments<T>(
  collectionName: CollectionName,
  filters: QueryFilter[] = []
): Promise<T[]> {
  if (collectionName === ENTITIES.NOTIFICACIONES) {
    return queryNotifications<T>(filters);
  }

  const entity = readEntity(collectionName);
  let query = supabase.from(entity as never).select('*') as unknown as QueryResult<{
    data: unknown[] | null;
    error: Error | null;
  }>;

  query = applyFilters(collectionName, query, filters);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapReadRow<T>(collectionName, row));
  return enrichCollectionRows(collectionName, rows);
}

export async function getCount(
  collectionName: CollectionName,
  filters: QueryFilter[] = []
): Promise<number> {
  if (collectionName === ENTITIES.USUARIOS && filters.some((filter) => filter.field === 'serviciosActivos')) {
    return getUsuariosDerivedCount(filters);
  }

  const entity = readEntity(collectionName);
  let query = supabase
    .from(entity as never)
    .select('*', { count: 'exact', head: true }) as unknown as QueryResult<{
      count: number | null;
      error: Error | null;
    }>;

  query = applyFilters(collectionName, query, filters);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function create<T extends Record<string, unknown>>(
  collectionName: CollectionName,
  payload: Omit<T, 'id'>
): Promise<string> {
  if (collectionName === ENTITIES.NOTIFICACIONES) {
    return createNotification(payload as Record<string, unknown>);
  }
  if (collectionName === ENTITIES.PAGOS_SERVICIO) {
    return createPagoServicio(payload as Record<string, unknown>);
  }
  if (collectionName === ENTITIES.PAGOS_VENTA) {
    return createPagoVenta(payload as Record<string, unknown>);
  }

  return createRaw(collectionName, normalizeWritePayload(collectionName, payload as Record<string, unknown>, 'insert'));
}

export async function createRaw(
  collectionName: CollectionName,
  payload: Record<string, unknown>
): Promise<string> {
  return insertRawRow(writeTable(collectionName), payload);
}

export async function update<T extends Record<string, unknown>>(
  collectionName: CollectionName,
  id: string,
  payload: Partial<T>
): Promise<void> {
  if (collectionName === ENTITIES.NOTIFICACIONES) {
    await updateNotification(id, payload as Record<string, unknown>);
    return;
  }

  const table = writeTable(collectionName);
  const snake = normalizeWritePayload(collectionName, payload as Record<string, unknown>, 'update');
  if (Object.keys(snake).length === 0) return;
  const { error } = await supabase
    .from(table as never)
    .update(snake as never)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function remove(collectionName: CollectionName, id: string): Promise<void> {
  const table = writeTable(collectionName);

  if (collectionName === ENTITIES.SERVICIOS || collectionName === ENTITIES.VENTAS) {
    const { error } = await supabase
      .from(table as never)
      .update({
        archivado_at: new Date().toISOString(),
        motivo_archivado: 'Eliminado desde la app',
      } as never)
      .eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from(table as never).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adjustServiciosActivos(..._args: unknown[]) {
  void _args;
}

export async function adjustCategoriaSuscripciones(..._args: unknown[]) {
  void _args;
}

export async function adjustCategoriaGastos(..._args: unknown[]) {
  void _args;
}

function applyFilters<T>(
  collectionName: CollectionName,
  query: QueryResult<T>,
  filters: QueryFilter[]
): QueryResult<T> {
  let current = query;
  for (const filter of filters) {
    const field = readField(collectionName, filter.field);
    const value = normalizeFilterValue(field, filter.value);
    if (filter.operator === '==') current = current.eq(field, value) as QueryResult<T>;
    if (filter.operator === '!=') current = current.neq(field, value) as QueryResult<T>;
    if (filter.operator === '<') current = current.lt(field, value) as QueryResult<T>;
    if (filter.operator === '<=') current = current.lte(field, value) as QueryResult<T>;
    if (filter.operator === '>') current = current.gt(field, value) as QueryResult<T>;
    if (filter.operator === '>=') current = current.gte(field, value) as QueryResult<T>;
    if (filter.operator === 'in') current = current.in(field, value) as QueryResult<T>;
  }
  return current;
}

async function enrichCollectionRows<T>(collectionName: CollectionName, rows: T[]): Promise<T[]> {
  if (collectionName === ENTITIES.USUARIOS) return enrichUsuarios(rows);
  if (collectionName === ENTITIES.CATEGORIAS) return enrichCategorias(rows);
  return rows;
}

async function getUsuariosDerivedCount(filters: QueryFilter[]): Promise<number> {
  let query = supabase
    .from('v_usuarios_servicios_activos')
    .select('*', { count: 'exact', head: true }) as unknown as QueryResult<{
      count: number | null;
      error: Error | null;
    }>;

  for (const filter of filters) {
    const field = filter.field === 'serviciosActivos' ? 'servicios_activos' : readField(ENTITIES.USUARIOS, filter.field);
    const value = normalizeFilterValue(field, filter.value);
    if (filter.operator === '==') query = query.eq(field, value) as typeof query;
    if (filter.operator === '!=') query = query.neq(field, value) as typeof query;
    if (filter.operator === '<') query = query.lt(field, value) as typeof query;
    if (filter.operator === '<=') query = query.lte(field, value) as typeof query;
    if (filter.operator === '>') query = query.gt(field, value) as typeof query;
    if (filter.operator === '>=') query = query.gte(field, value) as typeof query;
    if (filter.operator === 'in') query = query.in(field, value) as typeof query;
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
