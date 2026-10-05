import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { defaultDefinition } from '@/modules/bot-config';
import type { AutomationClaim } from '@/modules/whatsapp/automation-inbox-store';
import type { Json } from '@/platform/supabase/database.types';
import { commerceStateSchema } from '@/application/use-cases/commerce-conversation-state';

const mocks=vi.hoisted(()=>({ env:{whatsappAccessToken:'fixture',whatsappPhoneNumberId:'123'},
  store:{claim:vi.fn(),isCurrent:vi.fn(),checkpoint:vi.fn(),finish:vi.fn()},notice:vi.fn(),commerce:vi.fn(),
  send:vi.fn(),cloud:vi.fn(),delivery:vi.fn(),interest:vi.fn(),bot:{configuration:vi.fn(),definitionFor:vi.fn(),handle:vi.fn(),version:3},warn:vi.fn() }));
vi.mock('@/platform/config',()=>({env:mocks.env}));
vi.mock('@/platform/observability/logger',()=>({createLogger:()=>({warn:mocks.warn})}));
vi.mock('@/modules/whatsapp/automation-inbox-store',()=>({createAutomationInboxStore:()=>mocks.store}));
vi.mock('@/application/use-cases/notice-reply-use-case',()=>({handleNoticeReply:mocks.notice}));
vi.mock('@/application/use-cases/commerce-conversation-use-case',()=>({handleCommerceConversation:mocks.commerce}));
vi.mock('@/application/use-cases/commerce-conversation-runtime',()=>({createCommerceConversationDeps:()=>({})}));
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
  mocks.commerce.mockResolvedValue({context,payload:{kind:'text',text:'Fallback'},handBack:null,process:'payment',orderId,handoff});
}
beforeEach(()=>{
  vi.resetAllMocks(); mocks.env.whatsappAccessToken='fixture'; mocks.env.whatsappPhoneNumberId='123';
  mocks.store.isCurrent.mockResolvedValue(true); mocks.store.checkpoint.mockResolvedValue(true); mocks.store.finish.mockResolvedValue(true);
  mocks.notice.mockResolvedValue('ignored'); mocks.bot.configuration.mockResolvedValue(defaultDefinition()); mocks.bot.definitionFor.mockImplementation(async(_message,_pin,latest)=>latest); mocks.bot.handle.mockResolvedValue('ignored');
  mocks.commerce.mockResolvedValue(null); mocks.send.mockResolvedValue({sendStatus:'accepted'});
  mocks.delivery.mockResolvedValue({processed:0,failed:0});
});
describe('inbox composition',()=>{
  it('remains idle without channel credentials and handles known notice replies before the bot',async()=>{
    mocks.env.whatsappAccessToken=''; expect(await drainWhatsAppInbox('request')).toEqual({processed:0,failed:0});
    expect(mocks.store.claim).not.toHaveBeenCalled(); mocks.env.whatsappAccessToken='fixture'; queue(); mocks.notice.mockResolvedValue('handled');
    expect(await drainWhatsAppInbox('request')).toEqual({processed:1,failed:0}); expect(mocks.bot.configuration).not.toHaveBeenCalled();
  });
  it('sends unrecognised free text through the guided flow without any interpretation step',async()=>{
    const input=queue(); mocks.commerce.mockResolvedValue(null); mocks.bot.handle.mockResolvedValue('ignored');
    expect(await drainWhatsAppInbox('request')).toEqual({processed:1,failed:0});
    expect(mocks.commerce).toHaveBeenCalledWith(input.message,input.conversation.context,{},defaultDefinition(),undefined);
    expect(mocks.bot.handle).toHaveBeenCalledTimes(1); expect(mocks.store.checkpoint).not.toHaveBeenCalled();
  });
  it('hands the conversation order to the bot so node texts can show its data',async()=>{
    const input=claim(); input.conversation.orderId=orderId; queue(input);
    expect(await drainWhatsAppInbox('request')).toEqual({processed:1,failed:0});
    expect(mocks.bot.handle).toHaveBeenCalledWith(defaultDefinition(),input.message,expect.any(Function),orderId,undefined);
  });
  it('keeps payment images on the guided reply with no receipt reading',async()=>{
    const input=queue(claim({stage:'payment',orderId},'image')); commercial(input);
    await drainWhatsAppInbox('request'); expect(mocks.send.mock.lastCall?.[0].payload.text).toBe('Fallback');
  });
  it('pins the definition and fences a checkpoint before any send',async()=>{
    const input=queue(); commercial(input,true);
    await drainWhatsAppInbox('request');     expect(mocks.bot.configuration).toHaveBeenCalledWith(input.message); expect(mocks.bot.definitionFor).toHaveBeenCalledWith(input.message,2,defaultDefinition());
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
  it('hands the turn back to the journey in one reply after saving the purchase state, and answers with the pinned definition when it differs',async()=>{
    const input=queue(); const pinned={...defaultDefinition(),entryNodeId:'soporte'}; mocks.bot.definitionFor.mockResolvedValue(pinned);
    const handBack={text:'Listo, cancelé tu selección.',prefixed:true,block:null};
    const context=commerceStateSchema.parse({});
    mocks.commerce.mockResolvedValue({context,payload:null,handBack,process:'idle',orderId:null,handoff:false});
    mocks.bot.handle.mockResolvedValue('menu');
    expect(await drainWhatsAppInbox('request')).toEqual({processed:1,failed:0});
    expect(mocks.store.checkpoint).toHaveBeenCalledWith(input,context,'idle',null,3);
    expect(mocks.bot.handle).toHaveBeenCalledWith(pinned,input.message,expect.any(Function),null,{handBack});
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.store.finish).toHaveBeenCalledWith(input,expect.objectContaining({outcome:'done',context,process:'idle'}));
  });
  it('lets the purchase flow answer when the journey reaches a purchase node, with the notice in front',async()=>{
    queue(); mocks.commerce.mockResolvedValueOnce(null);
    const context=commerceStateSchema.parse({stage:'buy'});
    mocks.bot.handle.mockResolvedValue({delegate:'buy',prefix:'Aviso'});
    mocks.commerce.mockResolvedValueOnce({context,payload:{kind:'text',text:'Catálogo'},handBack:null,process:'buy',orderId:null,handoff:false});
    expect(await drainWhatsAppInbox('request')).toEqual({processed:1,failed:0});
    expect(mocks.commerce).toHaveBeenLastCalledWith(expect.anything(),expect.anything(),{},defaultDefinition(),{command:'buy',prefix:'Aviso'});
    expect(mocks.send.mock.lastCall?.[0].payload.text).toBe('Catálogo');
  });
});
