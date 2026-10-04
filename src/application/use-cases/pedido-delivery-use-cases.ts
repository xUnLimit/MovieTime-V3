import { z } from '@/platform/validation/zod';
import { getCurrentSession } from '@/platform/supabase/auth';
import { assertOnlineMutation } from '@/platform/utils/online-mutation';
import { postPedidoDeliveryRetry } from '@/platform/api/pedido-delivery-client';
export async function requestPedidoDeliveryRetryUseCase(id:string) {
  assertOnlineMutation(); const orderId=z.string().uuid().parse(id);
  const session=await getCurrentSession();
  if (!session?.access_token) throw new Error('Debes iniciar sesión para enviar el acceso.');
  return postPedidoDeliveryRetry(session.access_token,orderId);
}
