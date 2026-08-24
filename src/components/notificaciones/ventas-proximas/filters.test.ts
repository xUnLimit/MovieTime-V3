import { describe, expect, it } from 'vitest';

import type { NotificacionServicio, NotificacionVenta } from '@/types/notificaciones';

import {
  getPaginasNotificacionesVenta,
  getVentasNotificacionesFiltradas,
} from './filters';
import type { NotificacionConId } from './types';

const base = {
  tipo: 'sistema',
  prioridad: 'media',
  titulo: 'Aviso',
  leida: false,
  diasRestantes: 1,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
} as const;

function venta(
  id: string,
  overrides: Partial<NotificacionVenta> = {},
): NotificacionVenta & { id: string } {
  return {
    ...base,
    id,
    entidad: 'venta',
    ventaId: id,
    clienteId: `cliente-${id}`,
    servicioId: `servicio-${id}`,
    clienteNombre: `Cliente ${id}`,
    servicioNombre: 'Netflix',
    categoriaNombre: 'Streaming',
    estado: 'activo',
    resaltada: false,
    fechaFin: new Date('2026-05-30T00:00:00.000Z'),
    ...overrides,
  };
}

function servicio(id: string): NotificacionServicio & { id: string } {
  return {
    ...base,
    id,
    entidad: 'servicio',
    resaltada: false,
    servicioId: id,
    categoriaId: `categoria-${id}`,
    servicioNombre: 'Disney',
    categoriaNombre: 'Streaming',
    tipoServicio: 'premium',
    correo: 'service@example.com',
    contrasena: 'secret',
    metodoPagoNombre: 'Banco',
    moneda: 'USD',
    costoServicio: 10,
    cicloPago: 'mensual',
    fechaVencimiento: new Date('2026-05-30T00:00:00.000Z'),
    renovacionAutomatica: true,
  };
}

describe('ventas proximas filters', () => {
  it('filters only venta notifications and sorts highlighted, days, date, name and id', () => {
    const notificaciones: NotificacionConId[] = [
      venta('b', { clienteNombre: 'Zeta', diasRestantes: 2 }),
      servicio('servicio-1'),
      venta('c', { clienteNombre: 'Ana', diasRestantes: 1, fechaFin: new Date('2026-05-20T00:00:00.000Z') }),
      venta('d', { clienteNombre: 'Ana', diasRestantes: 1, fechaFin: new Date('2026-05-20T00:00:00.000Z') }),
      venta('a', { clienteNombre: 'Resaltada', diasRestantes: 10, resaltada: true }),
    ];

    expect(getVentasNotificacionesFiltradas(notificaciones, '', 'todos').map((n) => n.id)).toEqual([
      'a',
      'c',
      'd',
      'b',
    ]);
  });

  it('sorts promises first by promised date, then legacy highlights and normal rows', () => {
    const notificaciones: NotificacionConId[] = [
      venta('normal', { diasRestantes: -10 }),
      venta('legacy', { resaltada: true, diasRestantes: -20 }),
      venta('promise-later', {
        fechaPrometidaPago: new Date(2026, 7, 27),
        diasRestantes: -4,
      }),
      venta('promise-overdue', {
        fechaPrometidaPago: new Date(2026, 7, 22),
        diasRestantes: -1,
      }),
      venta('promise-sooner', {
        fechaPrometidaPago: new Date(2026, 7, 25),
        diasRestantes: -3,
      }),
    ];

    expect(getVentasNotificacionesFiltradas(notificaciones, '', 'todos').map((n) => n.id)).toEqual([
      'promise-overdue', 'promise-sooner', 'promise-later', 'legacy', 'normal',
    ]);
  });

  it('filters by search query and status buckets', () => {
    const notificaciones: NotificacionConId[] = [
      venta('proxima', { clienteNombre: 'Maria Gomez', diasRestantes: 3 }),
      venta('dia', { categoriaNombre: 'Canva Pro', diasRestantes: 0 }),
      venta('vencida', { clienteNombre: 'Pedro', diasRestantes: -2 }),
    ];

    expect(getVentasNotificacionesFiltradas(notificaciones, 'canva', 'todos').map((n) => n.id)).toEqual(['dia']);
    expect(getVentasNotificacionesFiltradas(notificaciones, '', 'proximas').map((n) => n.id)).toEqual(['proxima']);
    expect(getVentasNotificacionesFiltradas(notificaciones, '', 'dia_pago').map((n) => n.id)).toEqual(['dia']);
    expect(getVentasNotificacionesFiltradas(notificaciones, '', 'vencidas').map((n) => n.id)).toEqual(['vencida']);
  });

  it('paginates venta notifications preserving order', () => {
    const pages = getPaginasNotificacionesVenta(
      [venta('1'), venta('2'), venta('3')],
      2,
    );

    expect(pages.map((page) => page.map((n) => n.id))).toEqual([
      ['1', '2'],
      ['3'],
    ]);
  });
});
