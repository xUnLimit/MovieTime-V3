import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({ supabase: { rpc: rpcMock } }));

import { ValidationError } from '@/platform/errors/domain-errors';
import { assertRpcVoidResult, callRpc } from './rpc-client';

describe('callRpc', () => {
  beforeEach(() => rpcMock.mockReset());

  it('pasa el nombre y los argumentos tal cual, incluidos los null', async () => {
    rpcMock.mockResolvedValue({ data: 'id-1', error: null });
    const args = { p_venta_id: 'venta-1', p_delete_payments: null };

    const result = await callRpc('delete_venta_with_payments', args);

    expect(rpcMock).toHaveBeenCalledWith('delete_venta_with_payments', args);
    expect(rpcMock.mock.calls[0][1]).toBe(args);
    expect(result).toEqual({ data: 'id-1', error: null });
  });

  it('devuelve el error de Supabase sin transformarlo', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(callRpc('delete_venta_with_payments', { p_venta_id: 'v' }))
      .resolves.toEqual({ data: null, error: { message: 'boom' } });
  });
});

describe('assertRpcVoidResult', () => {
  it('acepta null y undefined', () => {
    expect(() => assertRpcVoidResult(null, 'op')).not.toThrow();
    expect(() => assertRpcVoidResult(undefined, 'op')).not.toThrow();
  });

  it('rechaza cualquier payload sin exponerlo', () => {
    const run = () => assertRpcVoidResult({ secreto: 'x' }, 'op');
    expect(run).toThrow(ValidationError);
    expect(run).toThrow('Respuesta invalida de op');
  });
});
