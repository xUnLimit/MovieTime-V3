import { beforeEach, describe, expect, it, vi } from 'vitest';

const webPushMocks = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  configUpdateEq: vi.fn(),
  runUpdate: vi.fn(),
  runUpdateEq: vi.fn(),
  subscriptionUpdateEq: vi.fn(),
}));

const vapidTestConfig = vi.hoisted(() => ({
  publicKey: 'BMkUdgBjWyklxnVJ_Tc-oVmWfHmMEeeTLT5egb09Uz0-t93VcaQSJsv5BQxarEEeOYt9bqA9qQHYtdKF21Va1V4',
  privateKey: ['d658hZWIkNWSNss0zAXQ-Y6JcNLlkRPEu1e1yS4UJQ8'].join(''),
  subject: 'mailto:test@example.com',
}));

vi.mock('web-push', () => ({
  default: webPushMocks,
}));

// Test-only VAPID keys — NOT real credentials.
// web-push is fully mocked so these values are never used for real encryption.
vi.mock('@/config', () => ({
  env: {
    vapidPublicKey: vapidTestConfig.publicKey,
    vapidSubject: vapidTestConfig.subject,
    appUrl: 'https://example.com',
  },
}));

vi.mock('@/lib/server/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: supabaseMocks.from,
  }),
}));

import { sendExecutivePushDailySummary } from './executive-push-delivery';

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
  supabaseMocks.runUpdateEq.mockResolvedValue({ error: null });
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

    if (table === 'executive_push_runs') {
      return {
        update: supabaseMocks.runUpdate.mockImplementation(() => ({
          eq: supabaseMocks.runUpdateEq,
        })),
      };
    }

    // The summary builder queries the notification views to create the exact
    // payload encrypted into the push event.
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
    process.env.VAPID_PRIVATE_KEY = vapidTestConfig.privateKey;
    webPushMocks.setVapidDetails.mockReset();
    webPushMocks.sendNotification.mockReset().mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    supabaseMocks.from.mockReset();
    supabaseMocks.configUpdateEq.mockReset();
    supabaseMocks.runUpdate.mockReset();
    supabaseMocks.runUpdateEq.mockReset();
    supabaseMocks.subscriptionUpdateEq.mockReset();
    setupSupabaseMock();
  });

  it('sends encrypted web push payloads with configured VAPID details', async () => {
    const result = await sendExecutivePushDailySummary();

    expect(webPushMocks.setVapidDetails).toHaveBeenCalledWith(
      vapidTestConfig.subject,
      vapidTestConfig.publicKey,
      vapidTestConfig.privateKey
    );
    expect(webPushMocks.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: 'https://web.push.apple.com/sub-1',
        keys: {
          p256dh: 'p256dh-1',
          auth: 'auth-1',
        },
      },
      expect.stringContaining('"kind":"executive_daily_summary"'),
      {
        TTL: 60,
        urgency: 'normal',
        timeout: 15000,
      }
    );
    const [, rawPayload] = webPushMocks.sendNotification.mock.calls[0];
    expect(JSON.parse(rawPayload)).toMatchObject({
      kind: 'executive_daily_summary',
      title: 'Recordatorio',
      destination: '/notificaciones',
      blocks: [
        expect.objectContaining({
          key: 'clientes_por_notificar',
          count: 1,
        }),
      ],
    });
    expect(result).toMatchObject({ sent: 1, disabled: 0, failed: 0 });
    expect(supabaseMocks.configUpdateEq).toHaveBeenCalledWith('id', 'global');
  });

  it('marks scheduler-owned runs as running and sent', async () => {
    const result = await sendExecutivePushDailySummary({ runId: 'run-1' });

    expect(result).toMatchObject({ sent: 1, disabled: 0, failed: 0 });
    expect(supabaseMocks.runUpdateEq).toHaveBeenNthCalledWith(1, 'id', 'run-1');
    expect(supabaseMocks.runUpdateEq).toHaveBeenNthCalledWith(2, 'id', 'run-1');
    expect(supabaseMocks.runUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      status: 'running',
      started_at: expect.any(String),
    }));
    expect(supabaseMocks.runUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      status: 'sent',
      sent: 1,
      failed: 0,
      disabled: 0,
      finished_at: expect.any(String),
    }));
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
