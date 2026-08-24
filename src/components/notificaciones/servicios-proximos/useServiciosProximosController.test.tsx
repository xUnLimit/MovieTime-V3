import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificacionServicioConId } from './types';
import { useServiciosProximosController } from './useServiciosProximosController';

const mocks = vi.hoisted(() => ({
  inactivateServicio: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/hooks/use-notificaciones', () => ({
  useNotificaciones: () => ({ data: [] }),
}));

vi.mock('@/platform/activity/activity-log-adapter', () => ({
  getActivityLogOptions: () => ({}),
}));

vi.mock(
  '@/application/use-cases/notificaciones/notificaciones-actions-use-cases',
  () => ({
    inactivateServicioFromNotificationUseCase: mocks.inactivateServicio,
  }),
);

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
  },
}));

const notification = {
  id: 'notif-servicio-1',
  entidad: 'servicio',
  tipo: 'sistema',
  prioridad: 'alta',
  titulo: 'Servicio próximo a vencer',
  leida: false,
  resaltada: false,
  diasRestantes: 3,
  createdAt: new Date('2026-08-20T00:00:00.000Z'),
  servicioId: 'servicio-1',
  categoriaId: 'categoria-1',
  servicioNombre: 'Netflix',
  categoriaNombre: 'Streaming',
  tipoServicio: 'cuenta-completa',
  correo: 'cuenta@example.com',
  contrasena: 'secreto',
  metodoPagoNombre: 'Visa',
  moneda: 'USD',
  costoServicio: 15,
  cicloPago: 'mensual',
  fechaVencimiento: new Date(2026, 7, 27),
  renovacionAutomatica: false,
} satisfies NotificacionServicioConId;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useServiciosProximosController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('propaga el error de inactivación para que el diálogo permanezca abierto', async () => {
    const failure = new Error('No se pudo inactivar');
    mocks.inactivateServicio.mockRejectedValue(failure);
    const { result } = renderHook(
      () => useServiciosProximosController({ soloAutorrenovables: false }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.handleAcciones(notification));

    await expect(result.current.handleInactivarServicio()).rejects.toBe(failure);
    expect(mocks.toastError).toHaveBeenCalledWith('Error al inactivar servicio', {
      description: 'No se pudo inactivar el servicio. Intenta nuevamente.',
    });
  });
});

