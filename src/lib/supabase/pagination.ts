import { supabase } from './client';
import { toSnakeCase } from './mappers';
import { ENTITIES } from './repository';
import type { Database } from './database.types';

export interface FilterOption {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in';
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
};

const READ_ENTITY_BY_COLLECTION: Record<string, PublicEntity> = {
  [ENTITIES.USUARIOS]: 'usuarios',
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
    .order(snakeField(orderByField), { ascending: orderDirection === 'asc' })
    .range(start, end) as unknown as QueryLike<unknown>;

  for (const filter of filters) {
    const field = snakeField(filter.field);
    const value = normalizeFilterValue(field, filter.value);
    if (filter.operator === '==') query = query.eq(field, value);
    if (filter.operator === '!=') query = query.neq(field, value);
    if (filter.operator === '<') query = query.lt(field, value);
    if (filter.operator === '<=') query = query.lte(field, value);
    if (filter.operator === '>') query = query.gt(field, value);
    if (filter.operator === '>=') query = query.gte(field, value);
    if (filter.operator === 'in') query = query.in(field, value as readonly unknown[]);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown[];
  const docs = rows
    .slice(0, pageSize)
    .map((row: unknown) => mapPaginatedRow(collectionName, reviveDates(toCamelCaseObject(row))) as T);
  const enrichedDocs =
    collectionName === ENTITIES.USUARIOS
      ? await enrichUsuarios(docs)
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
  const entity = READ_ENTITY_BY_COLLECTION[collectionName] ?? collectionName;
  let query = supabase
    .from(entity as never)
    .select('*', { count: 'exact', head: true }) as unknown as QueryLike<unknown>;

  for (const filter of filters) {
    const field = snakeField(filter.field);
    const value = normalizeFilterValue(field, filter.value);
    if (filter.operator === '==') query = query.eq(field, value);
    if (filter.operator === '!=') query = query.neq(field, value);
    if (filter.operator === '<') query = query.lt(field, value);
    if (filter.operator === '<=') query = query.lte(field, value);
    if (filter.operator === '>') query = query.gt(field, value);
    if (filter.operator === '>=') query = query.gte(field, value);
    if (filter.operator === 'in') query = query.in(field, value as readonly unknown[]);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function snakeField(field: string) {
  if (field === '__name__') return 'id';
  return Object.keys(toSnakeCase<Record<string, unknown>>({ [field]: true }))[0];
}

function normalizeFilterValue(field: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFilterValue(field, item));
  }

  if (value instanceof Date) {
    return isDateOnlyField(field) ? toDateOnly(value) : value.toISOString();
  }

  return value;
}

function isDateOnlyField(field: string) {
  return (
    field.includes('fecha_') ||
    field.startsWith('ultima_fecha_') ||
    field.startsWith('periodo_') ||
    field.endsWith('_snapshot') ||
    field === 'scheduled_for'
  );
}

function mapPaginatedRow(collectionName: string, row: unknown): unknown {
  const record = row as Record<string, unknown>;

  if (collectionName === ENTITIES.SERVICIOS) {
    return {
      ...record,
      tipo: record.tipo ?? record.planTipoId ?? '',
      tipoNombre: record.tipoNombre ?? record.planTipoNombre,
      costoServicio: Number(record.costoServicio ?? record.ultimoCostoOriginal ?? 0),
      moneda: record.moneda ?? record.ultimaMoneda ?? 'USD',
      cicloPago: record.cicloPago ?? record.ultimoCicloPago,
      fechaInicio: record.fechaInicio ?? record.ultimaFechaInicio,
      fechaVencimiento: record.fechaVencimiento ?? record.ultimaFechaVencimiento,
      renovacionAutomatica: Boolean(record.renovacionAutomatica ?? record.ultimaRenovacionAutomatica ?? false),
    };
  }

  return record;
}

async function enrichUsuarios<T>(usuarios: T[]): Promise<T[]> {
  const ids = usuarios
    .map((usuario) => (usuario as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return usuarios;

  const metodoIds = usuarios
    .map((usuario) => (usuario as Record<string, unknown>).metodoPagoId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const [metodosResult, serviciosResult] = await Promise.all([
    metodoIds.length > 0
      ? supabase.from('metodos_pago').select('id,nombre,moneda').in('id', metodoIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('v_usuarios_servicios_activos')
      .select('usuario_id,servicios_activos')
      .in('usuario_id', ids),
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
      row.usuario_id,
      Number(row.servicios_activos ?? 0),
    ])
  );

  return usuarios.map((usuario) => {
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

function toCamelCaseObject(row: unknown): unknown {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(toCamelCaseObject);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] =
      toCamelCaseObject(value);
  }
  return result;
}

function reviveDates<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(reviveDates) as T;

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (typeof nested === 'string' && /^\d{4}-\d{2}-\d{2}/.test(nested)) {
      result[key] = /^\d{4}-\d{2}-\d{2}$/.test(nested)
        ? dateOnlyToLocalDate(nested)
        : new Date(nested);
    } else {
      result[key] = reviveDates(nested);
    }
  }
  return result as T;
}

function dateOnlyToLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
