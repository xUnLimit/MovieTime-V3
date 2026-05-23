import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';

const queryNotificationsMock = vi.fn();

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

vi.mock('@/lib/supabase/notifications-repository', () => ({
  queryNotifications: queryNotificationsMock,
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
  function renderDashboardPage(Component: () => ReactNode) {
    const queryClient = createQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <Component />
      </QueryClientProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__movietimeDashboardToastState = undefined;
    window.sessionStorage.clear();

    queryNotificationsMock.mockResolvedValue([]);
  });

  it('no muestra el control manual de sincronizacion del sistema', async () => {
    const { default: DashboardPage } = await import('./page');

    renderDashboardPage(DashboardPage);

    expect(screen.queryByRole('button', { name: /sincronizar sistema/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^sincronizar$/i })).toBeNull();
  });

  it('shows the pending-notifications toast only once per browser runtime', async () => {
    const toast = await import('sonner').then((module) => module.toast);
    const { default: DashboardPage } = await import('./page');

    const { unmount } = renderDashboardPage(DashboardPage);
    unmount();
    renderDashboardPage(DashboardPage);

    expect(toast.custom).not.toHaveBeenCalled();
    expect(queryNotificationsMock).toHaveBeenCalledTimes(1);
  });

  it('does not show the pending-notifications toast again after a full document reload in the same tab', async () => {
    const { default: DashboardPage } = await import('./page');

    const { unmount } = renderDashboardPage(DashboardPage);
    unmount();

    globalThis.__movietimeDashboardToastState = undefined;
    renderDashboardPage(DashboardPage);

    expect(queryNotificationsMock).toHaveBeenCalledTimes(1);
  });
});
