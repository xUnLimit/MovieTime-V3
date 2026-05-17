import { beforeEach, describe, expect, it, vi } from 'vitest';

const tercerosRepository = vi.hoisted(() => ({
  updateTercero: vi.fn(),
}));

const tercerosStore = vi.hoisted(() => ({
  setState: vi.fn(),
}));

vi.mock('@/lib/supabase/terceros-repository', () => tercerosRepository);
vi.mock('@/store/tercerosStore', () => ({
  useTercerosStore: tercerosStore,
}));

import { updateTercero } from '@/lib/supabase/terceros-repository';
import { useTercerosStore } from '@/store/tercerosStore';
import { syncTerceroMetodoPago } from './terceroMetodoPagoSyncService';

const terceroBase = {
  id: 'tercero-1',
  nombre: 'Ana',
  apellido: 'Perez',
  tipo: 'cliente',
  telefono: '+507 6000-0000',
  metodoPagoId: 'metodo-old',
  metodoPagoNombre: 'Banco viejo',
  active: true,
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
  createdBy: 'user-1',
};

describe('syncTerceroMetodoPago', () => {
  beforeEach(() => {
    vi.mocked(updateTercero).mockReset();
    vi.mocked(useTercerosStore.setState).mockReset();
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

    const updater = vi.mocked(useTercerosStore.setState).mock.calls[0][0] as (state: {
      terceros: typeof terceroBase[];
      selectedTercero: typeof terceroBase;
    }) => { terceros: typeof terceroBase[]; selectedTercero: typeof terceroBase };

    const nextState = updater({
      terceros: [terceroBase],
      selectedTercero: terceroBase,
    });

    expect(nextState.terceros[0].metodoPagoId).toBe('');
    expect(nextState.selectedTercero.metodoPagoId).toBe('');
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
