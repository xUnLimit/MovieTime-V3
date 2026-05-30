import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviciosRepository = vi.hoisted(() => ({
  getPagoServicioById: vi.fn(),
  getServicioById: vi.fn(),
  queryPagosServicio: vi.fn(),
  removePagoServicio: vi.fn(),
  updateServicio: vi.fn(),
  updateServicioPaymentAndPeriod: vi.fn(),
}));

const payments = vi.hoisted(() => ({
  financialPayments: { registerRenewalServicioPayment: vi.fn() },
  // servicios-shared importa convertToUSD desde @/modules/payments (para getUsdValues).
  convertToUSD: vi.fn(async (amount: number) => amount),
}));

const notifications = vi.hoisted(() => ({
  sincronizarUnServicio: vi.fn(),
}));

vi.mock('@/platform/supabase/servicios-repository', () => serviciosRepository);
vi.mock('@/modules/payments', () => payments);
vi.mock('@/modules/notifications', () => notifications);

import {
  deleteServicioPagoUseCase,
  renewServicioUseCase,
  updateServicioPagoUseCase,
} from './servicios-payment-use-cases';
import type { PagoServicio, Servicio } from '@/types';

const servicio = {
  id: 'servicio-1',
  nombre: 'Netflix',
  correo: 'cuenta@example.com',
  categoriaId: 'categoria-1',
  moneda: 'USD',
  renovacionAutomatica: false,
} as Servicio;

const input = {
  costo: 20,
  metodoPagoId: 'metodo-1',
  metodoPagoNombre: 'Tarjeta',
  moneda: 'USD',
  periodoRenovacion: 'mensual',
  fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
  fechaVencimiento: new Date('2026-06-01T00:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  serviciosRepository.queryPagosServicio.mockResolvedValue([]);
  serviciosRepository.updateServicio.mockResolvedValue(undefined);
  payments.financialPayments.registerRenewalServicioPayment.mockResolvedValue(undefined);
});

describe('servicios payment use-cases', () => {
  describe('renewServicioUseCase', () => {
    it('registers a renewal payment, updates the servicio and logs the activity', async () => {
      const recordActivityLog = vi.fn().mockResolvedValue(undefined);

      const result = await renewServicioUseCase(servicio, input, {
        numeroRenovacion: 3,
        recordActivityLog,
        logContext: { usuarioId: 'u1', usuarioEmail: 'u@test.com' },
      });

      // El pago de renovacion se registra con los montos y numero correctos.
      expect(payments.financialPayments.registerRenewalServicioPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          servicioId: 'servicio-1',
          monto: 20,
          metodoPagoId: 'metodo-1',
          numeroRenovacion: 3,
          cicloPago: 'mensual',
        }),
      );
      // El servicio se actualiza y se registra la actividad de renovacion.
      expect(serviciosRepository.updateServicio).toHaveBeenCalledWith('servicio-1', expect.any(Object));
      expect(recordActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'renovacion', entidad: 'servicio', entidadId: 'servicio-1' }),
      );
      // Devuelve el servicio actualizado con los nuevos valores.
      expect(result.servicioActualizado).toMatchObject({
        costoServicio: 20,
        fechaVencimiento: input.fechaVencimiento,
        cicloPago: 'mensual',
      });
    });

    it('derives the renewal number from existing non-initial payments when not provided', async () => {
      serviciosRepository.queryPagosServicio.mockResolvedValue([
        { id: 'p1', isPagoInicial: true, descripcion: 'Pago inicial' },
        { id: 'p2', isPagoInicial: false, descripcion: 'Renovacion' },
      ] as PagoServicio[]);

      await renewServicioUseCase(servicio, input, {});

      // 1 renovacion previa -> numeroRenovacion = 2.
      expect(payments.financialPayments.registerRenewalServicioPayment).toHaveBeenCalledWith(
        expect.objectContaining({ numeroRenovacion: 2 }),
      );
    });
  });

  describe('updateServicioPagoUseCase', () => {
    const pago = { id: 'pago-1', moneda: 'USD' } as PagoServicio;

    it('updates payment and period when the payment has a period, returning the servicio only if latest', async () => {
      serviciosRepository.getPagoServicioById.mockResolvedValue({ ...pago, servicioPeriodoId: 'periodo-1' });
      serviciosRepository.getServicioById.mockResolvedValue({ ...servicio, costoServicio: 20 });

      const result = await updateServicioPagoUseCase(servicio, pago, input, {
        isLatestPayment: true,
      });

      expect(serviciosRepository.updateServicioPaymentAndPeriod).toHaveBeenCalledWith(
        'pago-1',
        expect.objectContaining({ costo: 20, metodoPagoId: 'metodo-1', cicloPago: 'mensual' }),
      );
      expect(result.servicioActualizado).toMatchObject({ id: 'servicio-1' });
    });

    it('does not touch the period when the payment has none, and returns null when not latest', async () => {
      serviciosRepository.getPagoServicioById.mockResolvedValue({ ...pago, servicioPeriodoId: undefined });

      const result = await updateServicioPagoUseCase(servicio, pago, input, {
        isLatestPayment: false,
      });

      expect(serviciosRepository.updateServicioPaymentAndPeriod).not.toHaveBeenCalled();
      expect(result.servicioActualizado).toBeNull();
    });
  });

  describe('deleteServicioPagoUseCase', () => {
    const pago = { id: 'pago-1', moneda: 'USD' } as PagoServicio;

    it('removes the payment and resyncs notifications when deleting the latest payment', async () => {
      serviciosRepository.getServicioById.mockResolvedValue(servicio);

      const result = await deleteServicioPagoUseCase(servicio, pago, [], {
        isLatestPayment: true,
      });

      expect(serviciosRepository.removePagoServicio).toHaveBeenCalledWith('pago-1');
      expect(notifications.sincronizarUnServicio).toHaveBeenCalledWith('servicio-1');
      expect(result.servicioActualizado).toMatchObject({ id: 'servicio-1' });
    });

    it('removes the payment without resync or servicio reload when not the latest', async () => {
      const result = await deleteServicioPagoUseCase(servicio, pago, [], {
        isLatestPayment: false,
      });

      expect(serviciosRepository.removePagoServicio).toHaveBeenCalledWith('pago-1');
      expect(notifications.sincronizarUnServicio).not.toHaveBeenCalled();
      expect(serviciosRepository.getServicioById).not.toHaveBeenCalled();
      expect(result.servicioActualizado).toBeNull();
    });
  });
});
