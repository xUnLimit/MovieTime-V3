import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), all: vi.fn(), byId: vi.fn(), remove: vi.fn(), update: vi.fn(),
  read: vi.fn(), services: vi.fn(), terceros: vi.fn(),
}));
vi.mock('@/platform/supabase/catalogos-repository', () => ({
  createMetodoPago: mocks.create, getMetodosPago: mocks.all, getMetodoPagoById: mocks.byId,
  removeMetodoPago: mocks.remove, updateMetodoPago: mocks.update,
}));
vi.mock('@/platform/supabase/domain-read-adapters', () => ({
  getMetodoPagoRead: mocks.read, queryMetodosPagoServiciosRead: mocks.services,
  queryMetodosPagoTercerosRead: mocks.terceros,
}));

import {
  createMetodoPagoUseCase, deleteMetodoPagoUseCase, fetchMetodosPagoUseCase,
  getMetodoPagoReadUseCase, getMetodoPagoUseCase, queryMetodosPagoServiciosUseCase,
  queryMetodosPagoTercerosUseCase, updateMetodoPagoUseCase,
} from './metodos-pago-use-cases';

beforeEach(() => vi.clearAllMocks());

describe('payment method use cases', () => {
  it('delegates all reads and filtered queries', async () => {
    await getMetodoPagoUseCase('m1'); await getMetodoPagoReadUseCase('m1'); await fetchMetodosPagoUseCase();
    await queryMetodosPagoServiciosUseCase(); await queryMetodosPagoServiciosUseCase({ soloActivos: true });
    await queryMetodosPagoTercerosUseCase(); await queryMetodosPagoTercerosUseCase({ soloActivos: true });
    expect(mocks.services).toHaveBeenCalledWith({});
    expect(mocks.services).toHaveBeenCalledWith({ soloActivos: true });
  });

  it('creates timestamps and delegates update/delete writes', async () => {
    mocks.create.mockResolvedValue('m1');
    const result = await createMetodoPagoUseCase({ nombre: 'Visa' } as never);
    expect(result).toEqual(expect.objectContaining({ id: 'm1', nombre: 'Visa', createdAt: expect.any(Date), updatedAt: expect.any(Date) }));
    await updateMetodoPagoUseCase('m1', { nombre: 'Nueva' });
    await deleteMetodoPagoUseCase('m1');
    expect(mocks.update).toHaveBeenCalledWith('m1', { nombre: 'Nueva' });
    expect(mocks.remove).toHaveBeenCalledWith('m1');
  });
});
