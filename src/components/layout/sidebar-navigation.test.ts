import { describe, expect, it } from 'vitest';

import { findNavItem, getSidebarNavigationSections, isNavItemActive } from './sidebar-navigation';

describe('findNavItem', () => {
  it('encuentra la seccion de una ruta y de sus subrutas', () => {
    expect(findNavItem('/ventas')?.name).toBe('Ventas');
    expect(findNavItem('/ventas/abc/editar')?.name).toBe('Ventas');
    expect(findNavItem('/servicios/detalle/x')?.name).toBe('Servicios');
    expect(findNavItem('/pedidos-cobros')?.name).toBe('Pedidos y cobros');
    expect(findNavItem('/plantillas-mensajes')?.name).toBe('Plantillas de mensajes');
    expect(findNavItem('/automatizaciones')?.name).toBe('Automatizaciones');
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

  it('ubica Pedidos y cobros sobre Gastos y Automatizaciones sobre Plantillas de mensajes', () => {
    const sections = getSidebarNavigationSections('admin');
    const section = (label: string) => sections.find((s) => s.label === label)?.items.map((i) => i.name);
    expect(section('Operación')).toEqual(['Terceros', 'Ventas', 'Servicios', 'Pedidos y cobros', 'Gastos']);
    expect(section('Configuración')).toEqual(['Categorías', 'Métodos de Pago', 'Automatizaciones', 'Plantillas de mensajes']);
    expect(section('Seguimiento')).not.toContain('Automatizaciones');
  });

  it('ubica Reportes inmediatamente debajo de Chats', () => {
    const section = getSidebarNavigationSections('admin').find((item) => item.label === 'Seguimiento');
    const names = section?.items.map((item) => item.name) ?? [];
    expect(names[names.indexOf('Chats') + 1]).toBe('Reportes');
  });

  it('reserva los apartados nuevos a administradores', () => {
    expect(names('vendedor')).not.toContain('Pedidos y cobros');
    expect(names('vendedor')).not.toContain('Plantillas de mensajes');
    expect(names('admin')).toContain('Pedidos y cobros');
    expect(names('admin')).toContain('Plantillas de mensajes');
  });

  it('no deja alias ocultos de rutas anteriores: el servidor las redirige', () => {
    const hrefs = getSidebarNavigationSections('admin').flatMap((s) => s.items.map((i) => i.href));
    for (const legacy of ['/bot', '/editor-mensajes', '/pagos-yappy']) {
      expect(hrefs).not.toContain(legacy);
      expect(findNavItem(legacy)).toBeUndefined();
    }
    expect(isNavItemActive('/automatizaciones/compras', '/automatizaciones')).toBe(true);
    expect(isNavItemActive('/pedidos-cobros', '/automatizaciones')).toBe(false);
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

