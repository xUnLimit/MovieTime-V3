import { assertOnlineMutation } from '@/platform/utils/online-mutation';
import { assertUuid } from '@/platform/utils/safety';
import { executeIdempotentRpc } from './idempotent-rpc';
import { callRpc } from './rpc-client';

export async function getPedidoResolutionQuoteRpc(id: string): Promise<unknown> {
  assertUuid(id, 'Pedido');
  const { data, error } = await callRpc('mt_order_resolution_quote', { p_order_id: id });
  if (error) throw new Error('No se pudieron revisar las condiciones del pedido.', { cause: error });
  return data;
}

export function resolvePedidoRpc(id: string, action: 'refund' | 'accept_quote' | 'assign_items', amount: number,
  reference: string | null, items: string[] | null, key: string): Promise<string> {
  assertOnlineMutation();
  assertUuid(id, 'Pedido');
  return executeIdempotentRpc('mt_resolve_order', { p_order_id: id, p_action: action, p_expected_amount: amount,
    p_reference: reference, p_items: items, p_idempotency_key: key }, request => callRpc('mt_resolve_order', request));
}
