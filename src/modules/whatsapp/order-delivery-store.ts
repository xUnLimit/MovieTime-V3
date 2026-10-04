import { createServiceRoleClient, createUserRequestClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';

const claimSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid(), orderId: z.string().uuid(),
  saleId: z.string().uuid(), waId: z.string().regex(/^507\d{8}$/), token: z.string().uuid(),
  fence: z.number().int().nonnegative(), attempts: z.number().int().positive() });
const accessSchema = z.object({ saleId: z.string().uuid(), serviceId: z.string().uuid(), waId: z.string().regex(/^507\d{8}$/),
  name: z.string().max(200), email: z.string().max(320), profile: z.string().max(200), mode: z.enum(['code','password']),
  provider: z.string().max(40), password: z.string().max(4096).nullable(), pin: z.string().max(200).nullable(), expiresAt: z.string() });
export type OrderDeliveryClaim = z.infer<typeof claimSchema>;
export type DeliveryAccess = z.infer<typeof accessSchema>;
export type OrderDeliveryStore = {
  claim(orderId?: string): Promise<OrderDeliveryClaim | null>;
  access(claim: OrderDeliveryClaim): Promise<DeliveryAccess | null>;
  finish(claim: OrderDeliveryClaim, result: 'accepted'|'retry'|'review'|'ineligible', outboundId?: string): Promise<boolean>;
  retry(orderId: string): Promise<boolean>;
};
export function createOrderDeliveryStore(authorization?: string): OrderDeliveryStore {
  const client = authorization ? createUserRequestClient(authorization) : createServiceRoleClient();
  return {
    async claim(orderId) {
      const { data,error } = await client.rpc('mt_claim_order_delivery', { p_order_id: orderId ?? null });
      if (error) throw new Error('Delivery claim failed');
      return data === null ? null : claimSchema.parse(data);
    },
    async access(claim) {
      const { data,error } = await client.rpc('mt_order_delivery_access', { p_id: claim.id,p_token: claim.token,p_fence: claim.fence });
      if (error) throw new Error('Delivery authorization failed');
      return data === null ? null : accessSchema.parse(data);
    },
    async finish(claim,result,outboundId) {
      const { data,error } = await client.rpc('mt_finish_order_delivery', { p_id: claim.id,p_token: claim.token,
        p_fence: claim.fence,p_result: result,p_outbound_id: outboundId ?? null });
      if (error) throw new Error('Delivery completion failed');
      return data === true;
    },
    async retry(orderId) {
      const { data,error } = await client.rpc('mt_retry_order_delivery', { p_order_id: z.string().uuid().parse(orderId) });
      if (error) throw new Error('Delivery retry failed');
      return data === true;
    },
  };
}

export async function resolveAccessSale(waId: string, saleId: string): Promise<string | null> {
  const { data,error } = await createServiceRoleClient().rpc('mt_resolve_access_sale', {
    p_wa_id: z.string().regex(/^507\d{8}$/).parse(waId), p_sale_id: z.string().uuid().parse(saleId),
  });
  if (error) throw new Error('Access sale authorization failed');
  return data === null ? null : z.string().uuid().parse(data);
}
