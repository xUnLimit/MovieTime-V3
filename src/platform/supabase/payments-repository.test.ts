import { beforeEach, describe, expect, it, vi } from 'vitest';

const convertToUSD = vi.hoisted(() => vi.fn());
const createServicioPaymentRpc = vi.hoisted(() => vi.fn());
const createVentaPaymentRpc = vi.hoisted(() => vi.fn());

vi.mock('@/modules/payments', () => ({ convertToUSD }));
vi.mock('./payments-rpc-adapter', () => ({ createServicioPaymentRpc, createVentaPaymentRpc }));

import { createPagoServicio, createPagoVenta } from './payments-repository';

describe('financial payment writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['servicio', () => createPagoServicio({ servicioId: 's-1', monto: 20, moneda: 'EUR' })],
    ['venta', () => createPagoVenta({ ventaId: 'v-1', monto: 20, moneda: 'EUR' })],
  ])('does not call the %s RPC when currency conversion fails', async (_kind, operation) => {
    convertToUSD.mockRejectedValueOnce(new Error('rate unavailable'));

    await expect(operation()).rejects.toThrow('rate unavailable');
    expect(createServicioPaymentRpc).not.toHaveBeenCalled();
    expect(createVentaPaymentRpc).not.toHaveBeenCalled();
  });
});
