import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomationNavigation } from './AutomationNavigation';

const state = vi.hoisted(() => ({ route: '/automatizaciones' }));
vi.mock('next/navigation', () => ({ usePathname: () => state.route }));
beforeEach(() => { state.route = '/automatizaciones'; });

describe('AutomationNavigation', () => {
  it('lista las seis secciones como enlaces a rutas propias', () => {
    render(<AutomationNavigation />);
    const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));
    expect(hrefs).toEqual(['/automatizaciones', '/automatizaciones/pedidos', '/automatizaciones/cobros', '/automatizaciones/interesados', '/automatizaciones/mensajes', '/automatizaciones/conexiones']);
  });

  it('marca solo la sección actual, incluso en subrutas, y Recorridos solo en la raíz', () => {
    const { rerender } = render(<AutomationNavigation />);
    expect(screen.getByRole('link', { name: 'Recorridos' }).getAttribute('aria-current')).toBe('page');
    state.route = '/automatizaciones/pedidos';
    rerender(<AutomationNavigation />);
    expect(screen.getByRole('link', { name: 'Pedidos' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Recorridos' }).getAttribute('aria-current')).toBeNull();
    state.route = '/automatizaciones/mensajes/x';
    rerender(<AutomationNavigation />);
    expect(screen.getByRole('link', { name: 'Mensajes' }).getAttribute('aria-current')).toBe('page');
  });
});
