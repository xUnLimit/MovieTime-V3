import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DashboardLayout from './layout';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    authRecoveryError: null,
    isAuthenticated: true,
    isHydrated: true,
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
