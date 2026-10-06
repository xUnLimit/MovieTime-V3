import { assertOnlineMutation } from '@/platform/utils/online-mutation';
import { assertUuid } from '@/platform/utils/safety';
import type { Json } from './database.types';
import { executeIdempotentRpc } from './idempotent-rpc';
import { callRpc } from './rpc-client';

export function createPedidoPanelRpc(groups: Json, key: string): Promise<string> {
  assertOnlineMutation();
  assertUuid(key, 'Intención');
  return executeIdempotentRpc('mt_panel_checkout', { p_groups: groups, p_idempotency_key: key },
    request => callRpc('mt_panel_checkout', request));
}

export async function listPedidosRpc(): Promise<unknown> {
  const { data, error } = await callRpc('mt_list_orders', {});
  if (error) throw new Error('No se pudieron cargar los pedidos.', { cause: error });
  return data;
}

export function mutatePedidoRpc(id: string, action: 'retry' | 'cancel', key: string): Promise<string> {
  assertOnlineMutation();
  assertUuid(id, 'Pedido');
  assertUuid(key, 'Intención');
  return executeIdempotentRpc('mt_order_command', { p_order_id: id, p_action: action, p_idempotency_key: key },
    request => callRpc('mt_order_command', request));
}

export function reconcilePedidoRpc(id: string, code: string, key: string): Promise<string> {
  assertOnlineMutation();
  return executeIdempotentRpc('mt_reconcile_order', {
    p_order_id: id, p_code: code, p_wa_id: null, p_idempotency_key: key,
  }, request => callRpc('mt_reconcile_order', request));
}

export function resolvePedidoExcessRpc(id: string, action: 'credito' | 'reembolsado', reference: string, amount: number, key: string): Promise<string> {
  assertOnlineMutation();
  return executeIdempotentRpc('mt_resolve_excess', {
    p_order_id: id, p_action: action, p_reference: reference, p_expected_amount: amount, p_idempotency_key: key,
  }, request => callRpc('mt_resolve_excess', request));
}

/** Acciones manuales del administrador: cada una es una RPC idempotente que valida rol y estado en SQL. */
export function deletePedidoRpc(id: string, key: string): Promise<string> {
  assertOnlineMutation();
  assertUuid(id, 'Pedido');
  assertUuid(key, 'Intención');
  return executeIdempotentRpc('mt_delete_order', { p_order_id: id, p_idempotency_key: key },
    request => callRpc('mt_delete_order', request));
}

export function registerPedidoPaymentRpc(id: string, amount: number, reference: string, key: string): Promise<string> {
  assertOnlineMutation();
  assertUuid(id, 'Pedido');
  assertUuid(key, 'Intención');
  return executeIdempotentRpc('mt_register_order_payment', { p_order_id: id, p_amount: amount, p_reference: reference, p_idempotency_key: key },
    request => callRpc('mt_register_order_payment', request));
}

export function markPedidoDeliveredRpc(id: string, key: string): Promise<string> {
  assertOnlineMutation();
  assertUuid(id, 'Pedido');
  assertUuid(key, 'Intención');
  return executeIdempotentRpc('mt_mark_order_delivered', { p_order_id: id, p_idempotency_key: key },
    request => callRpc('mt_mark_order_delivered', request));
}
