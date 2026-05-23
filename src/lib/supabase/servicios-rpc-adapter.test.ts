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
  createServicioWithInitialPaymentRpc,
  type CreateServicioWithInitialPaymentPayload,
} from './servicios-rpc-adapter';

const payload: CreateServicioWithInitialPaymentPayload = {
  p_categoria_id: 'categoria-1',
  p_plan_tipo_id: 'tipo-1',
  p_nombre: 'Netflix',
  p_correo: 'netflix@example.com',
  p_contrasena: 'secret',
  p_perfiles_disponibles: 4,
  p_perfiles_ocupados: 0,
  p_activo: true,
  p_en_reposo: false,
  p_dias_reposo: null,
  p_fecha_inicio_reposo: null,
  p_fecha_fin_reposo: null,
  p_notas: 'Notas',
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
  p_pago_notas: 'Pago inicial',
};

describe('createServicioWithInitialPaymentRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC with the expected payload and returns the servicio id', async () => {
    rpcMock.mockResolvedValue({ data: 'servicio-1', error: null });

    await expect(createServicioWithInitialPaymentRpc(payload)).resolves.toBe('servicio-1');

    expect(assertOnlineMutationMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('create_servicio_with_initial_payment', payload);
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(createServicioWithInitialPaymentRpc(payload)).rejects.toThrow('RPC failed');
  });

  it('validates the RPC response id', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(createServicioWithInitialPaymentRpc(payload)).rejects.toThrow(
      'create_servicio_with_initial_payment no retorno un id valido'
    );
  });
});
