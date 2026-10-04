import type { OrderDeliveryStore, OrderDeliveryClaim, DeliveryAccess } from '@/modules/whatsapp/order-delivery-store';
import { CustomerWindowClosedError, type OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';

export class DeliveryLeaseLostError extends Error {}
export function orderAccessPayload(access: DeliveryAccess): OutboundPayload {
  const body = `${access.name}\nCorreo: ${access.email}\nPerfil: ${access.profile || 'Cuenta'}\nVigencia: ${access.expiresAt}`;
  if (access.mode === 'code') {
    if (access.provider !== 'netflix') throw new Error('Access provider is unavailable');
    return { kind: 'buttons', body: `${body}\nSolicita un código cuando estés listo para iniciar sesión.`.slice(0,1024),
      buttons: [{ id: `ACCESS:LOGIN:${access.saleId}`, title: 'Solicitar código' }] };
  }
  return { kind: 'text', text: `${body}\nContraseña: ${access.password ?? ''}${access.pin ? `\nPIN: ${access.pin}` : ''}`.slice(0,4096) };
}
export async function processOrderDeliveries(deps: {
  store: OrderDeliveryStore;
  send: (claim: OrderDeliveryClaim, access: DeliveryAccess) => Promise<OutboundResult>;
  onFailure: (id: string) => void;
}, orderId?: string) {
  let processed = 0; let failed = 0;
  for (let index=0; index<10; index++) {
    const claim = await deps.store.claim(orderId);
    if (!claim) break;
    let externalStarted = false;
    try {
      const access = await deps.store.access(claim);
      if (!access) { await deps.store.finish(claim,'ineligible'); failed++; continue; }
      externalStarted = true;
      const result = await deps.send(claim,access);
      if (result.sendStatus==='accepted') {
        if (await deps.store.finish(claim,'accepted',result.id)) processed++;
      } else { await deps.store.finish(claim,result.sendStatus==='pending' ? 'review' : 'retry',result.id); failed++; }
    } catch (error) {
      if (error instanceof DeliveryLeaseLostError) continue;
      deps.onFailure(claim.id); failed++;
      await deps.store.finish(claim,error instanceof CustomerWindowClosedError || !externalStarted ? 'retry' : 'review');
    }
  }
  return { processed,failed };
}
