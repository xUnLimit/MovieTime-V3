import { env } from '@/platform/config';
import { createLogger } from '@/platform/observability/logger';
import { handleNoticeReply } from '@/application/use-cases/notice-reply-use-case';
import { AutomationDeliveryUncertainError, AutomationLeaseLostError, processWhatsAppInbox } from '@/application/use-cases/whatsapp-inbox-use-case';
import { handleCommerceConversation } from '@/application/use-cases/commerce-conversation-use-case';
import { createCommerceConversationDeps } from '@/application/use-cases/commerce-conversation-runtime';
import { commerceCommand } from '@/application/use-cases/commerce-conversation-state';
import { commerceStateSchema } from '@/application/use-cases/commerce-conversation-state';
import { readReceiptCandidateUseCase } from '@/application/use-cases/receipt-candidate-use-case';
import { suggestAutomationIntent } from '@/application/use-cases/automation-intent-use-case';
import { botReplyKey } from '@/application/use-cases/bot-reply';
import { drainOrderDeliveries } from '@/application/use-cases/pedido-delivery-runtime';
import { drainInterestDeliveries } from '@/application/use-cases/interest-delivery-runtime';
import { createNoticeReplyStore } from '@/modules/messaging/notice-reply-store';
import { createNoticeStore } from '@/modules/messaging/notice-store';
import { createAutomationInboxStore } from '@/modules/whatsapp/automation-inbox-store';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { sendOutboundMessage, type NewOutboundMessage } from '@/modules/whatsapp/outbound-messages';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';
import { createBotRuntime } from './bot-runtime';

const logger = createLogger('WhatsAppInboxRuntime');

export async function drainWhatsAppInbox(requestId: string) {
  if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) return { processed: 0, failed: 0 };
  const config = { accessToken: env.whatsappAccessToken, phoneNumberId: env.whatsappPhoneNumberId };
  const store = createAutomationInboxStore();
  const outboundStore = createOutboundStore();
  const catalog = createTemplateCatalog();
  const bot = createBotRuntime(requestId);
  const result = await processWhatsAppInbox({ store, onFailure: (context) => logger.warn('Automation processing failed', { requestId, ...context }),
    async handle(claim, assertCurrent) {
      const send = async (outbound: NewOutboundMessage) => {
        await assertCurrent();
        const result = await sendOutboundMessage(outbound, { store: outboundStore, catalog,
          send: async (recipient, payload) => {
            // Recheck after DB/template reads; taking the chat invalidates the lease.
            await assertCurrent();
            return sendCloudApiMessage(config, recipient, payload);
          },
        });
        if (result.sendStatus === 'pending') throw new AutomationDeliveryUncertainError();
        if (result.sendStatus === 'failed') throw new Error('Automatic reply failed');
        return result;
      };
      const result = await handleNoticeReply(claim.message, {
        replies: createNoticeReplyStore(), notices: createNoticeStore(), send,
      });
      if (result === 'failed') throw new Error('Notice reply processing failed');
      if (result !== 'ignored') return { outcome: 'done' };
      const definition = await bot.configuration(claim.message, claim.conversation.flowVersion);
      if (!definition) return { outcome: 'done' };
      let command: string | null = null;
      if (claim.message.messageType === 'text' && !commerceCommand(claim.message, definition)) {
        const suggestion = await suggestAutomationIntent(claim.message.textBody ?? '', undefined, true);
        if (suggestion) command = { catalogue: 'buy', services: 'services', payment: 'status', handoff: 'help', clarify: '' }[suggestion.intent] || null;
      }
      await assertCurrent();
      const commerce = await handleCommerceConversation(claim.message, claim.conversation.context, createCommerceConversationDeps(), definition, command);
      if (commerce) {
        const prior = commerceStateSchema.safeParse(claim.conversation.context);
        if (claim.message.messageType==='image' && claim.message.mediaId && prior.success
          && prior.data.stage==='payment' && prior.data.orderId && prior.data.lastMessageId!==claim.message.waMessageId) {
          const candidate = await readReceiptCandidateUseCase(claim.message.mediaId);
          if (candidate && candidate.length<=64) {
            const text = `Leo la referencia ${candidate}. Escríbela como pago ${candidate} para confirmar la lectura. La referencia se verificará contra el ingreso recibido.`;
            commerce.payload = { kind:'text',text };
            const checkpoint = commerceStateSchema.parse(commerce.context);
            checkpoint.lastPayload = { kind:'text',text }; checkpoint.lastReply = text;
            commerce.context = checkpoint;
          }
        }
        if (!await store.checkpoint(claim, commerce.context, commerce.process, commerce.orderId, bot.version)) throw new AutomationLeaseLostError();
        await send({ idempotencyKey: botReplyKey(claim.message.waMessageId), toWaId: claim.message.fromWaId,
          payload: commerce.payload, sentBy: null });
        return { outcome: commerce.handoff ? 'handoff' : 'done', context: commerce.context,
          process: commerce.process, ...(commerce.orderId ? { orderId: commerce.orderId } : {}),
          ...(bot.version ? { flowVersion: bot.version } : {}) };
      }
      const botResult = await bot.handle(claim.message, send, claim.conversation.flowVersion);
      if (botResult === 'send_failed' || botResult === 'retry') throw new Error('Bot reply failed');
      return { outcome: botResult === 'handoff' ? 'handoff' : 'done', ...(bot.version ? { flowVersion: bot.version } : {}) };
    },
  });
  try { await drainOrderDeliveries(); }
  catch { logger.warn('Order access delivery remains pending', { requestId }); }
  try { await drainInterestDeliveries(); }
  catch { logger.warn('Availability invitations remain pending', { requestId }); }
  return result;
}
