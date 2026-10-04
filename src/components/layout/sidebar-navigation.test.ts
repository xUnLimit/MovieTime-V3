import { describe, expect, it } from 'vitest';

import { findNavItem, getSidebarNavigationSections, isNavItemActive } from './sidebar-navigation';

describe('findNavItem', () => {
  it('encuentra la seccion de una ruta y de sus subrutas', () => {
    expect(findNavItem('/ventas')?.name).toBe('Ventas');
    expect(findNavItem('/ventas/abc/editar')?.name).toBe('Ventas');
    expect(findNavItem('/servicios/detalle/x')?.name).toBe('Servicios');
    expect(findNavItem('/editor-mensajes')?.name).toBe('Automatizaciones');
    expect(findNavItem('/bot/flujo')?.name).toBe('Automatizaciones');
  });

  it('devuelve undefined para rutas fuera del menu', () => {
    expect(findNavItem('/login')).toBeUndefined();
    expect(findNavItem('/')).toBeUndefined();
  });
});

describe('isNavItemActive', () => {
  it('marca activa la ruta exacta y sus subrutas', () => {
    expect(isNavItemActive('/ventas', '/ventas')).toBe(true);
    expect(isNavItemActive('/ventas/crear', '/ventas')).toBe(true);
    expect(isNavItemActive('/servicios/detalle/abc', '/servicios')).toBe(true);
  });

  it('no confunde rutas que solo comparten prefijo de texto', () => {
    expect(isNavItemActive('/ventas-archivo', '/ventas')).toBe(false);
    expect(isNavItemActive('/terceros', '/ventas')).toBe(false);
  });
});

describe('getSidebarNavigationSections', () => {
  const names = (role?: string) => getSidebarNavigationSections(role).flatMap((s) => s.items.map((i) => i.name));

  it('oculta apartados de administrador a otros roles', () => {
    expect(names('vendedor')).not.toContain('Chats');
    expect(names('admin')).toContain('Chats');
    expect(names('admin')).toContain('Automatizaciones');
    expect(names('vendedor')).not.toContain('Automatizaciones');
  });

  it('consolida bot y mensajes en Automatizaciones y cobros en Ventas', () => {
    const items = getSidebarNavigationSections('admin').flatMap((s) => s.items);
    expect(items.filter((i) => i.href === '/automatizaciones')).toHaveLength(1);
    expect(items.map((i) => i.href)).not.toContain('/pagos-yappy');
    expect(items.map((i) => i.href)).not.toContain('/editor-mensajes');
    expect(findNavItem('/pagos-yappy')?.name).toBe('Automatizaciones');
  });
  it('resalta el destino consolidado al abrir un enlace anterior', () => {
    expect(isNavItemActive('/bot', '/automatizaciones')).toBe(true);
    expect(isNavItemActive('/bot/flujo', '/automatizaciones')).toBe(true);
    expect(isNavItemActive('/editor-mensajes', '/automatizaciones')).toBe(true);
    expect(isNavItemActive('/pagos-yappy', '/automatizaciones')).toBe(true);
    expect(isNavItemActive('/automatizaciones/pedidos', '/ventas')).toBe(false);
    expect(isNavItemActive('/bot-archivo', '/automatizaciones')).toBe(false);
  });
});

describe('Configuracion', () => {
  it('conserva su miga pero no aparece en el menu lateral', () => {
    expect(findNavItem('/configuracion')?.name).toBe('Configuración');
    const names = (role?: string) => getSidebarNavigationSections(role).flatMap((s) => s.items.map((i) => i.name));
    expect(names('admin')).not.toContain('Configuración');
    expect(names('vendedor')).not.toContain('Configuración');
  });
});

