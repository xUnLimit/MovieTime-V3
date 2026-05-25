import { supabase } from './client';
import { ENTITIES, type CollectionName } from './entities';
import { readField, normalizeFilterValue } from './filters';
import type { Database } from './database.types';
import { getOfflinePaginated, shouldUseOfflineRead, readOfflineCollection } from '@/lib/pwa/offline-copy';
import { mapPaginatedRow, reviveDates, toCamelCaseObject } from './pagination-mappers';

export interface FilterOption {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'is' | 'ilike' | 'orIlike';
  value: unknown;
}

export interface PaginationOptions {
  pageSize: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  startAfterDoc?: number;
  filters?: FilterOption[];
}

export interface PaginatedResult<T> {
  docs: T[];
  lastDoc: number | null;
  hasMore: boolean;
}

export type SupabaseFilter = FilterOption;
export type SupabasePaginationOptions = PaginationOptions;
export type SupabasePaginatedResult<T> = PaginatedResult<T>;

type PublicTableName = keyof Database['public']['Tables'];
type PublicViewName = keyof Database['public']['Views'];
type PublicEntity = PublicTableName | PublicViewName;
type QueryLike<T> = PromiseLike<{ data: T[] | null; count?: number | null; error: Error | null }> & {
  eq: (field: string, value: unknown) => QueryLike<T>;
  neq: (field: string, value: unknown) => QueryLike<T>;
  lt: (field: string, value: unknown) => QueryLike<T>;
  lte: (field: string, value: unknown) => QueryLike<T>;
  gt: (field: string, value: unknown) => QueryLike<T>;
  gte: (field: string, value: unknown) => QueryLike<T>;
  in: (field: string, value: readonly unknown[]) => QueryLike<T>;
  is: (field: string, value: null | boolean) => QueryLike<T>;
  ilike: (field: string, value: string) => QueryLike<T>;
  or: (filters: string) => QueryLike<T>;
};

const READ_ENTITY_BY_COLLECTION: Record<string, PublicEntity> = {
  [ENTITIES.TERCEROS]: 'terceros',
  [ENTITIES.SERVICIOS]: 'v_servicios_full',
  [ENTITIES.CATEGORIAS]: 'categorias',
  [ENTITIES.METODOS_PAGO]: 'metodos_pago',
  [ENTITIES.TIPOS_GASTO]: 'tipos_gasto',
  [ENTITIES.ACTIVITY_LOG]: 'activity_log',
  [ENTITIES.GASTOS]: 'v_gastos_full',
  [ENTITIES.TEMPLATES]: 'templates',
  [ENTITIES.NOTIFICACIONES]: 'notificaciones',
  [ENTITIES.PAGOS_SERVICIO]: 'v_pagos_servicio_full',
  [ENTITIES.VENTAS]: 'v_ventas_full',
  [ENTITIES.PAGOS_VENTA]: 'v_pagos_venta_full',
};

export async function getPaginated<T>(
  collectionName: string,
  options: PaginationOptions
): Promise<PaginatedResult<T>> {
  if (await shouldUseOfflineRead()) {
    return getOfflinePaginated<T>(collectionName as CollectionName, options);
  }

  const {
    pageSize,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    startAfterDoc = 0,
    filters = [],
  } = options;

  const entity = READ_ENTITY_BY_COLLECTION[collectionName] ?? collectionName;
  const start = startAfterDoc;
  const end = start + pageSize;
  let query = supabase
    .from(entity as never)
    .select('*')
    .order(readField(collectionName as CollectionName, orderByField), { ascending: orderDirection === 'asc' })
    .range(start, end) as unknown as QueryLike<unknown>;

  query = applyFilters(collectionName, query, filters);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown[];
  const docs = rows
    .slice(0, pageSize)
    .map((row: unknown) => mapPaginatedRow(collectionName, reviveDates(toCamelCaseObject(row))) as T);
  const enrichedDocs =
    collectionName === ENTITIES.TERCEROS
      ? await enrichTerceros(docs)
      : collectionName === ENTITIES.SERVICIOS
        ? await enrichServicios(docs)
        : docs;

  return {
    docs: enrichedDocs,
    lastDoc: enrichedDocs.length > 0 ? start + enrichedDocs.length : null,
    hasMore: rows.length > pageSize,
  };
}

export async function getCount(
  collectionName: string,
  filters: FilterOption[] = []
): Promise<number> {
  if (await shouldUseOfflineRead()) {
    const rows = await readOfflineCollection(collectionName as CollectionName, filters as never);
    return rows.length;
  }

  const entity = READ_ENTITY_BY_COLLECTION[collectionName] ?? collectionName;
  let query = supabase
    .from(entity as never)
    .select('*', { count: 'exact', head: true }) as unknown as QueryLike<unknown>;

  query = applyFilters(collectionName, query, filters);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function enrichTerceros<T>(terceros: T[]): Promise<T[]> {
  const ids = terceros
    .map((usuario) => (usuario as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return terceros;

  const metodoIds = terceros
    .map((usuario) => (usuario as Record<string, unknown>).metodoPagoId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const [metodosResult, serviciosResult] = await Promise.all([
    metodoIds.length > 0
      ? supabase.from('metodos_pago').select('id,nombre,moneda').in('id', metodoIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('v_terceros_servicios_activos')
      .select('tercero_id,servicios_activos')
      .in('tercero_id', ids),
  ]);

  if (metodosResult.error) throw new Error(metodosResult.error.message);
  if (serviciosResult.error) throw new Error(serviciosResult.error.message);

  const metodos = new Map(
    (metodosResult.data ?? []).map((metodo) => [
      metodo.id,
      { nombre: metodo.nombre, moneda: metodo.moneda },
    ])
  );
  const serviciosActivos = new Map(
    (serviciosResult.data ?? []).map((row) => [
      row.tercero_id,
      Number(row.servicios_activos ?? 0),
    ])
  );

  return terceros.map((usuario) => {
    const record = usuario as Record<string, unknown>;
    const metodoPagoId = typeof record.metodoPagoId === 'string' ? record.metodoPagoId : undefined;
    const metodo = metodoPagoId ? metodos.get(metodoPagoId) : undefined;
    return {
      ...record,
      metodoPagoNombre: metodo?.nombre ?? record.metodoPagoNombre ?? 'Pendiente',
      moneda: metodo?.moneda ?? record.moneda ?? 'USD',
      serviciosActivos: serviciosActivos.get(String(record.id)) ?? 0,
    } as T;
  });
}

async function enrichServicios<T>(servicios: T[]): Promise<T[]> {
  const ids = servicios
    .map((servicio) => (servicio as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return servicios;

  const { data, error } = await supabase
    .from('v_pagos_servicio_full')
    .select('servicio_id,numero_periodo')
    .in('servicio_id', ids);

  if (error) throw new Error(error.message);

  const renovaciones = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.servicio_id) continue;
    const numeroPeriodo = Number(row.numero_periodo ?? 1);
    renovaciones.set(
      row.servicio_id,
      Math.max(renovaciones.get(row.servicio_id) ?? 0, numeroPeriodo - 1, 0)
    );
  }

  return servicios.map((servicio) => {
    const record = servicio as Record<string, unknown>;
    return {
      ...record,
      renovaciones: renovaciones.get(String(record.id)) ?? Number(record.renovaciones ?? 0),
    } as T;
  });
}

function applyFilters<T>(
  collectionName: string,
  query: QueryLike<T>,
  filters: FilterOption[]
): QueryLike<T> {
  const collection = collectionName as CollectionName;
  let current = query;

  for (const filter of filters) {
    if (filter.operator === 'orIlike') {
      current = current.or(buildOrIlikeFilter(collection, filter.value));
      continue;
    }

    const field = readField(collection, filter.field);
    const value = normalizeFilterValue(field, filter.value);
    if (filter.operator === '==') current = current.eq(field, value);
    if (filter.operator === '!=') current = current.neq(field, value);
    if (filter.operator === '<') current = current.lt(field, value);
    if (filter.operator === '<=') current = current.lte(field, value);
    if (filter.operator === '>') current = current.gt(field, value);
    if (filter.operator === '>=') current = current.gte(field, value);
    if (filter.operator === 'in') current = current.in(field, value as readonly unknown[]);
    if (filter.operator === 'is') current = current.is(field, value as null | boolean);
    if (filter.operator === 'ilike') current = current.ilike(field, String(value));
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
