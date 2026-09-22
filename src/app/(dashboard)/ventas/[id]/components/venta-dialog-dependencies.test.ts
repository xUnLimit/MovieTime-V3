import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchMetodos: vi.fn(),
  fetchPlanes: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock('@/application/use-cases/ventas/venta-detail-use-cases', () => ({
  fetchCategoriaPlanesQuery: mocks.fetchPlanes,
  fetchMetodosPagoTercerosWithPendingQuery: mocks.fetchMetodos,
}));
vi.mock('@/platform/observability/logger', () => ({ reportError: mocks.reportError }));

import { ensureVentaDialogDependencies } from './venta-dialog-dependencies';

function createQueryClient() {
  return {
    ensureQueryData: vi.fn(({ queryFn }: { queryFn: () => Promise<unknown> }) => queryFn()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchPlanes.mockResolvedValue([]);
});

describe('ensureVentaDialogDependencies', () => {
  it('reports ready when an active tercero payment method is available', async () => {
    mocks.fetchMetodos.mockResolvedValue([
      { id: 'pendiente', activo: true, asociadoA: 'tercero' },
      { id: 'metodo-1', activo: true, asociadoA: 'tercero' },
    ]);

    await expect(ensureVentaDialogDependencies({
      categoriaId: 'categoria-1',
      queryClient: createQueryClient() as never,
    })).resolves.toEqual({ status: 'ready' });
  });

  it('reports empty when renewal has no usable payment methods', async () => {
    mocks.fetchMetodos.mockResolvedValue([
      { id: 'pendiente', activo: true, asociadoA: 'tercero' },
      { id: 'metodo-inactivo', activo: false, asociadoA: 'tercero' },
    ]);

    await expect(ensureVentaDialogDependencies({
      queryClient: createQueryClient() as never,
    })).resolves.toEqual({ status: 'empty' });
  });

  it('reports unavailable and logs context when a dependency cannot be loaded', async () => {
    const error = new Error('network error');
    mocks.fetchMetodos.mockRejectedValue(error);

    await expect(ensureVentaDialogDependencies({
      categoriaId: 'categoria-1',
      queryClient: createQueryClient() as never,
    })).resolves.toEqual({ status: 'unavailable' });
    expect(mocks.reportError).toHaveBeenCalledWith(
      'VentaDetalle',
      'Error cargando metodos de pago y planes',
      error,
    );
  });
});
