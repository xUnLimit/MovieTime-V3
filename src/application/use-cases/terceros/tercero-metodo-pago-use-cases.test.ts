import { beforeEach, describe, expect, it, vi } from 'vitest';

const tercerosWriteAdapter = vi.hoisted(() => ({
  updateTerceroMetodoPago: vi.fn(),
}));

const cacheReactions = vi.hoisted(() => ({
  emitTerceroMetodoPagoUpdated: vi.fn(),
}));

vi.mock('@/application/terceros/terceros-write-adapter', () => tercerosWriteAdapter);
vi.mock('@/platform/events/cache-reactions', () => cacheReactions);

import { updateTerceroMetodoPago } from '@/application/terceros/terceros-write-adapter';
import { syncTerceroMetodoPagoUseCase as syncTerceroMetodoPago } from './tercero-metodo-pago-use-cases';

describe('syncTerceroMetodoPagoUseCase', () => {
  beforeEach(() => {
    vi.mocked(updateTerceroMetodoPago).mockReset();
    vi.mocked(updateTerceroMetodoPago).mockResolvedValue(undefined);
  });

  it('persists pending payment method as null to satisfy the terceros FK', async () => {
    await syncTerceroMetodoPago({
      terceroId: 'tercero-1',
      metodoPagoId: 'pendiente',
    });

    expect(updateTerceroMetodoPago).toHaveBeenCalledWith('tercero-1', null);
  });

  it('persists a real payment method id unchanged', async () => {
    await syncTerceroMetodoPago({
      terceroId: 'tercero-1',
      metodoPagoId: 'metodo-2',
    });

    expect(updateTerceroMetodoPago).toHaveBeenCalledWith('tercero-1', 'metodo-2');
  });
});
