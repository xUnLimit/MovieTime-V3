import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { DeliveryAccess, OrderDeliveryClaim } from '@/modules/whatsapp/order-delivery-store';
import { CustomerWindowClosedError } from '@/modules/whatsapp/outbound-messages';
import { DeliveryLeaseLostError, orderAccessPayload, processOrderDeliveries } from './pedido-delivery-worker';

const claim: OrderDeliveryClaim = { id:randomUUID(), itemId:randomUUID(), orderId:randomUUID(), saleId:randomUUID(),
  waId:'50760000000', token:randomUUID(), fence:1, attempts:1 };
const fixtureCredential='synthetic-access';
const access: DeliveryAccess = { saleId:claim.saleId,serviceId:randomUUID(),waId:claim.waId,name:'Servicio',email:'fixture@example.invalid',
  profile:'Perfil 1',mode:'password',provider:'none',password:fixtureCredential,pin:'1234',expiresAt:'2026-11-30' };
function dependencies() {
  return { store:{ claim:vi.fn().mockResolvedValueOnce(claim).mockResolvedValue(null),access:vi.fn().mockResolvedValue(access),
    finish:vi.fn().mockResolvedValue(true),retry:vi.fn().mockResolvedValue(true) },
    send:vi.fn().mockResolvedValue({ id:randomUUID(),sendStatus:'accepted' }),onFailure:vi.fn() };
}
describe('recoverable order access delivery',()=>{
  it('closes only an accepted and fenced item, without repeating a financial mutation',async()=>{
    const deps=dependencies(); expect(await processOrderDeliveries(deps,claim.orderId)).toEqual({processed:1,failed:0});
    expect(deps.store.claim).toHaveBeenCalledWith(claim.orderId);
    expect(deps.store.finish).toHaveBeenCalledWith(claim,'accepted',deps.send.mock.results[0] ? (await deps.send.mock.results[0].value).id : '');
    deps.store.claim.mockResolvedValueOnce(claim); deps.store.finish.mockResolvedValue(false);
    expect(await processOrderDeliveries(deps)).toEqual({processed:0,failed:0});
  });
  it('sends credentials transiently for password mode and excludes them entirely in code mode',()=>{
    expect(orderAccessPayload(access)).toMatchObject({kind:'text',text:expect.stringContaining('synthetic-access')});
    const coded=orderAccessPayload({...access,mode:'code',provider:'netflix'});
    expect(coded).toMatchObject({kind:'buttons',buttons:[{id:`ACCESS:LOGIN:${claim.saleId}`,title:'Solicitar código'}]});
    expect(JSON.stringify(coded)).not.toContain(access.password); expect(JSON.stringify(coded)).not.toContain('1234');
    expect(orderAccessPayload({...access,password:null,pin:null,profile:''})).toMatchObject({text:expect.stringContaining('Perfil: Cuenta')});
    expect(()=>orderAccessPayload({...access,mode:'code',provider:'unsupported'})).toThrow('provider');
  });
  it('keeps denied, failed and ambiguous external outcomes distinct',async()=>{
    const denied=dependencies(); denied.store.access.mockResolvedValue(null);
    expect(await processOrderDeliveries(denied)).toEqual({processed:0,failed:1}); expect(denied.send).not.toHaveBeenCalled();
    expect(denied.store.finish).toHaveBeenCalledWith(claim,'ineligible');
    for (const [status,outcome] of [['pending','review'],['failed','retry']]) {
      const deps=dependencies(); deps.send.mockResolvedValue({id:claim.id,sendStatus:status});
      expect(await processOrderDeliveries(deps)).toEqual({processed:0,failed:1});
      expect(deps.store.finish).toHaveBeenCalledWith(claim,outcome,claim.id);
    }
  });
  it('retries only failures known to precede delivery and leaves uncertain sends for review',async()=>{
    const before=dependencies(); before.store.access.mockRejectedValue(new Error('offline'));
    await processOrderDeliveries(before); expect(before.store.finish).toHaveBeenCalledWith(claim,'retry');
    const after=dependencies(); after.send.mockRejectedValue(new Error('connection interrupted'));
    await processOrderDeliveries(after); expect(after.store.finish).toHaveBeenCalledWith(claim,'review');
    const closed=dependencies(); closed.send.mockRejectedValue(new CustomerWindowClosedError());
    await processOrderDeliveries(closed); expect(closed.store.finish).toHaveBeenCalledWith(claim,'retry');
    const stale=dependencies(); stale.send.mockRejectedValue(new DeliveryLeaseLostError());
    expect(await processOrderDeliveries(stale)).toEqual({processed:0,failed:0});
    expect(stale.store.finish).not.toHaveBeenCalled(); expect(stale.onFailure).not.toHaveBeenCalled();
  });
  it('bounds each drain and propagates database failures',async()=>{
    const deps=dependencies(); deps.store.claim.mockReset().mockResolvedValue(claim);
    expect(await processOrderDeliveries(deps)).toEqual({processed:10,failed:0}); expect(deps.send).toHaveBeenCalledTimes(10);
    deps.store.claim.mockRejectedValue(new Error('claim unavailable'));
    await expect(processOrderDeliveries(deps)).rejects.toThrow('claim unavailable');
  });
});
