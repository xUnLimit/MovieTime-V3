import { createHmac, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeWebhookBatch = vi.hoisted(() => vi.fn());
const notifyWhatsAppMessages = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void>>);
const env = vi.hoisted(() => ({
  whatsappVerifyToken: 'verify-token-123456',
  whatsappAppSecret: '',
}));

vi.mock('@/platform/config', () => ({ env }));
vi.mock('@/modules/whatsapp/webhook-inbox', () => ({ storeWebhookBatch }));
vi.mock('@/modules/notifications/whatsapp-message-push', () => ({ notifyWhatsAppMessages }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => Promise<void>) => afterCallbacks.push(callback),
}));

import { GET, POST } from './route';

// Clave generada por ejecucion: no hay credenciales fijas en el repositorio.
const APP_SIGNING_FIXTURE = randomBytes(32).toString('hex');
const URL_BASE = 'https://example.com/api/whatsapp/webhook';

function verifyUrl(params: Record<string, string>) {
  return `${URL_BASE}?${new URLSearchParams(params).toString()}`;
}

function signedPost(payload: unknown, secret = env.whatsappAppSecret, extraHeaders: Record<string, string> = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return new Request(URL_BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${signature}`, ...extraHeaders },
    body,
  });
}

const textMessageEvent = {
  object: 'whatsapp_business_account',
  entry: [{
    id: '1592940775059519',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '50765331751', phone_number_id: '1324513647414207' },
        contacts: [{ wa_id: '50760000000', profile: { name: 'Cliente' } }],
        messages: [{ id: 'wamid.IN', from: '50760000000', timestamp: '1790000000', type: 'text', text: { body: 'Hola' } }],
      },
    }],
  }],
};

beforeEach(() => {
  storeWebhookBatch.mockReset();
  notifyWhatsAppMessages.mockReset();
  afterCallbacks.length = 0;
  env.whatsappVerifyToken = 'verify-token-123456';
  env.whatsappAppSecret = APP_SIGNING_FIXTURE;
});

describe('GET /api/whatsapp/webhook', () => {
  it('echoes the challenge when Meta sends the configured verify token', async () => {
    const response = await GET(new Request(verifyUrl({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token-123456',
      'hub.challenge': '1158201444',
    })));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('1158201444');
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    ['a wrong token', { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong-token-1234567', 'hub.challenge': '1' }],
    ['a wrong mode', { 'hub.mode': 'unsubscribe', 'hub.verify_token': 'verify-token-123456', 'hub.challenge': '1' }],
    ['an unsafe challenge', { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-token-123456', 'hub.challenge': '<script>' }],
    ['a non numeric challenge', { 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-token-123456', 'hub.challenge': 'abc123' }],
  ])('rejects %s', async (_label, params) => {
    const response = await GET(new Request(verifyUrl(params)));

    expect(response.status).toBe(403);
  });

  it('refuses verification while the integration is not configured', async () => {
    env.whatsappVerifyToken = '';

    const response = await GET(new Request(verifyUrl({
      'hub.mode': 'subscribe',
      'hub.verify_token': '',
      'hub.challenge': '1',
    })));

    expect(response.status).toBe(503);
  });
});

describe('POST /api/whatsapp/webhook', () => {
  it('stores a signed inbound message and acknowledges it', async () => {
    storeWebhookBatch.mockResolvedValueOnce({ messages: 1, statuses: 0 });

    const response = await POST(signedPost(textMessageEvent));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, data: { messages: 1, statuses: 0 } });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(storeWebhookBatch).toHaveBeenCalledWith(expect.objectContaining({
      messages: [expect.objectContaining({ waMessageId: 'wamid.IN', textBody: 'Hola' })],
    }));
  });

  it('schedules a push alert after responding when customers write', async () => {
    storeWebhookBatch.mockResolvedValueOnce({ messages: 1, statuses: 0 });
    notifyWhatsAppMessages.mockResolvedValueOnce({ sent: 1, failed: 0 });

    await POST(signedPost(textMessageEvent));
    expect(notifyWhatsAppMessages).not.toHaveBeenCalled();
    await Promise.all(afterCallbacks.map((callback) => callback()));

    expect(notifyWhatsAppMessages).toHaveBeenCalledWith([
      expect.objectContaining({ fromWaId: '50760000000', contactName: 'Cliente', textBody: 'Hola' }),
    ]);
  });

  it('keeps the acknowledgement when the push alert fails', async () => {
    storeWebhookBatch.mockResolvedValueOnce({ messages: 1, statuses: 0 });
    notifyWhatsAppMessages.mockRejectedValueOnce(new Error('push down'));

    const response = await POST(signedPost(textMessageEvent));

    expect(response.status).toBe(200);
    await expect(Promise.all(afterCallbacks.map((callback) => callback()))).resolves.toBeDefined();
  });

  it('acknowledges events for other fields without failing', async () => {
    storeWebhookBatch.mockResolvedValueOnce({ messages: 0, statuses: 0 });

    const response = await POST(signedPost({
      object: 'whatsapp_business_account',
      entry: [{ id: '1', changes: [{ field: 'message_template_status_update', value: {} }] }],
    }));

    expect(response.status).toBe(200);
    expect(afterCallbacks).toHaveLength(0);
  });

  it('rejects an event signed with another secret without storing it', async () => {
    const response = await POST(signedPost(textMessageEvent, randomBytes(32).toString('hex')));

    expect(response.status).toBe(401);
    expect(storeWebhookBatch).not.toHaveBeenCalled();
  });

  it('rejects an unsigned event', async () => {
    const response = await POST(new Request(URL_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(textMessageEvent),
    }));

    expect(response.status).toBe(401);
  });

  it('rejects oversized bodies before verifying them', async () => {
    const response = await POST(signedPost(textMessageEvent, env.whatsappAppSecret, {
      'content-length': String(300 * 1024),
    }));

    expect(response.status).toBe(413);
  });

  it('rejects oversized bodies that omit the declared length', async () => {
    const response = await POST(signedPost(`"${'x'.repeat(260 * 1024)}"`));

    expect(response.status).toBe(413);
  });

  it('rejects signed invalid JSON', async () => {
    const response = await POST(signedPost('{not json'));

    expect(response.status).toBe(400);
  });

  it('rejects signed payloads that are not WhatsApp events', async () => {
    const response = await POST(signedPost({ object: 'page', entry: [] }));

    expect(response.status).toBe(400);
    expect(storeWebhookBatch).not.toHaveBeenCalled();
  });

  it('returns a generic 500 so Meta retries when storage fails', async () => {
    storeWebhookBatch.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await POST(signedPost(textMessageEvent));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.' });
  });

  it('refuses events while the integration is not configured', async () => {
    env.whatsappAppSecret = '';

    const response = await POST(signedPost(textMessageEvent, APP_SIGNING_FIXTURE));

    expect(response.status).toBe(503);
    expect(storeWebhookBatch).not.toHaveBeenCalled();
  });
});
