import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createUserClient } from '@/test/integration/clients';
import { requireIntegrationEnv } from '@/test/integration/env';
import { FixtureScope, newUuid, unwrap, type Catalog } from '@/test/integration/fixtures';

// Reembolsos con el RPC real `create_venta_refund` (el mismo que usa createVentaRefundRpc).
describe.skipIf(requireIntegrationEnv() === null)('integracion: reembolsos de ventas', () => {
  const scope = new FixtureScope();
  let admin: SupabaseClient;
  let catalog: Catalog;

  const refund = (ventaId: string, overrides: Record<string, unknown> = {}) =>
    admin.rpc('create_venta_refund', {
      p_venta_id: ventaId,
      p_monto_original: 4,
      p_moneda_original: 'USD',
      p_monto_usd: 4,
      p_exchange_rate: 1,
      p_metodo_pago_id: catalog.metodoPagoId,
      p_metodo_pago_nombre_snapshot: 'Efectivo fixture',
      p_destino_reembolso: 'Cuenta del cliente 123',
      p_fecha_reembolso: new Date().toISOString(),
      p_nota: 'Reembolso de prueba',
      p_cortar: false,
      p_motivo_corte: null,
      p_idempotency_key: newUuid(),
      ...overrides,
    });
  const pagos = async (ventaId: string) =>
    unwrap(
      await scope.service
        .from('pagos_venta')
        .select('id, estado, monto_usd, destino_reembolso, anulada_at, venta_periodo_id')
        .eq('venta_id', ventaId),
      'pagos'
    );

  beforeAll(async () => {
    const user = await scope.createUser({ role: 'admin' });
    admin = await createUserClient(user.email, user.password);
    catalog = await scope.createCatalog();
  });

  afterAll(async () => {
    await admin?.auth.signOut();
    await scope.cleanup();
  });

  it('reembolsa parte del pago: nuevo registro reembolsado, periodo y pago original intactos', async () => {
    const venta = await scope.createVenta(admin, catalog);

    const refundId = unwrap<string>(await refund(venta.ventaId), 'create_venta_refund');

    const filas = await pagos(venta.ventaId);
    expect(filas).toHaveLength(2);
    expect(filas.find((fila) => fila.id === refundId)).toMatchObject({
      estado: 'reembolsado',
      destino_reembolso: 'Cuenta del cliente 123',
      venta_periodo_id: venta.periodoId,
    });
    expect(Number(filas.find((fila) => fila.id === refundId)?.monto_usd)).toBe(4);
    expect(filas.find((fila) => fila.id === refundId)?.anulada_at).not.toBeNull();
    expect(filas.find((fila) => fila.id === venta.pagoId)).toMatchObject({ estado: 'registrado', anulada_at: null });
    const periodos = unwrap(await scope.service.from('venta_periodos').select('id').eq('venta_id', venta.ventaId), 'periodos');
    expect(periodos).toHaveLength(1);

    // Proyeccion de pagos: el reembolso aparece como tal con su cuenta destino.
    const vista = unwrap(
      await admin.from('v_pagos_venta_full').select('estado, destino_reembolso').eq('id', refundId).single(),
      'v_pagos_venta_full'
    );
    expect(vista).toMatchObject({ estado: 'reembolsado', destino_reembolso: 'Cuenta del cliente 123' });
  });

  it('la misma clave en paralelo no duplica el reembolso', async () => {
    const venta = await scope.createVenta(admin, catalog);
    const key = newUuid();

    const resultados = await Promise.all(Array.from({ length: 5 }, () => refund(venta.ventaId, { p_idempotency_key: key })));
    const ids = resultados.map((resultado, index) => unwrap<string>(resultado, `reembolso ${index}`));

    expect(new Set(ids).size).toBe(1);
    const reembolsos = (await pagos(venta.ventaId)).filter((fila) => fila.estado === 'reembolsado');
    expect(reembolsos).toHaveLength(1);
  });

  it('rechaza un reembolso que supera el saldo, sin cuenta destino o sin motivo de corte', async () => {
    const venta = await scope.createVenta(admin, catalog);

    const excedido = await refund(venta.ventaId, { p_monto_original: 11, p_monto_usd: 11 });
    expect(excedido.error?.message).toContain('supera el saldo');
    const sinDestino = await refund(venta.ventaId, { p_destino_reembolso: '  ' });
    expect(sinDestino.error?.message).toContain('cuenta destino');
    const sinMotivo = await refund(venta.ventaId, { p_cortar: true, p_motivo_corte: null });
    expect(sinMotivo.error?.message).toContain('motivo de corte');

    expect((await pagos(venta.ventaId)).filter((fila) => fila.estado === 'reembolsado')).toHaveLength(0);
    const estado = unwrap(await scope.service.from('ventas').select('estado').eq('id', venta.ventaId).single(), 'venta');
    expect(estado).toMatchObject({ estado: 'activo' });
  });

  it('no permite reembolsar mas del saldo acumulado y puede cortar la venta con el ultimo reembolso', async () => {
    const venta = await scope.createVenta(admin, catalog);
    unwrap<string>(await refund(venta.ventaId), 'primer reembolso (4 de 10)');

    const excedido = await refund(venta.ventaId, { p_monto_original: 7, p_monto_usd: 7 });
    expect(excedido.error?.message).toContain('supera el saldo');

    unwrap<string>(
      await refund(venta.ventaId, { p_monto_original: 6, p_monto_usd: 6, p_cortar: true, p_motivo_corte: 'Cliente cancela' }),
      'ultimo reembolso con corte'
    );
    const fila = unwrap<Record<string, unknown>>(
      await scope.service.from('ventas').select('estado, cortada_at, motivo_corte').eq('id', venta.ventaId).single(),
      'venta cortada'
    );
    expect(fila).toMatchObject({ estado: 'inactivo', motivo_corte: 'Cliente cancela' });
    expect(fila.cortada_at).not.toBeNull();
  });
});
