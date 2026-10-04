import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import { requireIntegrationEnv,integrationEnv } from '@/test/integration/env';
import { CommerceJourneyFixture } from '@/test/integration/commerce-journey-fixture';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';

const cloud=vi.hoisted(()=>{
  if(process.env.INTEGRATION_SUPABASE_URL){
    process.env.NEXT_PUBLIC_SUPABASE_URL=process.env.INTEGRATION_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=process.env.INTEGRATION_SUPABASE_ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY=process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY;
  }
  process.env.WHATSAPP_ACCESS_TOKEN='integration'.repeat(3);process.env.WHATSAPP_PHONE_NUMBER_ID='123';
  return {send:vi.fn()};
});
// Only Meta's network boundary is doubled; inbox, configuration, RPCs and outbox are real.
vi.mock('@/modules/whatsapp/cloud-api-client',async importOriginal=>({
  ...await importOriginal<typeof import('@/modules/whatsapp/cloud-api-client')>(),sendCloudApiMessage:cloud.send,
}));
import { parseWebhookPayload,type WebhookBatch } from '@/modules/whatsapp/webhook-payload';
import { storeWebhookBatch } from '@/modules/whatsapp/webhook-inbox';
import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { Json } from '@/platform/supabase/database.types';
import { retryComprobantesServerUseCase,getPedidoServerUseCase } from '@/application/use-cases/pedidos-server-use-cases';
import { drainOrderDeliveries } from '@/application/use-cases/pedido-delivery-runtime';
import { commerceStateSchema } from '@/application/use-cases/commerce-conversation-state';
import { unwrap } from '@/test/integration/fixtures';
import { drainWhatsAppInbox } from './inbox-runtime';

describe.skipIf(requireIntegrationEnv()===null)('integracion: compra guiada, correo tardío y acceso protegido',()=>{
  const fixture=new CommerceJourneyFixture();const batches:WebhookBatch[]=[];
  beforeAll(()=>{
    expect(new URL(integrationEnv().url).hostname).toMatch(/^(?:127\.0\.0\.1|localhost|\[?::1\]?)$/);
    fixture.setup(); cloud.send.mockImplementation(async(config:unknown,recipient:string,payload:OutboundPayload)=>{
      expect(config).toMatchObject({phoneNumberId:'123'});expect(recipient).toBe(fixture.waId);expect(payload.kind).toBeTruthy();
      return {waMessageId:`wamid.meta.${randomUUID()}`};
    });
  });
  afterAll(()=>fixture.cleanup());
  async function inbound(command:string,interactive=false){
    const parsed=parseWebhookPayload({object:'whatsapp_business_account',entry:[{id:'1',changes:[{field:'messages',value:{
      messaging_product:'whatsapp',metadata:{phone_number_id:'123'},messages:[{id:`wamid.journey.${randomUUID()}`,from:fixture.waId,
        timestamp:String(Math.floor(Date.now()/1000)),type:interactive?'interactive':'text',
        ...(interactive?{interactive:{type:'button_reply',button_reply:{id:`SHOP:${command}`,title:'Fixture'}}}:{text:{body:command}}),
      }],
    }}]}]});
    if(!parsed.success)throw new Error('Invalid journey fixture');batches.push(parsed.batch);
    expect((await storeWebhookBatch(parsed.batch)).insertedWaMessageIds).toHaveLength(1);
    expect(await drainWhatsAppInbox('integration-journey')).toEqual({processed:1,failed:0});
    const row=unwrap<{context:Json}>(await createServiceRoleClient().from('whatsapp_conversation_state').select('context').eq('wa_id',fixture.waId).single(),'conversation checkpoint');
    const state=commerceStateSchema.parse(row.context);expect(state.lastMessageId).toBe(parsed.batch.messages[0].waMessageId);
    return state;
  }
  it('confirms bank money separately, delivers once, and never stores access plaintext in operational records',async()=>{
    expect(fixture.sql(`SELECT count(*) FROM public.terceros WHERE wa_id='${fixture.waId}';`)).toBe('0');
    await inbound('comprar');const selected=await inbound(`add:${fixture.plan}`,true);expect(selected.items).toHaveLength(1);
    const summary=await inbound('confirmar');expect(summary.stage).toBe('summary');expect(summary.orderId).toBeNull();
    const confirmed=await inbound('confirmar');expect(confirmed.stage).toBe('payment');if(!confirmed.orderId)throw new Error('Missing confirmed order');
    const orderId=confirmed.orderId;
    expect(fixture.sql(`SELECT count(*) FROM public.pedidos WHERE contact_id='${fixture.waId}';`)).toBe('1');
    const waiting=await inbound(`pago ${fixture.code}`);expect(waiting.lastReply).toContain('Faltante: 10.00');
    expect((await getPedidoServerUseCase(fixture.waId,orderId)).paymentState).toBe('pendiente');
    expect(fixture.sql(`SELECT count(*) FROM public.ventas WHERE servicio_id='${fixture.service}';`)).toBe('0');
    expect(fixture.sql(`SELECT count(*) FROM public.pedido_pagos WHERE pedido_id='${orderId}';`)).toBe('0');
    expect(fixture.sql(`SELECT pendiente FROM public.intentos_comprobante WHERE pedido_id='${orderId}';`)).toBe('t');
    const mailArgs={p_uid_validity:fixture.uidValidity,p_imap_uid:1,p_internet_message_id:`<${randomUUID()}@example.test>`,
      p_received_at:new Date().toISOString(),p_subject:'Yappy trusted fixture',p_dmarc_pass:true,p_parser_version:1,
      p_confirmation_code:fixture.code,p_amount:10,p_payer_name_short:'Another payer',p_payer_phone_last4:'9999',p_paid_at:new Date().toISOString()};
    const mail=unwrap(await createServiceRoleClient().rpc('ingest_yappy_payment',mailArgs),'trusted late mail');
    expect(mail[0].outcome).toBe('nuevo');expect(await retryComprobantesServerUseCase()).toBe(1);
    const assigned=await getPedidoServerUseCase(fixture.waId,orderId);expect(assigned).toMatchObject({paymentState:'cubierto',deliveryState:'asignado',missingAmount:0});
    expect(fixture.sql(`SELECT count(*) FROM public.ventas WHERE servicio_id='${fixture.service}';`)).toBe('1');
    expect(await drainOrderDeliveries(orderId)).toEqual({processed:1,failed:0});
    expect((await getPedidoServerUseCase(fixture.waId,orderId)).deliveryState).toBe('enviado');
    expect(cloud.send.mock.calls.some(call=>JSON.stringify(call[2]).includes(fixture.fixtureCredential))).toBe(true);
    const operational=fixture.sql(`SELECT jsonb_build_object('outbound',(SELECT jsonb_agg(to_jsonb(o)) FROM public.whatsapp_outbound_messages o WHERE to_wa_id='${fixture.waId}'),
      'delivery',(SELECT jsonb_agg(to_jsonb(d)) FROM public.mt_order_deliveries d WHERE pedido_id='${orderId}'),
      'conversation',(SELECT context FROM public.whatsapp_conversation_state WHERE wa_id='${fixture.waId}'));`);
    expect(operational).not.toContain(fixture.fixtureCredential);expect(operational).toContain('contenido protegido');
    const sends=cloud.send.mock.calls.length;const outboundCount=fixture.sql(`SELECT count(*) FROM public.whatsapp_outbound_messages WHERE to_wa_id='${fixture.waId}';`);
    for(const batch of batches)expect((await storeWebhookBatch(batch)).insertedWaMessageIds).toEqual([]);
    expect(await drainWhatsAppInbox('integration-duplicate')).toEqual({processed:0,failed:0});
    expect(unwrap(await createServiceRoleClient().rpc('ingest_yappy_payment',mailArgs),'duplicate trusted mail')[0].outcome).toBe('duplicado');
    expect(await retryComprobantesServerUseCase()).toBe(0);expect(await drainOrderDeliveries(orderId)).toEqual({processed:0,failed:0});
    expect(cloud.send).toHaveBeenCalledTimes(sends);
    expect(fixture.sql(`SELECT count(*) FROM public.whatsapp_outbound_messages WHERE to_wa_id='${fixture.waId}';`)).toBe(outboundCount);
    expect(fixture.sql(`SELECT count(*) FROM public.pedidos WHERE contact_id='${fixture.waId}';`)).toBe('1');
    expect(fixture.sql(`SELECT count(*) FROM public.pedido_pagos WHERE pedido_id='${orderId}';`)).toBe('1');
    expect(fixture.sql(`SELECT count(*) FROM public.pagos_venta WHERE venta_id IN(SELECT id FROM public.ventas WHERE servicio_id='${fixture.service}');`)).toBe('1');
    expect(fixture.sql(`SELECT count(*) FROM public.ventas WHERE servicio_id='${fixture.service}';`)).toBe('1');
  });
});
