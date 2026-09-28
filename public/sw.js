self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter((key) => key.startsWith('movietime-'))
        .map((key) => caches.delete(key)));
    } catch {
      // Cache Storage can be unavailable; push activation must still complete.
    }
    await self.clients.claim();
  })());
});

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
    if (payload.kind === 'whatsapp_message' || payload.kind === 'push_test') {
      await self.registration.showNotification(String(payload.title || 'MovieTime PTY'), {
        body: String(payload.body || 'Nuevo mensaje'),
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: payload.kind === 'whatsapp_message'
          ? `whatsapp-message:${toSameOriginPath(payload.destination, '/chats')}`
          : 'push_test',
        renotify: true,
        data: { url: toSameOriginPath(payload.destination, payload.kind === 'whatsapp_message' ? '/chats' : '/dashboard') },
      });
      return;
    }
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

// Solo se navega a rutas internas: un destino externo o malformado vuelve al valor por defecto.
function toSameOriginPath(destination, fallback) {
  return typeof destination === 'string' && destination.startsWith('/') && !destination.startsWith('//')
    ? destination
    : fallback;
}

function eventDataToJson(event) {
  if (!event || !event.data) {
    throw new Error('Missing push payload.');
  }
  return event.data.json();
}
