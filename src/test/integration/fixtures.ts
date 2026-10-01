import { randomInt, randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createServiceClient } from './clients';

export type Role = 'admin' | 'operador';
export type TestUser = { id: string; email: string; password: string; role: Role; active: boolean };
export type Catalog = {
  categoriaId: string;
  planTipoId: string;
  planId: string;
  metodoPagoId: string;
  servicioId: string;
  terceroId: string;
};
export type TestVenta = { ventaId: string; periodoId: string; pagoId: string };

type Row = Record<string, unknown>;
type Result<T> = { data: T | null; error: { message: string; code?: string } | null };

// Prefijo por ejecucion: ids unicos aunque dos corridas compartan la misma base local.
const RUN = randomUUID().slice(0, 8);
let counter = 0;

export function uniqueId(prefix: string): string {
  counter += 1;
  return `it-${prefix}-${RUN}-${counter}`;
}

export function newUuid(): string {
  return randomUUID();
}

/** wa_id numerico de 8-15 digitos, unico por llamada (la tabla de flags lo exige). */
export function uniqueWaId(): string {
  return `5079${String(randomInt(0, 1e7)).padStart(7, '0')}`;
}

/** Fecha YYYY-MM-DD desplazada `days` dias desde hoy. */
export function isoDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Lanza si la consulta fallo; devuelve los datos ya sin null. */
export function unwrap<T>(result: Result<T>, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message} (${result.error.code ?? 'sin codigo'})`);
  if (result.data === null) throw new Error(`${label}: respuesta vacia`);
  return result.data;
}

/** Argumentos de `create_venta_payment` (renovacion de 30 dias, 10 USD) con sobrescrituras. */
export function renewalArgs(
  catalog: Catalog,
  ventaId: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    p_venta_id: ventaId,
    p_fecha_inicio: isoDate(30),
    p_fecha_fin: isoDate(60),
    p_ciclo_pago: 'mensual',
    p_precio_original: 10,
    p_descuento: 0,
    p_total_original: 10,
    p_moneda_original: 'USD',
    p_total_usd: 10,
    p_exchange_rate: 1,
    p_metodo_pago_id: catalog.metodoPagoId,
    p_metodo_pago_nombre_snapshot: 'Efectivo fixture',
    p_fecha_pago: new Date().toISOString(),
    p_pago_notas: null,
    p_plan_id: catalog.planId,
    p_plan_nombre_snapshot: 'Plan fixture',
    p_plan_tipo_nombre_snapshot: 'Tipo fixture',
    p_idempotency_key: newUuid(),
    ...overrides,
  };
}

/** Crea datos con service role y los borra al final de la suite (en orden de FKs). */
export class FixtureScope {
  private client: SupabaseClient | null = null;
  private readonly users: string[] = [];
  private readonly catalogs: Catalog[] = [];
  private readonly ventaIds: string[] = [];
  private readonly waIds: string[] = [];

  // Perezoso: el cuerpo de `describe.skipIf` se ejecuta aunque la suite se salte, y sin variables no hay cliente.
  get service(): SupabaseClient {
    this.client ??= createServiceClient();
    return this.client;
  }

  /** Usuario real de Auth; el trigger crea su fila en `usuarios` y aqui se ajustan role/active. */
  async createUser(options: { role?: Role; active?: boolean } = {}): Promise<TestUser> {
    const role = options.role ?? 'operador';
    const active = options.active ?? true;
    const email = `${uniqueId('user')}@example.test`;
    const password = `Pw-${randomUUID()}`;
    const created = await this.service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: email },
    });
    if (created.error || !created.data.user) throw new Error(`createUser: ${created.error?.message ?? 'sin usuario'}`);
    const id = created.data.user.id;
    this.users.push(id);
    unwrap(await this.service.from('usuarios').update({ role, active }).eq('id', id).select('id'), 'ajustar usuario');
    return { id, email, password, role, active };
  }

  /** Metodo de pago, categoria, plan, tercero cliente y servicio con perfiles. */
  async createCatalog(): Promise<Catalog> {
    const db = this.service;
    const categoriaId = uniqueId('cat');
    const planTipoId = uniqueId('plantipo');
    const planId = uniqueId('plan');
    const metodoPagoId = uniqueId('metodo');
    const servicioId = uniqueId('servicio');
    const terceroId = uniqueId('tercero');
    const phone = `6${String(randomInt(0, 1e7)).padStart(7, '0')}`;
    const catalog: Catalog = { categoriaId, planTipoId, planId, metodoPagoId, servicioId, terceroId };
    this.catalogs.push(catalog);
    unwrap(await db.from('categorias').insert({ id: categoriaId, nombre: categoriaId, tipo: 'cliente' }).select('id'), 'categoria');
    unwrap(await db.from('planes_tipos').insert({ id: planTipoId, categoria_id: categoriaId, nombre: planTipoId }).select('id'), 'plan tipo');
    unwrap(
      await db
        .from('planes')
        .insert({ id: planId, categoria_id: categoriaId, plan_tipo_id: planTipoId, nombre: planId, precio: 10, ciclo_pago: 'mensual' })
        .select('id'),
      'plan'
    );
    unwrap(
      await db
        .from('metodos_pago')
        .insert({ id: metodoPagoId, nombre: 'Efectivo fixture', tipo: 'efectivo', moneda: 'USD', titular: 'Fixture', identificador: metodoPagoId })
        .select('id'),
      'metodo de pago'
    );
    unwrap(
      await db
        .from('servicios')
        .insert({ id: servicioId, categoria_id: categoriaId, nombre: servicioId, correo: 'fixture@example.test', contrasena: 'fixture-local', perfiles_disponibles: 10 })
        .select('id'),
      'servicio'
    );
    unwrap(
      await db.from('terceros').insert({ id: terceroId, nombre: 'Fixture', apellido: 'Cliente', tipo: 'cliente', telefono: phone }).select('id'),
      'tercero'
    );
    return catalog;
  }

  /** Venta con periodo inicial y pago, creada con el RPC real (SECURITY INVOKER: exige un usuario activo). */
  async createVenta(client: SupabaseClient, catalog: Catalog): Promise<TestVenta> {
    const created = await client.rpc('create_venta_with_initial_payment', {
      p_cliente_id: catalog.terceroId,
      p_servicio_id: catalog.servicioId,
      p_categoria_id: catalog.categoriaId,
      p_estado: 'activo',
      p_perfil_numero: null,
      p_perfil_nombre: null,
      p_codigo: null,
      p_notas: null,
      p_fecha_inicio: isoDate(0),
      p_fecha_fin: isoDate(30),
      p_ciclo_pago: 'mensual',
      p_precio_original: 10,
      p_descuento: 0,
      p_total_original: 10,
      p_moneda_original: 'USD',
      p_total_usd: 10,
      p_exchange_rate: 1,
      p_metodo_pago_id: catalog.metodoPagoId,
      p_metodo_pago_nombre_snapshot: 'Efectivo fixture',
      p_fecha_pago: new Date().toISOString(),
      p_pago_notas: null,
      p_plan_id: catalog.planId,
      p_plan_nombre_snapshot: 'Plan fixture',
      p_plan_tipo_nombre_snapshot: 'Tipo fixture',
      p_idempotency_key: newUuid(),
    });
    const ventaId = unwrap<string>(created, 'create_venta_with_initial_payment');
    this.ventaIds.push(ventaId);
    const periodo = unwrap<Row>(await this.service.from('venta_periodos').select('id').eq('venta_id', ventaId).single(), 'periodo inicial');
    const pago = unwrap<Row>(await this.service.from('pagos_venta').select('id').eq('venta_id', ventaId).single(), 'pago inicial');
    return { ventaId, periodoId: String(periodo.id), pagoId: String(pago.id) };
  }

  /** Registra un wa_id para borrar sus mensajes, marcadores y avisos al terminar. */
  trackWaId(waId: string): string {
    this.waIds.push(waId);
    return waId;
  }

  async cleanup(): Promise<void> {
    const db = this.service;
    const terceroIds = this.catalogs.map((c) => c.terceroId);
    const step = async (label: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
      try {
        const { error } = await run();
        if (error) console.warn(`[integration] limpieza ${label}: ${error.message}`);
      } catch (error) {
        console.warn(`[integration] limpieza ${label}:`, error);
      }
    };
    if (this.waIds.length > 0) {
      await step('flags', () => db.from('whatsapp_conversation_flags').delete().in('wa_id', this.waIds));
      await step('lecturas', () => db.from('whatsapp_conversation_reads').delete().in('wa_id', this.waIds));
      await step('entrantes', () => db.from('whatsapp_inbound_messages').delete().in('from_wa_id', this.waIds));
      await step('salientes', () => db.from('whatsapp_outbound_messages').delete().in('to_wa_id', this.waIds));
    }
    if (terceroIds.length > 0) {
      await step('avisos', () => db.from('whatsapp_notices').delete().in('tercero_id', terceroIds));
    }
    if (this.ventaIds.length > 0) {
      await step('avisos-ventas', () => db.from('whatsapp_notice_ventas').delete().in('venta_id', this.ventaIds));
      await step('pagos', () => db.from('pagos_venta').delete().in('venta_id', this.ventaIds));
      await step('periodos', () => db.from('venta_periodos').delete().in('venta_id', this.ventaIds));
      await step('ventas', () => db.from('ventas').delete().in('id', this.ventaIds));
    }
    for (const catalog of this.catalogs) {
      await step('tercero', () => db.from('terceros').delete().eq('id', catalog.terceroId));
      await step('servicio', () => db.from('servicios').delete().eq('id', catalog.servicioId));
      await step('plan', () => db.from('planes').delete().eq('id', catalog.planId));
      await step('plan tipo', () => db.from('planes_tipos').delete().eq('id', catalog.planTipoId));
      await step('categoria', () => db.from('categorias').delete().eq('id', catalog.categoriaId));
      await step('metodo', () => db.from('metodos_pago').delete().eq('id', catalog.metodoPagoId));
    }
    if (this.users.length > 0) {
      await step('claves idempotentes', () => db.from('rpc_idempotency_keys').delete().in('created_by', this.users));
    }
    for (const id of this.users) {
      await step('usuario', async () => ({ error: (await db.auth.admin.deleteUser(id)).error }));
    }
  }
}
