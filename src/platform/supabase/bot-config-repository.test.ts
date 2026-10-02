import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('./client', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));

import {
  getBotMetrics, getBotStatus, getBotVersion, listBotEvents, listBotVersions, publishBotVersion, setBotEnabled,
} from './bot-config-repository';

type Result = { data?: unknown; count?: number | null; error?: { message: string } | null };

// Chainable fake: every builder method records its call and the awaited value is the configured result.
function query(result: Result) {
  const calls: Array<[string, unknown[]]> = [];
  const final = { data: null, count: null, error: null, ...result };
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'range', 'ilike', 'gte', 'lte']) {
    builder[method] = (...args: unknown[]) => { calls.push([method, args]); return builder; };
  }
  builder.maybeSingle = async () => final;
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(final).then(resolve);
  return { builder, calls };
}

beforeEach(() => { mocks.from.mockReset(); mocks.rpc.mockReset(); });
afterEach(() => vi.unstubAllGlobals());

describe('bot status and versions', () => {
  it('maps the status row and falls back to an off bot when the row is missing', async () => {
    mocks.from.mockReturnValueOnce(query({ data: { enabled: true, published_version: 4, updated_at: 'u' } }).builder);
    await expect(getBotStatus()).resolves.toEqual({ enabled: true, publishedVersion: 4, updatedAt: 'u' });
    mocks.from.mockReturnValueOnce(query({ data: null }).builder);
    await expect(getBotStatus()).resolves.toEqual({ enabled: false, publishedVersion: null, updatedAt: null });
  });

  it('hides database messages behind a generic Spanish error', async () => {
    mocks.from.mockReturnValueOnce(query({ error: { message: 'relation "x" violates rls' } }).builder);
    const failure = await getBotStatus().catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('No se pudo leer el estado del bot.');
  });

  it('lists versions newest first and marks the published one', async () => {
    const { builder, calls } = query({ data: [
      { version: 2, note: 'b', created_at: 't2', created_by: 'u1' },
      { version: 1, note: 'a', created_at: 't1', created_by: null },
    ] });
    mocks.from.mockReturnValueOnce(builder);
    await expect(listBotVersions(2)).resolves.toEqual([
      { version: 2, note: 'b', createdAt: 't2', createdBy: 'u1', isPublished: true },
      { version: 1, note: 'a', createdAt: 't1', createdBy: null, isPublished: false },
    ]);
    expect(calls).toContainEqual(['order', ['version', { ascending: false }]]);
    mocks.from.mockReturnValueOnce(query({ error: { message: 'x' } }).builder);
    await expect(listBotVersions(null)).rejects.toThrow('No se pudo listar las versiones del bot.');
    mocks.from.mockReturnValueOnce(query({ data: null }).builder);
    await expect(listBotVersions(null)).resolves.toEqual([]);
  });

  it('loads one version or null', async () => {
    mocks.from.mockReturnValueOnce(query({ data: { version: 3, definition: { a: 1 } } }).builder);
    await expect(getBotVersion(3)).resolves.toEqual({ version: 3, definition: { a: 1 } });
    mocks.from.mockReturnValueOnce(query({ data: null }).builder);
    await expect(getBotVersion(9)).resolves.toBeNull();
    mocks.from.mockReturnValueOnce(query({ error: { message: 'x' } }).builder);
    await expect(getBotVersion(1)).rejects.toThrow('No se pudo leer la version del bot.');
  });
});

describe('publish and enable RPCs', () => {
  it('publishes through the typed RPC and returns the new version', async () => {
    mocks.rpc.mockResolvedValue({ data: 7, error: null });
    await expect(publishBotVersion({ schemaVersion: 1 }, 'Nota')).resolves.toBe(7);
    expect(mocks.rpc).toHaveBeenCalledWith('publish_whatsapp_bot_version', { p_definition: { schemaVersion: 1 }, p_note: 'Nota' });
  });

  it('rejects invalid RPC results and RPC errors', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: '7', error: null });
    await expect(publishBotVersion({}, 'n')).rejects.toThrow('no retorno una version valida');
    mocks.rpc.mockResolvedValueOnce({ data: 0, error: null });
    await expect(publishBotVersion({}, 'n')).rejects.toThrow('no retorno una version valida');
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'forbidden' } });
    await expect(publishBotVersion({}, 'n')).rejects.toThrow('No se pudo publicar la version del bot.');
  });

  it('toggles the switch and validates the boolean result', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(setBotEnabled(true)).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('set_whatsapp_bot_enabled', { p_enabled: true });
    mocks.rpc.mockResolvedValueOnce({ data: 'si', error: null });
    await expect(setBotEnabled(true)).rejects.toThrow('no retorno un booleano');
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    await expect(setBotEnabled(false)).rejects.toThrow('No se pudo cambiar el interruptor del bot.');
  });

  it('refuses to mutate while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(publishBotVersion({}, 'n')).rejects.toThrow('Sin conexion');
    await expect(setBotEnabled(true)).rejects.toThrow('Sin conexion');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe('listBotEvents', () => {
  const row = {
    id: 'e1', created_at: '2026-10-01T10:00:00Z', wa_id: '50760000001', cliente_id: 'c1', type: 'code_sent',
    node_id: 'login', option_id: null, detail: { minutes: 5, ok: true, nothing: null, label: 'x', nested: { a: 1 } },
    terceros: { nombre: 'Ana', apellido: 'Prueba' },
  };

  it('pages ten at a time, newest first, with the customer name', async () => {
    const { builder, calls } = query({ data: [row, { ...row, id: 'e2', type: 'nuevo', cliente_id: null, terceros: null, detail: [] }], count: 25 });
    mocks.from.mockReturnValueOnce(builder);
    const page = await listBotEvents(3, {});
    expect(page).toMatchObject({ total: 25, page: 3, pageSize: 10 });
    expect(page.events[0]).toEqual({
      id: 'e1', createdAt: row.created_at, waId: '50760000001', clienteId: 'c1', clienteNombre: 'Ana Prueba', type: 'code_sent',
      nodeId: 'login', optionId: null, detail: { minutes: 5, ok: true, nothing: null, label: 'x' },
    });
    expect(page.events[1]).toMatchObject({ clienteNombre: null, type: 'error', detail: {} });
    expect(calls).toContainEqual(['range', [20, 29]]);
    expect(calls).toContainEqual(['order', ['created_at', { ascending: false }]]);
  });

  it('applies filters, using only digits for the phone and ISO dates', async () => {
    const { builder, calls } = query({ data: [], count: 0 });
    mocks.from.mockReturnValueOnce(builder);
    const page = await listBotEvents(0, { type: 'error', waId: '+507 6000-0001%', from: '2026-10-01', to: '2026-10-02T00:00:00Z' });
    expect(page).toEqual({ events: [], total: 0, page: 1, pageSize: 10 });
    expect(calls).toContainEqual(['eq', ['type', 'error']]);
    expect(calls).toContainEqual(['ilike', ['wa_id', '%50760000001%']]);
    expect(calls).toContainEqual(['gte', ['created_at', '2026-10-01T00:00:00.000Z']]);
    expect(calls).toContainEqual(['lte', ['created_at', '2026-10-02T00:00:00.000Z']]);
  });

  it('ignores invalid dates and empty phone filters, and handles null data and counts', async () => {
    const { builder, calls } = query({ data: null, count: null });
    mocks.from.mockReturnValueOnce(builder);
    const page = await listBotEvents(1, { waId: 'abc', from: 'no-fecha', to: '' });
    expect(page.total).toBe(0);
    expect(calls.some(([method]) => ['ilike', 'gte', 'lte', 'eq'].includes(method))).toBe(false);
  });

  it('fails with a generic error', async () => {
    mocks.from.mockReturnValueOnce(query({ error: { message: 'sql' } }).builder);
    await expect(listBotEvents(1, {})).rejects.toThrow('No se pudo listar la actividad del bot.');
  });
});

describe('getBotMetrics', () => {
  const now = new Date('2026-10-02T12:00:00Z');

  it('counts the last 24 hours and reads the latest activity', async () => {
    const all = query({ count: 12 });
    const codes = query({ count: 3 });
    mocks.from.mockReturnValueOnce(all.builder).mockReturnValueOnce(codes.builder)
      .mockReturnValueOnce(query({ data: { created_at: 'last' } }).builder);
    await expect(getBotMetrics(now)).resolves.toEqual({ eventsLast24h: 12, codesLast24h: 3, lastActivityAt: 'last' });
    expect(all.calls).toContainEqual(['gte', ['created_at', '2026-10-01T12:00:00.000Z']]);
    expect(codes.calls).toContainEqual(['eq', ['type', 'code_sent']]);
  });

  it('defaults to zeros without events and fails on any error', async () => {
    mocks.from.mockReturnValueOnce(query({}).builder).mockReturnValueOnce(query({}).builder).mockReturnValueOnce(query({}).builder);
    await expect(getBotMetrics()).resolves.toEqual({ eventsLast24h: 0, codesLast24h: 0, lastActivityAt: null });
    for (const failing of [0, 1, 2]) {
      for (let index = 0; index < 3; index += 1) {
        mocks.from.mockReturnValueOnce(query(index === failing ? { error: { message: 'x' } } : {}).builder);
      }
      await expect(getBotMetrics(now)).rejects.toThrow('No se pudo leer las metricas del bot.');
    }
  });
});
