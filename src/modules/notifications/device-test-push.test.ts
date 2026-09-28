import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));

import { sendDeviceTestPush } from './device-test-push';

const subscription = {
  id: 'sub-1',
  endpoint: 'https://push.example/current-device',
  p256dh: 'public-key',
  auth: 'auth-key',
};

function fakeClient(data: typeof subscription[] | null, error: { code: string } | null = null) {
  const query = {
    eq: vi.fn(),
    then: (resolve: (value: { data: typeof data; error: typeof error }) => void) =>
      Promise.resolve({ data, error }).then(resolve),
  };
  query.eq.mockReturnValue(query);
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const client = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(query),
      update: vi.fn().mockReturnValue({ eq: updateEq }),
    }),
  };
  return { client: client as never, query, updateEq };
}

describe('sendDeviceTestPush', () => {
  it('sends a test payload to the requested admin device without checking reminder blocks', async () => {
    const { client, query } = fakeClient([subscription]);
    const send = vi.fn().mockResolvedValue(undefined);

    await expect(sendDeviceTestPush('admin-1', subscription.endpoint, client, send))
      .resolves.toEqual({ sent: 1, failed: 0, disabled: 0 });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'admin-1');
    expect(query.eq).toHaveBeenCalledWith('enabled', true);
    expect(query.eq).toHaveBeenCalledWith('endpoint', subscription.endpoint);
    expect(send).toHaveBeenCalledWith(subscription, {
      kind: 'push_test',
      title: 'Prueba de notificaciones',
      body: expect.any(String),
      destination: '/dashboard',
    });
  });

  it('reports an absent server subscription without attempting delivery', async () => {
    const send = vi.fn();
    await expect(sendDeviceTestPush('admin-1', subscription.endpoint, fakeClient([]).client, send))
      .resolves.toEqual({ sent: 0, failed: 0, disabled: 0, skipped: 'not_subscribed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('disables a rejected subscription and reports no delivery', async () => {
    const { client, updateEq } = fakeClient([subscription]);
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));

    await expect(sendDeviceTestPush('admin-1', subscription.endpoint, client, send))
      .resolves.toEqual({ sent: 0, failed: 1, disabled: 1 });
    expect(updateEq).toHaveBeenCalledWith('id', subscription.id);
  });

  it('keeps a subscription active after a transient delivery failure', async () => {
    const { client, updateEq } = fakeClient([subscription]);
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('busy'), { statusCode: 503 }));

    await expect(sendDeviceTestPush('admin-1', subscription.endpoint, client, send))
      .resolves.toEqual({ sent: 0, failed: 1, disabled: 0 });
    expect(updateEq).not.toHaveBeenCalled();
  });
});
