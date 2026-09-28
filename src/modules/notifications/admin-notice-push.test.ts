import { describe, expect, it, vi } from 'vitest';
import { notifyAdminsAboutNotices } from './admin-notice-push';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: mocks.createClient }));

const activeSubscription = {
  id: 'sub-1', endpoint: 'https://push.example/1', p256dh: 'key', auth: 'auth',
};

function fakeClient() {
  const admins = { select: vi.fn(), eq: vi.fn() };
  admins.select.mockReturnValue(admins);
  admins.eq.mockReturnValueOnce(admins).mockResolvedValueOnce({ data: [{ id: 'admin-1' }], error: null });
  const subscriptions = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), update: vi.fn() };
  subscriptions.select.mockReturnValue(subscriptions);
  subscriptions.eq.mockReturnValue(subscriptions);
  subscriptions.in.mockResolvedValue({ data: [activeSubscription], error: null });
  subscriptions.update.mockReturnValue(subscriptions);
  const from = vi.fn().mockReturnValueOnce(admins).mockReturnValue(subscriptions);
  mocks.createClient.mockReturnValue({ from });
  return { admins, subscriptions, from };
}

describe('notifyAdminsAboutNotices', () => {
  it('targets only active admin subscriptions with the notifications destination', async () => {
    const { admins, subscriptions } = fakeClient();
    const send = vi.fn().mockResolvedValue(undefined);
    await notifyAdminsAboutNotices('Un aviso requiere atención', undefined, send);
    expect(admins.eq).toHaveBeenCalledWith('role', 'admin');
    expect(admins.eq).toHaveBeenCalledWith('active', true);
    expect(subscriptions.in).toHaveBeenCalledWith('user_id', ['admin-1']);
    expect(send).toHaveBeenCalledWith(activeSubscription, expect.objectContaining({
      kind: 'whatsapp_notice', destination: '/notificaciones', body: 'Un aviso requiere atención',
    }));
  });

  it('isolates a delivery failure from other admin devices', async () => {
    const { subscriptions } = fakeClient();
    subscriptions.in.mockResolvedValue({ data: [activeSubscription, { ...activeSubscription, id: 'sub-2' }], error: null });
    const send = vi.fn().mockRejectedValueOnce(new Error('delivery failed')).mockResolvedValueOnce(undefined);
    await expect(notifyAdminsAboutNotices('Aviso', undefined, send)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('skips delivery when there are no active admins', async () => {
    const { admins, from } = fakeClient();
    admins.eq.mockReset().mockReturnValueOnce(admins).mockResolvedValueOnce({ data: [], error: null });
    const send = vi.fn();
    await notifyAdminsAboutNotices('Aviso', undefined, send);
    expect(from).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('disables an expired subscription after a 410 response', async () => {
    const { subscriptions } = fakeClient();
    const error = Object.assign(new Error('expired'), { statusCode: 410 });
    const send = vi.fn().mockRejectedValue(error);
    await notifyAdminsAboutNotices('Aviso', undefined, send);
    expect(subscriptions.update).toHaveBeenCalledWith({ enabled: false });
  });
});
