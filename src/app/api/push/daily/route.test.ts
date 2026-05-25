import { describe, expect, it, vi } from 'vitest';

const sendExecutivePushDailySummary = vi.hoisted(() => vi.fn());

vi.mock('@/config', () => ({
  env: {
    pushCronSecret: 'cron-secret',
  },
}));

vi.mock('@/lib/executive-push/executive-push-delivery', () => ({
  sendExecutivePushDailySummary,
}));

import { POST } from './route';

describe('/api/push/daily', () => {
  it('passes scheduler run ids from cron POST bodies to the service', async () => {
    sendExecutivePushDailySummary.mockResolvedValueOnce({
      sent: 1,
      disabled: 0,
      failed: 0,
      pushDate: '2026-05-09',
    });

    const response = await POST(new Request('https://example.com/api/push/daily', {
      method: 'POST',
      headers: {
        authorization: 'Bearer cron-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ run_id: 'run-1' }),
    }));

    expect(response.status).toBe(200);
    expect(sendExecutivePushDailySummary).toHaveBeenCalledWith({ runId: 'run-1' });
  });

  it('returns a clear 502 response when no push delivery succeeds', async () => {
    sendExecutivePushDailySummary.mockResolvedValueOnce({
      sent: 0,
      disabled: 1,
      failed: 1,
      skipped: 'no_successful_deliveries',
      pushDate: '2026-05-09',
    });

    const response = await POST(new Request('https://example.com/api/push/daily', {
      method: 'POST',
      headers: {
        authorization: 'Bearer cron-secret',
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      sent: 0,
      disabled: 1,
      failed: 1,
      skipped: 'no_successful_deliveries',
      pushDate: '2026-05-09',
    });
  });
});

