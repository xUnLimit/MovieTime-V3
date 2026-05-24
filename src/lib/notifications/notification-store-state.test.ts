import { describe, expect, it } from 'vitest';

import type { NotificacionReposo, NotificacionServicio, NotificacionVenta } from '@/types/notificaciones';

import {
  getNotificationCounts,
  getNotificationListState,
  getServicioNotifications,
  getTypedReposoNotifications,
  getTypedServicioNotifications,
  getTypedVentaNotifications,
  getVentaNotifications,
  removeServicioNotifications,
  removeVentaNotifications,
  type NotificacionConId,
} from './notification-store-state';

const base = {
  tipo: 'sistema',
  prioridad: 'media',
  titulo: 'Aviso',
  leida: false,
  resaltada: false,
  diasRestantes: 2,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
} as const;

function venta(id: string, ventaId: string): NotificacionVenta & { id: string } {
  return {
    ...base,
    id,
    entidad: 'venta',
    ventaId,
    clienteId: `cliente-${id}`,
    servicioId: `servicio-${id}`,
    clienteNombre: `Cliente ${id}`,
    servicioNombre: 'Netflix',
    categoriaNombre: 'Streaming',
    estado: 'activo',
    fechaFin: new Date('2026-05-30T00:00:00.000Z'),
  };
}

function servicio(id: string, servicioId: string): NotificacionServicio & { id: string } {
  return {
    ...base,
    id,
    entidad: 'servicio',
    servicioId,
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

function reposo(id: string): NotificacionReposo & { id: string } {
  return {
    ...base,
    id,
    entidad: 'reposo',
    servicioId: `servicio-${id}`,
    categoriaId: `categoria-${id}`,
    servicioNombre: 'Max',
    categoriaNombre: 'Streaming',
    correo: 'reposo@example.com',
    diasReposo: 30,
    fechaInicioReposo: new Date('2026-05-01T00:00:00.000Z'),
    fechaFinReposo: new Date('2026-05-30T00:00:00.000Z'),
  };
}

const notificaciones: NotificacionConId[] = [
  venta('venta-1', 'v1'),
  venta('venta-2', 'v2'),
  servicio('servicio-1', 's1'),
  reposo('reposo-1'),
];

describe('notification store state helpers', () => {
  it('calculates counts and list state from mixed notifications', () => {
    expect(getNotificationCounts(notificaciones)).toEqual({
      totalNotificaciones: 4,
      ventasProximas: 2,
      serviciosProximos: 1,
      reposoCompletados: 1,
    });
    expect(getNotificationListState(notificaciones)).toEqual({
      notificaciones,
      totalNotificaciones: 4,
      ventasProximas: 2,
      serviciosProximos: 1,
      reposoCompletados: 1,
    });
  });

  it('selects and removes venta notifications by venta id', () => {
    expect(getVentaNotifications(notificaciones, 'v1').map((n) => n.id)).toEqual(['venta-1']);
    expect(removeVentaNotifications(notificaciones, 'v1').map((n) => n.id)).toEqual([
      'venta-2',
      'servicio-1',
      'reposo-1',
    ]);
  });

  it('selects and removes servicio notifications by servicio id', () => {
    expect(getServicioNotifications(notificaciones, 's1').map((n) => n.id)).toEqual(['servicio-1']);
    expect(removeServicioNotifications(notificaciones, 's1').map((n) => n.id)).toEqual([
      'venta-1',
      'venta-2',
      'reposo-1',
    ]);
  });

  it('returns typed notification groups', () => {
    expect(getTypedVentaNotifications(notificaciones)).toHaveLength(2);
    expect(getTypedServicioNotifications(notificaciones)).toHaveLength(1);
    expect(getTypedReposoNotifications(notificaciones)).toHaveLength(1);
  });
});
