'use client';

import { env } from '@/config';
import { supabase } from '@/lib/supabase/client';

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function arrayBufferToBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function subscriptionUsesCurrentVapidKey(subscription: PushSubscription) {
  const key = subscription.options.applicationServerKey;
  if (!key) return false;
  return arrayBufferToBase64Url(key) === env.vapidPublicKey;
}

async function getAuthToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) {
    throw new Error('No hay una sesion activa para registrar notificaciones push.');
  }
  return data.session.access_token;
}

export type ExecutivePushTestResult = {
  ok: boolean;
  sent: number;
  disabled: number;
  failed: number;
  skipped?: string;
  pushDate?: string;
};

export async function triggerExecutivePushTest(): Promise<ExecutivePushTestResult> {
  const token = await getAuthToken();
  const response = await fetch('/api/push/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'No se pudo enviar la push de prueba.');
  }
  return body as ExecutivePushTestResult;
}

export async function registerPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Este navegador no soporta push web.');
  }
  if (!env.vapidPublicKey) {
    throw new Error('Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('El permiso de notificaciones no fue concedido.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !subscriptionUsesCurrentVapidKey(subscription)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(env.vapidPublicKey),
    });
  }

  const token = await getAuthToken();
  const json = subscription.toJSON();
  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'No se pudo registrar la suscripcion push.' }));
    throw new Error(typeof body.error === 'string' ? body.error : 'No se pudo registrar la suscripcion push.');
  }

  return subscription;
}

export async function unregisterPushSubscription() {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const token = await getAuthToken();
  const response = await fetch('/api/push/subscriptions', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'No se pudo desactivar la suscripcion push.' }));
    throw new Error(typeof body.error === 'string' ? body.error : 'No se pudo desactivar la suscripcion push.');
  }

  await subscription.unsubscribe();
}

export async function getPushSubscriptionStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      supported: false,
      subscribed: false,
      permission: 'unsupported' as const,
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    supported: true,
    subscribed: Boolean(subscription),
    permission: Notification.permission,
  };
}
