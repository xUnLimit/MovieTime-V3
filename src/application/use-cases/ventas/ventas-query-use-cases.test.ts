import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ detail: vi.fn(), count: vi.fn(), ventas: vi.fn(), pagos: vi.fn() }));
vi.mock('@/platform/supabase/domain-read-adapters', () => ({ getVentaDetalleRead: mocks.detail }));
vi.mock('@/platform/supabase/ventas-repository', () => ({
  countVentas: mocks.count, queryVentas: mocks.ventas, queryPagosVenta: mocks.pagos,
}));

import { countVentasActivasByServicioUseCase, fetchVentasByClienteIdsUseCase, fetchVentasCountsUseCase, getVentaDetalleUseCase, queryPagosVentaByVentaUseCase, queryVentasActivasByServiciosUseCase, queryVentasByClienteUseCase, queryVentasByServicioUseCase } from './ventas-query-use-cases';

beforeEach(() => vi.clearAllMocks());

describe('sales query use cases', () => {
  it('delegates detail, counts and individual filters', async () => {
    mocks.detail.mockResolvedValue({ id: 'v1' });
    mocks.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mocks.ventas.mockResolvedValue([]); mocks.pagos.mockResolvedValue([]);
    expect(await getVentaDetalleUseCase('v1')).toEqual({ id: 'v1' });
    expect(await fetchVentasCountsUseCase()).toEqual({ totalVentas: 3, ventasActivas: 2, ventasInactivas: 1 });
    await queryVentasByServicioUseCase('s1'); await queryVentasActivasByServiciosUseCase(['s1']);
    await queryVentasByClienteUseCase('c1'); await queryPagosVentaByVentaUseCase('v1');
    await countVentasActivasByServicioUseCase('s1');
    expect(mocks.ventas).toHaveBeenCalledTimes(3);
  });

  it('chunks sale queries by cliente and flattens the results', async () => {
    mocks.ventas.mockResolvedValueOnce([{ id: 'v1' }]).mockResolvedValueOnce([{ id: 'v2' }]);
    expect(await fetchVentasByClienteIdsUseCase(['c1', 'c2', 'c3'], 2)).toEqual([{ id: 'v1' }, { id: 'v2' }]);
    expect(mocks.ventas).toHaveBeenNthCalledWith(1, [{ field: 'clienteId', operator: 'in', value: ['c1', 'c2'] }]);
    expect(mocks.ventas).toHaveBeenNthCalledWith(2, [{ field: 'clienteId', operator: 'in', value: ['c3'] }]);
    expect(await fetchVentasByClienteIdsUseCase([], 2)).toEqual([]);
  });
});
