import { afterEach, describe, expect, it, vi } from 'vitest';

type WorkerEvent = {
  data?: { json: () => unknown };
  waitUntil: (promise: Promise<unknown>) => void;
};

async function loadServiceWorker() {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const claim = vi.fn().mockResolvedValue(undefined);
  const deleteCache = vi.fn().mockResolvedValue(true);
  vi.stubGlobal('self', {
    addEventListener: (name: string, listener: (event: WorkerEvent) => void) => listeners.set(name, listener),
    skipWaiting: vi.fn(),
    registration: { showNotification },
    clients: { claim },
  });
  vi.stubGlobal('caches', {
    keys: vi.fn().mockResolvedValue(['movietime-offline-v1', 'unrelated-cache']),
    delete: deleteCache,
  });
  vi.resetModules();
  const workerPath = '../../../public/sw.js';
  await import(workerPath);
  return { listeners, showNotification, claim, deleteCache };
}

async function dispatchWorkerEvent(listener: (event: WorkerEvent) => void, data?: unknown) {
  let pending: Promise<unknown> | undefined;
  listener({
    ...(data === undefined ? {} : { data: { json: () => data } }),
    waitUntil: (promise) => { pending = promise; },
  });
  await pending;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('push service worker', () => {
  it('shows the device test even without executive summary blocks', async () => {
    const { listeners, showNotification } = await loadServiceWorker();
    await dispatchWorkerEvent(listeners.get('push')!, {
      kind: 'push_test',
      title: 'Prueba de notificaciones',
      body: 'MovieTime puede enviarte avisos en este dispositivo.',
      destination: '/dashboard',
    });

    expect(showNotification).toHaveBeenCalledWith('Prueba de notificaciones', expect.objectContaining({
      body: 'MovieTime puede enviarte avisos en este dispositivo.',
      tag: 'push_test',
      data: { url: '/dashboard' },
    }));
  });

  it('shows incoming customer messages and opens their chat', async () => {
    const { listeners, showNotification } = await loadServiceWorker();
    await dispatchWorkerEvent(listeners.get('push')!, {
      kind: 'whatsapp_message',
      title: 'WhatsApp: Cliente',
      body: 'Hola',
      destination: '/chats?wa=50760000000',
    });

    expect(showNotification).toHaveBeenCalledWith('WhatsApp: Cliente', expect.objectContaining({
      body: 'Hola',
      tag: 'whatsapp-message:/chats?wa=50760000000',
      data: { url: '/chats?wa=50760000000' },
    }));
  });

  it('shows admin notice alerts and opens notifications', async () => {
    const { listeners, showNotification } = await loadServiceWorker();
    await dispatchWorkerEvent(listeners.get('push')!, {
      kind: 'whatsapp_notice', title: 'Avisos de WhatsApp',
      body: 'Un cliente no desea continuar', destination: '/notificaciones',
    });
    expect(showNotification).toHaveBeenCalledWith('Avisos de WhatsApp', expect.objectContaining({
      tag: 'whatsapp-notice', data: { url: '/notificaciones' },
    }));
  });

  it('removes retired offline caches when the new worker activates', async () => {
    const { listeners, claim, deleteCache } = await loadServiceWorker();
    await dispatchWorkerEvent(listeners.get('activate')!);

    expect(deleteCache).toHaveBeenCalledExactlyOnceWith('movietime-offline-v1');
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it('keeps push activation working if retired cache cleanup fails', async () => {
    const { listeners, claim } = await loadServiceWorker();
    vi.stubGlobal('caches', { keys: vi.fn().mockRejectedValue(new Error('storage unavailable')) });

    await expect(dispatchWorkerEvent(listeners.get('activate')!)).resolves.toBeUndefined();
    expect(claim).toHaveBeenCalledTimes(1);
  });
});
