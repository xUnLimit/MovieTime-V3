import { beforeEach, describe, expect, it } from 'vitest';

import type { Tercero } from '@/types';

const selectedTercero: Tercero = {
  id: 'cliente-1',
  nombre: 'Ana',
  apellido: 'Perez',
  tipo: 'cliente',
  telefono: '+507 6000-0000',
  metodoPagoId: 'metodo-1',
  metodoPagoNombre: 'Yappy',
  moneda: 'USD',
  active: true,
  createdBy: 'admin-1',
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  serviciosActivos: 1,
};

describe('useTercerosStore', () => {
  beforeEach(async () => {
    const { useTercerosStore } = await import('@/store/tercerosStore');
    useTercerosStore.setState({
      error: null,
      selectedTercero: null,
    });
  });

  it('keeps only UI state and does not expose remote mutation APIs', async () => {
    const { useTercerosStore } = await import('@/store/tercerosStore');
    const state = useTercerosStore.getState() as unknown as Record<string, unknown>;

    expect(state.fetchTerceros).toBeUndefined();
    expect(state.fetchCounts).toBeUndefined();
    expect(state.createTercero).toBeUndefined();
    expect(state.updateTercero).toBeUndefined();
    expect(state.deleteTercero).toBeUndefined();
  });

  it('stores the selected tercero locally', async () => {
    const { useTercerosStore } = await import('@/store/tercerosStore');

    useTercerosStore.getState().setSelectedTercero(selectedTercero);

    expect(useTercerosStore.getState().selectedTercero).toEqual(selectedTercero);
  });
});
