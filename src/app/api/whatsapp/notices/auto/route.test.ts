import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { whatsappAutoNoticesSecret: '1234567890abcdef', whatsappAccessToken: 'access-token',
    whatsappWabaId: '12345', whatsappPhoneNumberId: '67890' },
  run: vi.fn(),
}));
vi.mock('@/platform/config', () => ({ env: mocks.env }));
vi.mock('@/application/use-cases/auto-notices-use-case', () => ({ runAutoNotices: mocks.run }));
vi.mock('@/modules/messaging/auto-notice-store', () => ({ createAutoNoticeStore: () => ({}) }));
vi.mock('@/modules/messaging/notice-store', () => ({ createNoticeStore: () => ({}) }));
vi.mock('@/modules/whatsapp/template-catalog', () => ({ createTemplateCatalog: () => ({}), WHATSAPP_TEMPLATE_LANGUAGE: 'es' }));
vi.mock('@/modules/whatsapp/outbound-store', () => ({ createOutboundStore: () => ({}) }));

import { POST } from './route';

function request(body = '{}', token = mocks.env.whatsappAutoNoticesSecret) {
  return new Request('http://localhost/api/whatsapp/notices/auto', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body,
  });
}

describe('POST /api/whatsapp/notices/auto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.whatsappAutoNoticesSecret = '1234567890abcdef';
    mocks.run.mockResolvedValue({ skipped: 'not_scheduled' });
  });

  it('returns 503 when the secret is not configured', async () => {
    mocks.env.whatsappAutoNoticesSecret = '';
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('rejects missing and invalid Bearer credentials', async () => {
    const missing = new Request('http://localhost/api/whatsapp/notices/auto', { method: 'POST', body: '{}' });
    expect((await POST(missing)).status).toBe(401);
    expect((await POST(request('{}', '0000000000000000'))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('rejects non-empty objects and requires a strict empty JSON body', async () => {
    expect((await POST(request('{"force":true}'))).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });
});
