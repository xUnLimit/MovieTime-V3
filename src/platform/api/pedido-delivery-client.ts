import { z } from '@/platform/validation/zod';
import { readApiResponse } from './client';
export async function postPedidoDeliveryRetry(accessToken: string,orderId: string) {
  const response = await fetch('/api/whatsapp/orders/deliver',{ method:'POST',
    headers:{ Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json' },
    body:JSON.stringify({ orderId }),signal:AbortSignal.timeout(30000) });
  return z.object({ processed:z.number().int().nonnegative(),failed:z.number().int().nonnegative() })
    .parse(await readApiResponse<unknown>(response));
}
