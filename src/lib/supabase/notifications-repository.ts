import { supabase } from './client';
import { toCamelCase } from './mappers';
import { reviveDates, toNullableDateOnly } from './dates';
import { snakeField } from './filters';
import { ENTITIES, type PublicViewName, type QueryBuilder, type QueryFilter } from './entities';
import { assertOnlineMutation } from '@/lib/pwa/offline-copy';
import { readOfflineCollection, shouldUseOfflineRead } from '@/lib/pwa/offline-copy';
import {
  getById as coreGetById,
  queryDocuments as coreQueryDocuments,
  getCount as coreGetCount,
  create as coreCreate,
  update as coreUpdate,
  remove as coreRemove,
  logCacheHit,
} from './record-core';

export { logCacheHit };

export const getNotificacionById = <T>(id: string) => coreGetById<T>(ENTITIES.NOTIFICACIONES, id);
export const queryNotificaciones = <T>(filters: QueryFilter[] = []) =>
  coreQueryDocuments<T>(ENTITIES.NOTIFICACIONES, filters);
export const countNotificaciones = (filters: QueryFilter[] = []) => coreGetCount(ENTITIES.NOTIFICACIONES, filters);
export const createNotificacion = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  coreCreate(ENTITIES.NOTIFICACIONES, payload);
export const updateNotificacion = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  coreUpdate(ENTITIES.NOTIFICACIONES, id, payload);
export const removeNotificacion = (id: string) => coreRemove(ENTITIES.NOTIFICACIONES, id);

export async function queryNotifications<T>(filters: QueryFilter[]): Promise<T[]> {
  if (await shouldUseOfflineRead()) {
    const rows = await readOfflineCollection<T>(ENTITIES.NOTIFICACIONES, filters);
    return rows.sort((a, b) => {
      const left = (a as Record<string, unknown>).createdAt;
      const right = (b as Record<string, unknown>).createdAt;
      const leftTime = left instanceof Date ? left.getTime() : 0;
      const rightTime = right instanceof Date ? right.getTime() : 0;
      return rightTime - leftTime;
    });
  }

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

export async function createNotification(payload: Record<string, unknown>): Promise<string> {
  assertOnlineMutation();
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

export async function updateNotification(id: string, payload: Record<string, unknown>): Promise<void> {
  assertOnlineMutation();
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
      metodo_pago_id: payload.metodoPagoId ?? null,
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
      metodo_pago_alias_snapshot: payload.metodoPagoAlias ?? null,
      metodo_pago_tarjeta_terminacion_snapshot: payload.metodoPagoTarjetaTerminacion ?? null,
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
      notas: item.notas,
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
      metodoPagoAlias: item.metodoPagoAliasSnapshot,
      metodoPagoTarjetaTerminacion: item.metodoPagoTarjetaTerminacionSnapshot,
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
