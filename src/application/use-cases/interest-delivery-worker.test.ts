import { describe,expect,it,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { CustomerWindowClosedError,TemplateNotApprovedError,InvalidTemplateParamsError } from '@/modules/whatsapp/outbound-messages';
import { InterestDeliveryLeaseLostError,processInterestDeliveries } from './interest-delivery-worker';
const claim={id:randomUUID(),contact:'50760000000',name:'Netflix',token:randomUUID(),fence:1,attempts:1};
function dependencies(){return {store:{claim:vi.fn().mockResolvedValueOnce(claim).mockResolvedValue(null),current:vi.fn().mockResolvedValue(true),
  finish:vi.fn().mockResolvedValue(true)},send:vi.fn().mockResolvedValue({id:claim.id,sendStatus:'accepted'}),onFailure:vi.fn()};}
describe('durable consented stock invitation',()=>{
  it('records only fenced accepted delivery and bounds the drain',async()=>{
    const deps=dependencies();expect(await processInterestDeliveries(deps)).toEqual({processed:1,failed:0});
    expect(deps.store.finish).toHaveBeenCalledWith(claim,'accepted',claim.id);
    deps.store.claim.mockResolvedValueOnce(claim);deps.store.finish.mockResolvedValue(false);
    expect(await processInterestDeliveries(deps)).toEqual({processed:0,failed:0});
    deps.store.claim.mockReset().mockResolvedValue(claim);deps.store.finish.mockResolvedValue(true);
    expect(await processInterestDeliveries(deps)).toEqual({processed:10,failed:0});
  });
  it('fences loss of consent, stock, bot ownership or global switch before sending',async()=>{
    const deps=dependencies();deps.store.current.mockResolvedValue(false);
    expect(await processInterestDeliveries(deps)).toEqual({processed:0,failed:0});expect(deps.send).not.toHaveBeenCalled();
    const boundary=dependencies();boundary.send.mockRejectedValue(new InterestDeliveryLeaseLostError());
    await processInterestDeliveries(boundary);expect(boundary.store.finish).not.toHaveBeenCalled();
  });
  it('retries explicit failures and keeps uncertain results for review',async()=>{
    for(const [sendStatus,outcome] of [['pending','review'],['failed','retry']]){
      const deps=dependencies();deps.send.mockResolvedValue({id:claim.id,sendStatus});
      expect(await processInterestDeliveries(deps)).toEqual({processed:0,failed:1});
      expect(deps.store.finish).toHaveBeenCalledWith(claim,outcome,claim.id);
    }
    const uncertain=dependencies();uncertain.send.mockRejectedValue(new Error('interrupted'));
    await processInterestDeliveries(uncertain);expect(uncertain.store.finish).toHaveBeenCalledWith(claim,'review');
    expect(uncertain.onFailure).toHaveBeenCalledWith(claim.id);
  });
  it('retains recoverable work when window, template or preflight checks are unavailable',async()=>{
    for(const error of [new CustomerWindowClosedError(),new TemplateNotApprovedError(),new InvalidTemplateParamsError()]){
      const deps=dependencies();deps.send.mockRejectedValue(error);await processInterestDeliveries(deps);
      expect(deps.store.finish).toHaveBeenCalledWith(claim,'retry');
    }
    const before=dependencies();before.store.current.mockRejectedValue(new Error('database unavailable'));
    await processInterestDeliveries(before);expect(before.store.finish).toHaveBeenCalledWith(claim,'retry');
    const unavailable=dependencies();unavailable.store.claim.mockRejectedValue(new Error('claim unavailable'));
    await expect(processInterestDeliveries(unavailable)).rejects.toThrow('claim unavailable');
  });
});
