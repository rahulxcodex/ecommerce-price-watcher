// Service Worker for PriceWatcher In-Browser Instant Push Notifications
self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || '📉 PriceWatcher Alert!';
    const options = {
      body: data.body || 'A product in your watchlist dropped in price!',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
      },
      actions: [
        { action: 'open_url', title: 'View Deal' },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Failed to parse push data:', err);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
