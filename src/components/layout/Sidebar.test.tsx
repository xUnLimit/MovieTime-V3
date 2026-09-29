import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ role: 'admin', unread: 3, enabledArg: null as boolean | null }));

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/components/layout/ThemeProvider', () => ({ useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }) }));
vi.mock('@/hooks/use-sidebar', () => ({ useSidebarState: () => ({ isOpen: true, toggle: vi.fn() }) }));
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { role: state.role } }) }));
vi.mock('./UserMenu', () => ({ UserMenu: () => null }));
vi.mock('./useSidebarThemeTransition', () => ({ useSidebarThemeTransition: () => vi.fn() }));
vi.mock('@/hooks/use-whatsapp-chat', () => ({
  useWhatsAppUnreadChats: (enabled: boolean) => {
    state.enabledArg = enabled;
    return enabled ? state.unread : 0;
  },
}));

import { Sidebar } from './Sidebar';

beforeEach(() => {
  state.role = 'admin';
  state.unread = 3;
});

describe('Sidebar navigation', () => {
  it('marks the current section and collapses or expands from the footer button', () => {
    const onCollapse = vi.fn();
    const { unmount } = render(<Sidebar collapsed={false} onCollapse={onCollapse} />);

    const current = screen.getAllByRole('link', { name: /Dashboard/ }).filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Colapsar barra lateral' }));
    expect(onCollapse).toHaveBeenLastCalledWith(true);
    unmount();

    render(<Sidebar collapsed onCollapse={onCollapse} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir barra lateral' }));
    expect(onCollapse).toHaveBeenLastCalledWith(false);
  });
});

describe('Sidebar WhatsApp badge', () => {
  it('shows how many chats have unread messages for admins', () => {
    render(<Sidebar collapsed={false} onCollapse={vi.fn()} />);

    expect(state.enabledArg).toBe(true);
    expect(screen.getAllByLabelText('3 chats sin leer').length).toBeGreaterThan(0);
  });

  it('shows a dot on the icon when the sidebar is collapsed', () => {
    const { container } = render(<Sidebar collapsed onCollapse={vi.fn()} />);

    expect(container.querySelector('span.rounded-full.bg-primary')).not.toBeNull();
  });

  it('hides the badge without unread chats and does not poll for non admins', () => {
    state.unread = 0;
    const { unmount } = render(<Sidebar collapsed={false} onCollapse={vi.fn()} />);
    expect(screen.queryByLabelText(/chats sin leer/)).toBeNull();
    unmount();

    state.role = 'vendedor';
    render(<Sidebar collapsed={false} onCollapse={vi.fn()} />);
    expect(state.enabledArg).toBe(false);
  });
});
