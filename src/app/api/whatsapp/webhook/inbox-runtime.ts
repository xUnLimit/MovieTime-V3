import { env } from '@/platform/config';
import { createLogger } from '@/platform/observability/logger';
import { handleNoticeReply } from '@/application/use-cases/notice-reply-use-case';
import { AutomationDeliveryUncertainError, AutomationLeaseLostError, processWhatsAppInbox } from '@/application/use-cases/whatsapp-inbox-use-case';
import { handleCommerceConversation } from '@/application/use-cases/commerce-conversation-use-case';
import { runConversationTurn } from '@/application/use-cases/whatsapp-conversation-use-case';
import { createCommerceConversationDeps } from '@/application/use-cases/commerce-conversation-runtime';
import { botReplyKey } from '@/application/use-cases/bot-reply';
import { drainOrderDeliveries } from '@/application/use-cases/pedido-delivery-runtime';
import { drainInterestDeliveries } from '@/application/use-cases/interest-delivery-runtime';
import { createNoticeReplyStore } from '@/modules/messaging/notice-reply-store';
import { createNoticeStore } from '@/modules/messaging/notice-store';
import { createBotWaitStore } from '@/modules/messaging/bot-wait-store';
import { createAutomationInboxStore } from '@/modules/whatsapp/automation-inbox-store';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { sendOutboundMessage, type NewOutboundMessage } from '@/modules/whatsapp/outbound-messages';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';
import { createBotRuntime } from './bot-runtime';
import { createCustomerReportUseCase } from '@/application/use-cases/customer-report-use-case';

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
      const latest = await bot.configuration(claim.message);
      if (!latest) return { outcome: 'done' };
      await assertCurrent();
      const definition = await bot.definitionFor(claim.message, claim.conversation.flowVersion, latest);
      const commerceDeps = createCommerceConversationDeps();
      const createReport = async () => {
        await assertCurrent();
        await createCustomerReportUseCase({ waId: claim.message.fromWaId, messageId: claim.message.waMessageId,
          description: claim.message.messageType === 'text' ? claim.message.textBody?.trim() || 'Problema reportado por el cliente.' : 'Problema reportado por el cliente. Consulta la conversación para ver los detalles.',
          token: claim.token, fence: claim.fence });
      };
      const turn = await runConversationTurn({
        waiting: () => bot.waiting(definition, claim.message, send, claim.conversation.orderId, createReport),
        pauseCommerce: () => handleCommerceConversation(claim.message, claim.conversation.context, commerceDeps, definition, { pause: true }),
        clearWaiting: () => createBotWaitStore().clear(claim.message.fromWaId),
        commerce: (options) => handleCommerceConversation(claim.message, claim.conversation.context, commerceDeps, definition, options),
        bot: (input) => bot.handle(definition, claim.message, send, claim.conversation.orderId, { ...input, createReport }),
        async checkpoint(commerce) {
          if (!await store.checkpoint(claim, commerce.context, commerce.process, commerce.orderId, bot.version)) throw new AutomationLeaseLostError();
        },
        async send(payload) {
          await send({ idempotencyKey: botReplyKey(claim.message.waMessageId), toWaId: claim.message.fromWaId, payload, sentBy: null });
        },
      });
      if (turn.result === 'send_failed' || turn.result === 'retry') throw new Error('Bot reply failed');
      const { commerce } = turn;
      return { outcome: commerce?.handoff || turn.result === 'handoff' ? 'handoff' : 'done',
        ...(commerce ? { context: commerce.context, process: commerce.process, ...(commerce.orderId ? { orderId: commerce.orderId } : {}) } : {}),
        ...(bot.version ? { flowVersion: bot.version } : {}) };
    },
  });
  try { await drainOrderDeliveries(); }
  catch { logger.warn('Order access delivery remains pending', { requestId }); }
  try { await drainInterestDeliveries(); }
  catch { logger.warn('Availability invitations remain pending', { requestId }); }
  return result;
}
