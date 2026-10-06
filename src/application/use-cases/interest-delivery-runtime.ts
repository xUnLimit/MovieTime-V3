import { env } from '@/platform/config';
import { createLogger } from '@/platform/observability/logger';
import { createInterestDeliveryStore } from '@/modules/whatsapp/interest-delivery-store';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';
import { sendOutboundMessage } from '@/modules/whatsapp/outbound-messages';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { interestAvailableText } from './interest-copy';
import { InterestDeliveryLeaseLostError, processInterestDeliveries } from './interest-delivery-worker';
const logger=createLogger('InterestDelivery');
export async function drainInterestDeliveries(manualId?:string) {
  if(!env.whatsappAccessToken||!env.whatsappPhoneNumberId)return {processed:0,failed:0};
  const store=createInterestDeliveryStore(manualId);const outbound=createOutboundStore();const catalog=createTemplateCatalog();
  const config={accessToken:env.whatsappAccessToken,phoneNumberId:env.whatsappPhoneNumberId};
  const templateName=process.env.AUTOMATION_INTEREST_TEMPLATE;
  return processInterestDeliveries({store,onFailure:id=>logger.warn('Availability invitation remains pending',{interestId:id}),
    send:async claim=>sendOutboundMessage({idempotencyKey:claim.id,toWaId:claim.contact,sentBy:null,
      payload:templateName?{kind:'template',templateName,params:[claim.name]}:{kind:'text',
        text:await interestAvailableText(claim.name)}},
    {store:outbound,catalog,send:async(recipient,payload)=>{
      if(!await store.current(claim))throw new InterestDeliveryLeaseLostError();
      return sendCloudApiMessage(config,recipient,payload);
    }}),
  });
}
