import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardLayout from './layout';

const auth = vi.hoisted(() => ({ isAuthenticated: true, isHydrated: true, push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: auth.push }) }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    authRecoveryError: null,
    isAuthenticated: auth.isAuthenticated,
    isHydrated: auth.isHydrated,
    logout: vi.fn(),
    retryAuth: vi.fn(),
  }),
}));
vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: ({ mobileOpen }: { mobileOpen: boolean }) => (
    <aside data-testid="sidebar" data-open={mobileOpen} />
  ),
}));
vi.mock('@/components/shared/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/shared/DashboardErrorFallback', () => ({ DashboardErrorFallback: () => null }));
vi.mock('@/components/auth/AuthRecoveryState', () => ({ AuthRecoveryState: () => null }));
vi.mock('@/modules/notifications', () => ({ sincronizarNotificaciones: () => Promise.resolve() }));
vi.mock('@/platform/utils/safety', () => ({ safeAsyncSideEffect: vi.fn() }));

beforeEach(() => {
  auth.isAuthenticated = true;
  auth.isHydrated = true;
  auth.push.mockClear();
});

describe('dashboard session states', () => {
  it('redirects to login showing only the background, with no spinner flash, once the session is closed', () => {
    auth.isAuthenticated = false;
    const { container } = render(<DashboardLayout><div data-testid="page-content" /></DashboardLayout>);

    expect(auth.push).toHaveBeenCalledExactlyOnceWith('/login');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByTestId('page-content')).toBeNull();
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the spinner while the session is still being restored', () => {
    auth.isHydrated = false;
    auth.isAuthenticated = false;
    render(<DashboardLayout><div data-testid="page-content" /></DashboardLayout>);

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeTruthy();
    expect(auth.push).not.toHaveBeenCalled();
  });
});

describe('dashboard mobile header', () => {
  it('keeps the header in the layout flow while the page scrolls and the menu opens', () => {
    render(<DashboardLayout><div data-testid="page-content" /></DashboardLayout>);

    const header = screen.getByRole('banner');
    const main = screen.getByRole('main');

    expect(header.nextElementSibling).toBe(main);
    expect(header.className).not.toContain('fixed');
    expect(main.contains(screen.getByTestId('page-content'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(screen.getByTestId('sidebar').getAttribute('data-open')).toBe('true');
  });
});
