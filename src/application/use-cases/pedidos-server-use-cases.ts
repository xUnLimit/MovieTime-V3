import { z } from '@/platform/validation/zod';
import { catalogoSchema, pedidoSchema, serverCartSchema, receiptSchema } from '@/modules/orders/contracts';
import { catalogoServerRpc, createCommerceOrderRpc, getCommerceOrderRpc, reconcileCommerceOrderRpc, serviciosServerRpc, cancelCommerceOrderRpc, retryReceiptsRpc } from '@/platform/server/orders-server-rpc-adapter';

const waSchema = z.string().regex(/^507\d{8}$/);
const serviciosSchema = z.array(z.object({
  ventaId: z.uuid(), nombre: z.string(), precio: z.number().nonnegative(), moneda: z.string(),
  cicloPago: z.enum(['mensual', 'trimestral', 'semestral', 'anual']), fechaVencimiento: z.string(),
}));

export async function listCatalogoServerUseCase() {
  return catalogoSchema.parse(await catalogoServerRpc());
}

export async function listServiciosServerUseCase(waId: string) {
  return serviciosSchema.parse(await serviciosServerRpc(waSchema.parse(waId)));
}

export function createCompraServerUseCase(waId: string, planIds: string[], key: string, expectedTotal: number) {
  const request = serverCartSchema.parse({ waId, ids: planIds, key, expectedTotal });
  return createCommerceOrderRpc(request.waId, request.ids, 'compra', request.key, request.expectedTotal);
}

export function createRenovacionServerUseCase(waId: string, ventaIds: string[], key: string, expectedTotal: number) {
  const request = serverCartSchema.parse({ waId, ids: ventaIds, key, expectedTotal });
  return createCommerceOrderRpc(request.waId, request.ids, 'renovacion', request.key, request.expectedTotal);
}

export async function getPedidoServerUseCase(waId: string, id: string) {
  return pedidoSchema.parse(await getCommerceOrderRpc(waSchema.parse(waId), z.uuid().parse(id)));
}

export async function reconcilePedidoServerUseCase(waId: string, id: string, code: string, key: string) {
  const request = receiptSchema.parse({ id, code, key });
  await reconcileCommerceOrderRpc(waSchema.parse(waId), request.id, request.code, request.key);
  return getPedidoServerUseCase(waId, id);
}

export function cancelPedidoServerUseCase(waId: string, id: string, key: string) {
  return cancelCommerceOrderRpc(waSchema.parse(waId), z.uuid().parse(id), z.uuid().parse(key));
}

export async function retryComprobantesServerUseCase() {
  return z.number().int().nonnegative().parse(await retryReceiptsRpc());
}
