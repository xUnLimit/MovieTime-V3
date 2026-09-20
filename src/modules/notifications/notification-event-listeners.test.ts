import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  servicio: vi.fn(), venta: vi.fn(), full: vi.fn(), error: vi.fn(),
}));
vi.mock('./notification-sync-orchestrator', () => ({
  sincronizarUnServicio: mocks.servicio,
  sincronizarUnaVenta: mocks.venta,
  sincronizarNotificacionesForzado: mocks.full,
}));
vi.mock('@/platform/observability/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: mocks.error }),
}));

import { storeEventBus } from '@/platform/events/store-event-bus';
import { initializeNotificationEventListeners } from './notification-event-listeners';

function emitAllEvents() {
  storeEventBus.emit({ type: 'SERVICIO_CREATED', servicioId: 's1' });
  storeEventBus.emit({ type: 'SERVICIO_UPDATED', servicioId: 's2' });
  storeEventBus.emit({ type: 'SERVICIO_DELETED', servicioId: 's3' });
  storeEventBus.emit({ type: 'SERVICIO_ARCHIVED', servicioId: 's4' });
  storeEventBus.emit({ type: 'VENTA_CREATED', ventaId: 'v1' });
  storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId: 'v2' });
  storeEventBus.emit({ type: 'VENTA_DELETED', ventaId: 'v3' });
  storeEventBus.emit({ type: 'NOTIFICACIONES_INVALIDATED' });
  storeEventBus.emit({ type: 'TERCERO_DELETED', terceroId: 't1' });
}

beforeEach(() => {
  storeEventBus.clear();
  vi.clearAllMocks();
  mocks.servicio.mockResolvedValue(undefined);
  mocks.venta.mockResolvedValue(undefined);
  mocks.full.mockResolvedValue(undefined);
});

describe('notification event listeners', () => {
  it('routes every domain event to the appropriate synchronization', async () => {
    initializeNotificationEventListeners();
    emitAllEvents();
    await vi.waitFor(() => expect(mocks.full).toHaveBeenCalledTimes(4));
    expect(mocks.servicio.mock.calls.map(([id]) => id)).toEqual(['s1', 's2', 's4']);
    expect(mocks.venta.mock.calls.map(([id]) => id)).toEqual(['v1', 'v2']);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('captures and logs every asynchronous synchronization failure', async () => {
    mocks.servicio.mockRejectedValue(new Error('service'));
    mocks.venta.mockRejectedValue(new Error('sale'));
    mocks.full.mockRejectedValue(new Error('full'));
    initializeNotificationEventListeners();
    emitAllEvents();
    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(9));
    expect(mocks.error).toHaveBeenCalledWith('Failed to sync after SERVICIO_CREATED', expect.objectContaining({ servicioId: 's1' }));
    expect(mocks.error).toHaveBeenCalledWith('Failed to sync after VENTA_UPDATED', expect.objectContaining({ ventaId: 'v2' }));
    expect(mocks.error).toHaveBeenCalledWith('Failed to sync after TERCERO_DELETED', expect.any(Object));
  });
});
