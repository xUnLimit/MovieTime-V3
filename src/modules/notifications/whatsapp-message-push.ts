import { createLogger } from '@/platform/observability/logger';
import { createServiceRoleClient } from '@/platform/server/supabase-server';
import {
  sendPushNotification,
  shouldDisablePushSubscription,
  toPushDeliveryFailure,
  type PushNotificationPayload,
} from '@/modules/push-delivery';

const log = createLogger('WhatsAppMessagePush');
const PREVIEW_LENGTH = 100;

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type InboundMessageSummary = {
  fromWaId: string;
  contactName: string | null;
  textBody: string | null;
};

export function buildWhatsAppMessagePush(messages: readonly InboundMessageSummary[]): PushNotificationPayload {
  const latest = messages[messages.length - 1];
  const senders = new Set(messages.map((message) => message.fromWaId));
  const sender = latest.contactName?.trim() || `+${latest.fromWaId}`;
  const preview = latest.textBody?.trim() || 'Nuevo mensaje';

  return {
    kind: 'whatsapp_message',
    title: senders.size > 1 ? `${messages.length} mensajes nuevos de WhatsApp` : `WhatsApp: ${sender}`,
    body: preview.length > PREVIEW_LENGTH ? `${preview.slice(0, PREVIEW_LENGTH - 1)}…` : preview,
    destination: senders.size > 1 ? '/chats' : `/chats?wa=${latest.fromWaId}`,
  };
}

// Avisa a los dispositivos suscritos. Las suscripciones vencidas (404/410) se
// desactivan igual que en el resumen ejecutivo; un fallo no interrumpe al resto.
export async function notifyWhatsAppMessages(
  messages: readonly InboundMessageSummary[],
  client: ServiceClient = createServiceRoleClient(),
  send: typeof sendPushNotification = sendPushNotification
): Promise<{ sent: number; failed: number }> {
  if (messages.length === 0) return { sent: 0, failed: 0 };

  const { data, error } = await client
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('enabled', true);
  if (error) throw new Error(`No se pudieron leer las suscripciones push: ${error.code}`);

  const payload = buildWhatsAppMessagePush(messages);
  let sent = 0;
  let failed = 0;

  await Promise.all((data ?? []).map(async (subscription) => {
    try {
      await send(subscription, payload);
      sent += 1;
    } catch (sendError) {
      failed += 1;
      const failure = toPushDeliveryFailure(subscription, sendError);
      log.warn('WhatsApp message push failed', {
        endpointOrigin: failure.endpointOrigin,
        statusCode: failure.statusCode,
      });
      if (shouldDisablePushSubscription(failure.statusCode)) {
        await client.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
      }
    }
  }));

  return { sent, failed };
}
