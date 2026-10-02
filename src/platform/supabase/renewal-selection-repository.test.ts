import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { createRenewalSelectionRepository } from './renewal-selection-repository';
const id = '10000000-0000-4000-8000-000000000001';
function fixture() {
  const rows: Record<string, unknown> = {
    renovacion_ajustes: { id: 'global', renovacion_parcial_enabled: false },
    terceros: [{ id }], ventas: [{ id, servicio_id: id, cliente_id: id }],
    venta_periodos: [{ id, venta_id: id, numero_periodo: 1 }], servicios: [{ id, nombre: 'Servicio' }],
    pedidos: { id, total: 5, moneda: 'USD' },
  };
  const failed = new Set<string>();
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const table = new URL(String(input)).pathname.split('/').at(-1) ?? '';
    return new Response(JSON.stringify(failed.has(table) ? { message: 'private failure' } : rows[table]),
      { status: failed.has(table) ? 500 : 200, headers: { 'Content-Type': 'application/json' } });
  });
  const client = createClient<Database>('https://fixture.invalid', 'fixture', {
    global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false },
  });
  return { repository: createRenewalSelectionRepository(client), rows, failed, fetcher };
}
describe('renewal snapshot reads', () => {
  it('reads settings, unique ownership and authoritative totals without credentials', async () => {
    const { repository, fetcher } = fixture();
    expect((await repository.settings()).renovacion_parcial_enabled).toBe(false);
    expect(await repository.ownsCustomer('50760000000', id)).toBe(true);
    expect(await repository.readOrder(id)).toEqual({ id, total: 5, moneda: 'USD' });
    expect(fetcher.mock.calls.map(([url]) => String(url)).join()).not.toContain('contrasena');
  });
  it('rejects ambiguous ownership and tolerates absent orders', async () => {
    const { repository, rows } = fixture(); rows.terceros = [{ id }, { id: 'other' }];
    expect(await repository.ownsCustomer('50760000000', id)).toBe(false);
    rows.pedidos = null; expect(await repository.readOrder(id)).toBeNull();
  });
  it('joins service state and latest period snapshots', async () => {
    const { repository } = fixture();
    const [snapshot] = await repository.snapshots([id]);
    expect(snapshot.venta.id).toBe(id); expect(snapshot.period?.id).toBe(id); expect(snapshot.service?.id).toBe(id);
  });
  it('validates IDs before reads and controls private errors', async () => {
    const { repository, failed, fetcher, rows } = fixture();
    await expect(repository.snapshots(['bad'])).rejects.toThrow();
    await expect(repository.readOrder('bad')).rejects.toThrow();
    await expect(repository.ownsCustomer('50760000000', 'bad')).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    failed.add('pedidos'); await expect(repository.readOrder(id)).rejects.toMatchObject({ code: 'RENEWAL_READ_FAILED' });
    failed.add('ventas'); await expect(repository.snapshots([id])).rejects.toMatchObject({ code: 'RENEWAL_READ_FAILED' });
    rows.renovacion_ajustes = null; await expect(repository.settings()).rejects.toMatchObject({ code: 'RENEWAL_DISABLED' });
  });
});
