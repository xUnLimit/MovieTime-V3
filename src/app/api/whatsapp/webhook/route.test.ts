import { createHmac, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeWebhookBatch = vi.hoisted(() => vi.fn());
const notifyWhatsAppMessages = vi.hoisted(() => vi.fn());
const handleNoticeReply = vi.hoisted(() => vi.fn());
const sendOutboundMessage = vi.hoisted(() => vi.fn());
const sendCloudApiMessage = vi.hoisted(() => vi.fn());
const handleBotMessage = vi.hoisted(() => vi.fn());
const openNetflixInbox = vi.hoisted(() => vi.fn());
const getNetflixMailConfig = vi.hoisted(() => vi.fn());
const loadBotConfig = vi.hoisted(() => vi.fn());
const recordBotEvent = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void>>);
const env = vi.hoisted(() => ({
  whatsappVerifyToken: 'verify-token-123456',
  whatsappAppSecret: '',
  whatsappAccessToken: '',
  whatsappPhoneNumberId: '',
}));

vi.mock('@/platform/config', () => ({ env }));
vi.mock('@/modules/whatsapp/webhook-inbox', () => ({ storeWebhookBatch }));
vi.mock('@/application/use-cases/commerce-conversation-use-case', () => ({ handleCommerceConversation: async () => null }));
vi.mock('@/application/use-cases/commerce-conversation-runtime', () => ({ createCommerceConversationDeps: () => ({}) }));
vi.mock('@/application/use-cases/commerce-conversation-state', () => ({ commerceCommand: () => null }));
vi.mock('@/application/use-cases/automation-intent-use-case', () => ({ suggestAutomationIntent: async () => null }));
vi.mock('@/application/use-cases/pedido-delivery-runtime', () => ({ drainOrderDeliveries: async () => ({ processed:0,failed:0 }) }));
vi.mock('@/modules/whatsapp/automation-inbox-store', () => ({
  createAutomationInboxStore: () => {
    let queue: Array<{ id: number; attempts: number; token: string; fence: number; message: unknown; conversation: object }> | undefined;
    return {
      claim: async () => {
        if (!queue) {
          const batch = storeWebhookBatch.mock.calls.at(-1)?.[0];
          const stored = await storeWebhookBatch.mock.results.at(-1)?.value;
          queue = (batch?.messages ?? []).filter((message: { waMessageId: string }) => stored?.insertedWaMessageIds?.includes(message.waMessageId))
            .map((message: unknown, index: number) => ({ id: index + 1, attempts: 1, token: 'lease', fence: 1, message,
              conversation: { flowVersion: null, context: {}, activeProcess: null, orderId: null } }));
        }
        return queue?.shift() ?? null;
      },
      isCurrent: async () => true,
      finish: async () => true,
    };
  },
}));
vi.mock('@/modules/notifications/whatsapp-message-push', () => ({ notifyWhatsAppMessages }));
vi.mock('@/application/use-cases/notice-reply-use-case', () => ({ handleNoticeReply }));
vi.mock('@/modules/whatsapp/outbound-messages', () => ({ sendOutboundMessage }));
vi.mock('@/modules/whatsapp/cloud-api-client', () => ({ sendCloudApiMessage }));
vi.mock('@/modules/messaging/notice-reply-store', () => ({ createNoticeReplyStore: () => ({}) }));
vi.mock('@/modules/messaging/notice-store', () => ({ createNoticeStore: () => ({}) }));
vi.mock('@/application/use-cases/whatsapp-bot-use-case', () => ({ handleBotMessage }));
vi.mock('@/modules/messaging/bot-store', () => ({ createBotStore: () => ({ kind: 'bot-store' }) }));
vi.mock('@/modules/messaging/bot-config-store', () => ({ createBotConfigStore: () => ({ load: loadBotConfig }) }));
vi.mock('@/modules/messaging/bot-events-store', () => ({ createBotEventsStore: () => ({ record: recordBotEvent }) }));
vi.mock('@/modules/messaging/netflix-claim-store', () => ({ createNetflixClaimStore: () => ({ kind: 'claim-store' }) }));
vi.mock('@/platform/server/netflix-imap', () => ({ openNetflixInbox }));
vi.mock('@/platform/server/netflix-travel-page', () => ({ fetchTravelPageHtml: vi.fn() }));
vi.mock('@/platform/config/netflix-server', () => ({ getNetflixMailConfig }));
vi.mock('@/modules/whatsapp/template-catalog', () => ({ createTemplateCatalog: () => ({}) }));
vi.mock('@/modules/whatsapp/outbound-store', () => ({ createOutboundStore: () => ({}) }));
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
  handleNoticeReply.mockReset();
  sendOutboundMessage.mockReset();
  sendCloudApiMessage.mockReset();
  handleBotMessage.mockReset();
  openNetflixInbox.mockReset();
  getNetflixMailConfig.mockReset();
  loadBotConfig.mockReset();
  recordBotEvent.mockReset();
  afterCallbacks.length = 0;
  env.whatsappVerifyToken = 'verify-token-123456';
  env.whatsappAppSecret = APP_SIGNING_FIXTURE;
  env.whatsappAccessToken = '';
  env.whatsappPhoneNumberId = '';
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
  it('runs button actions only after inbox storage and keeps 200 when an action fails', async () => {
    const order: string[] = [];
    env.whatsappAccessToken = 'test-token';
    env.whatsappPhoneNumberId = '123456';
    storeWebhookBatch.mockImplementation(async () => { order.push('stored'); return { messages: 1, statuses: 0, insertedWaMessageIds: ['wamid.BUTTON'] }; });
    handleNoticeReply.mockImplementation(async () => { order.push('action'); throw new Error('action failed'); });
    notifyWhatsAppMessages.mockResolvedValue({ sent: 0, failed: 0 });
    const event = structuredClone(textMessageEvent);
    event.entry[0].changes[0].value.messages[0] = {
      id: 'wamid.BUTTON', from: '50760000000', timestamp: '1790000000', type: 'button',
      button: { text: 'Quiero renovar', payload: 'RENOVAR:123e4567-e89b-12d3-a456-426614174000' },
    } as never;
    const response = await POST(signedPost(event));
    expect(response.status).toBe(200);
    await expect(Promise.all(afterCallbacks.map((callback) => callback()))).resolves.toBeDefined();
    expect(order).toEqual(['stored', 'action']);
    expect(handleNoticeReply).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ type: 'template_button' }),
    }), expect.anything());
  });
  it('stores a signed inbound message and acknowledges it', async () => {
    storeWebhookBatch.mockResolvedValueOnce({ messages: 1, statuses: 0, insertedWaMessageIds: ['wamid.IN'] });

    const response = await POST(signedPost(textMessageEvent));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, data: { messages: 1, statuses: 0, insertedWaMessageIds: ['wamid.IN'] } });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(storeWebhookBatch).toHaveBeenCalledWith(expect.objectContaining({
      messages: [expect.objectContaining({ waMessageId: 'wamid.IN', textBody: 'Hola' })],
    }));
  });

  it('schedules a push alert after responding when customers write', async () => {
    storeWebhookBatch.mockResolvedValueOnce({ messages: 1, statuses: 0, insertedWaMessageIds: ['wamid.IN'] });
    notifyWhatsAppMessages.mockResolvedValueOnce({ sent: 1, failed: 0 });

    await POST(signedPost(textMessageEvent));
    expect(notifyWhatsAppMessages).not.toHaveBeenCalled();
    await Promise.all(afterCallbacks.map((callback) => callback()));

    expect(notifyWhatsAppMessages).toHaveBeenCalledWith([
      expect.objectContaining({ fromWaId: '50760000000', contactName: 'Cliente', textBody: 'Hola' }),
    ]);
  });

  it('keeps the acknowledgement when the push alert fails', async () => {
    storeWebhookBatch.mockResolvedValueOnce({ messages: 1, statuses: 0, insertedWaMessageIds: ['wamid.IN'] });
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

  it('no repite el push tras una reentrega de Meta', async () => {
    storeWebhookBatch.mockResolvedValueOnce({ messages: 1, statuses: 0, insertedWaMessageIds: [] });
    await POST(signedPost(textMessageEvent));
    await Promise.all(afterCallbacks.map((callback) => callback()));
    expect(notifyWhatsAppMessages).not.toHaveBeenCalled();
  });

  it('conecta el envio de botones con la Cloud API', async () => {
    env.whatsappAccessToken = 'test-token';
    env.whatsappPhoneNumberId = '123456';
    storeWebhookBatch.mockResolvedValueOnce({ messages: 1, statuses: 0, insertedWaMessageIds: ['wamid.IN'] });
    handleNoticeReply.mockImplementationOnce(async (_message, deps: { send: (message: object) => Promise<unknown> }) => {
      await deps.send({ idempotencyKey: 'key' });
      return 'accepted';
    });
    sendOutboundMessage.mockImplementationOnce(async (_message, deps: { send: (to: string, payload: object) => Promise<unknown> }) => {
      await deps.send('50760000000', { kind: 'text', text: 'Hola' });
    });
    sendCloudApiMessage.mockResolvedValueOnce({ waMessageId: 'wamid.OUT' });
    await POST(signedPost(textMessageEvent));
    await Promise.all(afterCallbacks.map((callback) => callback()));
    expect(sendCloudApiMessage).toHaveBeenCalledTimes(1);
  });

  describe('menu bot', () => {
    const published = { ready: true, enabled: true, version: 4, definition: { kind: 'published-definition' } };

    beforeEach(() => {
      env.whatsappAccessToken = 'test-token';
      env.whatsappPhoneNumberId = '123456';
      handleNoticeReply.mockResolvedValue('ignored');
      notifyWhatsAppMessages.mockResolvedValue({ sent: 0, failed: 0 });
      loadBotConfig.mockResolvedValue(published);
      recordBotEvent.mockResolvedValue(undefined);
    });

    async function deliver(inserted = ['wamid.IN']) {
      storeWebhookBatch.mockResolvedValueOnce({ messages: 1, statuses: 0, insertedWaMessageIds: inserted });
      const response = await POST(signedPost(textMessageEvent));
      await Promise.all(afterCallbacks.map((callback) => callback()));
      return response;
    }

    it('hands a new message that is not a notice reply to the bot with the published definition, wired to the mailbox and the Cloud API', async () => {
      getNetflixMailConfig.mockReturnValue({ user: 'owner@gmail.com', password: 'app-password' });
      openNetflixInbox.mockResolvedValue({ recent: vi.fn(), close: vi.fn() });
      sendOutboundMessage.mockImplementation(async (_message, deps: { send: (to: string, payload: object) => Promise<unknown> }) => {
        await deps.send('50760000000', { kind: 'text', text: 'Hola' });
      });
      sendCloudApiMessage.mockResolvedValue({ waMessageId: 'wamid.OUT' });
      handleBotMessage.mockImplementation(async (_message, deps: {
        store: unknown; claims: unknown; events: { record: (event: object) => Promise<void> }; definition: unknown;
        openInbox: () => Promise<unknown>; send: (message: object) => Promise<unknown>;
      }) => {
        expect(deps.store).toEqual({ kind: 'bot-store' });
        expect(deps.claims).toEqual({ kind: 'claim-store' });
        expect(deps.definition).toEqual({ kind: 'published-definition' });
        await deps.events.record({ waId: '50760000000', type: 'menu_shown' });
        await expect(deps.openInbox()).resolves.toBeTruthy();
        await deps.send({ idempotencyKey: 'key' });
        return 'menu';
      });
      await deliver();
      expect(handleBotMessage).toHaveBeenCalledWith(expect.objectContaining({ waMessageId: 'wamid.IN' }), expect.anything());
      expect(openNetflixInbox).toHaveBeenCalledWith('owner@gmail.com', 'app-password');
      expect(sendCloudApiMessage).toHaveBeenCalledTimes(1);
      expect(recordBotEvent).toHaveBeenCalledWith({ waId: '50760000000', type: 'menu_shown' });
    });

    it('reports an unconfigured mailbox to the bot as unavailable', async () => {
      getNetflixMailConfig.mockReturnValue(null);
      let inbox: unknown = 'unset';
      handleBotMessage.mockImplementation(async (_message, deps: { openInbox: () => Promise<unknown> }) => {
        inbox = await deps.openInbox();
        return 'unavailable';
      });
      await deliver();
      expect(inbox).toBeNull();
      expect(openNetflixInbox).not.toHaveBeenCalled();
    });

    it('loads the configuration once per delivery, however many messages it carries', async () => {
      const event = structuredClone(textMessageEvent);
      event.entry[0].changes[0].value.messages.push({ id: 'wamid.TWO', from: '50760000000', timestamp: '1790000001', type: 'text', text: { body: 'Hola otra vez' } });
      storeWebhookBatch.mockResolvedValueOnce({ messages: 2, statuses: 0, insertedWaMessageIds: ['wamid.IN', 'wamid.TWO'] });
      handleBotMessage.mockResolvedValue('menu');
      await POST(signedPost(event));
      await Promise.all(afterCallbacks.map((callback) => callback()));
      expect(handleBotMessage).toHaveBeenCalledTimes(2);
      expect(loadBotConfig).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['Meta redelivers a message already stored', () => undefined, []],
      ['the message was a notice reply', () => { handleNoticeReply.mockResolvedValue('accepted'); }, ['wamid.IN']],
    ])('does not run the bot when %s', async (_label, arrange, inserted) => {
      arrange();
      await deliver(inserted);
      expect(handleBotMessage).not.toHaveBeenCalled();
      expect(loadBotConfig).not.toHaveBeenCalled();
    });

    it('stays silent and quiet while the bot is switched off', async () => {
      loadBotConfig.mockResolvedValue({ ready: false, enabled: false, version: 4, reason: 'disabled' });
      await deliver();
      expect(handleBotMessage).not.toHaveBeenCalled();
      expect(recordBotEvent).not.toHaveBeenCalled();
    });

    it.each(['missing_config', 'no_published_version', 'invalid_definition'])('does not answer and records an error event when the configuration is %s', async (reason) => {
      loadBotConfig.mockResolvedValue({ ready: false, enabled: true, version: null, reason });
      const response = await deliver();
      expect(response.status).toBe(200);
      expect(handleBotMessage).not.toHaveBeenCalled();
      expect(recordBotEvent).toHaveBeenCalledWith({ waId: '50760000000', type: 'error', detail: { motivo: reason } });
      expect(notifyWhatsAppMessages).toHaveBeenCalledTimes(1);
    });

    it('keeps the acknowledgement and the push when the configuration cannot be read', async () => {
      loadBotConfig.mockRejectedValue(new Error('database unavailable'));
      const response = await deliver();
      expect(response.status).toBe(200);
      expect(handleBotMessage).not.toHaveBeenCalled();
      expect(recordBotEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', detail: { motivo: 'config_no_disponible' } }));
      expect(notifyWhatsAppMessages).toHaveBeenCalledTimes(1);
    });

    it('does not fail when the error event cannot be recorded either', async () => {
      loadBotConfig.mockRejectedValue(new Error('database unavailable'));
      recordBotEvent.mockRejectedValue(new Error('database unavailable'));
      const response = await deliver();
      expect(response.status).toBe(200);
      expect(notifyWhatsAppMessages).toHaveBeenCalledTimes(1);
    });

    it('keeps the acknowledgement and records an error event when the bot fails', async () => {
      handleBotMessage.mockRejectedValue(new Error('bot failed'));
      const response = await deliver();
      expect(response.status).toBe(200);
      expect(recordBotEvent).toHaveBeenCalledWith({ waId: '50760000000', type: 'error', detail: { motivo: 'respuesta_fallida' } });
      expect(notifyWhatsAppMessages).toHaveBeenCalledTimes(1);
    });
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
