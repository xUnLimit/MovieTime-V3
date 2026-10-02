import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./client', () => ({ supabase: { from: mocks.from } }));

import { listNoticeActivityRows, listRecentNotices } from './notice-activity-repository';

type Result = { data?: unknown; count?: number | null; error?: { message: string } | null };

// Chainable fake: every builder method records its call and the awaited value is the configured result.
function query(result: Result) {
  const calls: Array<[string, unknown[]]> = [];
  const final = { data: null, count: null, error: null, ...result };
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'range', 'gte']) {
    builder[method] = (...args: unknown[]) => { calls.push([method, args]); return builder; };
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(final).then(resolve);
  return { builder, calls };
}

beforeEach(() => mocks.from.mockReset());

describe('listNoticeActivityRows', () => {
  it('reads only tipo, status and date since the given moment', async () => {
    const { builder, calls } = query({ data: [{ tipo: 'dia_pago', status: 'accepted', created_at: 't1' }] });
    mocks.from.mockReturnValueOnce(builder);
    await expect(listNoticeActivityRows('2026-09-01T00:00:00.000Z')).resolves.toEqual([{ tipo: 'dia_pago', status: 'accepted', createdAt: 't1' }]);
    expect(mocks.from).toHaveBeenCalledWith('whatsapp_notices');
    expect(calls).toContainEqual(['select', ['tipo,status,created_at']]);
    expect(calls).toContainEqual(['gte', ['created_at', '2026-09-01T00:00:00.000Z']]);
    expect(calls).toContainEqual(['range', [0, 999]]);
  });

  it('keeps paging while the chunks come full', async () => {
    const full = Array.from({ length: 1000 }, () => ({ tipo: 'dia_pago', status: 'failed', created_at: 't' }));
    const first = query({ data: full });
    const second = query({ data: [{ tipo: 'despedida', status: 'skipped', created_at: 't2' }] });
    mocks.from.mockReturnValueOnce(first.builder).mockReturnValueOnce(second.builder);
    const rows = await listNoticeActivityRows('x');
    expect(rows).toHaveLength(1001);
    expect(second.calls).toContainEqual(['range', [1000, 1999]]);
  });

  it('stops after ten chunks and handles null data', async () => {
    const full = Array.from({ length: 1000 }, () => ({ tipo: 'dia_pago', status: 'failed', created_at: 't' }));
    for (let index = 0; index < 10; index += 1) mocks.from.mockReturnValueOnce(query({ data: full }).builder);
    await expect(listNoticeActivityRows('x')).resolves.toHaveLength(10000);
    expect(mocks.from).toHaveBeenCalledTimes(10);
    mocks.from.mockReset();
    mocks.from.mockReturnValueOnce(query({ data: null }).builder);
    await expect(listNoticeActivityRows('x')).resolves.toEqual([]);
  });

  it('hides database messages behind a Spanish error', async () => {
    mocks.from.mockReturnValueOnce(query({ error: { message: 'relation "x" violates rls' } }).builder);
    const failure = await listNoticeActivityRows('x').catch((error: Error) => error);
    expect((failure as Error).message).toBe('No se pudo leer la actividad de los avisos de WhatsApp.');
    expect((failure as Error).message).not.toContain('rls');
  });
});

describe('listRecentNotices', () => {
  const row = {
    id: 'n1', tipo: 'dia_pago', status: 'accepted', origin: 'auto', created_at: '2026-10-01T10:00:00Z', wa_id: '50760000001',
    skip_reason: null, terceros: { nombre: 'Ana', apellido: 'Prueba' },
  };

  it('pages ten at a time, newest first, with the customer name and without message text', async () => {
    const { builder, calls } = query({
      data: [row, { ...row, id: 'n2', origin: 'otro', status: 'raro', terceros: null, skip_reason: 'en_reposo' }],
      count: 25,
    });
    mocks.from.mockReturnValueOnce(builder);
    const page = await listRecentNotices(3, {});
    expect(page).toMatchObject({ total: 25, page: 3, pageSize: 10 });
    expect(page.notices[0]).toEqual({
      id: 'n1', tipo: 'dia_pago', status: 'accepted', origin: 'auto', createdAt: row.created_at, waId: '50760000001',
      clienteNombre: 'Ana Prueba', skipReason: null,
    });
    expect(page.notices[1]).toMatchObject({ origin: 'manual', status: 'pending', clienteNombre: null, skipReason: 'en_reposo' });
    expect(calls).toContainEqual(['range', [20, 29]]);
    expect(calls).toContainEqual(['order', ['created_at', { ascending: false }]]);
    const columns = String((calls.find(([method]) => method === 'select') ?? [])[1]?.[0]);
    expect(columns).not.toMatch(/contenido|body|text|message/);
  });

  it('applies the tipo and status filters and normalizes the page', async () => {
    const { builder, calls } = query({ data: [], count: 0 });
    mocks.from.mockReturnValueOnce(builder);
    const page = await listRecentNotices(0, { tipo: 'despedida', status: 'failed' });
    expect(page).toEqual({ notices: [], total: 0, page: 1, pageSize: 10 });
    expect(calls).toContainEqual(['eq', ['tipo', 'despedida']]);
    expect(calls).toContainEqual(['eq', ['status', 'failed']]);
  });

  it('handles null data and counts, and fails with a generic error', async () => {
    mocks.from.mockReturnValueOnce(query({ data: null, count: null }).builder);
    await expect(listRecentNotices(1, {})).resolves.toMatchObject({ notices: [], total: 0 });
    mocks.from.mockReturnValueOnce(query({ error: { message: 'sql' } }).builder);
    await expect(listRecentNotices(1, {})).rejects.toThrow('No se pudo listar el historial de los avisos de WhatsApp.');
  });
});
