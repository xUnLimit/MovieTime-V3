import { afterEach, describe, expect, it, vi } from 'vitest';

import { storeEventBus } from './store-event-bus';

describe('storeEventBus', () => {
  afterEach(() => {
    storeEventBus.clear();
  });

  it('emits payloads to listeners for the matching event type', () => {
    const handler = vi.fn();

    storeEventBus.on('VENTA_CREATED', handler);
    storeEventBus.emit({ type: 'VENTA_CREATED', ventaId: 'venta-1' });

    expect(handler).toHaveBeenCalledWith({ type: 'VENTA_CREATED', ventaId: 'venta-1' });
  });

  it('does not notify listeners registered for a different event type', () => {
    const handler = vi.fn();

    storeEventBus.on('VENTA_UPDATED', handler);
    storeEventBus.emit({ type: 'VENTA_DELETED', ventaId: 'venta-1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes listeners', () => {
    const handler = vi.fn();
    const unsubscribe = storeEventBus.on('SERVICIO_UPDATED', handler);

    unsubscribe();
    storeEventBus.emit({ type: 'SERVICIO_UPDATED', servicioId: 'servicio-1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('clears all listeners', () => {
    const ventaHandler = vi.fn();
    const dashboardHandler = vi.fn();

    storeEventBus.on('VENTA_UPDATED', ventaHandler);
    storeEventBus.on('DASHBOARD_INVALIDATED', dashboardHandler);
    storeEventBus.clear();

    storeEventBus.emit({ type: 'VENTA_UPDATED', ventaId: 'venta-1' });
    storeEventBus.emit({ type: 'DASHBOARD_INVALIDATED' });

    expect(ventaHandler).not.toHaveBeenCalled();
    expect(dashboardHandler).not.toHaveBeenCalled();
  });

  it('emits categoria invalidation events without payload requirements', () => {
    const handler = vi.fn();

    storeEventBus.on('CATEGORIAS_INVALIDATED', handler);
    storeEventBus.emit({ type: 'CATEGORIAS_INVALIDATED' });

    expect(handler).toHaveBeenCalledWith({ type: 'CATEGORIAS_INVALIDATED' });
  });
});
