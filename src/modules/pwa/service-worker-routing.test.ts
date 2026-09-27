import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

function loadServiceWorkerFetchHandler({
  fetchResult = Promise.resolve(new Response(null, { status: 204 })),
  matchResult,
  matchRejection,
}: {
  fetchResult?: Promise<Response>;
  matchResult?: Response;
  matchRejection?: Error;
} = {}) {
  const listeners = new Map<string, EventListener>();
  const script = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');
  const serviceWorkerScope = {
    location: { origin: 'https://app.movietime.test' },
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener);
    }),
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn(),
      openWindow: vi.fn(),
    },
    registration: {
      showNotification: vi.fn(),
    },
  };
  const cache = {
    put: vi.fn(),
    match: vi.fn().mockResolvedValue(matchResult),
  };
  const cachesMatch = matchRejection
    ? vi.fn().mockRejectedValue(matchRejection)
    : vi.fn().mockResolvedValue(matchResult);

  vm.runInNewContext(script, {
    self: serviceWorkerScope,
    caches: {
      delete: vi.fn(),
      keys: vi.fn(),
      match: cachesMatch,
      open: vi.fn().mockResolvedValue(cache),
    },
    fetch: vi.fn(() => fetchResult),
    Promise,
    Response,
    URL,
  });

  const fetchHandler = listeners.get('fetch');
  if (!fetchHandler) {
    throw new Error('Service worker fetch handler was not registered.');
  }

  return fetchHandler;
}

describe('service worker routing', () => {
  it('does not cache or answer Next App Router RSC requests', () => {
    const fetchHandler = loadServiceWorkerFetchHandler();
    const event = {
      request: new Request('https://app.movietime.test/dashboard?_rsc=abc123', {
        headers: {
          accept: 'text/x-component',
          rsc: '1',
        },
      }),
      respondWith: vi.fn(),
    };

    fetchHandler(event as unknown as Event);

    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('always returns a Response when a navigation fails without a cached fallback', async () => {
    const fetchHandler = loadServiceWorkerFetchHandler({
      fetchResult: Promise.reject(new TypeError('Network unavailable')),
    });
    let responsePromise: Promise<Response> | undefined;
    const event = {
      request: {
        headers: new Headers(),
        method: 'GET',
        mode: 'navigate',
        url: 'https://app.movietime.test/ventas/venta-1',
      },
      respondWith: vi.fn((promise: Promise<Response>) => {
        responsePromise = promise;
      }),
    };

    fetchHandler(event as unknown as Event);

    await expect(responsePromise).resolves.toEqual(expect.any(Response));
    await expect(responsePromise).resolves.toMatchObject({ status: 503 });
  });

  it('uses the cached navigation fallback when the network fails', async () => {
    const cachedResponse = new Response('cached', { status: 200 });
    const fetchHandler = loadServiceWorkerFetchHandler({
      fetchResult: Promise.reject(new TypeError('Network unavailable')),
      matchResult: cachedResponse,
    });
    let responsePromise: Promise<Response> | undefined;
    const event = {
      request: {
        headers: new Headers(),
        method: 'GET',
        mode: 'navigate',
        url: 'https://app.movietime.test/ventas/venta-1',
      },
      respondWith: vi.fn((promise: Promise<Response>) => {
        responsePromise = promise;
      }),
    };

    fetchHandler(event as unknown as Event);

    await expect(responsePromise).resolves.toBe(cachedResponse);
  });

  it('falls back to the offline response when the network fails and cache lookup throws', async () => {
    const fetchHandler = loadServiceWorkerFetchHandler({
      fetchResult: Promise.reject(new TypeError('Network unavailable')),
      matchRejection: new Error('Cache storage unavailable'),
    });
    let responsePromise: Promise<Response> | undefined;
    const event = {
      request: {
        headers: new Headers(),
        method: 'GET',
        mode: 'navigate',
        url: 'https://app.movietime.test/chats?wa=1234567890',
      },
      respondWith: vi.fn((promise: Promise<Response>) => {
        responsePromise = promise;
      }),
    };

    fetchHandler(event as unknown as Event);

    await expect(responsePromise).resolves.toEqual(expect.any(Response));
    await expect(responsePromise).resolves.toMatchObject({ status: 503 });
  });

  it('falls back to the network when cache lookup throws for a non-navigation request', async () => {
    const networkResponse = new Response('asset', { status: 200 });
    const fetchHandler = loadServiceWorkerFetchHandler({
      fetchResult: Promise.resolve(networkResponse),
      matchRejection: new Error('Cache storage unavailable'),
    });
    let responsePromise: Promise<Response> | undefined;
    const event = {
      request: {
        headers: new Headers(),
        method: 'GET',
        mode: 'no-cors',
        url: 'https://app.movietime.test/icon-192.png',
      },
      respondWith: vi.fn((promise: Promise<Response>) => {
        responsePromise = promise;
      }),
    };

    fetchHandler(event as unknown as Event);

    await expect(responsePromise).resolves.toBe(networkResponse);
  });
});
