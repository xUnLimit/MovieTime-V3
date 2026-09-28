import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());

vi.mock('@/platform/supabase/client', () => ({
  supabase: { auth: { getSession } },
}));

import { triggerDevicePushTest } from './push-client';

describe('triggerDevicePushTest', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends valid JSON for the current browser subscription', async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve({
          endpoint: 'https://push.example/current-device',
        }) } }),
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { sent: 1, failed: 0, disabled: 0 },
      requestId: 'request-1',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(triggerDevicePushTest()).resolves.toEqual({ sent: 1, failed: 0, disabled: 0 });
    expect(fetchMock).toHaveBeenCalledWith('/api/push/test', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ endpoint: 'https://push.example/current-device' }),
    }));
  });

  it('explains when Safari no longer has a push subscription', async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(null) } }),
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(triggerDevicePushTest()).rejects.toThrow('no tiene una suscripción push');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
