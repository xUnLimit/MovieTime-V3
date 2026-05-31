import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

function loadServiceWorkerFetchHandler() {
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
    match: vi.fn().mockResolvedValue(undefined),
  };

  vm.runInNewContext(script, {
    self: serviceWorkerScope,
    caches: {
      delete: vi.fn(),
      keys: vi.fn(),
      match: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(cache),
    },
    fetch: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    Promise,
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
});
