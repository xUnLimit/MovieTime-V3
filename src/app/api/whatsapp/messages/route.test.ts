import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnauthorizedError } from '@/platform/server/api-errors';

const requireAuthenticatedAdmin = vi.hoisted(() => vi.fn());
const sendOutboundMessage = vi.hoisted(() => vi.fn());
const sendCloudApiMessage = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => ({ whatsappAccessToken: '', whatsappPhoneNumberId: '' }));

vi.mock('@/platform/config', () => ({ env }));
vi.mock('@/platform/server/request-auth', () => ({ requireAuthenticatedAdmin }));
vi.mock('@/modules/whatsapp/outbound-store', () => ({ createOutboundStore: () => ({}) }));
vi.mock('@/modules/whatsapp/template-catalog', () => ({ createTemplateCatalog: () => ({}) }));
vi.mock('@/modules/whatsapp/cloud-api-client', () => ({ sendCloudApiMessage }));
vi.mock('@/modules/whatsapp/outbound-messages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/whatsapp/outbound-messages')>()),
  sendOutboundMessage,
}));

import { CustomerWindowClosedError, InvalidTemplateParamsError, TemplateNotApprovedError } from '@/modules/whatsapp/outbound-messages';
import { POST } from './route';

const KEY = '5b0f3c3e-8d8f-4c55-9a4b-3c9f1a2b7d10';

function post(body: unknown) {
  return new Request('https://example.com/api/whatsapp/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer user-session' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  env.whatsappAccessToken = 'configured-access-value';
  env.whatsappPhoneNumberId = '1324513647414207';
  requireAuthenticatedAdmin.mockResolvedValue({ user: { id: 'admin-1' } });
});

describe('POST /api/whatsapp/messages', () => {
  it('sends a text message on behalf of the authenticated admin', async () => {
    sendOutboundMessage.mockResolvedValueOnce({ id: 'out-1', sendStatus: 'accepted', waMessageId: 'wamid.OUT', errorTitle: null, replayed: false });

    const response = await POST(post({ idempotencyKey: KEY, to: '50760000000', message: { kind: 'text', text: ' Hola ' } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ sendStatus: 'accepted', waMessageId: 'wamid.OUT' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(sendOutboundMessage).toHaveBeenCalledWith(
      { idempotencyKey: KEY, toWaId: '50760000000', payload: { kind: 'text', text: 'Hola' }, sentBy: 'admin-1' },
      expect.objectContaining({ store: expect.any(Object), catalog: expect.any(Object), send: expect.any(Function) })
    );
  });

  it('wires the Cloud API sender with the configured number', async () => {
    sendOutboundMessage.mockImplementationOnce(async (_message, deps) => {
      await deps.send('50760000000', { kind: 'text', text: 'Hola' });
      return { id: 'out-1', sendStatus: 'accepted', waMessageId: 'w', errorTitle: null, replayed: false };
    });

    await POST(post({ idempotencyKey: KEY, to: '50760000000', message: { kind: 'text', text: 'Hola' } }));

    expect(sendCloudApiMessage).toHaveBeenCalledWith(
      { accessToken: 'configured-access-value', phoneNumberId: '1324513647414207' },
      '50760000000',
      { kind: 'text', text: 'Hola' }
    );
  });

  it('rejects unauthenticated requests before doing anything else', async () => {
    requireAuthenticatedAdmin.mockRejectedValueOnce(new UnauthorizedError());

    const response = await POST(post({}));

    expect(response.status).toBe(401);
    expect(sendOutboundMessage).not.toHaveBeenCalled();
  });

  it('refuses to send while the integration is not configured', async () => {
    env.whatsappAccessToken = '';

    const response = await POST(post({ idempotencyKey: KEY, to: '50760000000', message: { kind: 'text', text: 'Hola' } }));

    expect(response.status).toBe(503);
  });

  it.each([
    ['a non UUID idempotency key', { idempotencyKey: 'x', to: '50760000000', message: { kind: 'text', text: 'Hola' } }],
    ['a malformed number', { idempotencyKey: KEY, to: '+507 6000', message: { kind: 'text', text: 'Hola' } }],
    ['an empty text', { idempotencyKey: KEY, to: '50760000000', message: { kind: 'text', text: '   ' } }],
    ['an invalid template name', { idempotencyKey: KEY, to: '50760000000', message: { kind: 'template', templateName: 'Promo!', params: [] } }],
    ['a template value with line breaks', {
      idempotencyKey: KEY, to: '50760000000',
      message: { kind: 'template', templateName: 'vence_hoy', params: ['Net\nflix', 'a', 'b'] },
    }],
  ])('rejects %s', async (_label, body) => {
    const response = await POST(post(body));

    expect(response.status).toBe(400);
    expect(sendOutboundMessage).not.toHaveBeenCalled();
  });

  it('explains when free text is blocked by the 24 hour window', async () => {
    sendOutboundMessage.mockRejectedValueOnce(new CustomerWindowClosedError());

    const response = await POST(post({ idempotencyKey: KEY, to: '50760000000', message: { kind: 'text', text: 'Hola' } }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('WHATSAPP_WINDOW_CLOSED');
  });

  it('rejects template parameter counts that do not match', async () => {
    sendOutboundMessage.mockRejectedValueOnce(new InvalidTemplateParamsError());

    const response = await POST(post({
      idempotencyKey: KEY, to: '50760000000',
      message: { kind: 'template', templateName: 'vence_hoy', params: ['Netflix'] },
    }));

    expect(response.status).toBe(400);
  });

  it('rejects a template absent from the approved cache', async () => {
    sendOutboundMessage.mockRejectedValueOnce(new TemplateNotApprovedError());
    const response = await POST(post({ idempotencyKey: KEY, to: '50760000000',
      message: { kind: 'template', templateName: 'promo', params: [] } }));
    expect(response.status).toBe(400);
  });

  it('hides unexpected failures behind a generic error', async () => {
    sendOutboundMessage.mockRejectedValueOnce(new Error('database exploded'));

    const response = await POST(post({ idempotencyKey: KEY, to: '50760000000', message: { kind: 'text', text: 'Hola' } }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('database exploded');
  });
});
