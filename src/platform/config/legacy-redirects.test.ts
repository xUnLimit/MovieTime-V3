import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { legacyRedirects } from './legacy-redirects';

const pathOf = (destination: string) => destination.split('?')[0];
const target = (source: string) => legacyRedirects.find((redirect) => redirect.source === source && !redirect.has)?.destination;

describe('legacyRedirects', () => {
  it('lleva cada ruta anterior a su apartado nuevo', () => {
    expect(target('/pagos-yappy')).toBe('/pedidos-cobros?tab=cobros');
    expect(target('/automatizaciones/pedidos')).toBe('/pedidos-cobros?tab=pedidos');
    expect(target('/automatizaciones/interesados')).toBe('/pedidos-cobros?tab=interesados');
    expect(target('/editor-mensajes')).toBe('/plantillas-mensajes');
    expect(target('/automatizaciones/conexiones')).toBe('/configuracion');
    expect(target('/automatizaciones/compras')).toBe('/automatizaciones');
    expect(target('/bot/:path*')).toBe('/automatizaciones');
  });

  it('abre la plantilla pedida desde el enlace anterior ?mensaje=', () => {
    const redirect = legacyRedirects.find((item) => item.has?.some((has) => has.type === 'query' && has.key === 'mensaje'));
    expect(redirect?.source).toBe('/automatizaciones');
    expect(redirect?.destination).toBe('/plantillas-mensajes?tipo=:tipo');
  });

  it('no encadena redirecciones ni las guarda para siempre en el navegador', () => {
    const sources = new Set(legacyRedirects.filter((redirect) => !redirect.has).map((redirect) => redirect.source));
    for (const redirect of legacyRedirects) {
      expect(redirect.permanent).toBe(false);
      expect(sources.has(pathOf(redirect.destination))).toBe(false);
    }
  });

  it('solo apunta a paginas que existen', () => {
    for (const redirect of legacyRedirects) {
      const page = join(process.cwd(), 'src', 'app', '(dashboard)', pathOf(redirect.destination), 'page.tsx');
      expect(existsSync(page), page).toBe(true);
    }
  });
});
