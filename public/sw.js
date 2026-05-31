const CACHE_NAME = 'movietime-pwa-v7';
const NEXT_ASSET_PREFIX = '/_next/';
const API_PREFIX = '/api/';
const APP_SHELL = [
  '/',
  '/login',
  '/dashboard',
  '/terceros',
  '/servicios',
  '/ventas',
  '/notificaciones',
  '/categorias',
  '/metodos-pago',
  '/gastos',
  '/reposo',
  '/editor-mensajes',
  '/log-actividad',
  '/offline',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          APP_SHELL.map((url) =>
            fetch(url, { cache: 'reload' }).then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
              return undefined;
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isNextAppRouterRequest(request, url)) {
    return;
  }

  if (url.pathname.startsWith(NEXT_ASSET_PREFIX) || url.pathname.startsWith(API_PREFIX)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          const cachedPath = await caches.match(url.pathname);
          const offlineFallback = await caches.match('/offline');
          const rootShell = await caches.match('/');
          return cached || cachedPath || offlineFallback || rootShell;
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

function isNextAppRouterRequest(request, url) {
  const accept = request.headers.get('accept') || '';
  return (
    url.searchParams.has('_rsc') ||
    request.headers.get('rsc') === '1' ||
    request.headers.has('next-router-prefetch') ||
    accept.includes('text/x-component')
  );
}

self.addEventListener('push', (event) => {
  event.waitUntil(handlePushEvent(event));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    })
  );
});

async function handlePushEvent(event) {
  try {
    const payload = eventDataToJson(event);
    if (!Array.isArray(payload.blocks) || payload.blocks.length === 0) {
      return;
    }

    await self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.kind || 'executive-daily-summary',
      data: {
        url: payload.destinationWithQuery || payload.destination || '/dashboard',
      },
    });
  } catch {
    await self.registration.showNotification('MovieTime PTY', {
      body: 'Tienes un resumen operativo pendiente.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: '/dashboard' },
    });
  }
}

function eventDataToJson(event) {
  if (!event || !event.data) {
    throw new Error('Missing push payload.');
  }
  return event.data.json();
}
