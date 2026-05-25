import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const assertOnlineMutationMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock('@/lib/pwa/offline-copy', () => ({
  assertOnlineMutation: assertOnlineMutationMock,
}));

import {
  createVentaRefundRpc,
  createVentaWithInitialPaymentRpc,
  deleteVentaPaymentRpc,
  deleteVentaWithPaymentsRpc,
  updateVentaPaymentAndPeriodRpc,
  type CreateVentaRefundPayload,
  type CreateVentaWithInitialPaymentPayload,
  type UpdateVentaPaymentAndPeriodPayload,
} from './ventas-rpc-adapter';

const payload: CreateVentaWithInitialPaymentPayload = {
  p_cliente_id: 'cliente-1',
  p_servicio_id: 'servicio-1',
  p_categoria_id: 'categoria-1',
  p_estado: 'activo',
  p_perfil_numero: 1,
  p_perfil_nombre: 'Perfil 1',
  p_codigo: '1234',
  p_notas: 'Notas',
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
  p_pago_notas: 'Pago inicial',
  p_plan_id: 'plan-1',
  p_plan_nombre_snapshot: 'Plan Mensual',
  p_plan_tipo_nombre_snapshot: 'Individual',
  p_idempotency_key: '00000000-0000-4000-8000-000000000101',
};

const refundPayload: CreateVentaRefundPayload = {
  p_venta_id: 'venta-1',
  p_monto_original: 5,
  p_moneda_original: 'USD',
  p_monto_usd: 5,
  p_exchange_rate: 1,
  p_metodo_pago_id: 'metodo-1',
  p_metodo_pago_nombre_snapshot: 'Yappy',
  p_destino_reembolso: 'Cuenta destino',
  p_fecha_reembolso: '2026-05-22T00:00:00.000Z',
  p_nota: 'Reembolso',
  p_cortar: false,
  p_motivo_corte: null,
  p_created_by: '00000000-0000-0000-0000-000000000000',
  p_idempotency_key: '00000000-0000-4000-8000-000000000102',
};

const updatePaymentPayload: UpdateVentaPaymentAndPeriodPayload = {
  p_pago_id: 'pago-1',
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
  p_pago_notas: 'Ajuste',
};

describe('createVentaWithInitialPaymentRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC with the expected payload and returns the venta id', async () => {
    rpcMock.mockResolvedValue({ data: 'venta-1', error: null });

    await expect(createVentaWithInitialPaymentRpc(payload)).resolves.toBe('venta-1');

    expect(assertOnlineMutationMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('create_venta_with_initial_payment', payload);
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(createVentaWithInitialPaymentRpc(payload)).rejects.toThrow('RPC failed');
  });

  it('validates the RPC response id', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(createVentaWithInitialPaymentRpc(payload)).rejects.toThrow(
      'create_venta_with_initial_payment no retorno un id valido'
    );
  });
});

describe('createVentaRefundRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC with the expected payload and returns the pago id', async () => {
    rpcMock.mockResolvedValue({ data: 'pago-1', error: null });

    await expect(createVentaRefundRpc(refundPayload)).resolves.toBe('pago-1');

    expect(assertOnlineMutationMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('create_venta_refund', refundPayload);
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(createVentaRefundRpc(refundPayload)).rejects.toThrow('RPC failed');
  });

  it('validates the RPC response id', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(createVentaRefundRpc(refundPayload)).rejects.toThrow(
      'create_venta_refund no retorno un id valido'
    );
  });
});

describe('deleteVentaWithPaymentsRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC with the expected payload', async () => {
    const payload = { p_venta_id: 'venta-1', p_delete_payments: true };
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(deleteVentaWithPaymentsRpc(payload)).resolves.toBeUndefined();

    expect(assertOnlineMutationMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('delete_venta_with_payments', payload);
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(
      deleteVentaWithPaymentsRpc({ p_venta_id: 'venta-1', p_delete_payments: false })
    ).rejects.toThrow('RPC failed');
  });
});

describe('deleteVentaPaymentRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC with the expected payload', async () => {
    const payload = { p_pago_id: 'pago-1' };
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(deleteVentaPaymentRpc(payload)).resolves.toBeUndefined();

    expect(assertOnlineMutationMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('delete_venta_payment_and_empty_period', payload);
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(deleteVentaPaymentRpc({ p_pago_id: 'pago-1' })).rejects.toThrow('RPC failed');
  });
});

describe('updateVentaPaymentAndPeriodRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC with the expected payload', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(updateVentaPaymentAndPeriodRpc(updatePaymentPayload)).resolves.toBeUndefined();

    expect(assertOnlineMutationMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('update_venta_payment_and_period', updatePaymentPayload);
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(updateVentaPaymentAndPeriodRpc(updatePaymentPayload)).rejects.toThrow(
      'RPC failed'
    );
  });
});

