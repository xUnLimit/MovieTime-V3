import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ admin: true }));
vi.mock('next/navigation', () => ({ usePathname: () => '/automatizaciones/compras' }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (value: { user: { role: string } }) => unknown) => selector({ user: { role: state.admin ? 'admin' : 'vendedor' } }) }));
vi.mock('@/components/compras/CommerceFlowEditor', () => ({ CommerceFlowEditor: () => <p>Mapa del flujo</p> }));

import ComprasFlowPage from './page';

beforeEach(() => { state.admin = true; });

describe('/automatizaciones/compras', () => {
  it('muestra el encabezado, las pestañas y el editor a administradores', () => {
    render(<ComprasFlowPage />);
    expect(screen.getByRole('heading', { name: 'Flujo de compras' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Compras' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Mapa del flujo')).toBeTruthy();
  });
  it('limita la pantalla a administradores', () => {
    state.admin = false;
    render(<ComprasFlowPage />);
    expect(screen.getByText(/solo para administradores/)).toBeTruthy();
    expect(screen.queryByText('Mapa del flujo')).toBeNull();
  });
});
