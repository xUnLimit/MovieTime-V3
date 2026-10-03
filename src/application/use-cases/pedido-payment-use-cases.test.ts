import { describe, expect, it, vi } from 'vitest';
import { createManualReceiptReader } from '@/modules/payments-reconciliation';
import type { ClaimInput, ClaimResult, PedidoPaymentRepository } from '@/platform/supabase/pedido-payment-repository';
import { mapClaimResult, retryPendingReceipts, submitReceipt } from './pedido-payment-use-cases';

const pedidoId = '123e4567-e89b-12d3-a456-426614174000';
const claim = (over: Partial<ClaimResult>): ClaimResult => ({ outcome: 'confirmado', confirmed: true, pedidoEstado: 'entregado',
  total: 10, paid: 10, remaining: 0, deliveryPending: false, ...over });
const repo = (result: ClaimResult) => ({
  claim: vi.fn<PedidoPaymentRepository['claim']>(async () => result), listPending: vi.fn(async () => []),
}) satisfies PedidoPaymentRepository;
const deps = (repository: PedidoPaymentRepository) => ({ repository, reader: createManualReceiptReader(), newKey: () => 'key-1' });

describe('mapClaimResult (outcomes matrix)', () => {
  it.each([
    [claim({}), { estado: 'confirmado', sobrepago: false }],
    [claim({ outcome: 'monto_mayor' }), { estado: 'confirmado', sobrepago: true }],
    [claim({ outcome: 'confirmado', confirmed: false, deliveryPending: true }), { estado: 'en_revision', motivo: 'entrega_pendiente', faltante: 0 }],
    [claim({ outcome: 'monto_menor', confirmed: false, remaining: 3 }), { estado: 'en_revision', motivo: 'monto_menor', faltante: 3 }],
    [claim({ outcome: 'fuera_de_ventana', confirmed: false, remaining: 10 }), { estado: 'en_revision', motivo: 'fuera_de_ventana', faltante: 10 }],
    [claim({ outcome: 'no_encontrado', confirmed: false }), { estado: 'esperando_correo' }],
    [claim({ outcome: 'codigo_usado', confirmed: false }), { estado: 'rechazado', motivo: 'codigo_usado' }],
    [claim({ outcome: 'intentos_excedidos', confirmed: false }), { estado: 'rechazado', motivo: 'intentos_excedidos' }],
    [claim({ outcome: 'pedido_invalido', confirmed: false }), { estado: 'rechazado', motivo: 'pedido_invalido' }],
  ])('maps %#', (input, expected) => { expect(mapClaimResult(input)).toEqual(expected); });
});

describe('submitReceipt', () => {
  it('claims the typed code and returns confirmado', async () => {
    const repository = repo(claim({}));
    expect(await submitReceipt(deps(repository), { pedidoId, waId: 'w', typedCode: 'gzcss-20613095' }))
      .toEqual({ estado: 'confirmado', sobrepago: false });
    expect(repository.claim).toHaveBeenCalledWith({ pedidoId, code: 'GZCSS-20613095', waId: 'w', idempotencyKey: 'key-1', retry: false });
  });

  it('uses the caller idempotency key when given', async () => {
    const repository = repo(claim({}));
    await submitReceipt(deps(repository), { pedidoId, waId: 'w', typedCode: 'GZCSS-20613095', idempotencyKey: 'mine' });
    expect(repository.claim).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'mine' }));
  });

  it('never claims from an image alone with the manual reader', async () => {
    const repository = repo(claim({}));
    expect(await submitReceipt(deps(repository), { pedidoId, waId: 'w', imageMediaId: 'media' }))
      .toEqual({ estado: 'rechazado', motivo: 'sin_codigo' });
    expect(repository.claim).not.toHaveBeenCalled();
  });

  it('reports esperando_correo when the email has not arrived', async () => {
    const repository = repo(claim({ outcome: 'no_encontrado', confirmed: false }));
    expect(await submitReceipt(deps(repository), { pedidoId, waId: 'w', typedCode: 'GZCSS-20613095' })).toEqual({ estado: 'esperando_correo' });
  });

  it('rejects an invalid pedido id before touching the database', async () => {
    const repository = repo(claim({}));
    await expect(submitReceipt(deps(repository), { pedidoId: 'x', waId: 'w', typedCode: 'GZCSS-20613095' })).rejects.toThrow();
    expect(repository.claim).not.toHaveBeenCalled();
  });
});

describe('retryPendingReceipts', () => {
  const pending = [{ pedidoId, waId: 'w', code: 'GZCSS-20613095' }, { pedidoId, waId: null, code: 'AAAAA-12345678' }];

  it('retries without counting attempts and returns only the resolved receipts', async () => {
    const repository = {
      claim: vi.fn(async (i: ClaimInput) => i.code.startsWith('GZ') ? claim({}) : claim({ outcome: 'no_encontrado', confirmed: false })),
      listPending: vi.fn(async () => pending),
    };
    const onResolved = vi.fn(async () => undefined);
    const resolved = await retryPendingReceipts({ repository, newKey: () => 'k' }, onResolved);
    expect(resolved).toEqual([{ pedidoId, waId: 'w', result: { estado: 'confirmado', sobrepago: false } }]);
    expect(repository.claim).toHaveBeenCalledWith(expect.objectContaining({ retry: true }));
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('keeps going when one retry fails', async () => {
    const repository = {
      claim: vi.fn().mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce(claim({})),
      listPending: vi.fn(async () => pending),
    };
    expect(await retryPendingReceipts({ repository, newKey: () => 'k' })).toHaveLength(1);
  });
});
