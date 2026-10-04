import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { defaultDefinition } from '@/modules/bot-config';
import type { AutomationClaim } from '@/modules/whatsapp/automation-inbox-store';
import type { Json } from '@/platform/supabase/database.types';
import { commerceStateSchema } from '@/application/use-cases/commerce-conversation-state';

const mocks=vi.hoisted(()=>({ env:{whatsappAccessToken:'fixture',whatsappPhoneNumberId:'123'},
  store:{claim:vi.fn(),isCurrent:vi.fn(),checkpoint:vi.fn(),finish:vi.fn()},notice:vi.fn(),commerce:vi.fn(),candidate:vi.fn(),
  intent:vi.fn(),send:vi.fn(),cloud:vi.fn(),delivery:vi.fn(),interest:vi.fn(),bot:{configuration:vi.fn(),handle:vi.fn(),version:3},warn:vi.fn() }));
vi.mock('@/platform/config',()=>({env:mocks.env}));
vi.mock('@/platform/observability/logger',()=>({createLogger:()=>({warn:mocks.warn})}));
vi.mock('@/modules/whatsapp/automation-inbox-store',()=>({createAutomationInboxStore:()=>mocks.store}));
vi.mock('@/application/use-cases/notice-reply-use-case',()=>({handleNoticeReply:mocks.notice}));
vi.mock('@/application/use-cases/commerce-conversation-use-case',()=>({handleCommerceConversation:mocks.commerce}));
vi.mock('@/application/use-cases/commerce-conversation-runtime',()=>({createCommerceConversationDeps:()=>({})}));
vi.mock('@/application/use-cases/receipt-candidate-use-case',()=>({readReceiptCandidateUseCase:mocks.candidate}));
vi.mock('@/application/use-cases/automation-intent-use-case',()=>({suggestAutomationIntent:mocks.intent}));
vi.mock('@/application/use-cases/pedido-delivery-runtime',()=>({drainOrderDeliveries:mocks.delivery}));
vi.mock('@/application/use-cases/interest-delivery-runtime',()=>({drainInterestDeliveries:mocks.interest}));
vi.mock('@/modules/messaging/notice-reply-store',()=>({createNoticeReplyStore:()=>({})}));
vi.mock('@/modules/messaging/notice-store',()=>({createNoticeStore:()=>({})}));
vi.mock('@/modules/whatsapp/outbound-store',()=>({createOutboundStore:()=>({})}));
vi.mock('@/modules/whatsapp/template-catalog',()=>({createTemplateCatalog:()=>({})}));
vi.mock('@/modules/whatsapp/outbound-messages',()=>({sendOutboundMessage:mocks.send}));
vi.mock('@/modules/whatsapp/cloud-api-client',()=>({sendCloudApiMessage:mocks.cloud}));
vi.mock('./bot-runtime',()=>({createBotRuntime:()=>mocks.bot}));
import { drainWhatsAppInbox } from './inbox-runtime';

const orderId=randomUUID();
function claim(context:Record<string,Json>={},messageType='text'):AutomationClaim {
  return {id:1,attempts:1,token:randomUUID(),fence:1,conversation:{waId:'50760000000',flowVersion:2,context,activeProcess:null,orderId:null},
    message:{waMessageId:'wamid.fixture',fromWaId:'50760000000',phoneNumberId:'123',contactName:null,messageType,textBody:'free wording',sentAt:'2026-10-03',
      mediaId:messageType==='image'?'123':null,mediaMimeType:null,mediaFilename:null,contextWaMessageId:null,reactionEmoji:null,payload:{}} };
}
function queue(input=claim()) { mocks.store.claim.mockResolvedValueOnce(input).mockResolvedValue(null); return input; }
function commercial(input:AutomationClaim,handoff=false) {
  const context=commerceStateSchema.parse({...commerceStateSchema.parse(input.conversation.context),stage:'payment',orderId,lastMessageId:input.message.waMessageId,lastReply:'Fallback',lastPayload:{kind:'text',text:'Fallback'}});
  mocks.commerce.mockResolvedValue({context,payload:{kind:'text',text:'Fallback'},process:'payment',orderId,handoff});
}
beforeEach(()=>{
  vi.resetAllMocks(); mocks.env.whatsappAccessToken='fixture'; mocks.env.whatsappPhoneNumberId='123';
  mocks.store.isCurrent.mockResolvedValue(true); mocks.store.checkpoint.mockResolvedValue(true); mocks.store.finish.mockResolvedValue(true);
  mocks.notice.mockResolvedValue('ignored'); mocks.bot.configuration.mockResolvedValue(defaultDefinition()); mocks.bot.handle.mockResolvedValue('ignored');
  mocks.commerce.mockResolvedValue(null); mocks.intent.mockResolvedValue(null); mocks.send.mockResolvedValue({sendStatus:'accepted'});
  mocks.candidate.mockResolvedValue(null); mocks.delivery.mockResolvedValue({processed:0,failed:0});
});
describe('inbox composition and safe receipt candidates',()=>{
  it('remains idle without channel credentials and handles known notice replies before the bot',async()=>{
    mocks.env.whatsappAccessToken=''; expect(await drainWhatsAppInbox('request')).toEqual({processed:0,failed:0});
    expect(mocks.store.claim).not.toHaveBeenCalled(); mocks.env.whatsappAccessToken='fixture'; queue(); mocks.notice.mockResolvedValue('handled');
    expect(await drainWhatsAppInbox('request')).toEqual({processed:1,failed:0}); expect(mocks.bot.configuration).not.toHaveBeenCalled();
  });
  it('checkpoints a candidate only inside a confirmed payment context and requires written confirmation',async()=>{
    const input=queue(claim({stage:'payment',orderId},'image')); commercial(input); mocks.candidate.mockResolvedValue('ABCD-123');
    expect(await drainWhatsAppInbox('request')).toEqual({processed:1,failed:0});
    expect(mocks.candidate).toHaveBeenCalledWith('123');
    expect(mocks.store.checkpoint).toHaveBeenCalledWith(input,expect.objectContaining({lastReply:expect.stringContaining('Escríbela como pago ABCD-123')}),'payment',orderId,3);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({payload:{kind:'text',text:expect.stringContaining('para confirmar la lectura')}}),expect.any(Object));
    expect(mocks.commerce).toHaveBeenCalledTimes(1);
  });
  it('never reruns vision on replay and leaves unreadable, oversized or unrelated images with fallback',async()=>{
    const contexts:Record<string,Json>[]=[{stage:'payment',orderId,lastMessageId:'wamid.fixture'},{}];
    for (const context of contexts) {
      const input=queue(claim(context,'image')); commercial(input); await drainWhatsAppInbox('request');
    }
    expect(mocks.candidate).not.toHaveBeenCalled();
    for (const candidate of [null,'A'.repeat(65)]) {
      const input=queue(claim({stage:'payment',orderId},'image')); commercial(input); mocks.candidate.mockResolvedValue(candidate);
      await drainWhatsAppInbox('request'); expect(mocks.send.mock.lastCall?.[0].payload.text).toBe('Fallback');
    }
  });
  it('pins the definition, uses intent as navigation and fences a checkpoint before any send',async()=>{
    const input=queue(); commercial(input,true); mocks.intent.mockResolvedValue({intent:'catalogue'});
    await drainWhatsAppInbox('request'); expect(mocks.commerce.mock.lastCall?.[4]).toBe('buy');
    expect(mocks.bot.configuration).toHaveBeenCalledWith(input.message,2);
    expect(mocks.store.finish).toHaveBeenCalledWith(input,expect.objectContaining({outcome:'handoff',flowVersion:3}));
    const stale=queue(); commercial(stale); mocks.store.checkpoint.mockResolvedValue(false); mocks.send.mockClear();
    expect(await drainWhatsAppInbox('request')).toEqual({processed:0,failed:0}); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('handles disabled definitions, failed notices, failed bot and pending delivery without losing durable work',async()=>{
    queue(); mocks.bot.configuration.mockResolvedValue(null); await drainWhatsAppInbox('request'); expect(mocks.bot.handle).not.toHaveBeenCalled();
    queue(); mocks.notice.mockResolvedValue('failed'); expect(await drainWhatsAppInbox('request')).toEqual({processed:0,failed:1});
    mocks.notice.mockResolvedValue('ignored'); mocks.bot.configuration.mockResolvedValue(defaultDefinition());
    queue(); mocks.bot.handle.mockResolvedValue('retry'); expect(await drainWhatsAppInbox('request')).toEqual({processed:0,failed:1});
    const pending=queue(); commercial(pending); mocks.send.mockResolvedValue({sendStatus:'pending'});
    await drainWhatsAppInbox('request'); expect(mocks.store.finish).toHaveBeenCalledWith(pending,{outcome:'review'});
    const failed=queue(); commercial(failed); mocks.send.mockResolvedValue({sendStatus:'failed'});
    await drainWhatsAppInbox('request'); expect(mocks.store.finish).toHaveBeenCalledWith(failed,{outcome:'retry'});
    mocks.delivery.mockRejectedValue(new Error('outage')); queue(); mocks.commerce.mockResolvedValue(null); mocks.bot.handle.mockResolvedValue('handoff');
    expect(await drainWhatsAppInbox('request')).toEqual({processed:1,failed:0}); expect(mocks.warn).toHaveBeenCalled();
    mocks.interest.mockRejectedValue(new Error('invitation outage')); queue();
    expect(await drainWhatsAppInbox('request')).toEqual({processed:1,failed:0});
  });
  it('rechecks the current fence immediately before the external API',async()=>{
    const input=queue(); commercial(input); mocks.send.mockImplementation(async(_message,deps)=>{await deps.send(input.message.fromWaId,{kind:'text',text:'safe'});return {sendStatus:'accepted'};});
    await drainWhatsAppInbox('request'); expect(mocks.cloud).toHaveBeenCalledTimes(1);
    expect(mocks.store.isCurrent).toHaveBeenCalledTimes(4);
    queue(); mocks.store.isCurrent.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
    expect(await drainWhatsAppInbox('request')).toEqual({processed:0,failed:0}); expect(mocks.cloud).toHaveBeenCalledTimes(1);
  });
});
