import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const updateServicioMutation = vi.hoisted(() => vi.fn());
const deleteNotificacionesPorServicioUseCase = vi.hoisted(() => vi.fn());

vi.mock('@/application/client-domain-mutations', () => ({
  deleteVentaMutation: vi.fn(),
  refreshServicioProfileCountMutation: vi.fn(),
  updateServicioMutation,
}));
vi.mock('@/application/use-cases/notificaciones/notificaciones-store-use-cases', () => ({
  deleteNotificacionesPorServicioUseCase,
  deleteNotificacionesPorVentaUseCase: vi.fn(),
}));

import { useVentaDetalleStoreDependencies } from './venta-detalle-store-dependencies';

describe('venta detalle refund dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateServicioMutation.mockResolvedValue(undefined);
    deleteNotificacionesPorServicioUseCase.mockResolvedValue(undefined);
  });

  it('inactivates the complete service and removes its notifications', async () => {
    const { result } = renderHook(() => useVentaDetalleStoreDependencies());

    await result.current.inactivateServicio('servicio-1', 'Cuenta cancelada');

    expect(updateServicioMutation).toHaveBeenCalledWith('servicio-1', {
      activo: false,
      cortadoAt: expect.any(Date),
      motivoCorte: 'Cuenta cancelada',
    });
    expect(deleteNotificacionesPorServicioUseCase).toHaveBeenCalledWith('servicio-1');
  });
});
