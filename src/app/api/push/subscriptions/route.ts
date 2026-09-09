import { pushEndpointSchema, pushSubscriptionSchema } from '@/modules/pwa/push-api-contracts';
import { apiErrorResponse, apiFailure, apiSuccess, createRequestId } from '@/platform/server/api-response';
import { parseJsonRequest } from '@/platform/server/json-request';
import { requireAuthenticatedAdmin } from '@/platform/server/request-auth';
import { createServiceRoleClient } from '@/platform/server/supabase-server';

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    const parsed = await parseJsonRequest(request, pushSubscriptionSchema, 8 * 1024);
    if (!parsed.success) {
      return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    }

    const client = createServiceRoleClient();
    const { endpoint, p256dh, auth, platform, userAgent } = parsed.data;
    const { error } = await client.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      platform,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
      enabled: true,
    }, { onConflict: 'endpoint' });
    if (error) throw error;

    return apiSuccess({ subscribed: true }, requestId);
  } catch (error) {
    return apiErrorResponse('PushSubscriptionsPostRoute', requestId, error);
  }
}

export async function DELETE(request: Request) {
  const requestId = createRequestId();
  try {
    const { user } = await requireAuthenticatedAdmin(request);
    const parsed = await parseJsonRequest(request, pushEndpointSchema, 4 * 1024);
    if (!parsed.success) {
      return apiFailure(parsed.status, parsed.code, parsed.message, requestId, parsed.fieldErrors);
    }

    const client = createServiceRoleClient();
    const { error } = await client
      .from('push_subscriptions')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('endpoint', parsed.data.endpoint);
    if (error) throw error;

    return apiSuccess({ subscribed: false }, requestId);
  } catch (error) {
    return apiErrorResponse('PushSubscriptionsDeleteRoute', requestId, error);
  }
}
