import { describe, expect, it } from 'vitest';
import { filtrarServiciosNotificaciones } from './serviciosNotificacionesFilters';
import type { Notificacion, NotificacionServicio } from '@/types/notificaciones';

function servicioNotif(
  overrides: Partial<NotificacionServicio & { id: string }>
): NotificacionServicio & { id: string } {
  return {
    id: 'notif-1',
    entidad: 'servicio',
    tipo: 'sistema',
    prioridad: 'media',
    titulo: 'Servicio vence en 6 dias',
    leida: false,
    resaltada: false,
    diasRestantes: 6,
    createdAt: new Date('2026-04-29T12:00:00.000Z'),
    servicioId: 'servicio-1',
    categoriaId: 'categoria-1',
    servicioNombre: 'Netflix',
    categoriaNombre: 'Streaming',
    tipoServicio: 'tipo-streaming-individual',
    correo: 'netflix@example.com',
    contrasena: 'password',
    metodoPagoNombre: 'Tarjeta principal',
    moneda: 'USD',
    costoServicio: 12,
    cicloPago: 'mensual',
    fechaVencimiento: new Date('2026-05-05T12:00:00.000Z'),
    renovacionAutomatica: false,
    ...overrides,
  };
}

describe('filtrarServiciosNotificaciones', () => {
  it('mantiene todos los servicios en el tab de servicios proximos', () => {
    const notificaciones = [
      servicioNotif({ id: 'manual', renovacionAutomatica: false }),
      servicioNotif({ id: 'auto', renovacionAutomatica: true }),
    ];

    const result = filtrarServiciosNotificaciones(notificaciones);

    expect(result.map((n) => n.id)).toEqual(['manual', 'auto']);
  });

  it('muestra solo servicios autorrenovables cuando el filtro esta activo', () => {
    const notificaciones: (Notificacion & { id: string })[] = [
      servicioNotif({ id: 'manual', renovacionAutomatica: false }),
      servicioNotif({ id: 'auto', renovacionAutomatica: true }),
      {
        id: 'venta-1',
        entidad: 'venta',
        tipo: 'sistema',
        prioridad: 'media',
        titulo: 'Venta vence en 6 dias',
        leida: false,
        resaltada: false,
        diasRestantes: 6,
        createdAt: new Date('2026-04-29T12:00:00.000Z'),
        ventaId: 'venta-1',
        clienteId: 'cliente-1',
        servicioId: 'servicio-3',
        clienteNombre: 'Cliente',
        servicioNombre: 'Disney',
        categoriaNombre: 'Streaming',
        estado: 'activo',
        fechaFin: new Date('2026-05-05T12:00:00.000Z'),
      },
    ];

    const result = filtrarServiciosNotificaciones(notificaciones, {
      soloAutorrenovables: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('auto');
  });
});
