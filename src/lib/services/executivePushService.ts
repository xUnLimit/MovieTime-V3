import { env } from '@/config';
import { createServiceRoleClient } from '@/lib/server/supabase-server';
import type { ExecutivePushBlock, ExecutivePushSummaryBlock, ExecutivePushSummaryPayload, PushSubscriptionRecord } from '@/types';
import {
  sendExecutivePushPing,
  shouldDisablePushSubscription,
  toPushDeliveryFailure,
  type PushDeliveryFailure,
} from '@/lib/notifications/push-delivery';
import {
  buildExecutivePushSummaryPayload,
  filterExecutivePushActiveBlocks,
} from '@/lib/pwa/push-helpers';
import { getExecutivePushDeliverySkipReason, getExecutivePushDueStatus } from '@/lib/pwa/push-schedule';
import { buildExecutivePushSummaryBlocks } from './executive-push-summary-blocks';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
type ExecutivePushResult = {
  sent: number;
  disabled: number;
  failed: number;
  failures?: PushDeliveryFailure[];
  skipped?: string;
  pushDate?: string;
};

const PUSH_DELIVERY_CONCURRENCY = 5;

function buildDestinationWithQuery(payload: ExecutivePushSummaryPayload) {
  const url = new URL(payload.destination, env.appUrl);
  if (payload.tab) {
    url.searchParams.set('tab', payload.tab);
  }
  return `${url.pathname}${url.search}`;
}

async function getExecutivePushSettings(client: ServiceClient) {
  const { data, error } = await client.from('config').select('*').eq('id', 'global').single();
  if (error) throw new Error(error.message);
  return {
    enabled: Boolean(data.executive_push_enabled),
    sendTime: data.executive_push_send_time ?? '08:00',
    windowStart: data.executive_push_window_start ?? data.executive_push_send_time ?? '08:00',
    windowEnd: data.executive_push_window_end ?? '22:00',
    intervalHours: Number(data.executive_push_interval_hours ?? 24),
    timezone: data.executive_push_timezone ?? 'America/Bogota',
    lastSentAt: data.executive_push_last_sent_at ?? null,
    lastSentDate: data.executive_push_last_sent_date ?? null,
    selectedBlocks: Array.isArray(data.executive_push_selected_blocks)
      ? data.executive_push_selected_blocks as ExecutivePushBlock[]
      : [],
    blockOrder: Array.isArray(data.executive_push_block_order)
      ? data.executive_push_block_order as ExecutivePushBlock[]
      : [],
  };
}

async function updateExecutivePushRun(
  client: ServiceClient,
  runId: string | undefined,
  values: {
    status: 'running' | 'sent' | 'skipped' | 'failed';
    reason?: string | null;
    sent?: number;
    failed?: number;
    disabled?: number;
    error?: string | null;
    finished_at?: string | null;
  }
) {
  if (!runId) return;

  const { error } = await client
    .from('executive_push_runs')
    .update({
      ...values,
      started_at: values.status === 'running' ? new Date().toISOString() : undefined,
      finished_at: values.finished_at ?? (values.status === 'running' ? undefined : new Date().toISOString()),
    })
    .eq('id', runId);

  if (error) {
    console.error('Error updating executive push run:', {
      runId,
      status: values.status,
      message: error.message,
    });
  }
}

async function finishExecutivePushRun(client: ServiceClient, runId: string | undefined, result: ExecutivePushResult) {
  if (!runId) return;

  await updateExecutivePushRun(client, runId, {
    status: result.skipped ? 'skipped' : 'sent',
    reason: result.skipped ?? null,
    sent: result.sent,
    failed: result.failed,
    disabled: result.disabled,
  });
}

async function buildSummaryBlocks(client: ServiceClient): Promise<ExecutivePushSummaryBlock[]> {
  const settings = await getExecutivePushSettings(client);

  // Count notifications the user hasn't dismissed (leida=false — the "active
  // bell" icon in the table) AND that are due today or already overdue
  // (dias_restantes <= 0). Marking a row as read in the table removes it from
  // the push count.
  const [ventaNotificationsResult, servicioNotificationsResult, reposoNotificationsResult] = await Promise.all([
    client
      .from('v_notificaciones_venta')
      .select('cliente_id,dias_restantes,leida')
      .eq('leida', false)
      .lte('dias_restantes', 0),
    client
      .from('v_notificaciones_servicio')
      .select('servicio_id,costo_servicio_snapshot,moneda_snapshot,dias_restantes,leida')
      .eq('leida', false)
      .lte('dias_restantes', 0),
    client
      .from('v_notificaciones_reposo')
      .select('servicio_id,dias_restantes,leida')
      .eq('leida', false)
      .lte('dias_restantes', 0),
  ]);

  if (ventaNotificationsResult.error) throw new Error(ventaNotificationsResult.error.message);
  if (servicioNotificationsResult.error) throw new Error(servicioNotificationsResult.error.message);
  if (reposoNotificationsResult.error) throw new Error(reposoNotificationsResult.error.message);

  const ventaNotifications = ventaNotificationsResult.data ?? [];
  const servicioNotifications = servicioNotificationsResult.data ?? [];
  const reposoNotifications = reposoNotificationsResult.data ?? [];

  return buildExecutivePushSummaryBlocks({
    reposoCount: reposoNotifications.length,
    servicioNotifications,
    settings,
    ventaNotifications,
  });
}

export async function getExecutivePushSummaryForEndpoint(endpoint: string): Promise<ExecutivePushSummaryPayload & { destinationWithQuery: string }> {
  const client = createServiceRoleClient();
  const { data: subscription, error: subscriptionError } = await client
    .from('push_subscriptions')
    .select('*')
    .eq('endpoint', endpoint)
    .eq('enabled', true)
    .maybeSingle();

  if (subscriptionError) throw new Error(subscriptionError.message);
  if (!subscription) throw new Error('Push subscription not found.');

  const blocks = await buildSummaryBlocks(client);
  const payload = buildExecutivePushSummaryPayload(blocks);

  await client
    .from('push_subscriptions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', subscription.id);

  return {
    ...payload,
    destinationWithQuery: buildDestinationWithQuery(payload),
  };
}

export async function sendExecutivePushDailySummary(options?: { force?: boolean; runId?: string }): Promise<ExecutivePushResult> {
  const force = options?.force === true;
  const runId = options?.runId;
  const client = createServiceRoleClient();
  await updateExecutivePushRun(client, runId, { status: 'running' });

  try {
    const settings = await getExecutivePushSettings(client);

    const dueStatus = getExecutivePushDueStatus(settings);
    // Forced sends bypass the window/interval guards but still require enabled=true
    // to avoid "test" buttons firing notifications when the feature is off.
    if (!dueStatus.due && !(force && settings.enabled)) {
      const result = { sent: 0, disabled: 0, failed: 0, skipped: dueStatus.reason, pushDate: dueStatus.today };
      await finishExecutivePushRun(client, runId, result);
      return result;
    }

    const blocks = filterExecutivePushActiveBlocks(await buildSummaryBlocks(client));
    if (blocks.length === 0) {
      const result = { sent: 0, disabled: 0, failed: 0, skipped: 'no_active_items', pushDate: dueStatus.today };
      await finishExecutivePushRun(client, runId, result);
      return result;
    }

    const { data, error } = await client
      .from('push_subscriptions')
      .select('*')
      .eq('enabled', true);

    if (error) throw new Error(error.message);
    const subscriptions = (data ?? []) as unknown as PushSubscriptionRecord[];

    let sent = 0;
    let disabled = 0;
    const failures: PushDeliveryFailure[] = [];

    for (let index = 0; index < subscriptions.length; index += PUSH_DELIVERY_CONCURRENCY) {
      const batch = subscriptions.slice(index, index + PUSH_DELIVERY_CONCURRENCY);
      await Promise.all(
        batch.map(async (subscription) => {
          try {
            await sendExecutivePushPing(subscription);
            sent += 1;
          } catch (error) {
            const failure = toPushDeliveryFailure(subscription, error);
            failures.push(failure);

            console.error('Error sending executive push ping:', {
              endpointOrigin: failure.endpointOrigin,
              statusCode: failure.statusCode,
              body: failure.body,
              message: failure.message,
            });

            if (shouldDisablePushSubscription(failure.statusCode)) {
              disabled += 1;
              await client.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
            }
          }
        })
      );
    }

    const deliverySkipReason = getExecutivePushDeliverySkipReason(subscriptions.length, sent);
    if (deliverySkipReason) {
      const result = {
        sent,
        disabled,
        failed: failures.length,
        failures,
        skipped: deliverySkipReason,
        pushDate: dueStatus.today,
      };
      await finishExecutivePushRun(client, runId, result);
      return result;
    }

    const { error: markSentError } = await client
      .from('config')
      .update({
        executive_push_last_sent_at: new Date().toISOString(),
        executive_push_last_sent_date: dueStatus.today,
      })
      .eq('id', 'global');
    if (markSentError) throw new Error(markSentError.message);

    const result = {
      sent,
      disabled,
      failed: failures.length,
      failures: failures.length > 0 ? failures : undefined,
      pushDate: dueStatus.today,
    };
    await finishExecutivePushRun(client, runId, result);
    return result;
  } catch (error) {
    await updateExecutivePushRun(client, runId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown executive push error.',
    });
    throw error;
  }
}
