import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), getAll: vi.fn(), getById: vi.fn(), query: vi.fn(), count: vi.fn(),
  create: vi.fn(), update: vi.fn(),
  deleteRpc: vi.fn(), countsRpc: vi.fn(), fullRpc: vi.fn(),
}));

vi.mock('./client', () => ({ supabase: { from: mocks.from } }));
vi.mock('./record-core', () => ({
  getAll: mocks.getAll, getById: mocks.getById, queryDocuments: mocks.query,
  getCount: mocks.count, create: mocks.create, update: mocks.update, logCacheHit: vi.fn(),
}));
vi.mock('./categorias-rpc-adapter', () => ({
  deleteCategoriaRpc: mocks.deleteRpc,
  getCategoriasCountsRpc: mocks.countsRpc,
  getCategoriasFullRpc: mocks.fullRpc,
}));

import {
  buildCategorias, countCategorias, createCategoria, createCategoriaRecord,
  deleteCategoriaRecord, getCategoriaById, getCategorias, getCategoriasCounts,
  getCategoriasFull, queryCategorias, updateCategoria, updateCategoriaRecord,
  upsertCategoriaPlanes,
} from './categorias-repository';

type DbResult = { data: unknown; error: { message: string } | null };

function dbQuery(result: DbResult = { data: null, error: null }) {
  const chain = {
    insert: vi.fn(), update: vi.fn(), upsert: vi.fn(), select: vi.fn(), single: vi.fn(),
    in: vi.fn(), eq: vi.fn(), then: (resolve: (value: DbResult) => unknown) => Promise.resolve(resolve(result)),
  };
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.upsert.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue(result);
  return chain;
}

const categoryRow = {
  id: 'c1', nombre: 'Streaming', tipo: 'cliente' as const,
  tipo_categoria: 'plataforma_streaming' as const, notas: null, activo: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', created_by: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReset();
});

describe('category repository facades', () => {
  it('delegates generic CRUD operations', async () => {
    mocks.getAll.mockResolvedValue(['all']);
    mocks.getById.mockResolvedValue({ id: 'c1' });
    mocks.query.mockResolvedValue(['filtered']);
    mocks.count.mockResolvedValue(2);
    mocks.create.mockResolvedValue('new');
    mocks.update.mockResolvedValue(undefined);
    expect(await getCategorias()).toEqual(['all']);
    expect(await getCategoriaById('c1')).toEqual({ id: 'c1' });
    expect(await queryCategorias([{ field: 'activo', operator: '==', value: true }])).toEqual(['filtered']);
    expect(await countCategorias()).toBe(2);
    expect(await createCategoria({ nombre: 'Nueva' })).toBe('new');
    await updateCategoria('c1', { nombre: 'Editada' });
    expect(mocks.update).toHaveBeenCalledWith('categorias', 'c1', { nombre: 'Editada' });
  });

  it('normalizes full RPC JSON and invalid values', async () => {
    mocks.fullRpc.mockResolvedValue([
      {
        id: 7, nombre: null, tipo: 'revendedor', tipoCategoria: 'otros',
        tiposPlanes: [{ id: 't' }], planes: [{ id: 'p' }], notas: 'nota', activo: 1,
        totalServicios: '2', serviciosActivos: '1', perfilesDisponiblesTotal: '3',
        ventasTotales: '4', ingresosTotales: '5', gastosTotal: '6',
        createdAt: '2026-01-01', updatedAt: '2026-01-02', createdBy: 'u1',
      },
      { id: '8', tipo: 'otro', tipoCategoria: 'invalido', tiposPlanes: null, planes: null },
    ]);
    const result = await getCategoriasFull();
    expect(result[0]).toEqual(expect.objectContaining({
      id: '7', tipo: 'revendedor', tipoCategoria: 'otros', totalServicios: 2, ingresosTotales: 5,
      createdBy: 'u1',
    }));
    expect(result[1]).toEqual(expect.objectContaining({
      tipo: 'cliente', tipoCategoria: undefined, tiposPlanes: [], planes: [], createdAt: new Date(0),
    }));
    mocks.fullRpc.mockResolvedValue(null);
    expect(await getCategoriasFull()).toEqual([]);
  });

  it('normalizes count RPC values and invalid payloads', async () => {
    mocks.countsRpc.mockResolvedValue({
      totalCategorias: '4', categoriasClientes: 3, categoriasRevendedores: null,
    });
    expect(await getCategoriasCounts()).toEqual({
      totalCategorias: 4, categoriasClientes: 3, categoriasRevendedores: 0,
    });
    mocks.countsRpc.mockResolvedValue([]);
    expect(await getCategoriasCounts()).toEqual({
      totalCategorias: 0, categoriasClientes: 0, categoriasRevendedores: 0,
    });
  });

  it('creates, updates and deletes category records', async () => {
    const createQuery = dbQuery({ data: { id: 'c1' }, error: null });
    const updateQuery = dbQuery({ data: { id: 'c1', nombre: 'Nueva' }, error: null });
    mocks.from.mockReturnValueOnce(createQuery).mockReturnValueOnce(updateQuery);
    expect(await createCategoriaRecord({
      nombre: 'Nueva', tipo: 'cliente', tipoCategoria: 'otros', notas: undefined, activo: true,
    })).toEqual({ id: 'c1' });
    expect(await updateCategoriaRecord('c1', {
      nombre: 'Nueva', tipo: 'revendedor', tipoCategoria: 'otros', notas: 'n', activo: false,
    })).toEqual({ id: 'c1', nombre: 'Nueva' });
    await deleteCategoriaRecord('c1');
    expect(mocks.deleteRpc).toHaveBeenCalledWith('c1');
    expect(updateQuery.update).toHaveBeenCalledWith({
      nombre: 'Nueva', tipo: 'revendedor', tipo_categoria: 'otros', notas: 'n', activo: false,
    });
  });

  it('supports empty partial updates and propagates database errors', async () => {
    const empty = dbQuery({ data: { id: 'c1' }, error: null });
    mocks.from.mockReturnValueOnce(empty);
    await updateCategoriaRecord('c1', {});
    expect(empty.update).toHaveBeenCalledWith({});
    mocks.from.mockReturnValueOnce(dbQuery({ data: null, error: { message: 'crear' } }));
    await expect(createCategoriaRecord({
      nombre: 'X', tipo: 'cliente', tipoCategoria: undefined, notas: undefined, activo: true,
    })).rejects.toThrow('crear');
    mocks.from.mockReturnValueOnce(dbQuery({ data: null, error: { message: 'editar' } }));
    await expect(updateCategoriaRecord('c1', { nombre: 'X' })).rejects.toThrow('editar');
  });
});

describe('category aggregation and plans', () => {
  it('returns no categories without rows', async () => {
    expect(await buildCategorias([])).toEqual([]);
  });

  it('builds categories from all related data sources', async () => {
    const results = [
      [{ categoria_id: 'c1', id: 't1', nombre: 'Tipo' }],
      [{ categoria_id: 'c1', id: 'p1', nombre: 'Plan', precio: '12', ciclo_pago: 'mensual', plan_tipo_id: 't1' }],
      [{ categoria_id: 'c1', total_servicios: '3', servicios_activos: '2', perfiles_disponibles_total: '5' }],
      [{ categoria_id: 'c1', estado: 'activo' }, { categoria_id: 'c1', estado: 'inactivo' }, { categoria_id: null, estado: 'activo' }],
      [{ categoria_id: 'c1', ingresos_usd: '40', gastos_usd: '15' }],
    ];
    for (const data of results) mocks.from.mockReturnValueOnce(dbQuery({ data, error: null }));
    const result = await buildCategorias([categoryRow, { ...categoryRow, id: 'c2', tipo_categoria: null, notas: 'nota', created_by: 'u1' }]);
    expect(result[0]).toEqual(expect.objectContaining({
      tiposPlanes: [{ id: 't1', nombre: 'Tipo' }],
      planes: [{ id: 'p1', nombre: 'Plan', precio: 12, cicloPago: 'mensual', tipoPlan: 't1' }],
      totalServicios: 3, ventasTotales: 1, ingresosTotales: 40, gastosTotal: 15,
    }));
    expect(result[1]).toEqual(expect.objectContaining({
      tipoCategoria: undefined, notas: 'nota', createdBy: 'u1', tiposPlanes: [], planes: [],
      totalServicios: 0, ventasTotales: 0,
    }));
  });

  it.each([0, 1, 2, 3, 4])('propagates category aggregation dependency %s errors', async (failed) => {
    for (let index = 0; index < 5; index += 1) {
      mocks.from.mockReturnValueOnce(dbQuery({
        data: [], error: index === failed ? { message: `source-${index}` } : null,
      }));
    }
    await expect(buildCategorias([categoryRow])).rejects.toThrow(`source-${failed}`);
  });

  it('deactivates removed plans and upserts active definitions', async () => {
    const existingTypes = dbQuery({ data: [{ id: 'old-type' }, { id: 't1' }], error: null });
    const existingPlans = dbQuery({ data: [{ id: 'old-plan' }, { id: 'p1' }], error: null });
    const deactivatePlans = dbQuery({ data: null, error: null });
    const deactivateTypes = dbQuery({ data: null, error: null });
    const upsertTypes = dbQuery({ data: null, error: null });
    const upsertPlans = dbQuery({ data: null, error: null });
    mocks.from
      .mockReturnValueOnce(existingTypes).mockReturnValueOnce(existingPlans)
      .mockReturnValueOnce(deactivatePlans).mockReturnValueOnce(deactivateTypes)
      .mockReturnValueOnce(upsertTypes).mockReturnValueOnce(upsertPlans);
    await upsertCategoriaPlanes(
      'c1', [{ id: 't1', nombre: 'Tipo' }],
      [{ id: 'p1', nombre: 'Plan', precio: 10, cicloPago: 'mensual', tipoPlan: 't1' }],
    );
    expect(deactivatePlans.in).toHaveBeenCalledWith('id', ['old-plan']);
    expect(deactivateTypes.in).toHaveBeenCalledWith('id', ['old-type']);
    expect(upsertTypes.upsert).toHaveBeenCalled();
    expect(upsertPlans.upsert).toHaveBeenCalled();
  });

  it('does no writes when no existing or requested plans exist', async () => {
    mocks.from
      .mockReturnValueOnce(dbQuery({ data: null, error: null }))
      .mockReturnValueOnce(dbQuery({ data: null, error: null }));
    await upsertCategoriaPlanes('c1', [], []);
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it.each(['existing-types', 'existing-plans', 'deactivate-plans', 'deactivate-types', 'upsert-types', 'upsert-plans'] as const)(
    'propagates %s errors', async (stage) => {
      const error = (name: string) => dbQuery({ data: [], error: { message: name } });
      if (stage === 'existing-types') {
        mocks.from.mockReturnValueOnce(error(stage)).mockReturnValueOnce(dbQuery({ data: [], error: null }));
      } else if (stage === 'existing-plans') {
        mocks.from.mockReturnValueOnce(dbQuery({ data: [], error: null })).mockReturnValueOnce(error(stage));
      } else {
        const existingTypes = stage === 'deactivate-types' ? [{ id: 'old-type' }] : [];
        const existingPlans = stage === 'deactivate-plans' ? [{ id: 'old-plan' }] : [];
        mocks.from
          .mockReturnValueOnce(dbQuery({ data: existingTypes, error: null }))
          .mockReturnValueOnce(dbQuery({ data: existingPlans, error: null }));
        if (stage === 'deactivate-plans') mocks.from.mockReturnValueOnce(error(stage));
        if (stage === 'deactivate-types') mocks.from.mockReturnValueOnce(error(stage));
        if (stage === 'upsert-types') mocks.from.mockReturnValueOnce(error(stage));
        if (stage === 'upsert-plans') {
          mocks.from.mockReturnValueOnce(dbQuery({ data: null, error: null })).mockReturnValueOnce(error(stage));
        }
      }
      const tipos = stage === 'upsert-types' || stage === 'upsert-plans' ? [{ id: 't1', nombre: 'T' }] : [];
      const planes = stage === 'upsert-plans'
        ? [{ id: 'p1', nombre: 'P', precio: 1, cicloPago: 'mensual' as const, tipoPlan: 't1' }]
        : [];
      await expect(upsertCategoriaPlanes('c1', tipos, planes)).rejects.toThrow(stage);
    },
  );
});
