import { beforeEach, describe, expect, it, vi } from 'vitest';

const tercerosRepository = vi.hoisted(() => ({
  updateTercero: vi.fn(),
}));

const localStateReactions = vi.hoisted(() => ({
  updateTerceroMetodoPagoLocalState: vi.fn(),
}));

vi.mock('@/lib/supabase/terceros-repository', () => tercerosRepository);
vi.mock('@/lib/store-reactions/terceros-local-state-reactions', () => localStateReactions);

import { updateTerceroMetodoPagoLocalState } from '@/lib/store-reactions/terceros-local-state-reactions';
import { updateTercero } from '@/lib/supabase/terceros-repository';
import { syncTerceroMetodoPagoUseCase as syncTerceroMetodoPago } from './tercero-metodo-pago-use-cases';

describe('syncTerceroMetodoPagoUseCase', () => {
  beforeEach(() => {
    vi.mocked(updateTercero).mockReset();
    vi.mocked(updateTerceroMetodoPagoLocalState).mockReset();
    vi.mocked(updateTercero).mockResolvedValue(undefined);
  });

  it('persists pending payment method as null to satisfy the terceros FK', async () => {
    await syncTerceroMetodoPago({
      terceroId: 'tercero-1',
      metodoPagoId: 'pendiente',
    });

    expect(updateTercero).toHaveBeenCalledWith('tercero-1', {
      metodoPagoId: null,
    });
    expect(updateTerceroMetodoPagoLocalState).toHaveBeenCalledWith('tercero-1', '');
  });

  it('persists a real payment method id unchanged', async () => {
    await syncTerceroMetodoPago({
      terceroId: 'tercero-1',
      metodoPagoId: 'metodo-2',
    });

    expect(updateTercero).toHaveBeenCalledWith('tercero-1', {
      metodoPagoId: 'metodo-2',
    });
    expect(updateTerceroMetodoPagoLocalState).toHaveBeenCalledWith('tercero-1', 'metodo-2');
  });
});
