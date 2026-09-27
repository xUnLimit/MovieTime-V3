import { expect, test } from '@playwright/test';

test('@smoke keeps manual Yappy sync admin-only and cron sync secret-only', async ({ request }) => {
  const manual = await request.post('/api/yappy/sync-now', { data: {} });
  expect(manual.status()).toBe(401);
  const cron = await request.post('/api/yappy/sync', { data: {} });
  expect([401, 503]).toContain(cron.status());
});
