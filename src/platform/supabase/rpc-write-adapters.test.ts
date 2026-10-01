import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: {
    rpc: rpcMock,
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test-user' } } }, error: null }) },
  },
}));

import { ValidationError } from '@/platform/errors/domain-errors';
import { createServicioPaymentRpc, createVentaPaymentRpc } from './payments-rpc-adapter';
import { deleteServicioWithPaymentsRpc } from './servicios-rpc-adapter';
import { deleteVentaPaymentRpc, deleteVentaWithPaymentsRpc } from './ventas-rpc-adapter';

const deletes: Array<[string, () => Promise<void>]> = [
  ['delete_servicio_with_payments', () => deleteServicioWithPaymentsRpc({ p_servicio_id: 's' })],
  ['delete_venta_with_payments', () => deleteVentaWithPaymentsRpc({ p_venta_id: 'v' })],
  ['delete_venta_payment_and_empty_period', () => deleteVentaPaymentRpc({ p_pago_id: 'p' } as never)],
];

describe('validacion del retorno de los RPC de escritura', () => {
  beforeEach(() => rpcMock.mockReset());

  it.each(deletes)('%s acepta retorno vacio', async (_name, run) => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await expect(run()).resolves.toBeUndefined();
  });

  it.each(deletes)('%s rechaza un payload inesperado sin exponerlo', async (_name, run) => {
    rpcMock.mockResolvedValue({ data: { interno: 'sql' }, error: null });
    await expect(run()).rejects.toThrow(ValidationError);
    await expect(run()).rejects.not.toThrow(/sql/);
  });

  it.each(deletes)('%s propaga el error de Supabase', async (_name, run) => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'fallo' } });
    await expect(run()).rejects.toThrow('fallo');
  });

  it.each([
    ['null', null],
    ['id vacio', ''],
    ['forma invalida', { id: 'x' }],
  ])('los ids de pago rechazan %s', async (_label, data) => {
    rpcMock.mockResolvedValue({ data, error: null });
    await expect(createServicioPaymentRpc({ p_servicio_id: 's' } as never)).rejects.toThrow();
    await expect(createVentaPaymentRpc({ p_venta_id: 'v' } as never)).rejects.toThrow();
  });
});
