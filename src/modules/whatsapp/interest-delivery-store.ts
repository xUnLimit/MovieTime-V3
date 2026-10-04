import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';

const schema=z.object({id:z.string().uuid(),contact:z.string().regex(/^507\d{8}$/),name:z.string().min(1).max(200),
  token:z.string().uuid(),fence:z.number().int().nonnegative(),attempts:z.number().int().positive()});
export type InterestDeliveryClaim=z.infer<typeof schema>;
export type InterestDeliveryStore={claim():Promise<InterestDeliveryClaim|null>;current(claim:InterestDeliveryClaim):Promise<boolean>;
  finish(claim:InterestDeliveryClaim,result:'accepted'|'retry'|'review',outboundId?:string):Promise<boolean>};
export function createInterestDeliveryStore(manualId?:string):InterestDeliveryStore {
  const client=createServiceRoleClient();
  return {
    async claim(){
      const {data,error}=await client.rpc('mt_claim_automatic_interest',{p_id:manualId ?? null,p_manual:!!manualId});
      if(error)throw new Error('Availability invitation claim failed');
      return data===null?null:schema.parse(data);
    },
    async current(claim){
      const {data,error}=await client.rpc('mt_check_interest_delivery',{p_id:claim.id,p_token:claim.token,p_fence:claim.fence});
      if(error)throw new Error('Availability invitation check failed'); return data===true;
    },
    async finish(claim,result,outboundId){
      const {data,error}=await client.rpc('mt_finish_automatic_interest',{p_id:claim.id,p_token:claim.token,p_fence:claim.fence,
        p_result:result,p_outbound_id:outboundId ?? null});
      if(error)throw new Error('Availability invitation completion failed'); return data===true;
    },
  };
}
