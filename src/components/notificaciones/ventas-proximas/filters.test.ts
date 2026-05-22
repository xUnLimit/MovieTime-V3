import { describe, expect, it } from 'vitest';

import { getPaginasNotificacionesVenta } from './filters';
import type { NotificacionVentaConId } from './types';

function makeNotification(
  id: string,
  overrides: Partial<NotificacionVentaConId> = {}
): NotificacionVentaConId {
  return {
    id,
    tipo: 'sistema',
    prioridad: 'media',
    titulo: `Notificacion ${id}`,
    leida: false,
    resaltada: false,
    diasRestantes: 1,
    createdAt: new Date('2026-05-21T00:00:00.000Z'),
    entidad: 'venta',
    ventaId: `venta-${id}`,
    clienteId: `cliente-${id}`,
    servicioId: `servicio-${id}`,
    clienteNombre: `Cliente ${id}`,
    servicioNombre: 'Netflix',
    categoriaNombre: 'Streaming',
    estado: 'activo',
    fechaFin: new Date('2026-05-22T00:00:00.000Z'),
    ...overrides,
  };
}

describe('getPaginasNotificacionesVenta', () => {
  it('fills each page up to the requested size before starting the next page', () => {
    const notifications = [
      ...Array.from({ length: 9 }, (_, index) =>
        makeNotification(`a-${index}`)
      ),
      makeNotification('b-0', { clienteId: 'cliente-b' }),
      makeNotification('b-1', { clienteId: 'cliente-b' }),
    ];

    const pages = getPaginasNotificacionesVenta(notifications, 10);

    expect(pages.map((page) => page.length)).toEqual([10, 1]);
  });
});
