import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  context: vi.fn(() => ({ usuarioId: 'u1' })), record: vi.fn().mockResolvedValue(undefined),
  sync: vi.fn(), changes: vi.fn(), safe: vi.fn(), invalidate: vi.fn(),
}));
vi.mock('@/platform/activity/activity-log-adapter', () => ({
  getActivityLogContext: mocks.context, recordActivityLog: mocks.record,
}));
vi.mock('@/application/use-cases/metodos-pago/metodo-pago-dependency-use-cases', () => ({
  syncMetodoPagoDependenciasUseCase: mocks.sync,
}));
vi.mock('@/platform/utils/activityLogHelpers', () => ({ detectarCambios: mocks.changes }));
vi.mock('@/platform/utils/safety', () => ({ safeAsyncSideEffect: mocks.safe }));
vi.mock('@/platform/cache/store-query-invalidation', () => ({ invalidateStoreQueries: mocks.invalidate }));

import {
  afterMetodoPagoCreated, afterMetodoPagoDeleted, afterMetodoPagoUpdated, afterTipoGastoUpdated,
} from './catalogos-mutation-reactions';

const method = { id: 'm1', nombre: 'Visa', moneda: 'USD' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.changes.mockReturnValue([]);
});

describe('catalog mutation reactions', () => {
  it('records create and delete activity with and without entity snapshots', async () => {
    await afterMetodoPagoCreated(method);
    await afterMetodoPagoDeleted('m1', method);
    await afterMetodoPagoDeleted('missing');
    expect(mocks.record).toHaveBeenCalledTimes(3);
    expect(mocks.safe).toHaveBeenCalledTimes(3);
  });

  it('synchronizes dependencies for name and currency changes and records detected changes', async () => {
    mocks.changes.mockReturnValue([{ campo: 'Nombre' }]);
    await afterMetodoPagoUpdated({ metodoId: 'm1', oldMetodo: method, updates: { nombre: 'Nueva' } });
    await afterMetodoPagoUpdated({ metodoId: 'm1', oldMetodo: method, updates: { moneda: 'EUR' } });
    expect(mocks.sync).toHaveBeenCalledTimes(2);
    expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ nombreAnterior: 'Visa', monedaAnterior: 'USD' }));
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ cambios: [{ campo: 'Nombre' }] }));
  });

  it('skips dependency synchronization without meaningful old-value changes', async () => {
    await afterMetodoPagoUpdated({ metodoId: 'm1', oldMetodo: method, updates: { nombre: 'Visa', moneda: 'USD' } });
    await afterMetodoPagoUpdated({ metodoId: 'm2', updates: { nombre: 'Nueva' } });
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ cambios: undefined }));
  });

  it('only invalidates expense types when their name changes', async () => {
    const type = { id: 't1', nombre: 'Hosting' } as never;
    await afterTipoGastoUpdated('t1', type, {});
    await afterTipoGastoUpdated('t1', type, { nombre: 'Hosting' });
    expect(mocks.safe).not.toHaveBeenCalled();
    await afterTipoGastoUpdated('t1', type, { nombre: 'Cloud' });
    expect(mocks.invalidate).toHaveBeenCalledWith(['gastos', 'tiposGasto']);
    expect(mocks.safe).toHaveBeenCalledWith(undefined, expect.objectContaining({ entityId: 't1' }));
  });
});
