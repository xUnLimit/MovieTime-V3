import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServicioPaymentRpc = vi.hoisted(() => vi.fn());
const createVentaPaymentRpc = vi.hoisted(() => vi.fn());

vi.mock('./payments-rpc-adapter', () => ({ createServicioPaymentRpc, createVentaPaymentRpc }));

import { createPagoServicio, createPagoVenta } from './payments-repository';

describe('financial payment writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServicioPaymentRpc.mockResolvedValue('pago-servicio-1');
    createVentaPaymentRpc.mockResolvedValue('pago-venta-1');
  });

  it('persists the servicio payment with the already converted USD amount and rate', async () => {
    await expect(createPagoServicio({
      servicioId: 's-1', monto: 20, montoUsd: 10, exchangeRate: 2, moneda: 'EUR', cicloPago: 'anual',
      renovacionAutomatica: true, notas: 'nota', metodoPagoId: 'm-1', metodoPagoNombre: 'Banco', categoriaId: 'c-1',
    })).resolves.toBe('pago-servicio-1');

    expect(createServicioPaymentRpc).toHaveBeenCalledWith(expect.objectContaining({
      p_servicio_id: 's-1',
      p_costo_original: 20,
      p_moneda_original: 'EUR',
      p_costo_usd: 10,
      p_exchange_rate: 2,
      p_ciclo_pago: 'anual',
      p_renovacion_automatica: true,
      p_pago_notas: 'nota',
    }));
  });

  it('persists the venta payment with the already converted USD amount and rate', async () => {
    await expect(createPagoVenta({
      ventaId: 'v-1', monto: 20, montoUsd: 10, exchangeRate: 2, moneda: 'EUR', precio: 25, descuento: 5,
      cicloPago: 'semestral', planId: 'p-1', planNombre: 'Plan', planTipoNombre: 'Tipo', metodoPago: 'Banco',
    })).resolves.toBe('pago-venta-1');

    expect(createVentaPaymentRpc).toHaveBeenCalledWith(expect.objectContaining({
      p_venta_id: 'v-1',
      p_total_original: 20,
      p_precio_original: 25,
      p_descuento: 5,
      p_moneda_original: 'EUR',
      p_total_usd: 10,
      p_exchange_rate: 2,
      p_ciclo_pago: 'semestral',
      p_plan_id: 'p-1',
    }));
  });

  it('applies safe defaults (USD, mensual, null snapshots) when optional fields are missing', async () => {
    await createPagoServicio({ servicioId: 's-1', monto: 5, montoUsd: 5, exchangeRate: 1 });
    await createPagoVenta({ ventaId: 'v-1', monto: 5, montoUsd: 5, exchangeRate: 1, cicloPago: null });

    expect(createServicioPaymentRpc).toHaveBeenCalledWith(expect.objectContaining({
      p_moneda_original: 'USD', p_ciclo_pago: 'mensual', p_metodo_pago_id: null, p_pago_notas: null, p_renovacion_automatica: false,
    }));
    expect(createVentaPaymentRpc).toHaveBeenCalledWith(expect.objectContaining({
      p_moneda_original: 'USD', p_ciclo_pago: 'mensual', p_precio_original: 5, p_descuento: 0, p_plan_id: null,
    }));
  });

  it('rejects payments without a parent id before calling any RPC', async () => {
    await expect(createPagoServicio({ servicioId: '', monto: 1, montoUsd: 1, exchangeRate: 1 })).rejects.toThrow('servicioId');
    await expect(createPagoVenta({ ventaId: '', monto: 1, montoUsd: 1, exchangeRate: 1 })).rejects.toThrow('ventaId');
    expect(createServicioPaymentRpc).not.toHaveBeenCalled();
    expect(createVentaPaymentRpc).not.toHaveBeenCalled();
  });
});
