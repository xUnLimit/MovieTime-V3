import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const notificationsRepository = vi.hoisted(() => ({
  createNotificacion: vi.fn(),
  updateNotificacion: vi.fn(),
}));

const catalogosRepository = vi.hoisted(() => ({
  getMetodoPagoById: vi.fn(),
}));

vi.mock('@/platform/supabase/notifications-repository', () => notificationsRepository);
vi.mock('@/platform/supabase/catalogos-repository', () => catalogosRepository);

import { procesarNotificacionReposo } from './reposo-notification-sync';
import { procesarNotificacionServicio } from './servicio-notification-sync';
import { procesarNotificacionVenta } from './venta-notification-sync';

describe('notification sync modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates venta notifications with payment method fallback from the provided map', async () => {
    await procesarNotificacionVenta(
      {
        id: 'venta-1',
        clienteId: 'cliente-1',
        clienteNombre: 'Cliente Uno',
        servicioId: 'servicio-1',
        servicioNombre: 'Netflix',
        categoriaId: 'categoria-1',
        categoriaNombre: 'Streaming',
        estado: 'activo',
        fechaFin: new Date('2026-05-26T00:00:00.000Z'),
        metodoPagoId: 'metodo-1',
      } as never,
      undefined,
      false,
      new Map([['metodo-1', { id: 'metodo-1', nombre: 'Banco General' } as never]]),
    );

    expect(notificationsRepository.createNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      entidad: 'venta',
      ventaId: 'venta-1',
      metodoPagoNombre: 'Banco General',
      diasRestantes: 1,
      leida: false,
    }));
  });

  it('preserves a read venta notification when its priority increases', async () => {
    await procesarNotificacionVenta(
      {
        id: 'venta-1',
        clienteId: 'cliente-1',
        clienteNombre: 'Cliente Uno',
        servicioId: 'servicio-1',
        servicioNombre: 'Netflix',
        categoriaNombre: 'Streaming',
        estado: 'activo',
        fechaFin: new Date('2026-05-23T00:00:00.000Z'),
      } as never,
      {
        id: 'notif-1',
        prioridad: 'baja',
        diasRestantes: 10,
        leida: true,
        resaltada: true,
      } as never,
      true,
    );

    expect(notificationsRepository.updateNotificacion).toHaveBeenCalledWith('notif-1', expect.objectContaining({
      prioridad: 'critica',
      leida: true,
      resaltada: true,
    }));
  });

  it('skips venta notifications without fechaFin', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await procesarNotificacionVenta({
      id: 'venta-sin-fecha',
      clienteId: 'cliente-1',
      clienteNombre: 'Cliente Uno',
      servicioId: 'servicio-1',
      servicioNombre: 'Netflix',
    } as never);

    expect(notificationsRepository.createNotificacion).not.toHaveBeenCalled();
    expect(notificationsRepository.updateNotificacion).not.toHaveBeenCalled();
    // El logger central emite el warn como (mensaje, metadata).
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing fechaFin'),
      expect.objectContaining({ ventaId: 'venta-sin-fecha' }),
    );

    warnSpy.mockRestore();
  });

  it('creates servicio notifications with card alias metadata', async () => {
    await procesarNotificacionServicio(
      {
        id: 'servicio-1',
        categoriaId: 'categoria-1',
        categoriaNombre: 'Streaming',
        nombre: 'Disney',
        tipo: 'premium',
        correo: 'service@example.com',
        contrasena: 'secret',
        costoServicio: 12,
        fechaVencimiento: new Date('2026-05-27T00:00:00.000Z'),
        metodoPagoId: 'metodo-1',
        renovacionAutomatica: true,
      } as never,
      undefined,
      false,
      new Map([
        [
          'metodo-1',
          {
            id: 'metodo-1',
            nombre: 'Visa',
            alias: 'Tarjeta principal',
            numeroTarjeta: '4111 1111 1111 1234',
          } as never,
        ],
      ]),
    );

    expect(notificationsRepository.createNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      entidad: 'servicio',
      servicioId: 'servicio-1',
      metodoPagoAlias: 'Tarjeta principal',
      metodoPagoTarjetaTerminacion: '1234',
      renovacionAutomatica: true,
    }));
  });

  it('loads servicio payment method when it is not present in the provided map', async () => {
    catalogosRepository.getMetodoPagoById.mockResolvedValueOnce({
      id: 'metodo-1',
      nombre: 'Mastercard',
      alias: 'Backup',
      numeroTarjeta: '5555-4444-3333-9999',
    });

    await procesarNotificacionServicio(
      {
        id: 'servicio-1',
        categoriaId: 'categoria-1',
        categoriaNombre: 'Streaming',
        nombre: 'Disney',
        tipo: 'premium',
        correo: 'service@example.com',
        contrasena: 'secret',
        costoServicio: 12,
        fechaVencimiento: new Date('2026-05-27T00:00:00.000Z'),
        metodoPagoId: 'metodo-1',
      } as never,
      undefined,
      false,
      new Map(),
    );

    expect(catalogosRepository.getMetodoPagoById).toHaveBeenCalledWith('metodo-1');
    expect(notificationsRepository.createNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      metodoPagoAlias: 'Backup',
      metodoPagoTarjetaTerminacion: '9999',
    }));
  });

  it('updates servicio metadata without reactivating a read notification', async () => {
    await procesarNotificacionServicio(
      {
        id: 'servicio-1',
        categoriaId: 'categoria-1',
        categoriaNombre: 'Streaming',
        nombre: 'Disney',
        tipo: 'premium',
        correo: 'service@example.com',
        contrasena: 'secret',
        costoServicio: 12,
        fechaVencimiento: new Date('2026-05-27T00:00:00.000Z'),
        metodoPagoId: 'metodo-1',
        metodoPagoNombre: 'Visa',
        renovacionAutomatica: true,
      } as never,
      {
        id: 'notif-servicio-1',
        prioridad: 'media',
        diasRestantes: 3,
        metodoPagoNombre: 'Visa',
        metodoPagoAlias: 'Vieja',
        metodoPagoTarjetaTerminacion: '0000',
        renovacionAutomatica: false,
        leida: true,
        resaltada: true,
      } as never,
      false,
      new Map([
        [
          'metodo-1',
          {
            id: 'metodo-1',
            nombre: 'Visa',
            alias: 'Nueva',
            numeroTarjeta: '4111 1111 1111 4321',
          } as never,
        ],
      ]),
    );

    expect(notificationsRepository.updateNotificacion).toHaveBeenCalledWith('notif-servicio-1', expect.objectContaining({
      metodoPagoAlias: 'Nueva',
      metodoPagoTarjetaTerminacion: '4321',
      renovacionAutomatica: true,
      leida: true,
      resaltada: true,
    }));
  });

  it('skips reposo far from completion and creates one close to completion', async () => {
    await procesarNotificacionReposo({
      id: 'servicio-lejano',
      categoriaId: 'categoria-1',
      nombre: 'Netflix',
      correo: 'service@example.com',
      fechaFinReposo: new Date('2026-06-10T00:00:00.000Z'),
    } as never);

    expect(notificationsRepository.createNotificacion).not.toHaveBeenCalled();

    await procesarNotificacionReposo({
      id: 'servicio-cercano',
      categoriaId: 'categoria-1',
      categoriaNombre: 'Streaming',
      nombre: 'Netflix',
      correo: 'service@example.com',
      diasReposo: 30,
      fechaInicioReposo: new Date('2026-05-01T00:00:00.000Z'),
      fechaFinReposo: new Date('2026-05-26T00:00:00.000Z'),
    } as never);

    expect(notificationsRepository.createNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      entidad: 'reposo',
      servicioId: 'servicio-cercano',
      diasRestantes: 1,
      prioridad: 'alta',
    }));
  });

  it('updates reposo notifications without reactivating them on priority increase', async () => {
    await procesarNotificacionReposo(
      {
        id: 'servicio-cercano',
        categoriaId: 'categoria-1',
        categoriaNombre: 'Streaming',
        nombre: 'Netflix',
        correo: 'service@example.com',
        diasReposo: 30,
        fechaInicioReposo: new Date('2026-05-01T00:00:00.000Z'),
        fechaFinReposo: new Date('2026-05-23T00:00:00.000Z'),
      } as never,
      {
        id: 'notif-reposo-1',
        prioridad: 'media',
        diasRestantes: 5,
        titulo: 'Reposo finaliza en 5 dias',
        leida: true,
        resaltada: true,
      } as never,
    );

    expect(notificationsRepository.updateNotificacion).toHaveBeenCalledWith('notif-reposo-1', expect.objectContaining({
      entidad: 'reposo',
      prioridad: 'critica',
      diasRestantes: -2,
      leida: true,
      resaltada: true,
    }));
  });
});
