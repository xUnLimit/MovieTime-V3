import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import { requireIntegrationEnv,integrationEnv } from '@/test/integration/env';
import { CommerceJourneyFixture } from '@/test/integration/commerce-journey-fixture';

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
import { parseWebhookPayload } from '@/modules/whatsapp/webhook-payload';
import { storeWebhookBatch } from '@/modules/whatsapp/webhook-inbox';
import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { Json } from '@/platform/supabase/database.types';
import { getPedidoServerUseCase } from '@/application/use-cases/pedidos-server-use-cases';
import { commerceStateSchema } from '@/application/use-cases/commerce-conversation-state';
import { unwrap } from '@/test/integration/fixtures';
import { drainWhatsAppInbox } from './inbox-runtime';

describe.skipIf(requireIntegrationEnv()===null)('integracion: "Ya pagué" cruza los últimos 4 dígitos con el correo de Yappy',()=>{
  const fixture=new CommerceJourneyFixture();
  beforeAll(()=>{
    expect(new URL(integrationEnv().url).hostname).toMatch(/^(?:127\.0\.0\.1|localhost|\[?::1\]?)$/);
    fixture.setup();
    cloud.send.mockImplementation(async()=>({waMessageId:`wamid.meta.${randomUUID()}`}));
  });
  afterAll(()=>fixture.cleanup());
  async function inbound(command:string,interactive=false){
    const parsed=parseWebhookPayload({object:'whatsapp_business_account',entry:[{id:'1',changes:[{field:'messages',value:{
      messaging_product:'whatsapp',metadata:{phone_number_id:'123'},messages:[{id:`wamid.last4.${randomUUID()}`,from:fixture.waId,
        timestamp:String(Math.floor(Date.now()/1000)),type:interactive?'interactive':'text',
        ...(interactive?{interactive:{type:'button_reply',button_reply:{id:`SHOP:${command}`,title:'Fixture'}}}:{text:{body:command}}),
      }],
    }}]}]});
    if(!parsed.success)throw new Error('Invalid last-four fixture');
    expect((await storeWebhookBatch(parsed.batch)).insertedWaMessageIds).toHaveLength(1);
    expect(await drainWhatsAppInbox('integration-last4')).toEqual({processed:1,failed:0});
    const row=unwrap<{context:Json}>(await createServiceRoleClient().from('whatsapp_conversation_state').select('context').eq('wa_id',fixture.waId).single(),'conversation checkpoint');
    return commerceStateSchema.parse(row.context);
  }
  it('sends an unmatched order to review, then confirms the unique email match once, without reading any image',async()=>{
    await inbound('comprar');await inbound(`add:${fixture.plan}`,true);await inbound('confirmar');
    const confirmed=await inbound('confirmar');if(!confirmed.orderId)throw new Error('Missing confirmed order');
    const orderId=confirmed.orderId;
    expect((await inbound('paid',true)).stage).toBe('last4');
    // Nothing in the mailbox yet: the same generic answer, the order waits for a person and no money moves.
    const review=await inbound(fixture.last4);
    expect(review.lastReply).toContain('Una persona del equipo lo va a revisar');
    expect(fixture.sql(`SELECT estado FROM public.pedidos WHERE id='${orderId}';`)).toBe('pago_en_revision');
    expect(fixture.sql(`SELECT count(*) FROM public.pedido_pagos WHERE pedido_id='${orderId}';`)).toBe('0');
    expect(fixture.sql(`SELECT count(*) FROM public.ventas WHERE servicio_id='${fixture.service}';`)).toBe('0');
    // The bank mail arrives; a person would see it as the candidate, and the customer retries.
    const mail=unwrap(await createServiceRoleClient().rpc('ingest_yappy_payment',{p_uid_validity:fixture.uidValidity,p_imap_uid:2,
      p_internet_message_id:`<${randomUUID()}@example.test>`,p_received_at:new Date().toISOString(),p_subject:'Yappy last four fixture',
      p_dmarc_pass:true,p_parser_version:1,p_confirmation_code:fixture.digitsCode,p_amount:10,p_payer_name_short:'Another payer',
      p_payer_phone_last4:'9999',p_paid_at:new Date().toISOString()}),'trusted mail');
    expect(mail[0].outcome).toBe('nuevo');
    expect((await inbound('paid',true)).stage).toBe('last4');
    const paid=await inbound(fixture.last4);
    expect(paid.lastReply).toContain('Ya recibimos tu pago');
    expect(await getPedidoServerUseCase(fixture.waId,orderId)).toMatchObject({paymentState:'cubierto',missingAmount:0});
    expect(fixture.sql(`SELECT count(*) FROM public.pedido_pagos WHERE pedido_id='${orderId}';`)).toBe('1');
    expect(fixture.sql(`SELECT count(*) FROM public.ventas WHERE servicio_id='${fixture.service}';`)).toBe('1');
    // A repeated attempt never applies the same email payment twice.
    await inbound('paid',true);await inbound(fixture.last4);
    expect(fixture.sql(`SELECT count(*) FROM public.pedido_pagos WHERE pedido_id='${orderId}';`)).toBe('1');
  });
});
