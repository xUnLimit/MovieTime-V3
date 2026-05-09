import { createECDH } from 'node:crypto';

import webPush from 'web-push';

import { env } from '@/config';
import { createServiceRoleClient } from '@/lib/server/supabase-server';
import type { ExecutivePushBlock, ExecutivePushSummaryBlock, ExecutivePushSummaryPayload, PushSubscriptionRecord } from '@/types';
import { buildExecutivePushSummaryPayload, getExecutivePushBlockMeta } from '@/lib/pwa/push-helpers';
import { getExecutivePushDeliverySkipReason, getExecutivePushDueStatus } from '@/lib/pwa/push-schedule';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
type PushFailure = {
  endpointOrigin: string;
  statusCode?: number;
  body?: string;
  message: string;
};

const PUSH_PAYLOAD = JSON.stringify({ kind: 'executive_daily_summary' });
const PUSH_REQUEST_TIMEOUT_MS = 15_000;
const PUSH_DELIVERY_CONCURRENCY = 5;

function base64UrlEncode(value: Buffer) {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function assertValidVapidConfig(publicKey: string, privateKey: string) {
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(base64UrlDecode(privateKey));
  const derivedPublicKey = base64UrlEncode(ecdh.getPublicKey(undefined, 'uncompressed'));
  if (derivedPublicKey !== publicKey) {
    throw new Error('Invalid VAPID configuration: NEXT_PUBLIC_VAPID_PUBLIC_KEY does not match VAPID_PRIVATE_KEY.');
  }

  const validSubject = env.vapidSubject.startsWith('mailto:') || env.vapidSubject.startsWith('https://');
  if (!validSubject) {
    throw new Error('Invalid VAPID configuration: VAPID_SUBJECT must start with mailto: or https://.');
  }
}

function configureVapid() {
  const publicKey = env.vapidPublicKey;
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';

  if (!publicKey || !privateKey) {
    throw new Error('Missing VAPID keys. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
  }

  assertValidVapidConfig(publicKey, privateKey);
  webPush.setVapidDetails(env.vapidSubject, publicKey, privateKey);
}

function isWebPushError(error: unknown): error is Error & { statusCode?: number; body?: string } {
  return error instanceof Error;
}

function shouldDisableSubscription(statusCode: number | undefined) {
  return statusCode === 403 || statusCode === 404 || statusCode === 410;
}

function getEndpointOrigin(endpoint: string) {
  try {
    return new URL(endpoint).origin;
  } catch {
    return 'unknown';
  }
}

function buildDestinationWithQuery(payload: ExecutivePushSummaryPayload) {
  const url = new URL(payload.destination, env.appUrl);
  if (payload.tab) {
    url.searchParams.set('tab', payload.tab);
  }
  return `${url.pathname}${url.search}`;
}

function getDatePartsInTimezone(timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return {
    today: `${year}-${month}-${day}`,
  };
}

async function getExecutivePushSettings(client: ServiceClient) {
  const { data, error } = await client.from('config').select('*').eq('id', 'global').single();
  if (error) throw new Error(error.message);
  return {
    enabled: Boolean(data.executive_push_enabled),
    sendTime: data.executive_push_send_time ?? '08:00',
    timezone: data.executive_push_timezone ?? 'America/Bogota',
    lastSentDate: data.executive_push_last_sent_date ?? null,
    selectedBlocks: Array.isArray(data.executive_push_selected_blocks)
      ? data.executive_push_selected_blocks as ExecutivePushBlock[]
      : [],
    blockOrder: Array.isArray(data.executive_push_block_order)
      ? data.executive_push_block_order as ExecutivePushBlock[]
      : [],
  };
}

async function buildSummaryBlocks(client: ServiceClient): Promise<ExecutivePushSummaryBlock[]> {
  const settings = await getExecutivePushSettings(client);
  const { today } = getDatePartsInTimezone(settings.timezone);
  const orderedBlocks = settings.blockOrder.length > 0 ? settings.blockOrder : settings.selectedBlocks;
  const selectedSet = new Set(settings.selectedBlocks);

  const [ventaNotificationsResult, servicioNotificationsResult] = await Promise.all([
    client
      .from('v_notificaciones_venta')
      .select('cliente_id,venta_id,dias_restantes')
      .lte('dias_restantes', 7),
    client
      .from('v_notificaciones_servicio')
      .select('servicio_id,costo_servicio_snapshot,moneda_snapshot,fecha_vencimiento_snapshot,renovacion_automatica_snapshot')
      .eq('fecha_vencimiento_snapshot', today),
  ]);

  if (ventaNotificationsResult.error) throw new Error(ventaNotificationsResult.error.message);
  if (servicioNotificationsResult.error) throw new Error(servicioNotificationsResult.error.message);

  const ventaNotifications = ventaNotificationsResult.data ?? [];
  const servicioNotifications = (servicioNotificationsResult.data ?? []).filter(
    (item) => item.renovacion_automatica_snapshot === true
  );

  const distinctClientes = new Set(
    ventaNotifications
      .map((item) => item.cliente_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  );

  const montoPagarHoy = servicioNotifications.reduce((total, item) => {
    const costo = Number(item.costo_servicio_snapshot ?? 0);
    return total + costo;
  }, 0);

  const builders: Record<ExecutivePushBlock, () => ExecutivePushSummaryBlock> = {
    clientes_por_notificar: () => ({
      key: 'clientes_por_notificar',
      label: getExecutivePushBlockMeta('clientes_por_notificar')?.label ?? 'Clientes a notificar',
      count: distinctClientes.size,
      destination: '/notificaciones',
      tab: 'ventas',
    }),
    ventas_por_vencer: () => ({
      key: 'ventas_por_vencer',
      label: getExecutivePushBlockMeta('ventas_por_vencer')?.label ?? 'Ventas por vencer',
      count: ventaNotifications.length,
      destination: '/notificaciones',
      tab: 'ventas',
    }),
    servicios_por_pagar_hoy: () => ({
      key: 'servicios_por_pagar_hoy',
      label: getExecutivePushBlockMeta('servicios_por_pagar_hoy')?.label ?? 'Servicios por pagar hoy',
      count: servicioNotifications.length,
      destination: '/notificaciones',
      tab: 'servicios',
    }),
    monto_a_pagar_hoy: () => ({
      key: 'monto_a_pagar_hoy',
      label: getExecutivePushBlockMeta('monto_a_pagar_hoy')?.label ?? 'Monto a pagar hoy',
      amount: montoPagarHoy,
      currency: 'USD',
      destination: '/notificaciones',
      tab: 'servicios',
    }),
    monto_a_fondear: () => ({
      key: 'monto_a_fondear',
      label: getExecutivePushBlockMeta('monto_a_fondear')?.label ?? 'Monto a fondear',
      amount: montoPagarHoy,
      currency: 'USD',
      destination: '/dashboard',
    }),
  };

  return orderedBlocks
    .filter((block) => selectedSet.has(block))
    .map((block) => builders[block]());
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

async function sendSubscriptionPing(subscription: Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>) {
  configureVapid();
  await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    PUSH_PAYLOAD,
    {
      TTL: 60,
      urgency: 'normal',
      timeout: PUSH_REQUEST_TIMEOUT_MS,
    }
  );
}

export async function sendExecutivePushDailySummary(): Promise<{
  sent: number;
  disabled: number;
  failed: number;
  failures?: PushFailure[];
  skipped?: string;
  pushDate?: string;
}> {
  const client = createServiceRoleClient();
  const settings = await getExecutivePushSettings(client);

  const dueStatus = getExecutivePushDueStatus(settings);
  if (!dueStatus.due) {
    return { sent: 0, disabled: 0, failed: 0, skipped: dueStatus.reason, pushDate: dueStatus.today };
  }

  const { data, error } = await client
    .from('push_subscriptions')
    .select('*')
    .eq('enabled', true);

  if (error) throw new Error(error.message);
  const subscriptions = (data ?? []) as unknown as PushSubscriptionRecord[];

  let sent = 0;
  let disabled = 0;
  const failures: PushFailure[] = [];

  for (let index = 0; index < subscriptions.length; index += PUSH_DELIVERY_CONCURRENCY) {
    const batch = subscriptions.slice(index, index + PUSH_DELIVERY_CONCURRENCY);
    await Promise.all(
      batch.map(async (subscription) => {
        try {
          await sendSubscriptionPing(subscription);
          sent += 1;
        } catch (error) {
          const statusCode = isWebPushError(error) ? error.statusCode : undefined;
          const body = isWebPushError(error) ? error.body : undefined;
          const message = error instanceof Error ? error.message : 'Unknown push delivery error.';
          const endpointOrigin = getEndpointOrigin(subscription.endpoint);
          failures.push({
            endpointOrigin,
            statusCode,
            body,
            message,
          });

          console.error('Error sending executive push ping:', {
            endpointOrigin,
            statusCode,
            body,
            message,
          });

          if (shouldDisableSubscription(statusCode)) {
            disabled += 1;
            await client.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
          }
        }
      }
    ));
  }

  const deliverySkipReason = getExecutivePushDeliverySkipReason(subscriptions.length, sent);
  if (deliverySkipReason) {
    return {
      sent,
      disabled,
      failed: failures.length,
      failures,
      skipped: deliverySkipReason,
      pushDate: dueStatus.today,
    };
  }

  const { error: markSentError } = await client
    .from('config')
    .update({
      executive_push_last_sent_at: new Date().toISOString(),
      executive_push_last_sent_date: dueStatus.today,
    })
    .eq('id', 'global');
  if (markSentError) throw new Error(markSentError.message);

  return {
    sent,
    disabled,
    failed: failures.length,
    failures: failures.length > 0 ? failures : undefined,
    pushDate: dueStatus.today,
  };
}
