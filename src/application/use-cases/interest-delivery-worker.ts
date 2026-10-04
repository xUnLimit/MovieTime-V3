import type { InterestDeliveryStore, InterestDeliveryClaim } from '@/modules/whatsapp/interest-delivery-store';
import { CustomerWindowClosedError, TemplateNotApprovedError, InvalidTemplateParamsError, type OutboundResult } from '@/modules/whatsapp/outbound-messages';
export class InterestDeliveryLeaseLostError extends Error {}
export async function processInterestDeliveries(deps:{store:InterestDeliveryStore;send(claim:InterestDeliveryClaim):Promise<OutboundResult>;
  onFailure(id:string):void}) {
  let processed=0;let failed=0;
  for(let index=0;index<10;index++) {
    const claim=await deps.store.claim();if(!claim)break; let externalStarted=false;
    try {
      if(!await deps.store.current(claim))throw new InterestDeliveryLeaseLostError();
      externalStarted=true; const result=await deps.send(claim);
      if(result.sendStatus==='accepted') {if(await deps.store.finish(claim,'accepted',result.id))processed++;}
      else {await deps.store.finish(claim,result.sendStatus==='pending'?'review':'retry',result.id);failed++;}
    } catch(error) {
      if(error instanceof InterestDeliveryLeaseLostError)continue;
      failed++;deps.onFailure(claim.id);
      await deps.store.finish(claim,!externalStarted || error instanceof CustomerWindowClosedError
        || error instanceof TemplateNotApprovedError || error instanceof InvalidTemplateParamsError ? 'retry':'review');
    }
  }
  return {processed,failed};
}
