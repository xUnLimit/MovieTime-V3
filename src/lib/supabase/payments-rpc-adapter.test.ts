import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const assertOnlineMutationMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock('@/lib/pwa/mutation-guard', () => ({
  assertOnlineMutation: assertOnlineMutationMock,
}));

import {
  createServicioPaymentRpc,
  createVentaPaymentRpc,
  type CreateServicioPaymentPayload,
  type CreateVentaPaymentPayload,
} from './payments-rpc-adapter';

const servicioPaymentPayload: CreateServicioPaymentPayload = {
  p_servicio_id: 'servicio-1',
  p_categoria_id_snapshot: 'categoria-1',
  p_fecha_inicio: '2026-05-22',
  p_fecha_vencimiento: '2026-06-22',
  p_ciclo_pago: 'mensual',
  p_costo_original: 10,
  p_moneda_original: 'USD',
  p_costo_usd: 10,
  p_exchange_rate: 1,
  p_renovacion_automatica: false,
  p_metodo_pago_id: 'metodo-1',
  p_metodo_pago_nombre_snapshot: 'Yappy',
  p_fecha_pago: '2026-05-22T00:00:00.000Z',
  p_pago_notas: 'Renovacion',
};

const ventaPaymentPayload: CreateVentaPaymentPayload = {
  p_venta_id: 'venta-1',
  p_fecha_inicio: '2026-05-22',
  p_fecha_fin: '2026-06-22',
  p_ciclo_pago: 'mensual',
  p_precio_original: 10,
  p_descuento: 0,
  p_total_original: 10,
  p_moneda_original: 'USD',
  p_total_usd: 10,
  p_exchange_rate: 1,
  p_metodo_pago_id: 'metodo-1',
  p_metodo_pago_nombre_snapshot: 'Yappy',
  p_fecha_pago: '2026-05-22T00:00:00.000Z',
  p_pago_notas: 'Renovacion',
  p_plan_id: 'plan-1',
  p_plan_nombre_snapshot: 'Plan Mensual',
  p_plan_tipo_nombre_snapshot: 'Individual',
};

describe('createServicioPaymentRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC with the expected payload and returns the pago id', async () => {
    rpcMock.mockResolvedValue({ data: 'pago-servicio-1', error: null });

    await expect(createServicioPaymentRpc(servicioPaymentPayload)).resolves.toBe('pago-servicio-1');

    expect(assertOnlineMutationMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('create_servicio_payment', servicioPaymentPayload);
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(createServicioPaymentRpc(servicioPaymentPayload)).rejects.toThrow('RPC failed');
  });

  it('validates the RPC response id', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(createServicioPaymentRpc(servicioPaymentPayload)).rejects.toThrow(
      'create_servicio_payment no retorno un id valido'
    );
  });
});

describe('createVentaPaymentRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC with the expected payload and returns the pago id', async () => {
    rpcMock.mockResolvedValue({ data: 'pago-venta-1', error: null });

    await expect(createVentaPaymentRpc(ventaPaymentPayload)).resolves.toBe('pago-venta-1');

    expect(assertOnlineMutationMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('create_venta_payment', ventaPaymentPayload);
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(createVentaPaymentRpc(ventaPaymentPayload)).rejects.toThrow('RPC failed');
  });

  it('validates the RPC response id', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(createVentaPaymentRpc(ventaPaymentPayload)).rejects.toThrow(
      'create_venta_payment no retorno un id valido'
    );
  });
});
