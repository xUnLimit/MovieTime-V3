import { z } from '@/platform/validation/zod';
import { afterCommit } from '@/platform/errors/mutation-committed-error';
import { storeEventBus } from '@/platform/events/store-event-bus';
import { invalidateStoreQueries } from '@/platform/cache/store-query-invalidation';
import { getPedidoResolutionQuoteRpc, resolvePedidoRpc } from '@/platform/supabase/order-resolution-rpc-adapter';

const requestSchema = z.object({ id: z.uuid(), amount: z.number().finite().nonnegative(), key: z.uuid() });
const quoteSchema = z.object({ total: z.number().nonnegative(), difference: z.number().finite(),
  items: z.array(z.object({ id: z.uuid(), oldTotal: z.number().nonnegative(), newTotal: z.number().nonnegative() })) });

async function resolve(id: string, action: 'refund' | 'accept_quote' | 'assign_items', amount: number,
  reference: string | null, items: string[] | null, key: string) {
  const result = await resolvePedidoRpc(id, action, amount, reference, items, key);
  return afterCommit(result, async () => {
    storeEventBus.emit({ type: 'DASHBOARD_INVALIDATED' });
    storeEventBus.emit({ type: 'SERVICIOS_INVALIDATED' });
    await invalidateStoreQueries(['ventas', 'servicios', 'pagination', 'dashboard']);
    return result;
  });
}

export async function getPedidoResolutionQuoteUseCase(id: string) {
  return quoteSchema.parse(await getPedidoResolutionQuoteRpc(z.uuid().parse(id)));
}

export function acceptPedidoResolutionQuoteUseCase(id: string, expectedTotal: number, key: string) {
  const request = requestSchema.parse({ id, amount: expectedTotal, key });
  return resolve(request.id, 'accept_quote', request.amount, null, null, request.key);
}

export function refundPedidoUnallocatedUseCase(id: string, reference: string, expectedAmount: number, key: string) {
  const request = requestSchema.parse({ id, amount: expectedAmount, key });
  z.number().positive().parse(request.amount);
  const validatedReference = z.string().trim().regex(/^[A-Za-z0-9 ._:/-]{4,100}$/).parse(reference);
  return resolve(request.id, 'refund', request.amount, validatedReference, null, request.key);
}

export function assignPedidoItemsUseCase(id: string, itemIds: string[], expectedAmount: number, key: string) {
  const request = requestSchema.parse({ id, amount: expectedAmount, key });
  const selected = z.array(z.uuid()).min(1).max(100).refine(ids => new Set(ids).size === ids.length).parse(itemIds);
  return resolve(request.id, 'assign_items', request.amount, null, selected, request.key);
}
