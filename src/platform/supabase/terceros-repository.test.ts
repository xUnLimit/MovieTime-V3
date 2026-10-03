import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  getAll: vi.fn(), getById: vi.fn(), query: vi.fn(), count: vi.fn(), countView: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}));
vi.mock('./record-core', () => ({
  getAll: core.getAll, getById: core.getById, queryDocuments: core.query, getCount: core.count,
  countFromView: core.countView, create: core.create, update: core.update, remove: core.remove,
}));

import { countTerceros, createTercero, getTerceroById, getTerceros, removeTercero, updateTercero } from './terceros-repository';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';

const terceroId = '62222222-2222-4222-8222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('third-party repository', () => {
  it('delegates CRUD and chooses the correct count source', async () => {
    await getTerceros(); await getTerceroById('t1');
    await countTerceros([{ field: 'activo', operator: '==', value: true }]);
    const derived = [{ field: 'serviciosActivos', operator: '>', value: 0 }] as const;
    await countTerceros([...derived]);
    await createTercero({ nombre: 'Ana' }); await updateTercero('t1', { nombre: 'Beto' }); await removeTercero(terceroId);
    expect(core.count).toHaveBeenCalledWith('terceros', [{ field: 'activo', operator: '==', value: true }]);
    expect(core.countView).toHaveBeenCalledWith(
      'terceros', 'v_terceros_servicios_activos', [...derived], { serviciosActivos: 'servicios_activos' },
    );
  });

  it('returns a safe actionable conflict when a dependency prevents deletion', async () => {
    const databaseError = { code: '23503', message: 'SQL private constraint', details: 'private data' };
    core.remove.mockRejectedValueOnce(new Error(databaseError.message, { cause: databaseError }));
    const error = await removeTercero(terceroId).catch((failure: unknown) => failure);
    expect(getPublicErrorMessage(error, 'fallback')).toBe(
      'No se puede eliminar el tercero porque tiene registros asociados que impiden su eliminación. Revisa sus pedidos u otras dependencias.',
    );
    expect(getPublicErrorMessage(error, 'fallback')).not.toContain('SQL');
  });

  it.each([new Error('network'), undefined, null, { code: '42501' }, { code: 23503 }])(
    'preserves unrelated rejection %s', async (failure) => {
      core.remove.mockRejectedValueOnce(failure);
      await expect(removeTercero(terceroId)).rejects.toBe(failure);
    },
  );

  it('also maps a structured PostgREST FK rejection', async () => {
    core.remove.mockRejectedValueOnce({ code: '23503' });
    await expect(removeTercero(terceroId)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('validates the ID before issuing a delete', async () => {
    await expect(removeTercero('invalid')).rejects.toThrow('UUID');
    expect(core.remove).not.toHaveBeenCalled();
  });
});
