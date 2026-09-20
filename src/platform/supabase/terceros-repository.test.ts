import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  getAll: vi.fn(), getById: vi.fn(), query: vi.fn(), count: vi.fn(), countView: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}));
vi.mock('./record-core', () => ({
  getAll: core.getAll, getById: core.getById, queryDocuments: core.query, getCount: core.count,
  countFromView: core.countView, create: core.create, update: core.update, remove: core.remove, logCacheHit: vi.fn(),
}));

import {
  countTerceros, createTercero, getTerceroById, getTerceros,
  queryTerceros, removeTercero, updateTercero,
} from './terceros-repository';

beforeEach(() => vi.clearAllMocks());

describe('third-party repository', () => {
  it('delegates CRUD and chooses the correct count source', async () => {
    await getTerceros(); await getTerceroById('t1'); await queryTerceros();
    await countTerceros([{ field: 'activo', operator: '==', value: true }]);
    const derived = [{ field: 'serviciosActivos', operator: '>', value: 0 }] as const;
    await countTerceros([...derived]);
    await createTercero({ nombre: 'Ana' }); await updateTercero('t1', { nombre: 'Beto' }); await removeTercero('t1');
    expect(core.count).toHaveBeenCalledWith('terceros', [{ field: 'activo', operator: '==', value: true }]);
    expect(core.countView).toHaveBeenCalledWith(
      'terceros', 'v_terceros_servicios_activos', [...derived], { serviciosActivos: 'servicios_activos' },
    );
  });
});
