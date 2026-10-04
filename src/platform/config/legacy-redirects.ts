import type { NextConfig } from 'next';

type Redirect = Awaited<ReturnType<NonNullable<NextConfig['redirects']>>>[number];

const PEDIDOS = '/pedidos-cobros?tab=pedidos';
const COBROS = '/pedidos-cobros?tab=cobros';
const INTERESADOS = '/pedidos-cobros?tab=interesados';
const PLANTILLAS = '/plantillas-mensajes';

// Temporales (307): estas rutas ya cambiaron de lugar antes y una 308 quedaria guardada para siempre en el navegador.
const moved = (source: string, destination: string): Redirect => ({ source, destination, permanent: false });

/**
 * Rutas anteriores de Automatizaciones, el bot, el editor de mensajes y Yappy. Cada una lleva directo a su destino
 * final (sin cadenas) y conserva sus parametros, como `?tipo=` del editor de plantillas.
 */
export const legacyRedirects: Redirect[] = [
  moved('/ventas/pedidos', PEDIDOS),
  moved('/automatizaciones/pedidos', PEDIDOS),
  moved('/ventas/cobros', COBROS),
  moved('/automatizaciones/cobros', COBROS),
  moved('/pagos-yappy', COBROS),
  moved('/terceros/interesados', INTERESADOS),
  moved('/automatizaciones/interesados', INTERESADOS),
  moved('/editor-mensajes', PLANTILLAS),
  moved('/automatizaciones/mensajes', PLANTILLAS),
  {
    source: '/automatizaciones',
    has: [{ type: 'query', key: 'mensaje', value: '(?<tipo>[a-z_]{1,40})' }],
    destination: `${PLANTILLAS}?tipo=:tipo`,
    permanent: false,
  },
  { source: '/automatizaciones', has: [{ type: 'query', key: 'vista', value: 'mensajes' }], destination: PLANTILLAS, permanent: false },
  moved('/configuracion/automatizacion', '/configuracion'),
  moved('/automatizaciones/conexiones', '/configuracion'),
  moved('/automatizaciones/compras', '/automatizaciones'),
  moved('/bot', '/automatizaciones'),
  moved('/bot/:path*', '/automatizaciones'),
];
