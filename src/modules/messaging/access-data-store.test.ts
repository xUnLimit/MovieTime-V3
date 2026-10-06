import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({
  createServiceRoleClient: vi.fn(),
}));

import { createAccessDataStore } from './access-data-store';

type Result = { data?: unknown; error?: { code: string } | null };

function fakeClient(results: Record<string, Result>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const result = { data: results[table]?.data ?? null, error: results[table]?.error ?? null };
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'gte', 'limit']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
      return builder;
    },
  };
  return { client: client as never, calls };
}

const waId = '50765331751';
const venta = (overrides: object = {}) => ({
  id: 'v1', servicio_id: 's1', servicio_nombre: 'Disney+ Premium', categoria_nombre: 'Disney+', perfil_nombre: 'Ana', ultimo_periodo_id: 'p1', ...overrides,
});
const inUse = (id = 's1') => ({ id, activo: true, en_reposo: false, cortado_at: null, archivado_at: null });

describe('createAccessDataStore.eligibleSales', () => {
  it('devuelve las ventas activas y vigentes del único cliente con ese número', async () => {
    const { client, calls } = fakeClient({
      terceros: { data: [{ id: 'c1' }] },
      v_ventas_full: { data: [venta(), venta({ id: 'v2', servicio_id: 's2', servicio_nombre: '', categoria_nombre: 'Max', perfil_nombre: null, ultimo_periodo_id: null })] },
      servicios: { data: [inUse('s1'), inUse('s2')] },
      mt_service_access: { data: [{ service_id: 's2', mode: 'code' }, { service_id: 's1', mode: 'password' }] },
      pagos_venta: { data: [] },
    });
    await expect(createAccessDataStore(client).eligibleSales(waId)).resolves.toEqual({
      clienteId: 'c1',
      sales: [
        { saleId: 'v1', service: 'Disney+', profile: 'Ana', codeOnly: false },
        { saleId: 'v2', service: 'Max', profile: '', codeOnly: true },
      ],
    });
    expect(calls).toContainEqual({ table: 'terceros', method: 'eq', args: ['wa_id', waId] });
    expect(calls).toContainEqual({ table: 'terceros', method: 'eq', args: ['active', true] });
    expect(calls).toContainEqual({ table: 'v_ventas_full', method: 'eq', args: ['cliente_id', 'c1'] });
    expect(calls).toContainEqual({ table: 'v_ventas_full', method: 'eq', args: ['estado', 'activo'] });
  });

  it('un número que no es exactamente un cliente activo no tiene ventas', async () => {
    for (const people of [[], [{ id: 'c1' }, { id: 'c2' }], null]) {
      const { client, calls } = fakeClient({ terceros: { data: people } });
      await expect(createAccessDataStore(client).eligibleSales(waId)).resolves.toEqual({ clienteId: null, sales: [] });
      expect(calls.some((call) => call.table === 'v_ventas_full')).toBe(false);
    }
  });

  it('sin ventas vigentes no consulta nada más', async () => {
    const { client, calls } = fakeClient({ terceros: { data: [{ id: 'c1' }] }, v_ventas_full: { data: [venta({ id: null }), venta({ servicio_id: null })] } });
    await expect(createAccessDataStore(client).eligibleSales(waId)).resolves.toEqual({ clienteId: 'c1', sales: [] });
    expect(calls.some((call) => call.table === 'servicios')).toBe(false);
  });

  it('descarta los servicios en reposo, cortados, archivados o apagados', async () => {
    const { client } = fakeClient({
      terceros: { data: [{ id: 'c1' }] },
      v_ventas_full: { data: [venta({ id: 'a', servicio_id: 'sa' }), venta({ id: 'b', servicio_id: 'sb' }), venta({ id: 'c', servicio_id: 'sc' }), venta({ id: 'd', servicio_id: 'sd' }), venta({ id: 'e', servicio_id: 'se' })] },
      servicios: { data: [inUse('sa'), { ...inUse('sb'), en_reposo: true }, { ...inUse('sc'), cortado_at: '2026-10-01' }, { ...inUse('sd'), archivado_at: '2026-10-01' }, { ...inUse('se'), activo: false }] },
      mt_service_access: { data: [] },
    });
    const { sales } = await createAccessDataStore(client).eligibleSales(waId);
    expect(sales.map((sale) => sale.saleId)).toEqual(['a']);
  });

  it('descarta las ventas cuyo último periodo fue reembolsado', async () => {
    const { client } = fakeClient({
      terceros: { data: [{ id: 'c1' }] },
      v_ventas_full: { data: [venta({ id: 'a', ultimo_periodo_id: 'pa' }), venta({ id: 'b', ultimo_periodo_id: 'pb' })] },
      servicios: { data: [inUse('s1')] }, mt_service_access: { data: [] },
      pagos_venta: { data: [{ venta_periodo_id: 'pb' }] },
    });
    const { sales } = await createAccessDataStore(client).eligibleSales(waId);
    expect(sales.map((sale) => sale.saleId)).toEqual(['a']);
  });

  it('un error de la base de datos se propaga con su operación y sin datos del cliente', async () => {
    const failures: Array<[Record<string, Result>, string]> = [
      [{ terceros: { error: { code: 'X1' } } }, 'customer lookup'],
      [{ terceros: { data: [{ id: 'c1' }] }, v_ventas_full: { error: { code: 'X2' } } }, 'sales lookup'],
      [{ terceros: { data: [{ id: 'c1' }] }, v_ventas_full: { data: [venta()] }, servicios: { error: { code: 'X3' } }, mt_service_access: { data: [] }, pagos_venta: { data: [] } }, 'service state lookup'],
      [{ terceros: { data: [{ id: 'c1' }] }, v_ventas_full: { data: [venta()] }, servicios: { data: [inUse()] }, mt_service_access: { error: { code: 'X4' } }, pagos_venta: { data: [] } }, 'access policy lookup'],
      [{ terceros: { data: [{ id: 'c1' }] }, v_ventas_full: { data: [venta()] }, servicios: { data: [inUse()] }, mt_service_access: { data: [] }, pagos_venta: { error: { code: 'X5' } } }, 'refund lookup'],
    ];
    for (const [results, operation] of failures) {
      await expect(createAccessDataStore(fakeClient(results).client).eligibleSales(waId)).rejects.toThrow(`Access data store ${operation} failed`);
    }
  });
});
