import { supabase } from './client';
import { toCamelCase, toSnakeCase } from './mappers';
import type { Database } from './database.types';

export const ENTITIES = {
  USUARIOS: 'usuarios',
  SERVICIOS: 'servicios',
  CATEGORIAS: 'categorias',
  METODOS_PAGO: 'metodosPago',
  TIPOS_GASTO: 'tiposGasto',
  ACTIVITY_LOG: 'activityLog',
  CONFIG: 'config',
  GASTOS: 'gastos',
  TEMPLATES: 'templates',
  NOTIFICACIONES: 'notificaciones',
  PAGOS_SERVICIO: 'pagosServicio',
  VENTAS: 'ventas',
  PAGOS_VENTA: 'pagosVenta',
} as const;

type CollectionName = typeof ENTITIES[keyof typeof ENTITIES];
type PublicTableName = keyof Database['public']['Tables'];
type PublicViewName = keyof Database['public']['Views'];
type PublicEntity = PublicTableName | PublicViewName;

const TABLE_BY_COLLECTION: Record<CollectionName, PublicTableName> = {
  usuarios: 'usuarios',
  servicios: 'servicios',
  categorias: 'categorias',
  metodosPago: 'metodos_pago',
  tiposGasto: 'tipos_gasto',
  activityLog: 'activity_log',
  config: 'config',
  gastos: 'gastos',
  templates: 'templates',
  notificaciones: 'notificaciones',
  pagosServicio: 'pagos_servicio',
  ventas: 'ventas',
  pagosVenta: 'pagos_venta',
};

const READ_ENTITY_BY_COLLECTION: Partial<Record<CollectionName, PublicEntity>> = {
  gastos: 'v_gastos_full',
  pagosServicio: 'v_pagos_servicio_full',
  pagosVenta: 'v_pagos_venta_full',
  ventas: 'v_ventas_full',
  servicios: 'v_servicios_full',
};

type QueryFilter = {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in';
  value: unknown;
};

type QueryBuilder = {
  eq: (field: string, value: unknown) => QueryBuilder;
  neq: (field: string, value: unknown) => QueryBuilder;
  lt: (field: string, value: unknown) => QueryBuilder;
  lte: (field: string, value: unknown) => QueryBuilder;
  gt: (field: string, value: unknown) => QueryBuilder;
  gte: (field: string, value: unknown) => QueryBuilder;
  in: (field: string, value: unknown) => QueryBuilder;
};

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
  if (collectionName === ENTITIES.USUARIOS) return enrichUsuarios(rows);
  if (collectionName === ENTITIES.CATEGORIAS) return enrichCategorias(rows);
  return rows;
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
  if (collectionName === ENTITIES.USUARIOS) {
    const [enriched] = await enrichUsuarios([row]);
    return enriched ?? row;
  }
  if (collectionName === ENTITIES.CATEGORIAS) {
    const [enriched] = await enrichCategorias([row]);
    return enriched ?? row;
  }
  return row;
}

export async function queryDocuments<T>(
  collectionName: CollectionName,
  filters: QueryFilter[] = []
): Promise<T[]> {
  if (collectionName === ENTITIES.NOTIFICACIONES) {
    return queryNotifications<T>(filters);
  }

  const entity = readEntity(collectionName);
  let query = supabase.from(entity as never).select('*') as unknown as QueryBuilder & PromiseLike<{
    data: unknown[] | null;
    error: Error | null;
  }>;

  for (const filter of filters) {
    const field = readField(collectionName, filter.field);
    const value = normalizeFilterValue(field, filter.value);
    switch (filter.operator) {
      case '==':
        query = query.eq(field, value) as typeof query;
        break;
      case '!=':
        query = query.neq(field, value) as typeof query;
        break;
      case '<':
        query = query.lt(field, value) as typeof query;
        break;
      case '<=':
        query = query.lte(field, value) as typeof query;
        break;
      case '>':
        query = query.gt(field, value) as typeof query;
        break;
      case '>=':
        query = query.gte(field, value) as typeof query;
        break;
      case 'in':
        query = query.in(field, value) as typeof query;
        break;
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapReadRow<T>(collectionName, row));
  if (collectionName === ENTITIES.USUARIOS) return enrichUsuarios(rows);
  if (collectionName === ENTITIES.CATEGORIAS) return enrichCategorias(rows);
  return rows;
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
    .select('*', { count: 'exact', head: true }) as unknown as QueryBuilder & PromiseLike<{
      count: number | null;
      error: Error | null;
    }>;

  for (const filter of filters) {
    const field = readField(collectionName, filter.field);
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

export async function create<T extends Record<string, unknown>>(
  collectionName: CollectionName,
  payload: Omit<T, 'id'>
): Promise<string> {
  if (collectionName === ENTITIES.NOTIFICACIONES) {
    return createNotification(payload as Record<string, unknown>);
  }
  return createNormalized(collectionName, payload as Record<string, unknown>);
}

export async function createRaw(
  collectionName: CollectionName,
  payload: Record<string, unknown>
): Promise<string> {
  const table = writeTable(collectionName);
  const snake = toSnakeCase<Record<string, unknown>>(payload);
  const { data, error } = await supabase
    .from(table as never)
    .insert(snake as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
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

export function convertTimestamps<T>(value: T): T {
  return reviveDates(value);
}

export function timestampToDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dateOnlyToLocalDate(value);
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export async function adjustServiciosActivos(..._args: unknown[]) {
  void _args;
  // Derived in Supabase by v_usuarios_servicios_activos.
}

export async function adjustCategoriaSuscripciones(..._args: unknown[]) {
  void _args;
  // Category financial counters are derived from normalized ventas/pagos views.
}

export async function adjustCategoriaGastos(..._args: unknown[]) {
  void _args;
  // Category financial counters are derived from normalized servicios/pagos views.
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

function readEntity(collectionName: CollectionName): PublicEntity {
  return READ_ENTITY_BY_COLLECTION[collectionName] ?? TABLE_BY_COLLECTION[collectionName];
}

function writeTable(collectionName: CollectionName): PublicTableName {
  return TABLE_BY_COLLECTION[collectionName];
}

function snakeField(field: string) {
  if (field === '__name__') return 'id';
  return Object.keys(toSnakeCase<Record<string, unknown>>({ [field]: true }))[0];
}

function readField(collectionName: CollectionName, field: string) {
  if (field === '__name__') return 'id';

  const viewFieldMap: Partial<Record<CollectionName, Record<string, string>>> = {
    ventas: {
      fechaInicio: 'ultima_fecha_inicio',
      fechaFin: 'ultima_fecha_fin',
      cicloPago: 'ultimo_ciclo_pago',
      precio: 'ultimo_total_original',
      precioFinal: 'ultimo_total_original',
      moneda: 'ultima_moneda',
    },
    servicios: {
      tipo: 'plan_tipo_id',
      tipoNombre: 'plan_tipo_nombre',
      fechaInicio: 'ultima_fecha_inicio',
      fechaVencimiento: 'ultima_fecha_vencimiento',
      cicloPago: 'ultimo_ciclo_pago',
      costoServicio: 'ultimo_costo_original',
      moneda: 'ultima_moneda',
      renovacionAutomatica: 'ultima_renovacion_automatica',
    },
    pagosVenta: {
      fecha: 'fecha_pago',
      monto: 'monto_original',
      moneda: 'moneda_original',
      metodoPago: 'metodo_pago_nombre_snapshot',
      fechaInicio: 'periodo_inicio',
      fechaVencimiento: 'periodo_fin',
    },
    pagosServicio: {
      fecha: 'fecha_pago',
      monto: 'monto_original',
      moneda: 'moneda_original',
      metodoPagoNombre: 'metodo_pago_nombre_snapshot',
      fechaInicio: 'periodo_inicio',
      fechaVencimiento: 'periodo_vencimiento',
    },
    gastos: {
      monto: 'monto_original',
      moneda: 'moneda_original',
    },
  };

  return viewFieldMap[collectionName]?.[field] ?? snakeField(field);
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

function mapReadRow<T>(collectionName: CollectionName, row: unknown): T {
  const camel = reviveDates(toCamelCase<Record<string, unknown>>(row));

  if (collectionName === ENTITIES.SERVICIOS) {
    return {
      ...camel,
      tipo: camel.tipo ?? camel.planTipoId ?? '',
      tipoNombre: camel.tipoNombre ?? camel.planTipoNombre,
      costoServicio: Number(camel.costoServicio ?? camel.ultimoCostoOriginal ?? 0),
      gastosTotal: Number(camel.gastosTotal ?? 0),
      metodoPagoId: camel.metodoPagoId ?? camel.ultimoMetodoPagoId,
      metodoPagoNombre: camel.metodoPagoNombre ?? camel.ultimoMetodoPagoNombre,
      moneda: camel.moneda ?? camel.ultimaMoneda ?? 'USD',
      cicloPago: camel.cicloPago ?? camel.ultimoCicloPago,
      fechaInicio: camel.fechaInicio ?? camel.ultimaFechaInicio,
      fechaVencimiento: camel.fechaVencimiento ?? camel.ultimaFechaVencimiento,
      renovacionAutomatica: Boolean(camel.renovacionAutomatica ?? camel.ultimaRenovacionAutomatica ?? false),
    } as T;
  }

  if (collectionName === ENTITIES.VENTAS) {
    return {
      ...camel,
      fechaInicio: camel.fechaInicio ?? camel.ultimaFechaInicio,
      fechaFin: camel.fechaFin ?? camel.ultimaFechaFin,
      cicloPago: camel.cicloPago ?? camel.ultimoCicloPago,
      precio: Number(camel.precio ?? camel.ultimoPrecioOriginal ?? camel.ultimoTotalOriginal ?? 0),
      precioFinal: Number(camel.precioFinal ?? camel.ultimoTotalOriginal ?? 0),
      descuento: Number(camel.descuento ?? camel.ultimoDescuento ?? 0),
      metodoPagoId: camel.metodoPagoId ?? camel.ultimoMetodoPagoId,
      metodoPagoNombre: camel.metodoPagoNombre ?? camel.ultimoMetodoPagoNombre,
      moneda: camel.moneda ?? camel.ultimaMoneda ?? 'USD',
    } as T;
  }

  if (collectionName === ENTITIES.PAGOS_SERVICIO) {
    const numeroPeriodo = Number(camel.numeroPeriodo ?? 1);
    return {
      ...camel,
      fecha: camel.fecha ?? camel.fechaPago,
      descripcion: camel.descripcion ?? (numeroPeriodo <= 1 ? 'Pago inicial' : `Renovación #${numeroPeriodo - 1}`),
      monto: Number(camel.monto ?? camel.montoOriginal ?? 0),
      moneda: camel.moneda ?? camel.monedaOriginal ?? 'USD',
      metodoPagoNombre: camel.metodoPagoNombre ?? camel.metodoPagoNombreSnapshot,
      cicloPago: camel.cicloPago ?? camel.periodoCicloPago,
      fechaInicio: camel.fechaInicio ?? camel.periodoInicio,
      fechaVencimiento: camel.fechaVencimiento ?? camel.periodoVencimiento,
      isPagoInicial: camel.isPagoInicial ?? numeroPeriodo === 1,
    } as T;
  }

  if (collectionName === ENTITIES.PAGOS_VENTA) {
    return {
      ...camel,
      fecha: camel.fecha ?? camel.fechaPago,
      monto: Number(camel.monto ?? camel.montoOriginal ?? 0),
      precio: Number(camel.precio ?? camel.precioOriginal ?? camel.montoOriginal ?? 0),
      descuento: Number(camel.descuento ?? 0),
      moneda: camel.moneda ?? camel.monedaOriginal ?? 'USD',
      metodoPago: camel.metodoPago ?? camel.metodoPagoNombreSnapshot ?? '',
      cicloPago: camel.cicloPago ?? camel.periodoCicloPago,
      fechaInicio: camel.fechaInicio ?? camel.periodoInicio,
      fechaVencimiento: camel.fechaVencimiento ?? camel.periodoFin,
      isPagoInicial: camel.isPagoInicial ?? camel.numeroPeriodo === 1,
    } as T;
  }

  if (collectionName === ENTITIES.GASTOS) {
    return {
      ...camel,
      monto: Number(camel.monto ?? camel.montoOriginal ?? 0),
    } as T;
  }

  return camel as T;
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

async function enrichCategorias<T>(categorias: T[]): Promise<T[]> {
  const ids = categorias
    .map((categoria) => (categoria as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return categorias;

  const [
    tiposResult,
    planesResult,
    countersResult,
    ventasResult,
    financialResult,
  ] = await Promise.all([
    supabase.from('planes_tipos').select('*').in('categoria_id', ids),
    supabase.from('planes').select('*').in('categoria_id', ids),
    supabase.from('v_categoria_counters').select('*').in('categoria_id', ids),
    supabase.from('v_ventas_full').select('categoria_id,estado').in('categoria_id', ids),
    supabase.from('v_categoria_financial_metrics').select('*').in('categoria_id', ids),
  ]);

  if (tiposResult.error) throw new Error(tiposResult.error.message);
  if (planesResult.error) throw new Error(planesResult.error.message);
  if (countersResult.error) throw new Error(countersResult.error.message);
  if (ventasResult.error) throw new Error(ventasResult.error.message);
  if (financialResult.error) throw new Error(financialResult.error.message);

  const tiposByCategoria = new Map<string, { id: string; nombre: string }[]>();
  for (const tipo of tiposResult.data ?? []) {
    tiposByCategoria.set(tipo.categoria_id, [
      ...(tiposByCategoria.get(tipo.categoria_id) ?? []),
      { id: tipo.id, nombre: tipo.nombre },
    ]);
  }

  const planesByCategoria = new Map<string, {
    id: string;
    nombre: string;
    precio: number;
    cicloPago: string;
    tipoPlan: string;
  }[]>();
  for (const plan of planesResult.data ?? []) {
    planesByCategoria.set(plan.categoria_id, [
      ...(planesByCategoria.get(plan.categoria_id) ?? []),
      {
        id: plan.id,
        nombre: plan.nombre,
        precio: Number(plan.precio),
        cicloPago: plan.ciclo_pago,
        tipoPlan: plan.plan_tipo_id,
      },
    ]);
  }

  const countersByCategoria = new Map(
    (countersResult.data ?? []).map((counter) => [counter.categoria_id, counter])
  );
  const ventasActivasByCategoria = new Map<string, number>();
  for (const venta of ventasResult.data ?? []) {
    if (!venta.categoria_id || venta.estado === 'inactivo') continue;
    ventasActivasByCategoria.set(
      venta.categoria_id,
      (ventasActivasByCategoria.get(venta.categoria_id) ?? 0) + 1
    );
  }
  const financialByCategoria = new Map(
    (financialResult.data ?? []).map((row) => [row.categoria_id, row])
  );

  return categorias.map((categoria) => {
    const record = categoria as Record<string, unknown>;
    const id = String(record.id);
    const counters = countersByCategoria.get(id);
    const financial = financialByCategoria.get(id);
    return {
      ...record,
      tiposPlanes: tiposByCategoria.get(id) ?? [],
      planes: planesByCategoria.get(id) ?? [],
      totalServicios: Number(counters?.total_servicios ?? record.totalServicios ?? 0),
      serviciosActivos: Number(counters?.servicios_activos ?? record.serviciosActivos ?? 0),
      perfilesDisponiblesTotal: Number(
        counters?.perfiles_disponibles_total ?? record.perfilesDisponiblesTotal ?? 0
      ),
      ventasTotales: ventasActivasByCategoria.get(id) ?? Number(record.ventasTotales ?? 0),
      ingresosTotales: Number(financial?.ingresos_usd ?? record.ingresosTotales ?? 0),
      gastosTotal: Number(financial?.gastos_usd ?? record.gastosTotal ?? 0),
    } as T;
  });
}

async function getUsuariosDerivedCount(filters: QueryFilter[]): Promise<number> {
  let query = supabase
    .from('v_usuarios_servicios_activos')
    .select('*', { count: 'exact', head: true }) as unknown as QueryBuilder & PromiseLike<{
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

async function queryNotifications<T>(filters: QueryFilter[]): Promise<T[]> {
  const entidad = filters.find((filter) => filter.field === 'entidad' && filter.operator === '==')
    ?.value as string | undefined;
  const entities = entidad ? notificationViewsFor(entidad) : notificationViewsFor();
  const rows = await Promise.all(
    entities.map(async (entity) => {
      let query = supabase.from(entity.view as never).select('*') as unknown as QueryBuilder & PromiseLike<{
        data: unknown[] | null;
        error: Error | null;
      }>;

      for (const filter of filters) {
        const field = notificationReadField(filter.field);
        if (!field) continue;
        if (filter.operator === '==') query = query.eq(field, filter.value) as typeof query;
        if (filter.operator === '!=') query = query.neq(field, filter.value) as typeof query;
        if (filter.operator === '<') query = query.lt(field, filter.value) as typeof query;
        if (filter.operator === '<=') query = query.lte(field, filter.value) as typeof query;
        if (filter.operator === '>') query = query.gt(field, filter.value) as typeof query;
        if (filter.operator === '>=') query = query.gte(field, filter.value) as typeof query;
        if (filter.operator === 'in') query = query.in(field, filter.value) as typeof query;
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapNotificationRow(row));
    })
  );

  return rows.flat().sort((a, b) => {
    const left = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const right = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return right - left;
  }) as T[];
}

async function createNotification(payload: Record<string, unknown>): Promise<string> {
  const entidad = String(payload.entidad ?? '');
  const id = crypto.randomUUID();
  const { error } = await supabase.from('notificaciones').insert({
    id,
    dedupe_key: notificationDedupeKey(payload),
    entidad,
    tipo: payload.tipo ?? 'sistema',
    prioridad: payload.prioridad ?? 'media',
    titulo: payload.titulo ?? '',
    mensaje: payload.mensaje ?? null,
    dias_restantes: payload.diasRestantes ?? null,
    scheduled_for: notificationScheduledFor(payload),
    leida: Boolean(payload.leida ?? false),
    resaltada: Boolean(payload.resaltada ?? false),
  } as never);
  if (error) throw new Error(error.message);

  await upsertNotificationDetail(id, payload);
  return id;
}

async function updateNotification(id: string, payload: Record<string, unknown>): Promise<void> {
  const base = normalizeNotificationBasePayload(payload);
  if (Object.keys(base).length > 0) {
    const { error } = await supabase.from('notificaciones').update(base as never).eq('id', id);
    if (error) throw new Error(error.message);
  }

  if (payload.entidad) {
    await upsertNotificationDetail(id, payload);
  }
}

async function upsertNotificationDetail(notificacionId: string, payload: Record<string, unknown>) {
  if (payload.entidad === 'venta') {
    const { error } = await supabase.from('notificaciones_venta').upsert({
      notificacion_id: notificacionId,
      venta_id: payload.ventaId,
      cliente_id: payload.clienteId || null,
      servicio_id: payload.servicioId || null,
      categoria_id: payload.categoriaId || null,
      cliente_nombre_snapshot: payload.clienteNombre ?? '',
      cliente_telefono_snapshot: payload.clienteTelefono ?? null,
      servicio_nombre_snapshot: payload.servicioNombre ?? '',
      servicio_correo_snapshot: payload.servicioCorreo ?? null,
      servicio_contrasena_snapshot: payload.servicioContrasena ?? null,
      categoria_nombre_snapshot: payload.categoriaNombre ?? null,
      perfil_nombre_snapshot: payload.perfilNombre ?? null,
      codigo_snapshot: payload.codigo ?? null,
      fecha_inicio_snapshot: toNullableDateOnly(payload.fechaInicio),
      fecha_fin_snapshot: toNullableDateOnly(payload.fechaFin),
      ciclo_pago_snapshot: payload.cicloPago ?? null,
      precio_final_snapshot: payload.precioFinal ?? null,
      moneda_snapshot: payload.moneda ?? null,
      metodo_pago_nombre_snapshot: payload.metodoPagoNombre ?? payload.metodoPago ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return;
  }

  if (payload.entidad === 'servicio') {
    const { error } = await supabase.from('notificaciones_servicio').upsert({
      notificacion_id: notificacionId,
      servicio_id: payload.servicioId,
      categoria_id: payload.categoriaId || null,
      servicio_nombre_snapshot: payload.servicioNombre ?? '',
      servicio_correo_snapshot: payload.correo ?? null,
      servicio_contrasena_snapshot: payload.contrasena ?? null,
      categoria_nombre_snapshot: payload.categoriaNombre ?? null,
      fecha_inicio_snapshot: null,
      fecha_vencimiento_snapshot: toNullableDateOnly(payload.fechaVencimiento),
      ciclo_pago_snapshot: payload.cicloPago ?? null,
      costo_servicio_snapshot: payload.costoServicio ?? null,
      moneda_snapshot: payload.moneda ?? null,
      metodo_pago_nombre_snapshot: payload.metodoPagoNombre ?? null,
      renovacion_automatica_snapshot: payload.renovacionAutomatica ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return;
  }

  if (payload.entidad === 'reposo') {
    const { error } = await supabase.from('notificaciones_reposo').upsert({
      notificacion_id: notificacionId,
      servicio_id: payload.servicioId,
      categoria_id: payload.categoriaId || null,
      servicio_nombre_snapshot: payload.servicioNombre ?? '',
      servicio_correo_snapshot: payload.correo ?? null,
      servicio_contrasena_snapshot: payload.contrasena ?? null,
      categoria_nombre_snapshot: payload.categoriaNombre ?? null,
      dias_reposo_snapshot: payload.diasReposo ?? null,
      fecha_inicio_reposo_snapshot: toNullableDateOnly(payload.fechaInicioReposo),
      fecha_fin_reposo_snapshot: toNullableDateOnly(payload.fechaFinReposo),
    } as never);
    if (error) throw new Error(error.message);
  }
}

function normalizeNotificationBasePayload(payload: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if (payload.prioridad !== undefined) result.prioridad = payload.prioridad;
  if (payload.titulo !== undefined) result.titulo = payload.titulo;
  if (payload.mensaje !== undefined) result.mensaje = payload.mensaje;
  if (payload.diasRestantes !== undefined) result.dias_restantes = payload.diasRestantes;
  if (payload.leida !== undefined) result.leida = payload.leida;
  if (payload.resaltada !== undefined) result.resaltada = payload.resaltada;
  result.updated_at = new Date().toISOString();
  return result;
}

function notificationViewsFor(entidad?: string): { entidad: string; view: PublicViewName }[] {
  const all = [
    { entidad: 'venta', view: 'v_notificaciones_venta' as PublicViewName },
    { entidad: 'servicio', view: 'v_notificaciones_servicio' as PublicViewName },
    { entidad: 'reposo', view: 'v_notificaciones_reposo' as PublicViewName },
  ];
  return entidad ? all.filter((item) => item.entidad === entidad) : all;
}

function notificationReadField(field: string) {
  const map: Record<string, string> = {
    ventaId: 'venta_id',
    servicioId: 'servicio_id',
    clienteId: 'cliente_id',
    categoriaId: 'categoria_id',
    diasRestantes: 'dias_restantes',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };
  return map[field] ?? snakeField(field);
}

function mapNotificationRow(row: unknown): Record<string, unknown> {
  const item = reviveDates(toCamelCase<Record<string, unknown>>(row));
  const base = {
    ...item,
    diasRestantes: item.diasRestantes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  if (item.entidad === 'venta') {
    return {
      ...base,
      clienteNombre: item.clienteNombreSnapshot,
      clienteTelefono: item.clienteTelefonoSnapshot,
      servicioNombre: item.servicioNombreSnapshot,
      servicioCorreo: item.servicioCorreoSnapshot,
      servicioContrasena: item.servicioContrasenaSnapshot,
      categoriaNombre: item.categoriaNombreSnapshot,
      perfilNombre: item.perfilNombreSnapshot,
      codigo: item.codigoSnapshot,
      fechaInicio: item.fechaInicioSnapshot,
      fechaFin: item.fechaFinSnapshot,
      cicloPago: item.cicloPagoSnapshot,
      precioFinal: item.precioFinalSnapshot,
      metodoPagoNombre: item.metodoPagoNombreSnapshot,
      moneda: item.monedaSnapshot,
      estado: 'activo',
    };
  }

  if (item.entidad === 'servicio') {
    return {
      ...base,
      servicioNombre: item.servicioNombreSnapshot,
      categoriaNombre: item.categoriaNombreSnapshot,
      tipoServicio: item.tipoServicio ?? '',
      correo: item.servicioCorreoSnapshot,
      contrasena: item.servicioContrasenaSnapshot,
      metodoPagoNombre: item.metodoPagoNombreSnapshot,
      moneda: item.monedaSnapshot,
      costoServicio: item.costoServicioSnapshot,
      cicloPago: item.cicloPagoSnapshot,
      fechaVencimiento: item.fechaVencimientoSnapshot,
      renovacionAutomatica: Boolean(item.renovacionAutomaticaSnapshot),
    };
  }

  return {
    ...base,
    servicioNombre: item.servicioNombreSnapshot,
    categoriaNombre: item.categoriaNombreSnapshot,
    correo: item.servicioCorreoSnapshot,
    diasReposo: item.diasReposoSnapshot,
    fechaInicioReposo: item.fechaInicioReposoSnapshot,
    fechaFinReposo: item.fechaFinReposoSnapshot,
  };
}

function notificationDedupeKey(payload: Record<string, unknown>) {
  const entidad = String(payload.entidad ?? 'notificacion');
  if (entidad === 'venta') return `venta:${payload.ventaId}`;
  if (entidad === 'servicio') return `servicio:${payload.servicioId}`;
  if (entidad === 'reposo') return `reposo:${payload.servicioId}`;
  return `${entidad}:${crypto.randomUUID()}`;
}

function notificationScheduledFor(payload: Record<string, unknown>) {
  return toNullableDateOnly(payload.fechaFin ?? payload.fechaVencimiento ?? payload.fechaFinReposo);
}

function toNullableDateOnly(value: unknown) {
  if (!value) return null;
  return toDateOnly(value);
}

async function createNormalized(
  collectionName: CollectionName,
  payload: Record<string, unknown>
): Promise<string> {
  if (collectionName === ENTITIES.PAGOS_SERVICIO) {
    return createPagoServicio(payload);
  }
  if (collectionName === ENTITIES.PAGOS_VENTA) {
    return createPagoVenta(payload);
  }
  return createRaw(collectionName, normalizeWritePayload(collectionName, payload, 'insert'));
}

function normalizeWritePayload(
  collectionName: CollectionName,
  payload: Record<string, unknown>,
  mode: 'insert' | 'update'
): Record<string, unknown> {
  const snake = toSnakeCase<Record<string, unknown>>(payload);
  sanitizeUuidReferences(snake);
  const allowedByCollection: Partial<Record<CollectionName, string[]>> = {
    usuarios: [
      'nombre',
      'apellido',
      'tipo',
      'telefono',
      'email',
      'metodo_pago_id',
      'active',
      'notas',
      'created_by',
    ],
    servicios: [
      'categoria_id',
      'plan_tipo_id',
      'nombre',
      'correo',
      'contrasena',
      'perfiles_disponibles',
      'perfiles_ocupados',
      'activo',
      'en_reposo',
      'dias_reposo',
      'fecha_inicio_reposo',
      'fecha_fin_reposo',
      'notas',
      'created_by',
    ],
    ventas: [
      'cliente_id',
      'servicio_id',
      'categoria_id',
      'estado',
      'perfil_numero',
      'perfil_nombre',
      'codigo',
      'notas',
      'created_by',
    ],
    gastos: [
      'tipo_gasto_id',
      'fecha',
      'monto_original',
      'moneda_original',
      'monto_usd',
      'exchange_rate',
      'detalle',
      'created_by',
    ],
  };

  if (collectionName === ENTITIES.SERVICIOS && snake.tipo && !snake.plan_tipo_id) {
    snake.plan_tipo_id = snake.tipo;
  }
  if (collectionName === ENTITIES.GASTOS && snake.monto && !snake.monto_original) {
    snake.monto_original = snake.monto;
    snake.monto_usd = snake.monto;
    snake.moneda_original = 'USD';
  }

  const allowed = allowedByCollection[collectionName];
  if (!allowed) return snake;

  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (snake[key] !== undefined) result[key] = snake[key];
  }
  if (mode === 'update') {
    delete result.created_by;
  }
  sanitizeUuidReferences(result);

  if (process.env.NODE_ENV === 'development') {
    const dropped = Object.keys(snake).filter(
      (k) => !allowed.includes(k) && snake[k] !== undefined && k !== 'id'
    );
    if (dropped.length > 0) {
      console.warn(
        `[supabase repository] write to "${collectionName}" dropped fields not in allowlist: ${dropped.join(', ')}\n` +
        'These fields do not exist on the SQL table. Either add them to the allowlist or remove them from the caller.'
      );
    }
  }

  return result;
}

function sanitizeUuidReferences(row: Record<string, unknown>) {
  for (const key of ['created_by', 'archivado_by', 'cortado_by', 'cortada_by']) {
    if (row[key] !== undefined && !isUuid(String(row[key]))) {
      row[key] = null;
    }
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function createPagoServicio(payload: Record<string, unknown>): Promise<string> {
  const servicioId = String(payload.servicioId ?? '');
  if (!servicioId) throw new Error('servicioId es requerido para pagos_servicio');

  const monto = Number(payload.monto ?? 0);
  const moneda = String(payload.moneda ?? 'USD');
  const { usd, rate } = await convertAmountToUSD(monto, moneda);
  const periodoId = await ensureServicioPeriodo(servicioId, payload, monto, moneda, usd, rate);

  return createRaw(ENTITIES.PAGOS_SERVICIO, {
    servicio_periodo_id: periodoId,
    servicio_id: servicioId,
    fecha_pago: toIso(payload.fecha ?? new Date()),
    estado: 'registrado',
    monto_original: monto,
    moneda_original: moneda,
    monto_usd: usd,
    exchange_rate: rate,
    categoria_id_snapshot: payload.categoriaId || null,
    metodo_pago_id: payload.metodoPagoId || null,
    metodo_pago_nombre_snapshot: payload.metodoPagoNombre || null,
    notas: payload.notas ?? null,
  });
}

async function createPagoVenta(payload: Record<string, unknown>): Promise<string> {
  const ventaId = String(payload.ventaId ?? '');
  if (!ventaId) throw new Error('ventaId es requerido para pagos_venta');

  const monto = Number(payload.monto ?? 0);
  const precio = Number(payload.precio ?? monto);
  const descuento = Number(payload.descuento ?? 0);
  const moneda = String(payload.moneda ?? 'USD');
  const { usd, rate } = await convertAmountToUSD(monto, moneda);
  const periodoId = await ensureVentaPeriodo(ventaId, payload, precio, descuento, monto, moneda, usd, rate);

  return createRaw(ENTITIES.PAGOS_VENTA, {
    venta_periodo_id: periodoId,
    venta_id: ventaId,
    fecha_pago: toIso(payload.fecha ?? new Date()),
    estado: 'registrado',
    monto_original: monto,
    moneda_original: moneda,
    monto_usd: usd,
    exchange_rate: rate,
    metodo_pago_id: payload.metodoPagoId || null,
    metodo_pago_nombre_snapshot: payload.metodoPago || null,
    notas: payload.notas ?? null,
  });
}

async function ensureServicioPeriodo(
  servicioId: string,
  payload: Record<string, unknown>,
  monto: number,
  moneda: string,
  usd: number,
  rate: number
): Promise<string> {
  const numeroPeriodo = await nextPeriodNumber('servicio_periodos', 'servicio_id', servicioId);
  const { data, error } = await supabase
    .from('servicio_periodos')
    .insert({
      servicio_id: servicioId,
      numero_periodo: numeroPeriodo,
      tipo: numeroPeriodo === 1 ? 'inicial' : 'renovacion',
      fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
      fecha_vencimiento: toDateOnly(payload.fechaVencimiento ?? new Date()),
      ciclo_pago: payload.cicloPago ?? 'mensual',
      costo_original: monto,
      moneda_original: moneda,
      costo_usd: usd,
      exchange_rate: rate,
      renovacion_automatica: Boolean(payload.renovacionAutomatica ?? false),
    } as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

async function ensureVentaPeriodo(
  ventaId: string,
  payload: Record<string, unknown>,
  precio: number,
  descuento: number,
  total: number,
  moneda: string,
  usd: number,
  rate: number
): Promise<string> {
  const numeroPeriodo = await nextPeriodNumber('venta_periodos', 'venta_id', ventaId);
  const { data, error } = await supabase
    .from('venta_periodos')
    .insert({
      venta_id: ventaId,
      numero_periodo: numeroPeriodo,
      tipo: numeroPeriodo === 1 ? 'inicial' : 'renovacion',
      fecha_inicio: toDateOnly(payload.fechaInicio ?? new Date()),
      fecha_fin: toDateOnly(payload.fechaVencimiento ?? new Date()),
      ciclo_pago: payload.cicloPago ?? 'mensual',
      precio_original: precio,
      descuento,
      total_original: total,
      moneda_original: moneda,
      total_usd: usd,
      exchange_rate: rate,
    } as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

async function nextPeriodNumber(table: 'servicio_periodos' | 'venta_periodos', field: string, id: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(field, id);
  if (error) throw new Error(error.message);
  return (count ?? 0) + 1;
}

async function convertAmountToUSD(amount: number, moneda: string) {
  const { currencyService } = await import('@/lib/services/currencyService');
  const usd = await currencyService.convertToUSD(amount, moneda);
  return {
    usd,
    rate: moneda === 'USD' || amount === 0 ? 1 : amount / usd,
  };
}

function toIso(value: unknown) {
  const date = timestampToDate(value);
  return date.toISOString();
}

function toDateOnly(value: unknown) {
  const date = timestampToDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function reviveDates<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(reviveDates) as T;

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (typeof nested === 'string' && shouldReviveDate(key, nested)) {
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

function shouldReviveDate(key: string, value: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  return (
    key.endsWith('At') ||
    key.startsWith('fecha') ||
    key.includes('Fecha') ||
    key.startsWith('periodo') ||
    key.endsWith('Inicio') ||
    key.endsWith('Fin') ||
    key.endsWith('Vencimiento') ||
    key === 'timestamp'
  );
}
