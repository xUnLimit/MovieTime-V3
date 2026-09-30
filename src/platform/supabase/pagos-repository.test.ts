import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(), createVenta: vi.fn(), createServicio: vi.fn(), removeVenta: vi.fn(), removeServicio: vi.fn(),
}));
vi.mock('./record-core', () => ({ queryDocuments: mocks.query }));
vi.mock('./payments-repository', () => ({
  createPagoVenta: mocks.createVenta, createPagoServicio: mocks.createServicio,
}));
vi.mock('./ventas-repository', () => ({ removePagoVenta: mocks.removeVenta }));
vi.mock('./servicios-repository', () => ({ removePagoServicio: mocks.removeServicio }));

import { createPagoServicio, createPagoVenta, queryPagosServicio, removePagoServicio, removePagoVenta } from './pagos-repository';

beforeEach(() => vi.clearAllMocks());

describe('payment repository facade', () => {
  it('delegates sale and service payment operations to their authoritative adapters', async () => {
    const filters = [{ field: 'estado', operator: '==', value: 'registrado' }] as const;
    await createPagoVenta({} as never); await removePagoVenta('pv'); await queryPagosServicio([...filters]);
    await createPagoServicio({} as never); await removePagoServicio('ps');
    expect(mocks.query).toHaveBeenCalledWith('pagosServicio', [...filters]);
    expect(mocks.createVenta).toHaveBeenCalled(); expect(mocks.createServicio).toHaveBeenCalled();
    expect(mocks.removeVenta).toHaveBeenCalledWith('pv'); expect(mocks.removeServicio).toHaveBeenCalledWith('ps');
  });
});
