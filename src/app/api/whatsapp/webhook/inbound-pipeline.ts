import { createNoticeReplyStore } from '@/modules/messaging/notice-reply-store';
import { createNoticeStore } from '@/modules/messaging/notice-store';
import { sendCloudApiMessage } from '@/modules/whatsapp/cloud-api-client';
import { sendOutboundMessage } from '@/modules/whatsapp/outbound-messages';
import { createOutboundStore } from '@/modules/whatsapp/outbound-store';
import { createTemplateCatalog } from '@/modules/whatsapp/template-catalog';
import type { InboundPipelineDeps } from '@/application/use-cases/process-inbound-message';
import { createBotRuntime } from './bot-runtime';

// Composition root of the inbound pipeline, shared by the webhook (after()) and the retry endpoint.
export function createInboundPipelineDeps(
  config: { accessToken: string; phoneNumberId: string }, requestId: string,
): InboundPipelineDeps {
  const catalog = createTemplateCatalog();
  const outboundStore = createOutboundStore();
  const send: InboundPipelineDeps['send'] = (outbound) => sendOutboundMessage(outbound, {
    store: outboundStore, catalog,
    send: (recipient, payload) => sendCloudApiMessage(config, recipient, payload),
  });
  return {
    notice: { replies: createNoticeReplyStore(), notices: createNoticeStore(), send },
    bot: createBotRuntime(requestId),
    send,
  };
}
