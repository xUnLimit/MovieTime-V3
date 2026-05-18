import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagoServicio, Servicio } from '@/types';

vi.mock('@/lib/supabase/catalogos-repository', () => ({
  getMetodoPagoById: vi.fn(),
}));

vi.mock('@/lib/supabase/categorias-repository', () => ({
  countCategorias: vi.fn(),
}));

vi.mock('@/lib/supabase/servicios-repository', () => ({
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

vi.mock('@/lib/services/dashboardStatsService', () => ({
  adjustGastosStats: vi.fn(() => Promise.resolve()),
  getDiaKeyFromDate: vi.fn(() => '2026-05-06'),
  getMesKeyFromDate: vi.fn(() => '2026-05'),
  upsertServicioPronostico: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/services/pagosServicioService', () => ({
  crearPagoRenovacion: vi.fn(),
}));

vi.mock('@/lib/services/servicioSyncService', () => ({
  resyncServiciosDenormalizedData: vi.fn(),
  syncServicioDependencias: vi.fn(),
}));

vi.mock('@/lib/services/notificationSyncService', () => ({
  sincronizarUnServicio: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/services/currencyService', () => ({
  currencyService: {
    convertToUSD: vi.fn(),
  },
}));

vi.mock('@/lib/utils/activityLogHelpers', () => ({
  detectarCambios: vi.fn(() => []),
}));

import {
  getServicioById,
  queryPagosServicio,
  removePagoServicio,
  updateServicio,
} from '@/lib/supabase/servicios-repository';
import { adjustGastosStats, upsertServicioPronostico } from '@/lib/services/dashboardStatsService';
import { crearPagoRenovacion } from '@/lib/services/pagosServicioService';
import { sincronizarUnServicio } from '@/lib/services/notificationSyncService';
import { currencyService } from '@/lib/services/currencyService';
import { deleteServicioPagoUseCase, renewServicioUseCase } from './servicios-use-cases';

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
  vi.mocked(removePagoServicio).mockReset();
  vi.mocked(queryPagosServicio).mockReset();
  vi.mocked(updateServicio).mockReset();
  vi.mocked(crearPagoRenovacion).mockReset();
  vi.mocked(adjustGastosStats).mockClear();
  vi.mocked(getServicioById).mockReset();
  vi.mocked(upsertServicioPronostico).mockClear();
  vi.mocked(sincronizarUnServicio).mockClear();
  vi.mocked(currencyService.convertToUSD).mockReset();

  vi.mocked(removePagoServicio).mockResolvedValue(undefined);
  vi.mocked(queryPagosServicio).mockResolvedValue([]);
  vi.mocked(updateServicio).mockResolvedValue(undefined);
  vi.mocked(crearPagoRenovacion).mockResolvedValue(undefined);
  vi.mocked(currencyService.convertToUSD).mockResolvedValue(10);
  vi.mocked(getServicioById).mockResolvedValue({
    ...servicio,
    fechaVencimiento: new Date('2026-05-01T00:00:00Z'),
  });
});

describe('deleteServicioPagoUseCase', () => {
  it('hard-deletes the payment and reverses service expense stats', async () => {
    await deleteServicioPagoUseCase(servicio, pago, [], {
      isLatestPayment: true,
      fallbackMoneda: 'USD',
    });

    expect(removePagoServicio).toHaveBeenCalledWith('pago-1');
    expect(adjustGastosStats).toHaveBeenCalledWith(
      expect.objectContaining({
        delta: -10,
        moneda: 'USD',
        categoriaId: 'categoria-1',
        categoriaNombre: 'Netflix',
      })
    );
    expect(upsertServicioPronostico).toHaveBeenCalled();
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

    expect(crearPagoRenovacion).toHaveBeenCalledWith(
      'servicio-1',
      'categoria-1',
      10,
      'metodo-1',
      'Banco',
      'USD',
      'mensual',
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-07-01T00:00:00Z'),
      1,
      'Renovado',
      true
    );
    expect(result.servicioActualizado.renovacionAutomatica).toBe(true);
  });
});
