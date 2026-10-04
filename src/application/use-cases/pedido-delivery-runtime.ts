import { env } from '@/platform/config';
import { createLogger } from '@/platform/observability/logger';
import { createOrderDeliveryStore } from '@/modules/whatsapp/order-delivery-store';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';
import { sendOutboundMessage } from '@/modules/whatsapp/outbound-messages';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { botReplyKey } from './bot-reply';
import { DeliveryLeaseLostError, orderAccessPayload, processOrderDeliveries } from './pedido-delivery-worker';

const log = createLogger('OrderDelivery');
export async function drainOrderDeliveries(orderId?: string, authorization?: string) {
  if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) return { processed: 0,failed: 0 };
  const store = createOrderDeliveryStore(authorization);
  if (orderId && authorization && !await store.retry(orderId)) throw new Error('El envío requiere verificar el historial antes de reintentarlo.');
  const outboundStore = createOutboundStore(); const catalog = createTemplateCatalog();
  const config = { accessToken: env.whatsappAccessToken,phoneNumberId: env.whatsappPhoneNumberId };
  return processOrderDeliveries({ store,onFailure: id=>log.warn('Access delivery remains pending',{ deliveryId: id }),
    send: async (claim,access) => sendOutboundMessage({
      idempotencyKey: botReplyKey(`order-access:${claim.itemId}`),toWaId: claim.waId,
      payload: orderAccessPayload(access),sentBy: null,storedTextBody: 'Acceso enviado (contenido protegido).',
    },{ store: outboundStore,catalog,send: async recipient=>{
      // Fetch the current policy again immediately before the external boundary.
      const current = await store.access(claim);
      if (!current) throw new DeliveryLeaseLostError();
      return sendCloudApiMessage(config,recipient,orderAccessPayload(current));
    } }),
  },orderId);
}
