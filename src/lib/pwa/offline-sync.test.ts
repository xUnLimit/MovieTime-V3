import { describe, expect, it } from 'vitest';

import { buildOfflineDetailRoutes, extractNextStaticAssetUrls } from './offline-sync';

describe('buildOfflineDetailRoutes', () => {
  it('does not generate route cache entries from synced record ids', () => {
    const routes = buildOfflineDetailRoutes({
      ventas: [{ id: 'venta-1' }],
      servicios: [{ id: 'servicio-1', categoriaId: 'categoria-1' }],
      usuarios: [{ id: 'usuario-1' }],
      categorias: [{ id: 'categoria-1' }],
      metodosPago: [{ id: 'metodo-1' }],
    });

    expect(routes).toEqual([]);
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
