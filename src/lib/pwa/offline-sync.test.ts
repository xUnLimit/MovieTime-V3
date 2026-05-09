import { describe, expect, it } from 'vitest';

import { buildOfflineDetailRoutes, extractNextStaticAssetUrls } from './offline-sync';

describe('buildOfflineDetailRoutes', () => {
  it('includes static module routes and dynamic detail routes from synced records', () => {
    const routes = buildOfflineDetailRoutes({
      ventas: [{ id: 'venta-1' }],
      servicios: [{ id: 'servicio-1', categoriaId: 'categoria-1' }],
      usuarios: [{ id: 'usuario-1' }],
      categorias: [{ id: 'categoria-1' }],
      metodosPago: [{ id: 'metodo-1' }],
    });

    expect(routes).toEqual(expect.arrayContaining([
      '/dashboard',
      '/ventas',
      '/ventas/venta-1',
      '/servicios/detalle/servicio-1',
      '/servicios/categoria-1',
      '/usuarios/usuario-1',
      '/categorias/categoria-1',
      '/metodos-pago/metodo-1',
    ]));
  });

  it('extracts Next static assets from cached route HTML', () => {
    const assets = extractNextStaticAssetUrls(
      [
        '<script src="/_next/static/chunks/app/ventas/page.js"></script>',
        '<link href="/_next/static/css/app.css" rel="stylesheet">',
        '<script src="https://example.com/_next/static/chunks/ignored.js"></script>',
      ].join(''),
      'https://movietime.test'
    );

    expect(assets).toEqual([
      'https://movietime.test/_next/static/chunks/app/ventas/page.js',
      'https://movietime.test/_next/static/css/app.css',
    ]);
  });
});
