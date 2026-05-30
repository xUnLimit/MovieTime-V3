import { supabase } from './client';
import {
  ENTITIES,
  readEntity,
  writeTable,
  type CollectionName,
  type PublicViewName,
  type QueryBuilder,
  type QueryFilter,
} from './entities';
import { readField, normalizeFilterValue } from './filters';
import { mapReadRow, enrichCategorias, enrichTerceros } from './read-models';
import { insertRawRow, normalizeWritePayload } from './write-utils';
import { readOfflineCollection, readOfflineCollectionById, shouldUseOfflineRead } from '@/modules/pwa/offline-copy';
import { assertOnlineMutation } from '@/modules/pwa/offline-copy';

export { ENTITIES };
export type { CollectionName, QueryFilter };
export { convertTimestamps, timestampToDate } from './dates';

type QueryResult<T> = QueryBuilder & PromiseLike<T>;

/**
 * Adapta el builder del SDK de Supabase a nuestro QueryResult encadenable.
 *
 * El cast `as unknown as` es inevitable: el tipo del builder de supabase-js es
 * altamente generico/dinamico y no es asignable a una interfaz de filtros generica.
 * Centralizarlo aqui mantiene el unico punto de cast (en vez de repetirlo en cada
 * lectura) y deja la frontera SDK -> motor-generico documentada en un solo lugar.
 */
function asQuery<T>(builder: unknown): QueryResult<T> {
  return builder as QueryResult<T>;
}

export function logCacheHit(collectionName: string) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Supabase cache hit] ${collectionName}`);
  }
}

export async function getAll<T>(collectionName: CollectionName): Promise<T[]> {
  if (await shouldUseOfflineRead()) {
    return readOfflineCollection<T>(collectionName);
  }

  const entity = readEntity(collectionName);
  const { data, error } = await supabase.from(entity as never).select('*');
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapReadRow<T>(collectionName, row));
  return enrichCollectionRows(collectionName, rows);
}

export async function getById<T>(collectionName: CollectionName, id: string): Promise<T | null> {
  if (await shouldUseOfflineRead()) {
    return readOfflineCollectionById<T>(collectionName, id);
  }

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
  if (await shouldUseOfflineRead()) {
    return readOfflineCollection<T>(collectionName, filters);
  }

  const entity = readEntity(collectionName);
  let query = asQuery<{ data: unknown[] | null; error: Error | null }>(
    supabase.from(entity as never).select('*'),
  );

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
  if (await shouldUseOfflineRead()) {
    const rows = await readOfflineCollection(collectionName, filters);
    return rows.length;
  }

  const entity = readEntity(collectionName);
  let query = asQuery<{ count: number | null; error: Error | null }>(
    supabase.from(entity as never).select('*', { count: 'exact', head: true }),
  );

  query = applyFilters(collectionName, query, filters);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function create<T extends Record<string, unknown>>(
  collectionName: CollectionName,
  payload: Omit<T, 'id'>
): Promise<string> {
  assertOnlineMutation();
  return createRaw(collectionName, normalizeWritePayload(collectionName, payload as Record<string, unknown>, 'insert'));
}

export async function createRaw(
  collectionName: CollectionName,
  payload: Record<string, unknown>
): Promise<string> {
  assertOnlineMutation();
  return insertRawRow(writeTable(collectionName), payload);
}

export async function update<T extends Record<string, unknown>>(
  collectionName: CollectionName,
  id: string,
  payload: Partial<T>
): Promise<void> {
  assertOnlineMutation();

  const table = writeTable(collectionName);
  const snake = normalizeWritePayload(collectionName, payload as Record<string, unknown>, 'update');
  if (Object.keys(snake).length === 0) return;
  const { error } = await supabase
    .from(table as never)
    .update(snake as never)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Hard-delete de infraestructura: borra la fila. SIN decisiones de negocio.
 * La politica de soft-delete (archivado) de ventas/servicios vive en sus repos
 * especificos via archiveRecord(); este adapter generico no decide que entidad se archiva.
 */
export async function remove(collectionName: CollectionName, id: string): Promise<void> {
  assertOnlineMutation();
  const table = writeTable(collectionName);
  const { error } = await supabase.from(table as never).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Soft-delete de infraestructura: marca la fila como archivada. SOLO ejecuta el UPDATE;
 * el caller (repo especifico de la entidad) decide cuando archivar en vez de borrar.
 */
export async function archiveRecord(
  collectionName: CollectionName,
  id: string,
  motivo = 'Eliminado desde la app',
): Promise<void> {
  assertOnlineMutation();
  const table = writeTable(collectionName);
  const { error } = await supabase
    .from(table as never)
    .update({
      archivado_at: new Date().toISOString(),
      motivo_archivado: motivo,
    } as never)
    .eq('id', id);
  if (error) throw new Error(error.message);
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
    if (filter.operator === 'is') current = current.is(field, value as null | boolean) as QueryResult<T>;
    if (filter.operator === 'ilike') current = current.ilike(field, String(value)) as QueryResult<T>;
    if (filter.operator === 'orIlike') current = current.or(buildOrIlikeFilter(collectionName, filter.value)) as QueryResult<T>;
  }
  return current;
}

function buildOrIlikeFilter(collectionName: CollectionName, value: unknown): string {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { fields?: unknown }).fields)) {
    throw new Error('Filtro orIlike invalido');
  }

  const fields = (value as { fields: unknown[] }).fields.filter(
    (field): field is string => typeof field === 'string' && field.length > 0
  );
  const term = String((value as { value?: unknown }).value ?? '');
  const pattern = `%${escapeIlikeTerm(term)}%`;

  return fields
    .map((field) => `${readField(collectionName, field)}.ilike.${pattern}`)
    .join(',');
}

function escapeIlikeTerm(value: string): string {
  return value.trim().replace(/[,%()]/g, ' ').replace(/[%_\\]/g, '\\$&');
}

// Tabla de enrichers por coleccion (Open/Closed): anadir uno es agregar una entrada,
// no editar una cadena de if. Las colecciones sin entrada se devuelven tal cual.
const ROW_ENRICHERS: Partial<Record<CollectionName, <T>(rows: T[]) => Promise<T[]>>> = {
  [ENTITIES.TERCEROS]: enrichTerceros,
  [ENTITIES.CATEGORIAS]: enrichCategorias,
};

async function enrichCollectionRows<T>(collectionName: CollectionName, rows: T[]): Promise<T[]> {
  const enrich = ROW_ENRICHERS[collectionName];
  return enrich ? enrich(rows) : rows;
}

/**
 * Conteo generico contra una vista derivada, con override de nombres de campo.
 * El repo especifico decide CUANDO usar una vista derivada (ej: terceros con
 * serviciosActivos); el core solo provee el motor de conteo+filtros.
 */
export async function countFromView(
  collectionName: CollectionName,
  viewName: PublicViewName,
  filters: QueryFilter[],
  fieldOverrides: Record<string, string> = {},
): Promise<number> {
  let query = asQuery<{ count: number | null; error: Error | null }>(
    supabase.from(viewName as never).select('*', { count: 'exact', head: true }),
  );

  for (const filter of filters) {
    const field = fieldOverrides[filter.field] ?? readField(collectionName, filter.field);
    const value = normalizeFilterValue(field, filter.value);
    if (filter.operator === '==') query = query.eq(field, value) as typeof query;
    if (filter.operator === '!=') query = query.neq(field, value) as typeof query;
    if (filter.operator === '<') query = query.lt(field, value) as typeof query;
    if (filter.operator === '<=') query = query.lte(field, value) as typeof query;
    if (filter.operator === '>') query = query.gt(field, value) as typeof query;
    if (filter.operator === '>=') query = query.gte(field, value) as typeof query;
    if (filter.operator === 'in') query = query.in(field, value) as typeof query;
    if (filter.operator === 'is') query = query.is(field, value as null | boolean) as typeof query;
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
