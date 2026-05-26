import { beforeEach, describe, expect, it } from 'vitest';

import type { VentaDoc } from '@/types';

const ventaBase = {
  id: 'venta-1',
  clienteId: 'tercero-1',
  clienteNombre: 'Cliente',
  categoriaId: 'categoria-1',
  servicioId: 'servicio-1',
  servicioNombre: 'Netflix',
  estado: 'activo',
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
} as VentaDoc;

describe('useVentasStore', () => {
  beforeEach(async () => {
    const { useVentasStore } = await import('./ventasStore');
    useVentasStore.setState({
      error: null,
      selectedVenta: null,
    });
  });

  it('keeps only UI state and does not expose remote mutation APIs', async () => {
    const { useVentasStore } = await import('./ventasStore');
    const state = useVentasStore.getState() as Record<string, unknown>;

    expect(state.ventas).toBeUndefined();
    expect(state.fetchVentas).toBeUndefined();
    expect(state.fetchCounts).toBeUndefined();
    expect(state.createVenta).toBeUndefined();
    expect(state.updateVenta).toBeUndefined();
    expect(state.deleteVenta).toBeUndefined();
  });

  it('stores the selected venta locally', async () => {
    const { useVentasStore } = await import('./ventasStore');

    useVentasStore.getState().setSelectedVenta(ventaBase);

    expect(useVentasStore.getState().selectedVenta).toEqual(ventaBase);
  });
});
