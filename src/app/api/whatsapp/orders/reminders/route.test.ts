import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { whatsappAutoNoticesSecret: '1234567890abcdef', whatsappAccessToken: 'access-token', whatsappPhoneNumberId: '67890' },
  run: vi.fn(),
}));
vi.mock('@/platform/config', () => ({ env: mocks.env }));
vi.mock('@/application/use-cases/order-reminders-use-case', () => ({ runOrderReminders: mocks.run }));
vi.mock('@/application/use-cases/payment-wiring', () => ({ createOrderReminderDeps: () => ({}) }));

import { POST } from './route';

const request = (body = '{}', token = mocks.env.whatsappAutoNoticesSecret) => new Request('http://localhost/api/whatsapp/orders/reminders', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body,
});

describe('POST /api/whatsapp/orders/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.whatsappAutoNoticesSecret = '1234567890abcdef';
    mocks.run.mockResolvedValue({ claimed: 0, sent: 0, failed: 0 });
  });

  it('is unavailable without configuration and rejects bad credentials', async () => {
    mocks.env.whatsappAutoNoticesSecret = '';
    expect((await POST(request())).status).toBe(503);
    mocks.env.whatsappAutoNoticesSecret = '1234567890abcdef';
    expect((await POST(new Request('http://localhost/x', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect((await POST(request('{}', '0000000000000000'))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('requires an empty JSON body and runs the use case', async () => {
    expect((await POST(request('{"force":true}'))).status).toBe(400);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });

  it('returns a typed error when the run fails', async () => {
    mocks.run.mockRejectedValue(new Error('db password leaked'));
    const response = await POST(request());
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(await response.text()).not.toContain('leaked');
  });
});
