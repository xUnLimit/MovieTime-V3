import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ admin: true, inCanvas: false }));
vi.mock('@/hooks/use-purchase-flow-in-canvas', () => ({ usePurchaseFlowInCanvas: (enabled: boolean) => enabled && state.inCanvas }));
vi.mock('next/navigation', () => ({ usePathname: () => '/automatizaciones/compras' }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (value: { user: { role: string } }) => unknown) => selector({ user: { role: state.admin ? 'admin' : 'vendedor' } }) }));
vi.mock('@/components/compras/CommerceFlowEditor', () => ({ CommerceFlowEditor: () => <p>Mapa del flujo</p> }));

import ComprasFlowPage from './page';

beforeEach(() => { state.admin = true; state.inCanvas = false; });

describe('/automatizaciones/compras', () => {
  it('muestra el encabezado, las pestañas y el editor a administradores', () => {
    render(<ComprasFlowPage />);
    expect(screen.getByRole('heading', { name: 'Flujo de compras' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Compras' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Mapa del flujo')).toBeTruthy();
  });
  it('con los textos en el lienzo remite a Recorridos y oculta el editor anterior', () => {
    state.inCanvas = true;
    render(<ComprasFlowPage />);
    expect(screen.getByText('Los textos de compras se editan en el lienzo')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Recorridos' }).map(link => link.getAttribute('href'))).toEqual(['/automatizaciones', '/automatizaciones']);
    expect(screen.queryByText('Mapa del flujo')).toBeNull();
  });
  it('limita la pantalla a administradores', () => {
    state.admin = false;
    render(<ComprasFlowPage />);
    expect(screen.getByText(/solo para administradores/)).toBeTruthy();
    expect(screen.queryByText('Mapa del flujo')).toBeNull();
  });
});
