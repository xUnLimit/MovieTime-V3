import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const servicioDetailMocks = vi.hoisted(() => ({
  fetchServicioDetalleBundleUseCase: vi.fn(),
  fetchServicioVentasProfilesUseCase: vi.fn(),
}));

vi.mock('@/application/use-cases/servicios/servicio-detail-use-cases', () => ({
  fetchServicioDetalleBundleUseCase: servicioDetailMocks.fetchServicioDetalleBundleUseCase,
  fetchServicioVentasProfilesUseCase: servicioDetailMocks.fetchServicioVentasProfilesUseCase,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { useServicioDetalleData } from './useServicioDetalleData';

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

describe('useServicioDetalleData', () => {
  beforeEach(() => {
    servicioDetailMocks.fetchServicioDetalleBundleUseCase.mockReset();
    servicioDetailMocks.fetchServicioVentasProfilesUseCase.mockReset();
  });

  it('keeps ventasServicio stable while the ventas query has not resolved', async () => {
    servicioDetailMocks.fetchServicioDetalleBundleUseCase.mockResolvedValue({
      categoria: null,
      metodoPago: null,
      servicio: null,
    });
    servicioDetailMocks.fetchServicioVentasProfilesUseCase.mockImplementation(
      () => new Promise(() => undefined),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).includes('Maximum update depth exceeded')) {
        throw new Error('Maximum update depth exceeded');
      }
    });

    const { result } = renderHook(() => useServicioDetalleData('servicio-1'), {
      wrapper: createWrapper(),
    });

    const initialVentasServicio = result.current.ventasServicio;

    await waitFor(() => {
      expect(result.current.ventasServicio).toBe(initialVentasServicio);
    });
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded'),
    );

    consoleError.mockRestore();
  });
});
