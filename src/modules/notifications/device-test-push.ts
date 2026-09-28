import { createLogger } from '@/platform/observability/logger';
import { createServiceRoleClient } from '@/platform/server/supabase-server';
import {
  sendPushNotification,
  shouldDisablePushSubscription,
  toPushDeliveryFailure,
} from './push-delivery';

const log = createLogger('DeviceTestPush');

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type DeviceTestPushResult = {
  sent: number;
  failed: number;
  disabled: number;
  skipped?: 'not_subscribed';
};

export async function sendDeviceTestPush(
  userId: string,
  endpoint?: string,
  client: ServiceClient = createServiceRoleClient(),
  send: typeof sendPushNotification = sendPushNotification,
): Promise<DeviceTestPushResult> {
  const query = client
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('user_id', userId)
    .eq('enabled', true);
  const { data, error } = await (endpoint ? query.eq('endpoint', endpoint) : query);
  if (error) throw new Error(`No se pudieron consultar las suscripciones push: ${error.code}`);
  if (!data?.length) return { sent: 0, failed: 0, disabled: 0, skipped: 'not_subscribed' };

  let sent = 0;
  let failed = 0;
  let disabled = 0;
  for (const subscription of data) {
    try {
      await send(subscription, {
        kind: 'push_test',
        title: 'Prueba de notificaciones',
        body: 'MovieTime puede enviarte avisos en este dispositivo.',
        destination: '/dashboard',
      });
      sent += 1;
    } catch (sendError) {
      failed += 1;
      const failure = toPushDeliveryFailure(subscription, sendError);
      log.warn('Device test push failed', {
        endpointOrigin: failure.endpointOrigin,
        statusCode: failure.statusCode,
        message: failure.message,
      });
      if (shouldDisablePushSubscription(failure.statusCode)) {
        const { error: updateError } = await client
          .from('push_subscriptions')
          .update({ enabled: false })
          .eq('id', subscription.id);
        if (updateError) throw new Error(`No se pudo desactivar la suscripción push: ${updateError.code}`);
        disabled += 1;
      }
    }
  }

  return { sent, failed, disabled };
}
