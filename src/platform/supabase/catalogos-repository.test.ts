import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  getAll: vi.fn(), getById: vi.fn(), query: vi.fn(), count: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}));
vi.mock('./record-core', () => ({
  ...core, queryDocuments: core.query, getCount: core.count,
}));

import {
  countGastos, countMetodosPago, createGasto, createMetodoPago, createTipoGasto,
  getGastoById, getGastos, getMetodoPagoById, getMetodosPago, getTipoGastoById, getTiposGasto,
  queryMetodosPago, removeGasto, removeMetodoPago, removeTipoGasto,
  updateGasto, updateMetodoPago, updateTipoGasto,
} from './catalogos-repository';

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of Object.values(core)) mock.mockResolvedValue(undefined);
});

describe('catalog repository facades', () => {
  it.each([
    ['metodosPago', getMetodosPago, getMetodoPagoById, createMetodoPago, updateMetodoPago, removeMetodoPago],
    ['tiposGasto', getTiposGasto, getTipoGastoById, createTipoGasto, updateTipoGasto, removeTipoGasto],
    ['gastos', getGastos, getGastoById, createGasto, updateGasto, removeGasto],
  ] as const)('delegates the %s CRUD operations', async (entity, getAll, getById, create, update, remove) => {
    await getAll();
    await getById('id1');
    await create({ nombre: 'nuevo' });
    await update('id1', { nombre: 'editado' });
    await remove('id1');
    expect(core.getAll).toHaveBeenCalledWith(entity);
    expect(core.getById).toHaveBeenCalledWith(entity, 'id1');
    expect(core.create).toHaveBeenCalledWith(entity, { nombre: 'nuevo' });
    expect(core.update).toHaveBeenCalledWith(entity, 'id1', { nombre: 'editado' });
    expect(core.remove).toHaveBeenCalledWith(entity, 'id1');
  });

  it('queries and counts with filters', async () => {
    const filters = [{ field: 'activo', operator: '==', value: true }] as const;
    await queryMetodosPago([...filters]);
    await countMetodosPago([...filters]);
    await countGastos([...filters]);
    expect(core.query).toHaveBeenCalledWith('metodosPago', [...filters]);
    expect(core.count).toHaveBeenCalledWith('metodosPago', [...filters]);
    expect(core.count).toHaveBeenCalledWith('gastos', [...filters]);
  });
});
