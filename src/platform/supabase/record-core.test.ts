import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  mapReadRow: vi.fn((collection: string, row: unknown) => ({ collection, row })),
  enrichTerceros: vi.fn(async <T>(rows: T[]) => rows.map((row) => ({ ...row, enriched: 'tercero' }))),
  enrichCategorias: vi.fn(async <T>(rows: T[]) => rows.map((row) => ({ ...row, enriched: 'categoria' }))),
  insertRaw: vi.fn(),
  normalizeWrite: vi.fn((_collection: string, payload: Record<string, unknown>) => payload),
}));

vi.mock('./client', () => ({ supabase: { from: mocks.from } }));
vi.mock('./read-models', () => ({
  mapReadRow: mocks.mapReadRow,
  enrichTerceros: mocks.enrichTerceros,
  enrichCategorias: mocks.enrichCategorias,
}));
vi.mock('./write-utils', () => ({
  insertRawRow: mocks.insertRaw,
  normalizeWritePayload: mocks.normalizeWrite,
}));

import {
  archiveRecord,
  countFromView,
  create,
  createRaw,
  getAll,
  getById,
  getCount,
  logCacheHit,
  queryDocuments,
  remove,
  update,
} from './record-core';

type Result = { data?: unknown; count?: number | null; error?: { message: string } | null };

function builder(result: Result = { data: [], error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<Result> = {
    then: vi.fn((resolve: (value: Result) => unknown) => Promise.resolve(resolve(result))),
  } as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<Result>;
  for (const method of ['select', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'is', 'ilike', 'or', 'update', 'delete', 'maybeSingle']) {
    chain[method] = vi.fn(() => chain);
  }
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReset();
});

describe('record-core reads', () => {
  it('reads, maps and enriches online collections', async () => {
    const all = builder({ data: [{ id: '1' }], error: null });
    const one = builder({ data: { id: '2' }, error: null });
    mocks.from.mockReturnValueOnce(all).mockReturnValueOnce(one);

    expect(await getAll('categorias')).toEqual([
      { collection: 'categorias', row: { id: '1' }, enriched: 'categoria' },
    ]);
    expect(await getById('terceros', '2')).toEqual({
      collection: 'terceros', row: { id: '2' }, enriched: 'tercero',
    });
    expect(one.eq).toHaveBeenCalledWith('id', '2');
  });

  it('returns empty/null defaults and propagates read errors', async () => {
    mocks.from
      .mockReturnValueOnce(builder({ data: null, error: null }))
      .mockReturnValueOnce(builder({ data: null, error: null }))
      .mockReturnValueOnce(builder({ data: null, error: { message: 'lectura' } }));
    expect(await getAll('config')).toEqual([]);
    expect(await getById('config', 'missing')).toBeNull();
    await expect(getAll('config')).rejects.toThrow('lectura');
  });

  it('applies every supported filter and normalizes mapped fields', async () => {
    const query = builder({ data: [], error: null });
    mocks.from.mockReturnValue(query);
    await queryDocuments('ventas', [
      { field: '__name__', operator: '==', value: '1' },
      { field: 'estado', operator: '!=', value: 'x' },
      { field: 'precio', operator: '<', value: 2 },
      { field: 'precio', operator: '<=', value: 3 },
      { field: 'precio', operator: '>', value: 4 },
      { field: 'precio', operator: '>=', value: 5 },
      { field: 'estado', operator: 'in', value: ['a', 'b'] },
      { field: 'archivado', operator: 'is', value: null },
      { field: 'nombre', operator: 'ilike', value: '%ana%' },
      { field: 'nombre', operator: 'orIlike', value: { fields: ['nombre', '', 4], value: ' a,%_\\ ' } },
    ]);
    expect(query.eq).toHaveBeenCalledWith('id', '1');
    expect(query.neq).toHaveBeenCalled();
    expect(query.lt).toHaveBeenCalledWith('ultimo_total_original', 2);
    expect(query.lte).toHaveBeenCalled();
    expect(query.gt).toHaveBeenCalled();
    expect(query.gte).toHaveBeenCalled();
    expect(query.in).toHaveBeenCalled();
    expect(query.is).toHaveBeenCalled();
    expect(query.ilike).toHaveBeenCalled();
    expect(query.or).toHaveBeenCalledWith(expect.stringContaining('nombre.ilike.'));
  });

  it('rejects malformed compound filters and query failures', async () => {
    mocks.from.mockReturnValue(builder());
    await expect(queryDocuments('config', [
      { field: 'id', operator: 'orIlike', value: null },
    ])).rejects.toThrow('Filtro orIlike invalido');

    mocks.from.mockReturnValue(builder({ error: { message: 'consulta' } }));
    await expect(queryDocuments('config')).rejects.toThrow('consulta');
  });

  it('counts online rows, including zero and errors', async () => {
    const positive = builder({ count: 4, error: null });
    const zero = builder({ count: null, error: null });
    const failure = builder({ error: { message: 'conteo' } });
    mocks.from.mockReturnValueOnce(positive).mockReturnValueOnce(zero).mockReturnValueOnce(failure);
    expect(await getCount('config', [{ field: 'activo', operator: '==', value: true }])).toBe(4);
    expect(await getCount('config')).toBe(0);
    await expect(getCount('config')).rejects.toThrow('conteo');
  });
});

describe('record-core writes and views', () => {
  it('creates normalized and raw records', async () => {
    mocks.insertRaw.mockResolvedValue('new-id');
    expect(await create('config', { clave: 'x' })).toBe('new-id');
    expect(await createRaw('config', { clave: 'raw' })).toBe('new-id');
    expect(mocks.normalizeWrite).toHaveBeenCalledWith('config', { clave: 'x' }, 'insert');
  });

  it('updates, skips empty updates, removes and archives', async () => {
    const updateQuery = builder({ error: null });
    const removeQuery = builder({ error: null });
    const archiveQuery = builder({ error: null });
    mocks.from.mockReturnValueOnce(updateQuery).mockReturnValueOnce(removeQuery).mockReturnValueOnce(archiveQuery);
    await update('config', '1', { clave: 'nueva' });
    mocks.normalizeWrite.mockReturnValueOnce({});
    await update('config', '1', {});
    await remove('config', '1');
    await archiveRecord('config', '1');
    expect(updateQuery.update).toHaveBeenCalledWith({ clave: 'nueva' });
    expect(removeQuery.delete).toHaveBeenCalled();
    expect(archiveQuery.update).toHaveBeenCalledWith(expect.objectContaining({ motivo_archivado: 'Eliminado desde la app' }));
  });

  it.each(['update', 'remove', 'archive'] as const)('propagates %s errors', async (operation) => {
    mocks.from.mockReturnValue(builder({ error: { message: operation } }));
    if (operation === 'update') await expect(update('config', '1', { clave: 'x' })).rejects.toThrow(operation);
    if (operation === 'remove') await expect(remove('config', '1')).rejects.toThrow(operation);
    if (operation === 'archive') await expect(archiveRecord('config', '1', 'motivo')).rejects.toThrow(operation);
  });

  it('counts filtered rows from a view with overrides and all operators', async () => {
    const query = builder({ count: 2, error: null });
    mocks.from.mockReturnValue(query);
    const filters = ['==', '!=', '<', '<=', '>', '>=', 'in', 'is'].map((operator) => ({
      field: 'campo', operator: operator as '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'is', value: operator === 'is' ? null : 1,
    }));
    expect(await countFromView('config', 'v_terceros_servicios_activos', filters, { campo: 'override' })).toBe(2);
    for (const method of ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in']) {
      expect(query[method]).toHaveBeenCalledWith('override', expect.anything());
    }
    expect(query.is).toHaveBeenCalledWith('override', null);
  });

  it('handles zero and errors from view counts', async () => {
    mocks.from.mockReturnValueOnce(builder({ count: null, error: null }))
      .mockReturnValueOnce(builder({ error: { message: 'vista' } }));
    expect(await countFromView('config', 'v_terceros_servicios_activos', [])).toBe(0);
    await expect(countFromView('config', 'v_terceros_servicios_activos', [])).rejects.toThrow('vista');
  });

  it('only logs cache hits in development', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'development');
    logCacheHit('config');
    expect(debug).toHaveBeenCalled();
    vi.stubEnv('NODE_ENV', 'test');
    logCacheHit('config');
    expect(debug).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
    debug.mockRestore();
  });
});
