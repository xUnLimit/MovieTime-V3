import { describe, expect, it } from 'vitest';

import { findNavItem, getSidebarNavigationSections, isNavItemActive } from './sidebar-navigation';

describe('findNavItem', () => {
  it('encuentra la seccion de una ruta y de sus subrutas', () => {
    expect(findNavItem('/ventas')?.name).toBe('Ventas');
    expect(findNavItem('/ventas/abc/editar')?.name).toBe('Ventas');
    expect(findNavItem('/servicios/detalle/x')?.name).toBe('Servicios');
    expect(findNavItem('/editor-mensajes')?.name).toBe('Plantillas de Mensajes');
    expect(findNavItem('/bot/flujo')?.name).toBe('Bot');
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
    expect(names('admin')).toContain('Bot');
    expect(names('vendedor')).not.toContain('Bot');
  });

  it('usa iconos distintos para Pagos Yappy y Metodos de Pago', () => {
    const items = getSidebarNavigationSections('admin').flatMap((s) => s.items);
    const yappy = items.find((i) => i.name === 'Pagos Yappy');
    const metodos = items.find((i) => i.name === 'Métodos de Pago');

    expect(yappy?.icon).not.toBe(metodos?.icon);
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

it('limits catalog and interests navigation to administrators', () => {
  for (const role of [undefined, 'vendedor', 'admin']) {
    const paths = getSidebarNavigationSections(role).flatMap(section => section.items.map(item => item.href));
    for (const path of ['/catalogo', '/interesados']) expect(paths.includes(path)).toBe(role === 'admin');
  }
});
