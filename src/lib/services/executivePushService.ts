import { createPrivateKey, createECDH, sign as cryptoSign } from 'node:crypto';

import { env } from '@/config';
import { createServiceRoleClient } from '@/lib/server/supabase-server';
import type { ExecutivePushBlock, ExecutivePushSummaryBlock, ExecutivePushSummaryPayload, PushSubscriptionRecord } from '@/types';
import { buildExecutivePushSummaryPayload, getExecutivePushBlockMeta } from '@/lib/pwa/push-helpers';
import { getExecutivePushDueStatus } from '@/lib/pwa/push-schedule';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

function base64UrlEncode(value: Buffer | string) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function getVapidKeyPair() {
  const publicKey = env.vapidPublicKey;
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';

  if (!publicKey || !privateKey) {
    throw new Error('Missing VAPID keys. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
  }

  const privateBytes = base64UrlDecode(privateKey);
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(privateBytes);
  const publicBytes = ecdh.getPublicKey(undefined, 'uncompressed');
  const x = base64UrlEncode(publicBytes.subarray(1, 33));
  const y = base64UrlEncode(publicBytes.subarray(33));
  const d = base64UrlEncode(privateBytes);

  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d,
    },
    format: 'jwk',
  });

  return {
    publicKey,
    privateKey: key,
  };
}

function createVapidJwt(endpoint: string) {
  const { publicKey, privateKey } = getVapidKeyPair();
  const audience = new URL(endpoint).origin;
  const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
      sub: env.vapidSubject,
    })
  );
  const data = `${header}.${payload}`;
  const signature = cryptoSign('SHA256', Buffer.from(data), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return {
    token: `${data}.${base64UrlEncode(signature)}`,
    publicKey,
  };
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

async function sendSubscriptionPing(subscription: Pick<PushSubscriptionRecord, 'endpoint'>) {
  const { token, publicKey } = createVapidJwt(subscription.endpoint);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: '60',
      Urgency: 'normal',
      Authorization: `vapid t=${token}, k=${publicKey}`,
      'Content-Length': '0',
    },
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Push endpoint rejected request with status ${response.status}.`);
  }

  return response.status;
}

export async function sendExecutivePushDailySummary(): Promise<{
  sent: number;
  disabled: number;
  skipped?: string;
  pushDate?: string;
}> {
  const client = createServiceRoleClient();
  const settings = await getExecutivePushSettings(client);

  const dueStatus = getExecutivePushDueStatus(settings);
  if (!dueStatus.due) {
    return { sent: 0, disabled: 0, skipped: dueStatus.reason, pushDate: dueStatus.today };
  }

  const { data, error } = await client
    .from('push_subscriptions')
    .select('*')
    .eq('enabled', true);

  if (error) throw new Error(error.message);
  const subscriptions = (data ?? []) as unknown as PushSubscriptionRecord[];

  let sent = 0;
  let disabled = 0;

  for (const subscription of subscriptions) {
    try {
      const status = await sendSubscriptionPing(subscription);
      if (status === 404 || status === 410) {
        disabled += 1;
        await client.from('push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
      } else {
        sent += 1;
      }
    } catch (error) {
      console.error('Error sending executive push ping:', error);
    }
  }

  const { error: markSentError } = await client
    .from('config')
    .update({
      executive_push_last_sent_at: new Date().toISOString(),
      executive_push_last_sent_date: dueStatus.today,
    })
    .eq('id', 'global');
  if (markSentError) throw new Error(markSentError.message);

  return { sent, disabled, pushDate: dueStatus.today };
}
