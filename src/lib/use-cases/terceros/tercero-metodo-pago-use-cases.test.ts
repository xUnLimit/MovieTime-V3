import { beforeEach, describe, expect, it, vi } from 'vitest';

const tercerosRepository = vi.hoisted(() => ({
  updateTercero: vi.fn(),
}));

const cacheReactions = vi.hoisted(() => ({
  emitTerceroMetodoPagoUpdated: vi.fn(),
}));

const tercerosStore = vi.hoisted(() => {
  const mockSetState = vi.fn();
  return {
    mockSetState,
    useTercerosStore: {
      getState: vi.fn(() => ({
        terceros: [{ id: 'tercero-1' }],
        selectedTercero: { id: 'tercero-1' },
      })),
      setState: mockSetState,
    },
  };
});

vi.mock('@/lib/supabase/terceros-repository', () => tercerosRepository);
vi.mock('@/lib/events/cache-reactions', () => cacheReactions);
vi.mock('@/store/tercerosStore', () => tercerosStore);

import { updateTercero } from '@/lib/supabase/terceros-repository';
import { syncTerceroMetodoPagoUseCase as syncTerceroMetodoPago } from './tercero-metodo-pago-use-cases';

describe('syncTerceroMetodoPagoUseCase', () => {
  beforeEach(() => {
    vi.mocked(updateTercero).mockReset();
    vi.mocked(updateTercero).mockResolvedValue(undefined);
    tercerosStore.mockSetState.mockReset();
  });

  it('persists pending payment method as null to satisfy the terceros FK', async () => {
    await syncTerceroMetodoPago({
      terceroId: 'tercero-1',
      metodoPagoId: 'pendiente',
    });

    expect(updateTercero).toHaveBeenCalledWith('tercero-1', {
      metodoPagoId: null,
    });
  });

  it('persists a real payment method id unchanged', async () => {
    await syncTerceroMetodoPago({
      terceroId: 'tercero-1',
      metodoPagoId: 'metodo-2',
    });

    expect(updateTercero).toHaveBeenCalledWith('tercero-1', {
      metodoPagoId: 'metodo-2',
    });
  });
});
