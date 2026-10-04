import { assertRpcStringId, assertUuid } from '@/platform/utils/safety';
import { createServiceRoleClient } from './supabase-server';

function check(error: { message: string } | null): void {
  if (error?.message === 'pedido_purchases_paused') throw new Error('Por ahora no estamos tomando compras nuevas. Seguimos atendiendo los pedidos pagados.');
  if (error) throw new Error('No se pudo completar el pedido.', { cause: error });
}

export async function catalogoServerRpc(): Promise<unknown> {
  const { data, error } = await createServiceRoleClient().rpc('mt_public_catalog', {});
  check(error);
  return data;
}

export async function serviciosServerRpc(waId: string): Promise<unknown> {
  const { data, error } = await createServiceRoleClient().rpc('mt_customer_sales', { p_wa_id: waId });
  check(error);
  return data;
}

export async function createCommerceOrderRpc(waId: string, ids: string[], kind: 'compra' | 'renovacion', key: string, expectedTotal: number): Promise<string> {
  const { data, error } = await createServiceRoleClient().rpc('mt_create_commerce_order', {
    p_wa_id: waId, p_ids: ids, p_kind: kind, p_idempotency_key: key, p_expected_total: expectedTotal,
  });
  check(error);
  return assertRpcStringId(data, 'mt_create_commerce_order');
}

export async function getCommerceOrderRpc(waId: string, id: string): Promise<unknown> {
  assertUuid(id, 'Pedido');
  const { data, error } = await createServiceRoleClient().rpc('mt_get_commerce_order', { p_wa_id: waId, p_order_id: id });
  check(error);
  return data;
}

export async function reconcileCommerceOrderRpc(waId: string, id: string, code: string, key: string): Promise<string> {
  assertUuid(id, 'Pedido');
  const { data, error } = await createServiceRoleClient().rpc('mt_reconcile_order', {
    p_wa_id: waId, p_order_id: id, p_code: code, p_idempotency_key: key,
  });
  check(error);
  return assertRpcStringId(data, 'mt_reconcile_order');
}

export async function cancelCommerceOrderRpc(waId: string, id: string, key: string): Promise<string> {
  assertUuid(id, 'Pedido');
  const { data, error } = await createServiceRoleClient().rpc('mt_order_command', {
    p_order_id: id, p_action: 'cancel', p_wa_id: waId, p_idempotency_key: key,
  });
  check(error);
  return assertRpcStringId(data, 'mt_order_command');
}

export async function retryReceiptsRpc(): Promise<unknown> {
  const { data, error } = await createServiceRoleClient().rpc('mt_retry_receipts', { p_limit: 50 });
  check(error);
  return data;
}
