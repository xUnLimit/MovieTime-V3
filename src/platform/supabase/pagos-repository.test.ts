import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getById: vi.fn(), query: vi.fn(), count: vi.fn(), update: vi.fn(),
  createVenta: vi.fn(), createServicio: vi.fn(), removeVenta: vi.fn(), removeServicio: vi.fn(),
}));
vi.mock('./record-core', () => ({
  getById: mocks.getById, queryDocuments: mocks.query, getCount: mocks.count,
  update: mocks.update, logCacheHit: vi.fn(),
}));
vi.mock('./payments-repository', () => ({
  createPagoVenta: mocks.createVenta, createPagoServicio: mocks.createServicio,
}));
vi.mock('./ventas-repository', () => ({ removePagoVenta: mocks.removeVenta }));
vi.mock('./servicios-repository', () => ({ removePagoServicio: mocks.removeServicio }));

import {
  countPagosServicio, countPagosVenta, createPagoServicio, createPagoVenta,
  getPagoServicioById, getPagoVentaById, queryPagosServicio, queryPagosVenta,
  removePagoServicio, removePagoVenta, updatePagoServicio, updatePagoVenta,
} from './pagos-repository';

beforeEach(() => vi.clearAllMocks());

describe('payment repository facade', () => {
  it('delegates sale and service payment operations to their authoritative adapters', async () => {
    const filters = [{ field: 'estado', operator: '==', value: 'registrado' }] as const;
    await getPagoVentaById('pv'); await queryPagosVenta([...filters]); await countPagosVenta([...filters]);
    await createPagoVenta({} as never); await updatePagoVenta('pv', { notas: 'n' }); await removePagoVenta('pv');
    await getPagoServicioById('ps'); await queryPagosServicio([...filters]); await countPagosServicio([...filters]);
    await createPagoServicio({} as never); await updatePagoServicio('ps', { notas: 'n' }); await removePagoServicio('ps');
    expect(mocks.getById).toHaveBeenCalledWith('pagosVenta', 'pv');
    expect(mocks.getById).toHaveBeenCalledWith('pagosServicio', 'ps');
    expect(mocks.createVenta).toHaveBeenCalled(); expect(mocks.createServicio).toHaveBeenCalled();
    expect(mocks.removeVenta).toHaveBeenCalledWith('pv'); expect(mocks.removeServicio).toHaveBeenCalledWith('ps');
  });
});
