import { deliveryPassword } from '@/platform/utils/code-access';
import { supabase } from './client';
import { toCamelCase } from './mappers';
import { reviveDates, toNullableDateOnly } from './dates';
import { snakeField } from './filters';
import { ENTITIES, type PublicViewName, type QueryBuilder, type QueryFilter } from './entities';
import type { Json } from './database.types';
import { upsertNotificationAggregateRpc } from './notifications-rpc-adapter';
import { remove as coreRemove } from './record-core';
export const queryNotificaciones = <T>(filters: QueryFilter[] = []) =>
  queryNotifications<T>(filters);
export const createNotificacion = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  createNotification(payload as Record<string, unknown>);
export const updateNotificacion = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  updateNotification(id, payload as Record<string, unknown>);
export const removeNotificacion = (id: string) => coreRemove(ENTITIES.NOTIFICACIONES, id);
export async function queryNotifications<T>(filters: QueryFilter[]): Promise<T[]> {
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
  const id = crypto.randomUUID();
  return upsertNotificationAggregateRpc({
    p_base: notificationBasePayload(id, payload),
    p_detail: notificationDetailPayload(payload),
    p_preserve_existing_state: true,
  });
}

export async function updateNotification(id: string, payload: Record<string, unknown>): Promise<void> {
  if (payload.entidad) {
    await upsertNotificationAggregateRpc({
      p_base: notificationBasePayload(id, payload),
      p_detail: notificationDetailPayload(payload),
      p_preserve_existing_state: true,
    });
    return;
  }

  const base = normalizeNotificationBasePayload(payload);
  if (Object.keys(base).length > 0) {
    const { error } = await supabase.from('notificaciones').update(base as never).eq('id', id);
    if (error) throw new Error(error.message);
  }
}

function notificationDetailPayload(payload: Record<string, unknown>): Json {
  if (payload.entidad === 'venta') {
    return {
      venta_id: requiredNotificationString(payload.ventaId, 'ventaId'),
      cliente_id: nullableNotificationString(payload.clienteId),
      servicio_id: nullableNotificationString(payload.servicioId),
      categoria_id: nullableNotificationString(payload.categoriaId),
      cliente_nombre_snapshot: notificationString(payload.clienteNombre),
      cliente_telefono_snapshot: nullableNotificationString(payload.clienteTelefono),
      servicio_nombre_snapshot: notificationString(payload.servicioNombre),
      servicio_correo_snapshot: nullableNotificationString(payload.servicioCorreo),
      servicio_contrasena_snapshot: nullableNotificationString(payload.servicioContrasena),
      categoria_nombre_snapshot: nullableNotificationString(payload.categoriaNombre),
      perfil_nombre_snapshot: nullableNotificationString(payload.perfilNombre),
      codigo_snapshot: nullableNotificationString(payload.codigo),
      fecha_inicio_snapshot: toNullableDateOnly(payload.fechaInicio),
      fecha_fin_snapshot: toNullableDateOnly(payload.fechaFin),
      ciclo_pago_snapshot: nullableNotificationString(payload.cicloPago),
      precio_final_snapshot: nullableNotificationNumber(payload.precioFinal),
      moneda_snapshot: nullableNotificationString(payload.moneda),
      metodo_pago_nombre_snapshot: nullableNotificationString(payload.metodoPagoNombre ?? payload.metodoPago),
      metodo_pago_id: nullableNotificationString(payload.metodoPagoId),
    };
  }

  if (payload.entidad === 'servicio') {
    return {
      servicio_id: requiredNotificationString(payload.servicioId, 'servicioId'),
      categoria_id: nullableNotificationString(payload.categoriaId),
      servicio_nombre_snapshot: notificationString(payload.servicioNombre),
      servicio_correo_snapshot: nullableNotificationString(payload.correo),
      servicio_contrasena_snapshot: nullableNotificationString(payload.contrasena),
      categoria_nombre_snapshot: nullableNotificationString(payload.categoriaNombre),
      fecha_inicio_snapshot: null,
      fecha_vencimiento_snapshot: toNullableDateOnly(payload.fechaVencimiento),
      ciclo_pago_snapshot: nullableNotificationString(payload.cicloPago),
      costo_servicio_snapshot: nullableNotificationNumber(payload.costoServicio),
      moneda_snapshot: nullableNotificationString(payload.moneda),
      metodo_pago_nombre_snapshot: nullableNotificationString(payload.metodoPagoNombre),
      metodo_pago_alias_snapshot: nullableNotificationString(payload.metodoPagoAlias),
      metodo_pago_tarjeta_terminacion_snapshot: nullableNotificationString(payload.metodoPagoTarjetaTerminacion),
      renovacion_automatica_snapshot: nullableNotificationBoolean(payload.renovacionAutomatica),
    };
  }

  if (payload.entidad === 'reposo') {
    return {
      servicio_id: requiredNotificationString(payload.servicioId, 'servicioId'),
      categoria_id: nullableNotificationString(payload.categoriaId),
      servicio_nombre_snapshot: notificationString(payload.servicioNombre),
      servicio_correo_snapshot: nullableNotificationString(payload.correo),
      servicio_contrasena_snapshot: nullableNotificationString(payload.contrasena),
      categoria_nombre_snapshot: nullableNotificationString(payload.categoriaNombre),
      dias_reposo_snapshot: nullableNotificationNumber(payload.diasReposo),
      fecha_inicio_reposo_snapshot: toNullableDateOnly(payload.fechaInicioReposo),
      fecha_fin_reposo_snapshot: toNullableDateOnly(payload.fechaFinReposo),
    };
  }

  throw new Error(`Entidad de notificacion no soportada: ${String(payload.entidad ?? '')}`);
}

function notificationBasePayload(id: string, payload: Record<string, unknown>) {
  return {
    id,
    dedupe_key: notificationDedupeKey(payload),
    entidad: String(payload.entidad ?? ''),
    tipo: String(payload.tipo ?? 'sistema'),
    prioridad: String(payload.prioridad ?? 'media'),
    titulo: String(payload.titulo ?? ''),
    mensaje: payload.mensaje == null ? null : String(payload.mensaje),
    dias_restantes: payload.diasRestantes == null ? null : Number(payload.diasRestantes),
    scheduled_for: notificationScheduledFor(payload),
    leida: false,
    resaltada: false,
  };
}

function requiredNotificationString(value: unknown, field: string): string {
  const normalized = nullableNotificationString(value);
  if (!normalized) {
    throw new Error(`${field} es requerido para sincronizar la notificacion`);
  }
  return normalized;
}

function notificationString(value: unknown): string {
  return value == null ? '' : String(value);
}

function nullableNotificationString(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function nullableNotificationNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    throw new Error('La notificacion contiene un valor numerico invalido');
  }
  return normalized;
}

function nullableNotificationBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value !== 'boolean') {
    throw new Error('La notificacion contiene un valor booleano invalido');
  }
  return value;
}

function normalizeNotificationBasePayload(payload: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if (payload.prioridad !== undefined) result.prioridad = payload.prioridad;
  if (payload.titulo !== undefined) result.titulo = payload.titulo;
  if (payload.mensaje !== undefined) result.mensaje = payload.mensaje;
  if (payload.diasRestantes !== undefined) result.dias_restantes = payload.diasRestantes;
  if (payload.leida !== undefined) result.leida = payload.leida;
  if (payload.resaltada !== undefined) result.resaltada = payload.resaltada;
  if (payload.fechaPrometidaPago !== undefined) {
    result.fecha_prometida_pago = toNullableDateOnly(payload.fechaPrometidaPago);
  }
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
      servicioContrasena: item.accesoPorCodigo === true ? deliveryPassword('', true) : item.servicioContrasenaSnapshot,
      accesoPorCodigo: item.accesoPorCodigo === true,
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
