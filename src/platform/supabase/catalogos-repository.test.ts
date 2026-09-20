import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  getAll: vi.fn(), getById: vi.fn(), query: vi.fn(), count: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}));
vi.mock('./record-core', () => ({
  ...core, queryDocuments: core.query, getCount: core.count, logCacheHit: vi.fn(),
}));

import {
  countGastos, countMetodosPago, countTiposGasto, createGasto, createMetodoPago, createTipoGasto,
  getGastoById, getGastos, getMetodoPagoById, getMetodosPago, getTipoGastoById, getTiposGasto,
  queryGastos, queryMetodosPago, queryTiposGasto, removeGasto, removeMetodoPago, removeTipoGasto,
  updateGasto, updateMetodoPago, updateTipoGasto,
} from './catalogos-repository';

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of Object.values(core)) mock.mockResolvedValue(undefined);
});

describe('catalog repository facades', () => {
  it.each([
    ['metodosPago', getMetodosPago, getMetodoPagoById, queryMetodosPago, countMetodosPago, createMetodoPago, updateMetodoPago, removeMetodoPago],
    ['tiposGasto', getTiposGasto, getTipoGastoById, queryTiposGasto, countTiposGasto, createTipoGasto, updateTipoGasto, removeTipoGasto],
    ['gastos', getGastos, getGastoById, queryGastos, countGastos, createGasto, updateGasto, removeGasto],
  ] as const)('delegates all %s operations', async (entity, getAll, getById, query, count, create, update, remove) => {
    const filters = [{ field: 'activo', operator: '==', value: true }] as const;
    await getAll();
    await getById('id1');
    await query([...filters]);
    await count([...filters]);
    await create({ nombre: 'nuevo' });
    await update('id1', { nombre: 'editado' });
    await remove('id1');
    expect(core.getAll).toHaveBeenCalledWith(entity);
    expect(core.getById).toHaveBeenCalledWith(entity, 'id1');
    expect(core.query).toHaveBeenCalledWith(entity, [...filters]);
    expect(core.count).toHaveBeenCalledWith(entity, [...filters]);
    expect(core.create).toHaveBeenCalledWith(entity, { nombre: 'nuevo' });
    expect(core.update).toHaveBeenCalledWith(entity, 'id1', { nombre: 'editado' });
    expect(core.remove).toHaveBeenCalledWith(entity, 'id1');
  });
});
