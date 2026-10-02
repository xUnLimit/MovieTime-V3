import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { whatsappAutoNoticesSecret: '1234567890abcdef', whatsappAccessToken: 'access-token', whatsappPhoneNumberId: '12345' },
  run: vi.fn(),
}));
vi.mock('@/platform/config', () => ({ env: mocks.env }));
vi.mock('@/application/use-cases/process-inbound-message', () => ({ retryPendingInboundMessages: mocks.run }));
vi.mock('@/modules/whatsapp/inbound-queue-store', () => ({ createInboundQueueStore: () => ({ kind: 'queue' }) }));
vi.mock('../../webhook/inbound-pipeline', () => ({ createInboundPipelineDeps: () => ({ kind: 'pipeline' }) }));

import { POST } from './route';

function request(body = '{}', token = mocks.env.whatsappAutoNoticesSecret) {
  return new Request('https://example.test/api/whatsapp/inbound/retry', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body,
  });
}

describe('POST /api/whatsapp/inbound/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.whatsappAutoNoticesSecret = '1234567890abcdef';
    mocks.run.mockResolvedValue({ claimed: 1, done: 1, failed: 0 });
  });

  it('returns 503 without configuration', async () => {
    mocks.env.whatsappAutoNoticesSecret = '';
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects a missing or wrong bearer', async () => {
    expect((await POST(request('{}', '0000000000000000'))).status).toBe(401);
    expect((await POST(new Request('https://example.test/x', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('rejects a non-empty body', async () => {
    expect((await POST(request('{"limit":100}'))).status).toBe(400);
  });

  it('processes a batch with request id and no-store', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ queue: { kind: 'queue' } }), 10, 300);
  });

  it('answers 500 with a public error when the worker throws', async () => {
    mocks.run.mockRejectedValueOnce(new Error('sql detail'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('sql detail');
  });
});
