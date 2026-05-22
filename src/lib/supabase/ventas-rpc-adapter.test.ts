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
  createVentaWithInitialPaymentRpc,
  type CreateVentaWithInitialPaymentPayload,
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
