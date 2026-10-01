import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));
vi.mock('@/modules/push-delivery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/push-delivery')>()),
  sendPushNotification: vi.fn(),
}));

import { buildWhatsAppMessagePush, notifyWhatsAppMessages } from './whatsapp-message-push';

const maria = { fromWaId: '50760000000', contactName: 'María', textBody: 'Ya pagué' };

function fakeClient(result: { data?: unknown; error?: { code: string } | null }) {
  const updates: unknown[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: result.data ?? null, error: result.error ?? null }) }),
      update: (value: unknown) => {
        updates.push(value);
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
  return { client: client as never, updates };
}

const subscriptions = [
  { id: 's1', endpoint: 'https://push.example/1', p256dh: 'k1', auth: 'a1' },
  { id: 's2', endpoint: 'https://push.example/2', p256dh: 'k2', auth: 'a2' },
];

describe('buildWhatsAppMessagePush', () => {
  it('names the contact and links straight to the conversation', () => {
    expect(buildWhatsAppMessagePush([maria])).toEqual({
      kind: 'whatsapp_message',
      title: 'WhatsApp: María',
      body: 'Ya pagué',
      destination: '/chats?wa=50760000000',
    });
  });

  it('falls back to the number and a generic body for unnamed media messages', () => {
    expect(buildWhatsAppMessagePush([{ fromWaId: '50761111111', contactName: null, textBody: null }]))
      .toMatchObject({ title: 'WhatsApp: +50761111111', body: 'Nuevo mensaje' });
  });

  it('summarizes messages from several customers and truncates long text', () => {
    const push = buildWhatsAppMessagePush([maria, { ...maria, fromWaId: '50762222222', textBody: 'x'.repeat(300) }]);

    expect(push).toMatchObject({ title: '2 mensajes nuevos de WhatsApp', destination: '/chats' });
    expect(push.body).toHaveLength(100);
  });
});

describe('notifyWhatsAppMessages', () => {
  it('does nothing without messages', async () => {
    const send = vi.fn();

    await expect(notifyWhatsAppMessages([], fakeClient({}).client, send)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the alert to every enabled subscription', async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    await expect(notifyWhatsAppMessages([maria], fakeClient({ data: subscriptions }).client, send))
      .resolves.toEqual({ sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledWith(subscriptions[0], expect.objectContaining({ kind: 'whatsapp_message' }));
  });

  it('disables expired subscriptions and keeps delivering to the rest', async () => {
    const expired = Object.assign(new Error('gone'), { statusCode: 410 });
    const send = vi.fn().mockRejectedValueOnce(expired).mockResolvedValueOnce(undefined);
    const { client, updates } = fakeClient({ data: subscriptions });

    await expect(notifyWhatsAppMessages([maria], client, send)).resolves.toEqual({ sent: 1, failed: 1 });
    expect(updates).toEqual([{ enabled: false }]);
  });

  it('keeps subscriptions on transient failures', async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('busy'), { statusCode: 503 }));
    const { client, updates } = fakeClient({ data: [subscriptions[0]] });

    await expect(notifyWhatsAppMessages([maria], client, send)).resolves.toEqual({ sent: 0, failed: 1 });
    expect(updates).toEqual([]);
  });

  it('reports when subscriptions cannot be read', async () => {
    await expect(notifyWhatsAppMessages([maria], fakeClient({ error: { code: '42501' } }).client, vi.fn()))
      .rejects.toThrow('42501');
  });

  it('handles an empty subscription list', async () => {
    await expect(notifyWhatsAppMessages([maria], fakeClient({ data: null }).client, vi.fn()))
      .resolves.toEqual({ sent: 0, failed: 0 });
  });
});
