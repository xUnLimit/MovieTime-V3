import { createLogger } from '@/platform/observability/logger';
import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { sendPushNotification, shouldDisablePushSubscription, toPushDeliveryFailure } from '@/modules/push-delivery';

const log = createLogger('AdminNoticePush');
type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export async function notifyAdminsAboutNotices(
  body: string,
  client: ServiceClient = createServiceRoleClient(),
  send: typeof sendPushNotification = sendPushNotification,
): Promise<void> {
  const { data: admins, error: adminError } = await client.from('usuarios')
    .select('id').eq('role', 'admin').eq('active', true);
  if (adminError) throw new Error(`Admin lookup failed: ${adminError.code}`);
  const ids = (admins ?? []).map((admin) => admin.id);
  if (ids.length === 0) return;
  const { data, error } = await client.from('push_subscriptions')
    .select('id,endpoint,p256dh,auth').eq('enabled', true).in('user_id', ids);
  if (error) throw new Error(`Admin push lookup failed: ${error.code}`);
  for (const subscription of data ?? []) {
    try {
      await send(subscription, {
        kind: 'whatsapp_notice', title: 'Avisos de WhatsApp', body, destination: '/notificaciones',
      });
    } catch (sendError) {
      const failure = toPushDeliveryFailure(subscription, sendError);
      log.warn('Admin notice push failed', {
        endpointOrigin: failure.endpointOrigin, statusCode: failure.statusCode,
      });
      if (shouldDisablePushSubscription(failure.statusCode)) {
        const { error: disableError } = await client.from('push_subscriptions')
          .update({ enabled: false }).eq('id', subscription.id);
        if (disableError) log.warn('Failed to disable expired push subscription', { code: disableError.code });
      }
    }
  }
}
