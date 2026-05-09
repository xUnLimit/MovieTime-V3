import { beforeEach, describe, expect, it, vi } from 'vitest';

const webPushMocks = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  configUpdateEq: vi.fn(),
  subscriptionUpdateEq: vi.fn(),
}));

vi.mock('web-push', () => ({
  default: webPushMocks,
}));

vi.mock('@/config', () => ({
  env: {
    vapidPublicKey: 'REDACTED_VAPID_PUBLIC_KEY',
    vapidSubject: 'mailto:admin@example.com',
    appUrl: 'https://system.movietimepty.top',
  },
}));

vi.mock('@/lib/server/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: supabaseMocks.from,
  }),
}));

import { sendExecutivePushDailySummary } from './executivePushService';

function setupSupabaseMock() {
  const configRow = {
    executive_push_enabled: true,
    executive_push_send_time: '00:00',
    executive_push_timezone: 'UTC',
    executive_push_last_sent_date: null,
    executive_push_selected_blocks: ['ventas_por_vencer'],
    executive_push_block_order: ['ventas_por_vencer'],
  };
  const subscriptions = [
    {
      id: 'sub-1',
      endpoint: 'https://web.push.apple.com/sub-1',
      p256dh: 'p256dh-1',
      auth: 'auth-1',
      enabled: true,
    },
  ];

  supabaseMocks.configUpdateEq.mockResolvedValue({ error: null });
  supabaseMocks.subscriptionUpdateEq.mockResolvedValue({ error: null });
  supabaseMocks.from.mockImplementation((table: string) => {
    if (table === 'config') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: configRow, error: null }),
          }),
        }),
        update: () => ({
          eq: supabaseMocks.configUpdateEq,
        }),
      };
    }

    if (table === 'push_subscriptions') {
      return {
        select: () => ({
          eq: async () => ({ data: subscriptions, error: null }),
        }),
        update: () => ({
          eq: supabaseMocks.subscriptionUpdateEq,
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
}

describe('sendExecutivePushDailySummary', () => {
  beforeEach(() => {
    process.env.VAPID_PRIVATE_KEY = 'REDACTED_VAPID_PRIVATE_KEY';
    webPushMocks.setVapidDetails.mockReset();
    webPushMocks.sendNotification.mockReset().mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    supabaseMocks.from.mockReset();
    supabaseMocks.configUpdateEq.mockReset();
    supabaseMocks.subscriptionUpdateEq.mockReset();
    setupSupabaseMock();
  });

  it('sends encrypted web push payloads with configured VAPID details', async () => {
    const result = await sendExecutivePushDailySummary();

    expect(webPushMocks.setVapidDetails).toHaveBeenCalledWith(
      'mailto:admin@example.com',
      'REDACTED_VAPID_PUBLIC_KEY',
      'REDACTED_VAPID_PRIVATE_KEY'
    );
    expect(webPushMocks.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://web.push.apple.com/sub-1',
        keys: {
          p256dh: 'p256dh-1',
          auth: 'auth-1',
        },
      },
      JSON.stringify({ kind: 'executive_daily_summary' }),
      {
        TTL: 60,
        urgency: 'normal',
        timeout: 15000,
      }
    );
    expect(result).toMatchObject({ sent: 1, disabled: 0, failed: 0 });
    expect(supabaseMocks.configUpdateEq).toHaveBeenCalledWith('id', 'global');
  });

  it('disables subscriptions rejected with invalid push status codes', async () => {
    webPushMocks.sendNotification.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), {
        statusCode: 403,
        body: '{"reason":"BadJwtToken"}',
      })
    );

    const result = await sendExecutivePushDailySummary();

    expect(result).toMatchObject({
      sent: 0,
      disabled: 1,
      failed: 1,
      skipped: 'no_successful_deliveries',
    });
    expect(supabaseMocks.subscriptionUpdateEq).toHaveBeenCalledWith('id', 'sub-1');
    expect(supabaseMocks.configUpdateEq).not.toHaveBeenCalled();
  });
});
