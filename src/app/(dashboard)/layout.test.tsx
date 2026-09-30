import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardLayout from './layout';

const auth = vi.hoisted(() => ({ isAuthenticated: true, isHydrated: true, push: vi.fn(), pathname: '/dashboard', search: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: auth.push }),
  usePathname: () => auth.pathname,
  useSearchParams: () => new URLSearchParams(auth.search),
}));
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
  auth.pathname = '/dashboard';
  auth.search = '';
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

describe('dashboard chats layout', () => {
  it('shows the mobile header on the conversation list and hides it once a chat is open', () => {
    auth.pathname = '/chats';
    const { unmount } = render(<DashboardLayout><div /></DashboardLayout>);
    expect(screen.getByRole('banner').classList.contains('hidden')).toBe(false);
    unmount();

    auth.search = 'wa=50760000000';
    render(<DashboardLayout><div /></DashboardLayout>);
    expect(screen.getByRole('banner').classList.contains('hidden')).toBe(true);
  });

  it('lets chats run edge to edge without page padding or page scroll', () => {
    auth.pathname = '/chats';
    render(<DashboardLayout><div data-testid="page-content" /></DashboardLayout>);
    const main = screen.getByRole('main');
    expect(main.className).toContain('overflow-y-hidden');
    expect(main.firstElementChild?.className).not.toContain('px-');
  });

  it('keeps the padded, scrollable content area on other pages', () => {
    render(<DashboardLayout><div /></DashboardLayout>);
    const main = screen.getByRole('main');
    expect(main.className).toContain('overflow-y-auto');
    expect(main.firstElementChild?.className).toContain('pb-[max(0.75rem,env(safe-area-inset-bottom))]');
  });
});
