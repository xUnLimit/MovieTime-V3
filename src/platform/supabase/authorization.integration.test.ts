import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAnonClient, createUserClient } from '@/test/integration/clients';
import { requireIntegrationEnv } from '@/test/integration/env';
import { FixtureScope, renewalArgs, unwrap, type Catalog, type TestUser, type TestVenta } from '@/test/integration/fixtures';

// Autorizacion con usuarios reales de Auth (JWT firmado). Complementa los pgTAP de supabase/tests/database,
// que simulan los claims dentro de una transaccion: aqui se ejerce la ruta completa PostgREST + RLS.
describe.skipIf(requireIntegrationEnv() === null)('integracion: autorizacion con usuarios reales', () => {
  const scope = new FixtureScope();
  let admin: SupabaseClient;
  let operator: SupabaseClient;
  let inactive: SupabaseClient;
  let inactiveUser: TestUser;
  let operatorUser: TestUser;
  let target: TestUser;
  let catalog: Catalog;
  let venta: TestVenta;

  const usuario = async (id: string) =>
    unwrap(await scope.service.from('usuarios').select('role, active').eq('id', id).single(), 'usuario');

  beforeAll(async () => {
    const adminUser = await scope.createUser({ role: 'admin' });
    operatorUser = await scope.createUser({ role: 'operador' });
    inactiveUser = await scope.createUser({ role: 'operador', active: false });
    target = await scope.createUser({ role: 'operador' });
    admin = await createUserClient(adminUser.email, adminUser.password);
    operator = await createUserClient(operatorUser.email, operatorUser.password);
    inactive = await createUserClient(inactiveUser.email, inactiveUser.password);
    catalog = await scope.createCatalog();
    venta = await scope.createVenta(admin, catalog);
  });

  afterAll(async () => {
    await Promise.all([admin, operator, inactive].map((client) => client?.auth.signOut()));
    await scope.cleanup();
  });

  it('un operador activo lee ventas, pagos y ficha de ventas', async () => {
    const ventas = unwrap(await operator.from('ventas').select('id').eq('id', venta.ventaId), 'ventas');
    const pagos = unwrap(await operator.from('pagos_venta').select('id').eq('venta_id', venta.ventaId), 'pagos');
    const ficha = unwrap(await operator.from('v_ventas_full').select('id').eq('id', venta.ventaId), 'v_ventas_full');
    expect([ventas.length, pagos.length, ficha.length]).toEqual([1, 1, 1]);
  });

  it('un operador activo puede renovar con el RPC de pagos', async () => {
    const pagoId = unwrap<string>(await operator.rpc('create_venta_payment', renewalArgs(catalog, venta.ventaId)), 'renovacion');
    expect(typeof pagoId).toBe('string');
  });

  it('un operador INACTIVO con JWT vigente no ve ventas ni pagos y no puede escribir', async () => {
    const ventas = await inactive.from('ventas').select('id').eq('id', venta.ventaId);
    const pagos = await inactive.from('pagos_venta').select('id').eq('venta_id', venta.ventaId);
    const ficha = await inactive.from('v_ventas_full').select('id').eq('id', venta.ventaId);
    // Segun el rol/grant puede ser 0 filas o un error de permisos: nunca datos.
    expect(ventas.data ?? []).toHaveLength(0);
    expect(pagos.data ?? []).toHaveLength(0);
    expect(ficha.data ?? []).toHaveLength(0);

    const renovacion = await inactive.rpc('create_venta_payment', renewalArgs(catalog, venta.ventaId));
    expect(renovacion.error).not.toBeNull();
    const escritura = await inactive
      .from('terceros')
      .insert({ id: `${catalog.terceroId}-inactivo`, nombre: 'No', apellido: 'Permitido', tipo: 'cliente', telefono: '60000000' })
      .select('id');
    expect(escritura.data ?? []).toHaveLength(0);
    expect(escritura.error).not.toBeNull();
  });

  it('un operador inactivo no puede reactivarse ni un operador activo elevarse a admin', async () => {
    await inactive.from('usuarios').update({ active: true }).eq('id', inactiveUser.id).select('id');
    expect(await usuario(inactiveUser.id)).toMatchObject({ active: false, role: 'operador' });

    await operator.from('usuarios').update({ role: 'admin' }).eq('id', operatorUser.id).select('id');
    expect(await usuario(operatorUser.id)).toMatchObject({ role: 'operador', active: true });
  });

  it('un admin activo cambia el active de otro usuario y lo restaura', async () => {
    const desactivado = unwrap(await admin.from('usuarios').update({ active: false }).eq('id', target.id).select('id, active'), 'desactivar');
    expect(desactivado).toEqual([{ id: target.id, active: false }]);
    expect(await usuario(target.id)).toMatchObject({ active: false });

    const reactivado = unwrap(await admin.from('usuarios').update({ active: true }).eq('id', target.id).select('id, active'), 'reactivar');
    expect(reactivado).toEqual([{ id: target.id, active: true }]);
    expect(await usuario(target.id)).toMatchObject({ active: true });
  });

  it('un cliente anonimo no lee tablas ni ejecuta RPC de negocio', async () => {
    const anon = createAnonClient();
    for (const tabla of ['ventas', 'pagos_venta', 'terceros', 'usuarios', 'rpc_idempotency_keys']) {
      const respuesta = await anon.from(tabla).select('*').limit(1);
      expect(respuesta.data ?? [], tabla).toHaveLength(0);
    }
    const renovacion = await anon.rpc('create_venta_payment', renewalArgs(catalog, venta.ventaId));
    expect(renovacion.error).not.toBeNull();
    const conversaciones = await anon.from('v_whatsapp_conversations').select('wa_id').limit(1);
    expect(conversaciones.data ?? []).toHaveLength(0);
  });
});
