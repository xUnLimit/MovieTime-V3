import { createECDH } from 'node:crypto';

import webPush from 'web-push';

import { env } from '@/platform/config';
import type { ExecutivePushSummaryPayload, PushSubscriptionRecord } from '@/types';

const PUSH_REQUEST_TIMEOUT_MS = 15_000;

export type PushDeliveryFailure = {
  endpointOrigin: string;
  statusCode?: number;
  body?: string;
  message: string;
};

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

export function shouldDisablePushSubscription(statusCode: number | undefined) {
  return statusCode === 403 || statusCode === 404 || statusCode === 410;
}

function getEndpointOrigin(endpoint: string) {
  try {
    return new URL(endpoint).origin;
  } catch (error) {
    void error;
    return 'unknown';
  }
}

export function toPushDeliveryFailure(
  subscription: Pick<PushSubscriptionRecord, 'endpoint'>,
  error: unknown,
): PushDeliveryFailure {
  return {
    endpointOrigin: getEndpointOrigin(subscription.endpoint),
    statusCode: isWebPushError(error) ? error.statusCode : undefined,
    body: isWebPushError(error) ? error.body : undefined,
    message: error instanceof Error ? error.message : 'Unknown push delivery error.',
  };
}

// Aviso push simple (titulo, cuerpo y destino) para eventos que no son el
// resumen ejecutivo, como un mensaje nuevo de WhatsApp.
export type PushNotificationPayload = {
  kind: 'whatsapp_message';
  title: string;
  body: string;
  destination: string;
};

export async function sendPushNotification(
  subscription: Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>,
  payload: PushNotificationPayload,
) {
  await deliverPush(subscription, payload);
}

export async function sendExecutivePushPing(
  subscription: Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>,
  payload: ExecutivePushSummaryPayload,
) {
  await deliverPush(subscription, payload);
}

async function deliverPush(
  subscription: Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>,
  payload: ExecutivePushSummaryPayload | PushNotificationPayload,
) {
  configureVapid();
  await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload),
    {
      TTL: 60,
      urgency: 'normal',
      timeout: PUSH_REQUEST_TIMEOUT_MS,
    },
  );
}
