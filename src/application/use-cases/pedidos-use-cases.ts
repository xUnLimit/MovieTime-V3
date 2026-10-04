import { z } from '@/platform/validation/zod';
import { storeEventBus } from '@/platform/events/store-event-bus';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import { afterCommit } from '@/platform/errors/mutation-committed-error';
import { createPedidoPanelRpc, listPedidosRpc, mutatePedidoRpc, reconcilePedidoRpc, resolvePedidoExcessRpc } from '@/platform/supabase/orders-rpc-adapter';
import { pedidoSchema, panelCartSchema, receiptSchema, type PanelCart } from '@/modules/orders/contracts';

export async function createPedidoPanelUseCase(groups: PanelCart, key: string): Promise<string> {
  const validated = panelCartSchema.parse(groups);
  const id = await createPedidoPanelRpc(validated, z.uuid().parse(key));
  return afterCommit(id, async () => {
    storeEventBus.emit({ type: 'DASHBOARD_INVALIDATED' });
    storeEventBus.emit({ type: 'SERVICIOS_INVALIDATED' });
    storeEventBus.emit({ type: 'NOTIFICACIONES_INVALIDATED', entity: 'venta' });
    await invalidateStoreQueries(['ventas', 'servicios', 'pagination', 'dashboard']);
    return id;
  });
}

export async function listPedidosUseCase() {
  return z.array(pedidoSchema).parse(await listPedidosRpc());
}

export async function retryPedidoUseCase(id: string, key: string) {
  const result = await mutatePedidoRpc(z.uuid().parse(id), 'retry', z.uuid().parse(key));
  return afterCommit(result, async () => {
    storeEventBus.emit({ type: 'DASHBOARD_INVALIDATED' });
    storeEventBus.emit({ type: 'SERVICIOS_INVALIDATED' });
    await invalidateStoreQueries(['ventas', 'servicios', 'pagination', 'dashboard']);
    return result;
  });
}

export function cancelPedidoUseCase(id: string, key: string) {
  return mutatePedidoRpc(z.uuid().parse(id), 'cancel', z.uuid().parse(key));
}

export function reconcilePedidoUseCase(id: string, code: string, key: string) {
  const receipt = receiptSchema.parse({ id, code, key });
  return reconcilePedidoRpc(receipt.id, receipt.code, receipt.key);
}

const excessResolution = z.object({ id: z.uuid(), action: z.enum(['credito', 'reembolsado']),
  reference: z.string().trim().regex(/^[A-Za-z0-9 ._:/-]{4,100}$/), amount: z.number().positive().finite(), key: z.uuid() });
export function resolvePedidoExcessUseCase(id: string, action: 'credito' | 'reembolsado', reference: string, amount: number, key: string) {
  const request = excessResolution.parse({ id, action, reference, amount, key });
  return resolvePedidoExcessRpc(request.id, request.action, request.reference, request.amount, request.key);
}
