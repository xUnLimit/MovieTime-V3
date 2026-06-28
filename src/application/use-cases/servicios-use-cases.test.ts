import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagoServicio, Servicio } from '@/types';

vi.mock('@/platform/supabase/catalogos-repository', () => ({
  getMetodoPagoById: vi.fn(),
}));

vi.mock('@/platform/supabase/categorias-repository', () => ({
  countCategorias: vi.fn(),
}));

vi.mock('@/platform/supabase/servicios-repository', () => ({
  countServicios: vi.fn(),
  createServicioWithInitialPayment: vi.fn(),
  getPagoServicioById: vi.fn(),
  getServicioById: vi.fn(),
  queryPagosServicio: vi.fn(),
  queryServicios: vi.fn(),
  removePagoServicio: vi.fn(),
  removeServicio: vi.fn(),
  updateLatestServicioPeriodo: vi.fn(),
  updateServicio: vi.fn(),
  updateServicioPaymentAndPeriod: vi.fn(),
}));

vi.mock('@/modules/dashboard-read-models', () => ({
  getDiaKeyFromDate: vi.fn(() => '2026-05-06'),
  getMesKeyFromDate: vi.fn(() => '2026-05'),
}));

vi.mock('@/application/use-cases/servicios/servicio-dependencies-use-cases', () => ({
  resyncServiciosDenormalizedData: vi.fn(),
  syncServicioDependencias: vi.fn(),
}));

vi.mock('@/modules/notifications', () => ({
  sincronizarUnServicio: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/modules/payments', () => ({
  convertToUSD: vi.fn(),
  financialPayments: {
    registerRenewalServicioPayment: vi.fn(),
  },
  sumPaymentsInUSD: vi.fn(async (
    payments: Array<{ monto: number; moneda?: string | null }>,
    converter: (monto: number, moneda: string) => Promise<number>
  ) => {
    const amounts = await Promise.all(
      payments.map((payment) => converter(payment.monto, payment.moneda ?? 'USD'))
    );
    return amounts.reduce((sum, amount) => sum + amount, 0);
  }),
}));

vi.mock('@/platform/utils/activityLogHelpers', () => ({
  detectarCambios: vi.fn(() => []),
}));

import {
  createServicioWithInitialPayment,
  getPagoServicioById,
  getServicioById,
  queryPagosServicio,
  removeServicio,
  removePagoServicio,
  updateLatestServicioPeriodo,
  updateServicio,
  updateServicioPaymentAndPeriod,
} from '@/platform/supabase/servicios-repository';
import { getMetodoPagoById } from '@/platform/supabase/catalogos-repository';
import { financialPayments } from '@/modules/payments';
import { sincronizarUnServicio } from '@/modules/notifications';
import { syncServicioDependencias } from '@/application/use-cases/servicios/servicio-dependencies-use-cases';
import { convertToUSD } from '@/modules/payments';
import {
  createServicioUseCase,
  deleteServicioUseCase,
  updateServicioUseCase,
} from './servicios/servicios-write-use-cases';
import {
  deleteServicioPagoUseCase,
  renewServicioUseCase,
  updateServicioPagoUseCase,
} from './servicios/servicios-payment-use-cases';

const servicio: Servicio = {
  id: 'servicio-1',
  categoriaId: 'categoria-1',
  categoriaNombre: 'Netflix',
  nombre: 'Cuenta Netflix',
  tipo: 'tipo-1',
  correo: 'netflix@example.com',
  contrasena: 'secret',
  perfilesDisponibles: 4,
  perfilesOcupados: 1,
  costoServicio: 10,
  gastosTotal: 10,
  moneda: 'USD',
  cicloPago: 'mensual',
  fechaInicio: new Date('2026-05-01T00:00:00Z'),
  fechaVencimiento: new Date('2026-06-01T00:00:00Z'),
  activo: true,
  renovacionAutomatica: false,
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
  createdBy: 'user-1',
};

const pago: PagoServicio = {
  id: 'pago-1',
  servicioId: 'servicio-1',
  categoriaId: 'categoria-1',
  moneda: 'USD',
  isPagoInicial: false,
  fecha: new Date('2026-05-06T00:00:00Z'),
  descripcion: 'Renovacion #1',
  cicloPago: 'mensual',
  fechaInicio: new Date('2026-05-01T00:00:00Z'),
  fechaVencimiento: new Date('2026-06-01T00:00:00Z'),
  monto: 10,
  createdAt: new Date('2026-05-06T00:00:00Z'),
  updatedAt: new Date('2026-05-06T00:00:00Z'),
};

beforeEach(() => {
  vi.mocked(getMetodoPagoById).mockReset();
  vi.mocked(createServicioWithInitialPayment).mockReset();
  vi.mocked(getPagoServicioById).mockReset();
  vi.mocked(removePagoServicio).mockReset();
  vi.mocked(removeServicio).mockReset();
  vi.mocked(queryPagosServicio).mockReset();
  vi.mocked(updateLatestServicioPeriodo).mockReset();
  vi.mocked(updateServicio).mockReset();
  vi.mocked(updateServicioPaymentAndPeriod).mockReset();
  vi.mocked(financialPayments.registerRenewalServicioPayment).mockReset();
  vi.mocked(syncServicioDependencias).mockReset();
  vi.mocked(getServicioById).mockReset();
  vi.mocked(sincronizarUnServicio).mockClear();
  vi.mocked(convertToUSD).mockReset();

  vi.mocked(getMetodoPagoById).mockResolvedValue({ id: 'metodo-1', nombre: 'Banco', moneda: 'USD' });
  vi.mocked(createServicioWithInitialPayment).mockResolvedValue('servicio-1');
  vi.mocked(getPagoServicioById).mockResolvedValue({ ...pago, servicioPeriodoId: 'periodo-1' });
  vi.mocked(removePagoServicio).mockResolvedValue(undefined);
  vi.mocked(removeServicio).mockResolvedValue(undefined);
  vi.mocked(queryPagosServicio).mockResolvedValue([]);
  vi.mocked(updateLatestServicioPeriodo).mockResolvedValue(undefined);
  vi.mocked(updateServicio).mockResolvedValue(undefined);
  vi.mocked(updateServicioPaymentAndPeriod).mockResolvedValue(undefined);
  vi.mocked(financialPayments.registerRenewalServicioPayment).mockResolvedValue(undefined);
  vi.mocked(syncServicioDependencias).mockResolvedValue(undefined);
  vi.mocked(convertToUSD).mockResolvedValue(10);
  vi.mocked(getServicioById).mockResolvedValue({
    ...servicio,
    fechaVencimiento: new Date('2026-05-01T00:00:00Z'),
  });
});

describe('createServicioUseCase', () => {
  it('creates the service with an initial payment and records side effects', async () => {
    const recordActivityLog = vi.fn();

    const result = await createServicioUseCase({
      categoriaId: 'categoria-1',
      categoriaNombre: 'Netflix',
      nombre: 'Cuenta Netflix',
      tipo: 'tipo-1',
      correo: 'netflix@example.com',
      contrasena: 'secret',
      perfilesDisponibles: 4,
      costoServicio: 10,
      moneda: 'USD',
      cicloPago: 'mensual',
      fechaInicio: new Date('2026-05-01T00:00:00Z'),
      fechaVencimiento: new Date('2026-06-01T00:00:00Z'),
      metodoPagoId: 'metodo-1',
      activo: true,
      renovacionAutomatica: false,
    }, {
      logContext: { usuarioId: 'user-1', usuarioEmail: 'user@example.com' },
      recordActivityLog,
    });

    expect(getMetodoPagoById).toHaveBeenCalledWith('metodo-1');
    expect(createServicioWithInitialPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        p_categoria_id: 'categoria-1',
        p_nombre: 'Cuenta Netflix',
        p_costo_original: 10,
        p_metodo_pago_nombre_snapshot: 'Banco',
      })
    );
    expect(result.servicio.id).toBe('servicio-1');
    expect(recordActivityLog).toHaveBeenCalledWith(expect.objectContaining({ accion: 'creacion' }));
    // Event bus is now responsible for triggering notification sync
    // Tests for event listeners are in notification-event-listeners.test.ts
  });
});

describe('updateServicioUseCase', () => {
  it('updates service fields, syncs period data and denormalized references', async () => {
    const recordActivityLog = vi.fn();

    const result = await updateServicioUseCase('servicio-1', {
      metodoPagoId: 'metodo-1',
      costoServicio: 12,
      fechaVencimiento: new Date('2026-07-01T00:00:00Z'),
    }, {
      logContext: { usuarioId: 'user-1', usuarioEmail: 'user@example.com' },
      recordActivityLog,
    });

    expect(updateServicio).toHaveBeenCalledWith('servicio-1', expect.objectContaining({}));
    expect(updateLatestServicioPeriodo).toHaveBeenCalledWith(
      'servicio-1',
      expect.objectContaining({
        costo: 12,
        moneda: 'USD',
        fechaVencimiento: new Date('2026-07-01T00:00:00Z'),
      })
    );
    expect(syncServicioDependencias).toHaveBeenCalled();
    expect(result.finalUpdates).toEqual(expect.objectContaining({
      metodoPagoNombre: 'Banco',
      moneda: 'USD',
    }));
    expect(recordActivityLog).toHaveBeenCalledWith(expect.objectContaining({ accion: 'actualizacion' }));
  });
});

describe('deleteServicioUseCase', () => {
  it('deletes the service without payments and removes forecast data', async () => {
    const recordActivityLog = vi.fn();

    const result = await deleteServicioUseCase('servicio-1', {
      deletePayments: false,
      logContext: { usuarioId: 'user-1', usuarioEmail: 'user@example.com' },
      recordActivityLog,
    });

    expect(removeServicio).toHaveBeenCalledWith('servicio-1');
    expect(recordActivityLog).toHaveBeenCalledWith(expect.objectContaining({ accion: 'eliminacion' }));
    expect(result.servicio?.id).toBe('servicio-1');
  });
});

describe('deleteServicioPagoUseCase', () => {
  it('hard-deletes the payment and reverses service expense stats', async () => {
    await deleteServicioPagoUseCase(servicio, pago, [], {
      isLatestPayment: true,
      fallbackMoneda: 'USD',
    });

    expect(removePagoServicio).toHaveBeenCalledWith('pago-1');
    expect(sincronizarUnServicio).toHaveBeenCalledWith('servicio-1');
  });
});

describe('renewServicioUseCase', () => {
  it('uses the renewal dialog autorenew value for the new service period', async () => {
    const result = await renewServicioUseCase(servicio, {
      periodoRenovacion: 'mensual',
      metodoPagoId: 'metodo-1',
      metodoPagoNombre: 'Banco',
      moneda: 'USD',
      costo: 10,
      fechaInicio: new Date('2026-06-01T00:00:00Z'),
      fechaVencimiento: new Date('2026-07-01T00:00:00Z'),
      notas: 'Renovado',
      renovacionAutomatica: true,
    }, {
      numeroRenovacion: 1,
    });

    expect(financialPayments.registerRenewalServicioPayment).toHaveBeenCalledWith(expect.objectContaining({
      servicioId: 'servicio-1',
      categoriaId: 'categoria-1',
      monto: 10,
      metodoPagoId: 'metodo-1',
      metodoPagoNombre: 'Banco',
      moneda: 'USD',
      cicloPago: 'mensual',
      fechaInicio: new Date('2026-06-01T00:00:00Z'),
      fechaVencimiento: new Date('2026-07-01T00:00:00Z'),
      numeroRenovacion: 1,
      notas: 'Renovado',
      renovacionAutomatica: true,
    }));
    expect(result.servicioActualizado.renovacionAutomatica).toBe(true);
  });
});

describe('updateServicioPagoUseCase', () => {
  it('uses the edit form autorenew value when updating the service period', async () => {
    await updateServicioPagoUseCase(
      {
        ...servicio,
        renovacionAutomatica: true,
      },
      pago,
      {
        periodoRenovacion: 'mensual',
        metodoPagoId: 'metodo-1',
        metodoPagoNombre: 'Banco',
        moneda: 'USD',
        costo: 10,
        fechaInicio: new Date('2026-06-01T00:00:00Z'),
        fechaVencimiento: new Date('2026-07-01T00:00:00Z'),
        renovacionAutomatica: false,
      },
      {
        isLatestPayment: false,
      },
    );

    expect(updateServicioPaymentAndPeriod).toHaveBeenCalledWith(
      'pago-1',
      expect.objectContaining({
        renovacionAutomatica: false,
      }),
    );
  });
});
