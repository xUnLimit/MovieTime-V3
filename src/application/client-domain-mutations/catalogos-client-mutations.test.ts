import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createCategoria: vi.fn(), updateCategoria: vi.fn(), deleteCategoria: vi.fn(),
  createMetodo: vi.fn(), updateMetodo: vi.fn(), deleteMetodo: vi.fn(), getMetodo: vi.fn(),
  createTipo: vi.fn(), updateTipo: vi.fn(), deleteTipo: vi.fn(), getTipo: vi.fn(),
  afterCreated: vi.fn(), afterUpdated: vi.fn(), afterDeleted: vi.fn(), afterTipo: vi.fn(),
  invalidate: vi.fn(), log: vi.fn(() => ({ usuarioId: 'u1' })),
}));
vi.mock('@/application/use-cases/categorias-use-cases', () => ({
  createCategoriaUseCase: mocks.createCategoria, updateCategoriaUseCase: mocks.updateCategoria,
  deleteCategoriaUseCase: mocks.deleteCategoria,
}));
vi.mock('@/application/use-cases/metodos-pago-use-cases', () => ({
  createMetodoPagoUseCase: mocks.createMetodo, updateMetodoPagoUseCase: mocks.updateMetodo,
  deleteMetodoPagoUseCase: mocks.deleteMetodo, getMetodoPagoUseCase: mocks.getMetodo,
}));
vi.mock('@/application/use-cases/tipos-gasto-use-cases', () => ({
  createTipoGastoUseCase: mocks.createTipo, updateTipoGastoUseCase: mocks.updateTipo,
  deleteTipoGastoUseCase: mocks.deleteTipo, getTipoGastoUseCase: mocks.getTipo,
}));
vi.mock('@/application/store-reactions/catalogos-mutation-reactions', () => ({
  afterMetodoPagoCreated: mocks.afterCreated, afterMetodoPagoUpdated: mocks.afterUpdated,
  afterMetodoPagoDeleted: mocks.afterDeleted, afterTipoGastoUpdated: mocks.afterTipo,
}));
vi.mock('@/platform/cache/store-query-invalidation', () => ({ invalidateStoreQueries: mocks.invalidate }));
vi.mock('@/platform/activity/activity-log-adapter', () => ({ getActivityLogOptions: mocks.log }));

import {
  createCategoriaMutation, createMetodoPagoMutation, createTipoGastoMutation,
  deleteCategoriaMutation, deleteMetodoPagoMutation, deleteTipoGastoMutation,
  toggleMetodoPagoActivoMutation, toggleTipoGastoActivoMutation,
  updateCategoriaMutation, updateMetodoPagoMutation, updateTipoGastoMutation,
} from './catalogos-client-mutations';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createMetodo.mockResolvedValue({ id: 'm1', nombre: 'Visa', activo: true });
});

describe('catalog client mutations', () => {
  it('runs category mutations with activity context and invalidation', async () => {
    const category = { id: 'c1', nombre: 'Streaming' } as never;
    await createCategoriaMutation(category);
    await updateCategoriaMutation('c1', { nombre: 'Nueva' }, category);
    await deleteCategoriaMutation('c1', category);
    expect(mocks.createCategoria).toHaveBeenCalledWith(category, { usuarioId: 'u1' });
    expect(mocks.updateCategoria).toHaveBeenCalledWith('c1', { nombre: 'Nueva' }, expect.objectContaining({ oldCategoria: category }));
    expect(mocks.deleteCategoria).toHaveBeenCalledWith('c1', expect.objectContaining({ categoria: category }));
    expect(mocks.invalidate).toHaveBeenCalledTimes(3);
  });

  it('creates, updates, toggles and deletes payment methods with supplied and loaded snapshots', async () => {
    const method = { id: 'm1', nombre: 'Visa', activo: true } as never;
    await createMetodoPagoMutation(method);
    await updateMetodoPagoMutation('m1', { nombre: 'Nueva' }, method);
    mocks.getMetodo.mockResolvedValue(method);
    await updateMetodoPagoMutation('m1', { moneda: 'EUR' });
    await toggleMetodoPagoActivoMutation('m1', method);
    await toggleMetodoPagoActivoMutation('m1');
    await deleteMetodoPagoMutation('m1', method);
    await deleteMetodoPagoMutation('m1');
    expect(mocks.afterCreated).toHaveBeenCalled();
    expect(mocks.afterUpdated).toHaveBeenCalledWith(expect.objectContaining({ metodoId: 'm1' }));
    expect(mocks.updateMetodo).toHaveBeenCalledWith('m1', { activo: false });
    expect(mocks.afterDeleted).toHaveBeenCalledTimes(2);
  });

  it('rejects toggling a missing payment method', async () => {
    mocks.getMetodo.mockResolvedValue(null);
    await expect(toggleMetodoPagoActivoMutation('missing')).rejects.toThrow('Metodo de pago no encontrado');
  });

  it('creates, updates, toggles and deletes expense types', async () => {
    const type = { id: 't1', nombre: 'Hosting', activo: true } as never;
    mocks.updateTipo.mockResolvedValue({ tipoActual: type, finalUpdates: { nombre: 'Cloud' } });
    mocks.getTipo.mockResolvedValue(type);
    await createTipoGastoMutation(type);
    await updateTipoGastoMutation('t1', { nombre: 'Cloud' });
    await toggleTipoGastoActivoMutation('t1');
    await deleteTipoGastoMutation('t1');
    expect(mocks.afterTipo).toHaveBeenCalledWith('t1', type, { nombre: 'Cloud' });
    expect(mocks.updateTipo).toHaveBeenCalledWith('t1', { activo: false });
  });

  it('rejects toggling a missing expense type', async () => {
    mocks.getTipo.mockResolvedValue(null);
    await expect(toggleTipoGastoActivoMutation('missing')).rejects.toThrow('Tipo de gasto no encontrado');
  });
});
