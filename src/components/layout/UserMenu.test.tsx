import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), logout: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { displayName: 'Allan Ordoñez', email: 'a@movietime.test', role: 'admin' }, logout: mocks.logout }),
}));
// El menú de Radix necesita eventos de puntero; aquí se renderiza en línea para probar solo el cierre de sesión.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onClick, onSelect }: { children: React.ReactNode; onClick?: () => void; onSelect?: () => void }) => (
    <button type="button" onClick={onClick ?? onSelect}>{children}</button>
  ),
}));

import { UserMenu } from './UserMenu';

describe('UserMenu logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('waits for the session to close before opening the login, so it cannot bounce back to the dashboard', async () => {
    let finishLogout: () => void = () => undefined;
    mocks.logout.mockReturnValue(new Promise<void>((resolve) => { finishLogout = resolve; }));
    render(<UserMenu variant="sidebar" />);

    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();

    finishLogout();
    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/login'));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('opens the settings page from the menu', () => {
    render(<UserMenu variant="sidebar" />);
    fireEvent.click(screen.getByRole('button', { name: /Configuración/ }));
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/configuracion');
  });
});
