import { randomInt, randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { uniqueId } from './env';
import { assertOk, assertRow, bestEffort } from './supabase';

/** Fecha local YYYY-MM-DD desplazada `offsetDays` dias desde hoy. */
export function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const usedLast4 = new Set<string>();

/** Ultimos 4 digitos de telefono unicos dentro del proceso (el match de Yappy se basa en ellos). */
function uniqueLast4(): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = String(randomInt(1000, 10000));
    if (!usedLast4.has(candidate)) {
      usedLast4.add(candidate);
      return candidate;
    }
  }
  throw new Error('No se pudo generar un telefono unico para la prueba.');
}

export type Catalog = {
  runId: string;
  metodoId: string;
  metodoNombre: string;
  categoriaId: string;
  categoriaNombre: string;
  planTipoId: string;
  planId: string;
  planNombre: string;
  planPrecio: number;
  terceroId: string;
  terceroNombre: string;
  terceroApellido: string;
  telefono: string;
  last4: string;
  servicioId: string;
  servicioNombre: string;
  servicioCorreo: string;
};

/**
 * Siembra (con service role) todo lo que una venta necesita: metodo de pago de tercero, categoria,
 * tipo de plan, plan mensual, tercero con ese metodo y un servicio con perfiles libres.
 * Todos los nombres llevan un id unico para localizarlos en la UI sin ambiguedad.
 */
export async function seedCatalog(admin: SupabaseClient, options: { perfiles?: number } = {}): Promise<Catalog> {
  const runId = uniqueId();
  const last4 = uniqueLast4();
  const planPrecio = 10;

  const metodoNombre = `E2E Efectivo ${runId}`;
  const metodo = assertRow(
    await admin.from('metodos_pago').insert({
      nombre: metodoNombre, tipo: 'efectivo', moneda: 'USD', titular: 'E2E', identificador: `e2e-${runId}`,
      asociado_a: 'tercero', activo: true,
    }).select('id').single(),
    'sembrar metodo de pago',
  );
  const categoriaNombre = `E2E Categoria ${runId}`;
  const categoria = assertRow(
    await admin.from('categorias').insert({
      nombre: categoriaNombre, tipo: 'cliente', tipo_categoria: 'plataforma_streaming', activo: true,
    }).select('id').single(),
    'sembrar categoria',
  );
  const planTipo = assertRow(
    await admin.from('planes_tipos').insert({ categoria_id: categoria.data.id, nombre: `Perfil ${runId}`, orden: 1, activo: true })
      .select('id').single(),
    'sembrar tipo de plan',
  );
  const planNombre = `E2E Plan ${runId}`;
  const plan = assertRow(
    await admin.from('planes').insert({
      categoria_id: categoria.data.id, plan_tipo_id: planTipo.data.id, nombre: planNombre,
      precio: planPrecio, ciclo_pago: 'mensual', orden: 1, activo: true,
    }).select('id').single(),
    'sembrar plan',
  );
  const terceroNombre = `E2E${runId}`;
  const telefono = `+507 6000-${last4}`;
  const tercero = assertRow(
    await admin.from('terceros').insert({
      nombre: terceroNombre, apellido: 'Cliente', tipo: 'cliente', telefono, metodo_pago_id: metodo.data.id, active: true,
    }).select('id').single(),
    'sembrar tercero',
  );
  const servicioNombre = `E2E Servicio ${runId}`;
  const servicioCorreo = `e2e-${runId}@example.com`;
  const servicio = assertRow(
    await admin.from('servicios').insert({
      categoria_id: categoria.data.id, plan_tipo_id: planTipo.data.id, nombre: servicioNombre, correo: servicioCorreo,
      contrasena: 'e2e-secret', perfiles_disponibles: options.perfiles ?? 4, activo: true,
    }).select('id').single(),
    'sembrar servicio',
  );

  return {
    runId, metodoId: metodo.data.id, metodoNombre, categoriaId: categoria.data.id, categoriaNombre,
    planTipoId: planTipo.data.id, planId: plan.data.id, planNombre, planPrecio,
    terceroId: tercero.data.id, terceroNombre, terceroApellido: 'Cliente', telefono, last4,
    servicioId: servicio.data.id, servicioNombre, servicioCorreo,
  };
}

/** Crea una venta con su pago inicial por el mismo RPC atomico que usa la app (como admin autenticado). */
export async function createVentaRpc(
  adminUser: SupabaseClient,
  catalog: Catalog,
  options: { perfil: number; fechaFin?: string; total?: number },
): Promise<string> {
  const total = options.total ?? catalog.planPrecio;
  const { data, error } = await adminUser.rpc('create_venta_with_initial_payment', {
    p_cliente_id: catalog.terceroId,
    p_servicio_id: catalog.servicioId,
    p_categoria_id: catalog.categoriaId,
    p_estado: 'activo',
    p_perfil_numero: options.perfil,
    p_perfil_nombre: null,
    p_codigo: null,
    p_notas: null,
    p_fecha_inicio: isoDate(0),
    p_fecha_fin: options.fechaFin ?? isoDate(30),
    p_ciclo_pago: 'mensual',
    p_precio_original: total,
    p_descuento: 0,
    p_total_original: total,
    p_moneda_original: 'USD',
    p_total_usd: total,
    p_exchange_rate: null,
    p_metodo_pago_id: catalog.metodoId,
    p_metodo_pago_nombre_snapshot: catalog.metodoNombre,
    p_fecha_pago: isoDate(0),
    p_pago_notas: null,
    p_plan_id: catalog.planId,
    p_plan_nombre_snapshot: catalog.planNombre,
    p_plan_tipo_nombre_snapshot: `Perfil ${catalog.runId}`,
    p_idempotency_key: randomUUID(),
  });
  if (error) throw new Error(`create_venta_with_initial_payment: ${error.message}`);
  if (typeof data !== 'string' || !data) throw new Error('create_venta_with_initial_payment no devolvio un id');
  return data;
}

/** Id de la venta del tercero sembrado (la mas reciente). */
export async function findVentaId(admin: SupabaseClient, catalog: Catalog): Promise<string> {
  const { data, error } = await admin.from('ventas').select('id').eq('cliente_id', catalog.terceroId)
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw new Error(`buscar venta: ${error.message}`);
  const id = data?.[0]?.id;
  if (!id) throw new Error(`No hay ventas del tercero ${catalog.terceroNombre}`);
  return String(id);
}

/**
 * Limpieza del catalogo. Las ventas se borran por el RPC de la app (pagos, periodos y notificaciones
 * incluidos); lo demas, con service role y en orden de dependencias. Es best-effort.
 */
export async function cleanupCatalog(admin: SupabaseClient, adminUser: SupabaseClient, catalog: Catalog): Promise<void> {
  await bestEffort('borrar ventas', async () => {
    const { data } = await admin.from('ventas').select('id').eq('cliente_id', catalog.terceroId);
    await (data ?? []).reduce(async (previous, row) => {
      // Las ventas comparten servicio: conservar el orden de los RPC de limpieza.
      await previous;
      const id = String(row.id);
      const { error } = await adminUser.rpc('delete_venta_with_payments', { p_venta_id: id, p_delete_payments: true });
      if (error) {
        await admin.from('pagos_venta').delete().eq('venta_id', id);
        await admin.from('venta_periodos').delete().eq('venta_id', id);
        assertOk(await admin.from('ventas').delete().eq('id', id), 'borrar venta');
      }
    }, Promise.resolve());
  });
  await bestEffort('borrar servicio', async () => assertOk(await admin.from('servicios').delete().eq('id', catalog.servicioId), 'servicio'));
  await bestEffort('borrar tercero', async () => assertOk(await admin.from('terceros').delete().eq('id', catalog.terceroId), 'tercero'));
  await bestEffort('borrar plan', async () => assertOk(await admin.from('planes').delete().eq('id', catalog.planId), 'plan'));
  await bestEffort('borrar tipo de plan', async () => assertOk(await admin.from('planes_tipos').delete().eq('id', catalog.planTipoId), 'tipo de plan'));
  await bestEffort('borrar categoria', async () => assertOk(await admin.from('categorias').delete().eq('id', catalog.categoriaId), 'categoria'));
  await bestEffort('borrar metodo de pago', async () => assertOk(await admin.from('metodos_pago').delete().eq('id', catalog.metodoId), 'metodo'));
}
