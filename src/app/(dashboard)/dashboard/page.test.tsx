import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchDashboardMock = vi.fn();
const fetchNotificacionesMock = vi.fn();
const fetchCategoriasMock = vi.fn();
const performGlobalSyncMock = vi.fn();
const toastLoadingMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/dashboard/DashboardMetrics', () => ({
  DashboardMetrics: () => <div>DashboardMetrics</div>,
}));

vi.mock('@/components/dashboard/RecentActivity', () => ({
  RecentActivity: () => <div>RecentActivity</div>,
}));

vi.mock('@/components/dashboard/PronosticoFinanciero', () => ({
  PronosticoFinanciero: () => <div>PronosticoFinanciero</div>,
}));

vi.mock('@/components/layout/UserMenu', () => ({
  UserMenu: () => <div>UserMenu</div>,
}));

vi.mock('@/components/notificaciones/NotificationBell', () => ({
  NotificationBell: () => <div>NotificationBell</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div>Skeleton</div>,
}));

const dashboardStoreHook = Object.assign(
  vi.fn(() => ({
    fetchDashboard: fetchDashboardMock,
    isRecalculating: false,
  })),
  {
    // Used by: `await import('@/store/dashboardStore')` inside handleRecalculate
    getState: () => ({ fetchDashboard: fetchDashboardMock }),
  }
);

vi.mock('@/store/dashboardStore', () => ({
  useDashboardStore: dashboardStoreHook,
}));

// Mock the dynamic import of centralSyncService used inside handleRecalculate
vi.mock('@/lib/services/centralSyncService', () => ({
  performGlobalSync: performGlobalSyncMock,
}));

const useNotificacionesStoreMock = Object.assign(
  () => ({
    fetchNotificaciones: fetchNotificacionesMock,
  }),
  {
    getState: () => ({
      notificaciones: [],
    }),
  }
);

vi.mock('@/store/notificacionesStore', () => ({
  useNotificacionesStore: useNotificacionesStoreMock,
}));

vi.mock('@/store/serviciosStore', () => ({
  useServiciosStore: () => ({}),
}));

vi.mock('@/store/categoriasStore', () => ({
  useCategoriasStore: () => ({
    fetchCategorias: fetchCategoriasMock,
  }),
}));

vi.mock('@/store/usuariosStore', () => ({
  useUsuariosStore: () => ({}),
}));

vi.mock('@/types/notificaciones', () => ({
  esNotificacionVenta: () => false,
  esNotificacionServicio: () => false,
}));

vi.mock('sonner', () => ({
  toast: {
    loading: toastLoadingMock,
    success: toastSuccessMock,
    error: toastErrorMock,
    custom: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('Dashboard sync button', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fetchDashboardMock.mockResolvedValue(undefined);
    fetchNotificacionesMock.mockResolvedValue(undefined);
    toastLoadingMock.mockReturnValue('toast-1');

    performGlobalSyncMock.mockResolvedValue({
      usuariosReparados: 1,
      serviciosCorregidos: 0,
      serviciosRevisados: 3,
      ventasActualizadas: 2,
    });

    fetchCategoriasMock.mockResolvedValue(undefined);
  });

  it('dispara la resincronizacion de servicios al hacer click en Sincronizar sistema', async () => {
    const { default: DashboardPage } = await import('./page');

    render(<DashboardPage />);

    const button = await screen.findByRole('button', { name: /sincronizar sistema/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(performGlobalSyncMock).toHaveBeenCalledTimes(1);
      expect(fetchCategoriasMock).toHaveBeenCalledWith(true);
    });

    expect(toastSuccessMock).toHaveBeenCalledWith(
      'Sistema sincronizado correctamente',
      expect.objectContaining({
        id: 'toast-1',
        description: expect.stringContaining('2 venta(s) resincronizadas desde 3 servicio(s).'),
      })
    );
  });
});
