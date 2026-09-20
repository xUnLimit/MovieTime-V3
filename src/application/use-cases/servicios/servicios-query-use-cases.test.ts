import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  countCategorias: vi.fn(), read: vi.fn(), count: vi.fn(), getById: vi.fn(), getAll: vi.fn(), query: vi.fn(),
}));
vi.mock('@/platform/supabase/categorias-repository', () => ({ countCategorias: mocks.countCategorias }));
vi.mock('@/platform/supabase/domain-read-adapters', () => ({ getServicioRead: mocks.read }));
vi.mock('@/platform/supabase/servicios-repository', () => ({
  countServicios: mocks.count, getServicioById: mocks.getById,
  getServicios: mocks.getAll, queryServicios: mocks.query,
}));

import {
  countServiciosProximosPagoByCategoriaUseCase, fetchServiciosByIdsUseCase,
  fetchServiciosCountsUseCase, fetchServiciosUseCase, getServicioReadUseCase,
  getServicioUseCase, queryServiciosByCategoriaUseCase, queryServiciosEnReposoUseCase,
} from './servicios-query-use-cases';

beforeEach(() => vi.clearAllMocks());

describe('service query use cases', () => {
  it('delegates simple service reads and filters', async () => {
    mocks.getById.mockResolvedValue({ id: 's1' }); mocks.read.mockResolvedValue({ id: 's1' });
    mocks.getAll.mockResolvedValue([]); mocks.query.mockResolvedValue([{ id: 's1' }]);
    expect(await getServicioUseCase('s1')).toEqual({ id: 's1' });
    expect(await getServicioReadUseCase('s1')).toEqual({ id: 's1' });
    expect(await fetchServiciosUseCase()).toEqual([]);
    await queryServiciosByCategoriaUseCase('c1');
    await fetchServiciosByIdsUseCase(['s1', 's2']);
    await queryServiciosEnReposoUseCase();
    expect(await countServiciosProximosPagoByCategoriaUseCase('c1', new Date('2026-01-01'))).toBe(1);
    expect(mocks.query).toHaveBeenCalledWith([{ field: 'categoriaId', operator: '==', value: 'c1' }]);
    expect(mocks.query).toHaveBeenCalledWith([{ field: '__name__', operator: 'in', value: ['s1', 's2'] }]);
  });

  it('derives nonnegative active counts excluding resting services', async () => {
    mocks.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    mocks.query.mockResolvedValue([{ activo: true }, { activo: false }]);
    mocks.countCategorias.mockResolvedValue(4);
    expect(await fetchServiciosCountsUseCase()).toEqual({
      totalServicios: 0, serviciosActivos: 0, totalCategoriasActivas: 4,
    });
  });
});
