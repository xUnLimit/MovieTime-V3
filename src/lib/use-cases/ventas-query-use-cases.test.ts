import { beforeEach, describe, expect, it, vi } from 'vitest';

const ventasRepository = vi.hoisted(() => ({
  createVenta: vi.fn(),
  createVentaWithInitialPayment: vi.fn(),
  createVentaRefund: vi.fn(),
  getPagoVentaById: vi.fn(),
  getVentaById: vi.fn(),
  countVentas: vi.fn(),
  queryPagosVenta: vi.fn(),
  queryVentas: vi.fn(),
  removePagoVenta: vi.fn(),
  removeVenta: vi.fn(),
  removeVentaWithPayments: vi.fn(),
  updateLatestVentaPeriodo: vi.fn(),
  updateVenta: vi.fn(),
  updateVentaPaymentAndPeriod: vi.fn(),
}));

const dashboardStatsService = vi.hoisted(() => ({
  getDiaKeyFromDate: vi.fn(() => '2026-05-10'),
  getMesKeyFromDate: vi.fn(() => '2026-05'),
}));

const paymentsModule = vi.hoisted(() => ({
  convertToUSD: vi.fn(),
  createRenewalVentaPayment: vi.fn(),
}));

const notificationSyncService = vi.hoisted(() => ({
  sincronizarUnaVenta: vi.fn(),
}));

const ventaSyncService = vi.hoisted(() => ({
  getVentaConUltimoPago: vi.fn(),
}));

const terceroMetodoPagoSyncService = vi.hoisted(() => ({
  syncTerceroMetodoPago: vi.fn(),
}));

vi.mock('@/lib/supabase/ventas-repository', () => ventasRepository);
vi.mock('@/lib/dashboard-read-models', () => dashboardStatsService);
vi.mock('@/lib/payments', () => paymentsModule);
vi.mock('@/lib/notifications', () => notificationSyncService);
vi.mock('@/lib/services/ventaSyncService', () => ventaSyncService);
vi.mock('@/lib/services/terceroMetodoPagoSyncService', () => terceroMetodoPagoSyncService);
vi.mock('@/lib/supabase/catalogos-repository', () => ({
  getMetodoPagoById: vi.fn(),
}));

import {
  fetchPagosVentaByVentaIdsUseCase,
  fetchVentasByClienteIdsUseCase,
} from './ventas-use-cases';

describe('ventas query use cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches ventas by cliente ids in chunks', async () => {
    ventasRepository.queryVentas
      .mockResolvedValueOnce([{ id: 'venta-1' }])
      .mockResolvedValueOnce([{ id: 'venta-2' }]);

    const result = await fetchVentasByClienteIdsUseCase(
      ['cliente-1', 'cliente-2', 'cliente-3'],
      2,
    );

    expect(ventasRepository.queryVentas).toHaveBeenCalledTimes(2);
    expect(ventasRepository.queryVentas).toHaveBeenNthCalledWith(1, [
      { field: 'clienteId', operator: 'in', value: ['cliente-1', 'cliente-2'] },
    ]);
    expect(ventasRepository.queryVentas).toHaveBeenNthCalledWith(2, [
      { field: 'clienteId', operator: 'in', value: ['cliente-3'] },
    ]);
    expect(result).toEqual([{ id: 'venta-1' }, { id: 'venta-2' }]);
  });

  it('fetches pagos by venta ids in chunks', async () => {
    ventasRepository.queryPagosVenta
      .mockResolvedValueOnce([{ id: 'pago-1' }])
      .mockResolvedValueOnce([{ id: 'pago-2' }]);

    const result = await fetchPagosVentaByVentaIdsUseCase(
      ['venta-1', 'venta-2', 'venta-3'],
      2,
    );

    expect(ventasRepository.queryPagosVenta).toHaveBeenCalledTimes(2);
    expect(ventasRepository.queryPagosVenta).toHaveBeenNthCalledWith(1, [
      { field: 'ventaId', operator: 'in', value: ['venta-1', 'venta-2'] },
    ]);
    expect(ventasRepository.queryPagosVenta).toHaveBeenNthCalledWith(2, [
      { field: 'ventaId', operator: 'in', value: ['venta-3'] },
    ]);
    expect(result).toEqual([{ id: 'pago-1' }, { id: 'pago-2' }]);
  });
});
