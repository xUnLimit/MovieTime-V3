import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { whatsappAutoNoticesSecret: '1234567890abcdef', whatsappAccessToken: 'access-token', whatsappPhoneNumberId: '12345' },
  run: vi.fn(),
  send: vi.fn(),
  cloud: vi.fn(),
}));
vi.mock('@/platform/config', () => ({ env: mocks.env }));
vi.mock('@/application/use-cases/notice-reply-use-case', () => ({ retryPendingNoticeReplies: mocks.run }));
vi.mock('@/modules/messaging/notice-reply-store', () => ({ createNoticeReplyStore: () => ({}) }));
vi.mock('@/modules/messaging/notice-store', () => ({ createNoticeStore: () => ({}) }));
vi.mock('@/modules/whatsapp/template-catalog', () => ({ createTemplateCatalog: () => ({}) }));
vi.mock('@/modules/whatsapp/outbound-store', () => ({ createOutboundStore: () => ({}) }));
vi.mock('@/modules/whatsapp/outbound-messages', () => ({ sendOutboundMessage: mocks.send }));
vi.mock('@/modules/whatsapp/cloud-api-client', () => ({ sendCloudApiMessage: mocks.cloud }));

import { POST } from './route';

function request(body = '{}', token = mocks.env.whatsappAutoNoticesSecret) {
  return new Request('https://example.test/api/whatsapp/notice-replies/retry', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body,
  });
}

describe('POST /api/whatsapp/notice-replies/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.whatsappAutoNoticesSecret = '1234567890abcdef';
    mocks.run.mockResolvedValue({ processed: 1, accepted: 1, failed: 0, uncertain: 0, skipped: 0 });
  });

  it('devuelve 503 sin configuracion', async () => {
    mocks.env.whatsappAutoNoticesSecret = '';
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rechaza un Bearer distinto', async () => {
    expect((await POST(request('{}', '0000000000000000'))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('procesa un lote con cuerpo vacio estricto', async () => {
    expect((await POST(request('{"limit":100}'))).status).toBe(400);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.run).toHaveBeenCalledWith(expect.anything(), 25);
  });

  it('conecta el envio del worker con la Cloud API', async () => {
    mocks.run.mockImplementationOnce(async (deps: { send: (message: object) => Promise<unknown> }) => {
      await deps.send({ idempotencyKey: 'key' });
      return { processed: 1 };
    });
    mocks.send.mockImplementationOnce(async (_message, deps: { send: (to: string, payload: object) => Promise<unknown> }) => {
      await deps.send('50760000000', { kind: 'text', text: 'Hola' });
    });
    mocks.cloud.mockResolvedValueOnce({ waMessageId: 'wamid.OUT' });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.cloud).toHaveBeenCalledTimes(1);
  });

  it('devuelve un error publico si falla el lote', async () => {
    mocks.run.mockRejectedValueOnce(new Error('db unavailable'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe('INTERNAL_ERROR');
  });
});
