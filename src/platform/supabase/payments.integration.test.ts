import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createUserClient } from '@/test/integration/clients';
import { requireIntegrationEnv } from '@/test/integration/env';
import {
  FixtureScope,
  isoDate,
  newUuid,
  renewalArgs,
  unwrap,
  type Catalog,
} from '@/test/integration/fixtures';

// Renovaciones con el RPC real `create_venta_payment` (el mismo que usa createVentaPaymentRpc).
describe.skipIf(requireIntegrationEnv() === null)('integracion: pagos y renovaciones de ventas', () => {
  const scope = new FixtureScope();
  let admin: SupabaseClient;
  let catalog: Catalog;

  const periodos = async (ventaId: string) =>
    unwrap(
      await scope.service.from('venta_periodos').select('numero_periodo, tipo, fecha_fin').eq('venta_id', ventaId).order('numero_periodo'),
      'periodos'
    );
  const pagos = async (ventaId: string) =>
    unwrap(await scope.service.from('pagos_venta').select('id, estado, monto_usd, venta_periodo_id').eq('venta_id', ventaId), 'pagos');
  const renew = (ventaId: string, overrides: Record<string, unknown> = {}) =>
    admin.rpc('create_venta_payment', renewalArgs(catalog, ventaId, overrides));

  beforeAll(async () => {
    const user = await scope.createUser({ role: 'admin' });
    admin = await createUserClient(user.email, user.password);
    catalog = await scope.createCatalog();
  });

  afterAll(async () => {
    await admin?.auth.signOut();
    await scope.cleanup();
  });

  it('renueva una venta: crea el periodo 2 y un pago registrado, y las vistas lo reflejan', async () => {
    const venta = await scope.createVenta(admin, catalog);
    const pagoId = unwrap<string>(await renew(venta.ventaId), 'create_venta_payment');

    expect(await periodos(venta.ventaId)).toEqual([
      expect.objectContaining({ numero_periodo: 1, tipo: 'inicial' }),
      expect.objectContaining({ numero_periodo: 2, tipo: 'renovacion', fecha_fin: isoDate(60) }),
    ]);
    const filas = await pagos(venta.ventaId);
    expect(filas).toHaveLength(2);
    expect(filas.find((fila) => fila.id === pagoId)).toMatchObject({ estado: 'registrado' });

    // Proyecciones: la ficha de la venta apunta al ultimo periodo y el pago aparece en la vista de pagos.
    const ficha = unwrap(
      await admin.from('v_ventas_full').select('ultimo_numero_periodo, ultima_fecha_fin, renovaciones').eq('id', venta.ventaId).single(),
      'v_ventas_full'
    );
    expect(ficha).toMatchObject({ ultimo_numero_periodo: 2, ultima_fecha_fin: isoDate(60), renovaciones: 1 });
    const vista = unwrap(
      await admin.from('v_pagos_venta_full').select('numero_periodo, estado').eq('id', pagoId).single(),
      'v_pagos_venta_full'
    );
    expect(vista).toMatchObject({ numero_periodo: 2, estado: 'registrado' });
  });

  it('la misma idempotencyKey en paralelo produce un solo pago y un solo periodo', async () => {
    const venta = await scope.createVenta(admin, catalog);
    const key = newUuid();

    const resultados = await Promise.all(
      Array.from({ length: 5 }, () => renew(venta.ventaId, { p_idempotency_key: key }))
    );
    const ids = resultados.map((resultado, index) => unwrap<string>(resultado, `renovacion paralela ${index}`));

    expect(new Set(ids).size).toBe(1);
    expect(await periodos(venta.ventaId)).toHaveLength(2);
    expect(await pagos(venta.ventaId)).toHaveLength(2);
    const claves = unwrap(
      await scope.service.from('rpc_idempotency_keys').select('result_id').eq('idempotency_key', key).eq('rpc_name', 'create_venta_payment'),
      'rpc_idempotency_keys'
    );
    expect(claves).toEqual([{ result_id: ids[0] }]);

    // Un reintento posterior sigue devolviendo el mismo pago sin crear otro.
    expect(unwrap<string>(await renew(venta.ventaId, { p_idempotency_key: key }), 'reintento')).toBe(ids[0]);
    expect(await pagos(venta.ventaId)).toHaveLength(2);
  });

  it('claves distintas en paralelo producen pagos y periodos distintos y consecutivos', async () => {
    const venta = await scope.createVenta(admin, catalog);

    const resultados = await Promise.all(Array.from({ length: 3 }, () => renew(venta.ventaId)));
    const ids = resultados.map((resultado, index) => unwrap<string>(resultado, `renovacion ${index}`));

    expect(new Set(ids).size).toBe(3);
    expect((await periodos(venta.ventaId)).map((periodo) => periodo.numero_periodo)).toEqual([1, 2, 3, 4]);
    expect(await pagos(venta.ventaId)).toHaveLength(4);
  });

  it('un fallo a mitad del RPC revierte periodo y pago, y no consume la clave', async () => {
    const venta = await scope.createVenta(admin, catalog);
    const key = newUuid();

    // El periodo se inserta antes que el pago: un metodo de pago inexistente viola la FK del pago (23503)
    // cuando el periodo ya existe dentro de la transaccion de la funcion.
    const fallido = await renew(venta.ventaId, { p_idempotency_key: key, p_metodo_pago_id: uniqueMissingId() });
    expect(fallido.error?.code).toBe('23503');

    expect(await periodos(venta.ventaId)).toHaveLength(1);
    expect(await pagos(venta.ventaId)).toHaveLength(1);
    const ficha = unwrap(await admin.from('v_ventas_full').select('ultimo_numero_periodo, ultima_fecha_fin').eq('id', venta.ventaId).single(), 'ficha');
    expect(ficha).toMatchObject({ ultimo_numero_periodo: 1, ultima_fecha_fin: isoDate(30) });
    const claves = unwrap(await scope.service.from('rpc_idempotency_keys').select('result_id').eq('idempotency_key', key), 'claves');
    expect(claves).toHaveLength(0);

    // Con la misma clave y datos validos la operacion si se aplica (la clave no quedo quemada).
    const pagoId = unwrap<string>(await renew(venta.ventaId, { p_idempotency_key: key }), 'reintento valido');
    expect((await pagos(venta.ventaId)).map((fila) => fila.id)).toContain(pagoId);
    expect(await periodos(venta.ventaId)).toHaveLength(2);
  });

  it('rechaza una moneda inexistente sin dejar datos parciales', async () => {
    const venta = await scope.createVenta(admin, catalog);

    const fallido = await renew(venta.ventaId, { p_moneda_original: 'ZZZ' });

    expect(fallido.error).not.toBeNull();
    expect(await periodos(venta.ventaId)).toHaveLength(1);
    expect(await pagos(venta.ventaId)).toHaveLength(1);
  });

  it('la renovacion suma al ingreso total del dashboard', async () => {
    const venta = await scope.createVenta(admin, catalog);
    const ingresos = async () => {
      const filas = unwrap<{ ingresos_total: number | string }[] | { ingresos_total: number | string }>(
        await admin.rpc('get_dashboard_stats_live'),
        'get_dashboard_stats_live'
      );
      const fila = Array.isArray(filas) ? filas[0] : filas;
      return Number(fila.ingresos_total);
    };
    const antes = await ingresos();

    unwrap<string>(await renew(venta.ventaId), 'renovacion');

    expect(await ingresos()).toBeCloseTo(antes + 10, 2);
  });
});

function uniqueMissingId(): string {
  return `it-metodo-inexistente-${newUuid()}`;
}
