import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/platform/query-client';
import type { NotificacionConId } from '@/hooks/use-notificaciones';

const queryNotificationsMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => ({ custom: vi.fn(), dismiss: vi.fn() }));

vi.mock('next/link', () => ({
  default: ({ children, href, onClick }: { children: ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={(event) => { event.preventDefault(); onClick?.(); }}>{children}</a>
  ),
}));
vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/application/use-cases/notificaciones/notificaciones-query-use-cases', () => ({
  queryNotificationsUseCase: queryNotificationsMock,
}));

import { useDashboardNotificationToast } from './useDashboardNotificationToast';

function notificacion(overrides: Partial<NotificacionConId>): NotificacionConId {
  return { id: 'n1', entidad: 'venta', prioridad: 'media', leida: false, ...overrides } as NotificacionConId;
}

function Harness() {
  useDashboardNotificationToast();
  return null;
}

async function showToast(notificaciones: NotificacionConId[]) {
  queryNotificationsMock.mockResolvedValue(notificaciones);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Harness />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(queryNotificationsMock).toHaveBeenCalled());
}

function renderedToast() {
  const [factory] = toastMock.custom.mock.calls[0] as [(id: string) => ReactNode];
  return render(<>{factory('toast-1')}</>);
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__movietimeDashboardToastState = undefined;
  window.sessionStorage.clear();
});

describe('dashboard pending-notifications toast', () => {
  it('summarises sales and services and links to the notifications page', async () => {
    await showToast([
      notificacion({ id: 'v1', entidad: 'venta' }),
      notificacion({ id: 'v2', entidad: 'venta' }),
      notificacion({ id: 's1', entidad: 'servicio' }),
    ]);
    await waitFor(() => expect(toastMock.custom).toHaveBeenCalledOnce());
    renderedToast();
    expect(screen.getByText('Notificaciones pendientes')).toBeTruthy();
    expect(screen.getByText('Tienes 2 ventas por vencer y 1 servicio por pagar.')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Ver ahora/ });
    expect(link.getAttribute('href')).toBe('/notificaciones');
    fireEvent.click(link);
    expect(toastMock.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('uses the danger tone when any unread notification is critical', async () => {
    await showToast([notificacion({ prioridad: 'critica' })]);
    await waitFor(() => expect(toastMock.custom).toHaveBeenCalledOnce());
    const { container } = renderedToast();
    expect(container.firstElementChild?.className).toContain('border-danger-border');
  });

  it('uses the warning tone when nothing is critical', async () => {
    await showToast([notificacion({ prioridad: 'alta' })]);
    await waitFor(() => expect(toastMock.custom).toHaveBeenCalledOnce());
    const { container } = renderedToast();
    expect(container.firstElementChild?.className).toContain('border-warning-border');
  });

  it('falls back to a generic alert count for other entities', async () => {
    await showToast([
      notificacion({ id: 'r1', entidad: 'reposo' as NotificacionConId['entidad'] }),
      notificacion({ id: 'r2', entidad: 'reposo' as NotificacionConId['entidad'] }),
    ]);
    await waitFor(() => expect(toastMock.custom).toHaveBeenCalledOnce());
    renderedToast();
    expect(screen.getByText('Tienes 2 alertas importantes.')).toBeTruthy();
  });

  it('does not show a toast when everything is already read', async () => {
    await showToast([notificacion({ leida: true })]);
    await waitFor(() => expect(globalThis.__movietimeDashboardToastState).toBe('shown'));
    expect(toastMock.custom).not.toHaveBeenCalled();
  });
});
