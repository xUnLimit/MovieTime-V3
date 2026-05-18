import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchDashboardMock = vi.fn();
const fetchNotificacionesMock = vi.fn();

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

vi.mock('@/components/notificaciones/NotificationBell', () => ({
  NotificationBell: () => <div>NotificationBell</div>,
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
  vi.fn((selector?: (state: { fetchDashboard: typeof fetchDashboardMock }) => unknown) => {
    const state = {
      fetchDashboard: fetchDashboardMock,
    };

    return selector ? selector(state) : state;
  }),
  { getState: () => ({ fetchDashboard: fetchDashboardMock }) }
);

vi.mock('@/store/dashboardStore', () => ({
  useDashboardStore: dashboardStoreHook,
}));

const useNotificacionesStoreMock = Object.assign(
  (selector?: (state: { fetchNotificaciones: typeof fetchNotificacionesMock; notificaciones: never[] }) => unknown) => {
    const state = {
      fetchNotificaciones: fetchNotificacionesMock,
      notificaciones: [],
    };

    return selector ? selector(state) : state;
  },
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

vi.mock('@/store/tercerosStore', () => ({
  useTercerosStore: () => ({}),
}));

vi.mock('@/types/notificaciones', () => ({
  esNotificacionVenta: () => false,
  esNotificacionServicio: () => false,
}));

vi.mock('sonner', () => ({
  toast: {
    custom: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('Dashboard header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__movietimeDashboardToastState = undefined;
    window.sessionStorage.clear();

    fetchDashboardMock.mockResolvedValue(undefined);
    fetchNotificacionesMock.mockResolvedValue(undefined);
  });

  it('no muestra el control manual de sincronizacion del sistema', async () => {
    const { default: DashboardPage } = await import('./page');

    render(<DashboardPage />);

    expect(screen.queryByRole('button', { name: /sincronizar sistema/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^sincronizar$/i })).toBeNull();
  });

  it('shows the pending-notifications toast only once per browser runtime', async () => {
    const toast = await import('sonner').then((module) => module.toast);
    const { default: DashboardPage } = await import('./page');

    const { unmount } = render(<DashboardPage />);
    unmount();
    render(<DashboardPage />);

    expect(toast.custom).not.toHaveBeenCalled();
    expect(fetchNotificacionesMock).toHaveBeenCalledTimes(1);
  });

  it('does not show the pending-notifications toast again after a full document reload in the same tab', async () => {
    const { default: DashboardPage } = await import('./page');

    const { unmount } = render(<DashboardPage />);
    unmount();

    globalThis.__movietimeDashboardToastState = undefined;
    render(<DashboardPage />);

    expect(fetchNotificacionesMock).toHaveBeenCalledTimes(1);
  });
});
