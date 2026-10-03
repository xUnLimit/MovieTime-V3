import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { whatsappAutoNoticesSecret: '1234567890abcdef' },
  run: vi.fn(),
}));
vi.mock('@/platform/config', () => ({ env: mocks.env }));
vi.mock('@/application/use-cases/dispatch-domain-events', () => ({
  dispatchDomainEvents: mocks.run, createDomainEventHandlers: () => ({ kind: 'handlers' }),
}));
vi.mock('@/modules/domain-events', () => ({ createDomainEventStore: () => ({ kind: 'store' }) }));

import { POST } from './route';

function request(body = '{}', token = mocks.env.whatsappAutoNoticesSecret) {
  return new Request('https://example.test/api/domain-events/dispatch', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body,
  });
}

describe('POST /api/domain-events/dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.whatsappAutoNoticesSecret = '1234567890abcdef';
    mocks.run.mockResolvedValue({ claimed: 1, processed: 1, failed: 0 });
  });

  it('returns 503 without the secret', async () => {
    mocks.env.whatsappAutoNoticesSecret = '';
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects a missing or wrong bearer without dispatching', async () => {
    expect((await POST(request('{}', '0000000000000000'))).status).toBe(401);
    expect((await POST(new Request('https://example.test/x', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('rejects a non-empty body', async () => {
    expect((await POST(request('{"limit":9}'))).status).toBe(400);
  });

  it('dispatches a batch with request id and no-store', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.run).toHaveBeenCalledWith({ store: { kind: 'store' }, handlers: { kind: 'handlers' } }, 50, 120);
  });

  it('hides internal errors', async () => {
    mocks.run.mockRejectedValueOnce(new Error('sql detail'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('sql detail');
  });
});
