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

// Test-only VAPID keys — NOT real credentials.
// web-push is fully mocked so these values are never used for real encryption.
const TEST_VAPID_PUBLIC_KEY =
  'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFakeVapidPublicKeyForTestsOnly00';
const TEST_VAPID_PRIVATE_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TEST_VAPID_SUBJECT = 'mailto:test@example.com';

vi.mock('@/config', () => ({
  env: {
    vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    vapidSubject: TEST_VAPID_SUBJECT,
    appUrl: 'https://example.com',
  },
}));

vi.mock('@/lib/server/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: supabaseMocks.from,
  }),
}));

import { sendExecutivePushDailySummary } from './executivePushService';

function setupSupabaseMock(options: { ventaNotifications?: Array<{ cliente_id: string; dias_restantes: number; leida: boolean }> } = {}) {
  const ventaNotifications = options.ventaNotifications ?? [
    { cliente_id: 'cliente-1', dias_restantes: 0, leida: false },
  ];
  const configRow = {
    executive_push_enabled: true,
    executive_push_send_time: '00:00',
    executive_push_window_start: '00:00',
    executive_push_window_end: '23:59',
    executive_push_interval_hours: 4,
    executive_push_timezone: 'UTC',
    executive_push_last_sent_at: null,
    executive_push_last_sent_date: null,
    executive_push_selected_blocks: ['clientes_por_notificar'],
    executive_push_block_order: ['clientes_por_notificar'],
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

    // The summary builder queries the notification views; the production push
    // path currently doesn't reach buildSummaryBlocks (sendSubscriptionPing
    // sends a constant payload), but keep these stubs to be safe if the call
    // chain changes.
    if (table === 'v_notificaciones_venta') {
      return {
        select: () => ({
          eq: () => ({
            lte: async () => ({ data: ventaNotifications, error: null }),
          }),
        }),
      };
    }

    if (table === 'v_notificaciones_servicio' || table === 'v_notificaciones_reposo') {
      return {
        select: () => ({
          eq: () => ({
            lte: async () => ({ data: [], error: null }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
}

describe('sendExecutivePushDailySummary', () => {
  beforeEach(() => {
    process.env.VAPID_PRIVATE_KEY = TEST_VAPID_PRIVATE_KEY;
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
      TEST_VAPID_SUBJECT,
      TEST_VAPID_PUBLIC_KEY,
      TEST_VAPID_PRIVATE_KEY
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

  it('skips delivery and keeps the reminder retryable when no selected block has active items', async () => {
    setupSupabaseMock({ ventaNotifications: [] });

    const result = await sendExecutivePushDailySummary();

    expect(result).toMatchObject({
      sent: 0,
      disabled: 0,
      failed: 0,
      skipped: 'no_active_items',
    });
    expect(webPushMocks.sendNotification).not.toHaveBeenCalled();
    expect(supabaseMocks.configUpdateEq).not.toHaveBeenCalled();
  });
});
