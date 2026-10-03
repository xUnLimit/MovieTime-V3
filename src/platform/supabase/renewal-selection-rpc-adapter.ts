import { z } from '@/platform/validation/zod';
import { DomainError } from '@/platform/errors/domain-errors';
import { assertRpcStringId } from '@/platform/utils/safety';
import { crearPedidoSchema } from './pedidos-schemas';
import { assertOnlineMutation } from './online-mutation';
import { executeIdempotentRpc } from './idempotent-rpc';
import { callRpc } from './rpc-client';

const schema = crearPedidoSchema.safeExtend({
  p_notice_id: z.string().uuid(), p_wa_id: z.string().regex(/^\d{8,15}$/),
  p_expected: z.array(z.object({ venta_id: z.string().uuid(), period_id: z.string().uuid(),
    precio: z.number().finite().nonnegative().multipleOf(0.01) }).strict()).min(1).max(100),
}).refine(p => p.p_items.every(i => i.tipo === 'renovacion') && p.p_expected.length === p.p_items.length);
export type RenewalOrderInput = z.input<typeof schema>;

export async function createRenewalSelectionOrderRpc(input: RenewalOrderInput): Promise<string> {
  const payload = schema.parse(input);
  assertOnlineMutation();
  try {
    return assertRpcStringId(await executeIdempotentRpc('crear_pedido_renovacion', payload,
      request => callRpc('crear_pedido_renovacion', request)), 'crear_pedido_renovacion');
  } catch {
    throw new DomainError('No se pudo registrar la renovación. Revisa el pedido antes de reintentar.', 'RENEWAL_ORDER_FAILED');
  }
}
