import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificacionVenta } from '@/types/notificaciones';

import { useNotificacionesMontos } from './use-notificaciones-montos';

const mockUseNotificaciones = vi.fn();
const mockConvertToUSD = vi.fn(async (amount: number, currency: string) => {
  void currency;
  return amount;
});

vi.mock('@/hooks/use-notificaciones', () => ({
  useNotificaciones: () => mockUseNotificaciones(),
}));

vi.mock('@/modules/payments', () => ({
  convertToUSD: (amount: number, currency: string) => mockConvertToUSD(amount, currency),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function ventaNotification(
  id: string,
  diasRestantes: number,
  precioFinal: number,
): NotificacionVenta {
  return {
    id,
    entidad: 'venta',
    tipo: 'sistema',
    prioridad: 'media',
    titulo: 'Venta por vencer',
    leida: false,
    resaltada: false,
    diasRestantes,
    createdAt: new Date('2026-07-05T00:00:00.000Z'),
    ventaId: `venta-${id}`,
    clienteId: `cliente-${id}`,
    servicioId: `servicio-${id}`,
    clienteNombre: `Cliente ${id}`,
    servicioNombre: 'Crunchyroll',
    categoriaNombre: 'Streaming',
    estado: 'activo',
    fechaFin: new Date('2026-07-05T00:00:00.000Z'),
    precioFinal,
    moneda: 'USD',
  };
}

describe('useNotificacionesMontos', () => {
  beforeEach(() => {
    mockConvertToUSD.mockClear();
  });

  it('includes ventas that expire today in the delayed sales amount', async () => {
    mockUseNotificaciones.mockReturnValue({
      data: [
        ventaNotification('overdue', -1, 5),
        ventaNotification('today', 0, 9),
        ventaNotification('future', 1, 7),
      ],
    });

    const { result } = renderHook(() => useNotificacionesMontos(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.ventasEnRetraso).toBe(14);
    });
    expect(mockConvertToUSD).toHaveBeenCalledWith(5, 'USD');
    expect(mockConvertToUSD).toHaveBeenCalledWith(9, 'USD');
    expect(mockConvertToUSD).not.toHaveBeenCalledWith(7, 'USD');
  });
});
