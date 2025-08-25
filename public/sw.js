
self.addEventListener('push', function(event) {
  const data = event.data.json();
  const { title, body, icon, url } = data;

  const options = {
    body: body,
    icon: icon,
    badge: '/favicon.ico', // A small badge icon
    data: {
      url: url // URL to open when notification is clicked
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // If a window for the app is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          // Check if the client is at the target URL already
          if (client.url !== new URL(urlToOpen, self.location.origin).href) {
            return client.navigate(urlToOpen).then(client => client.focus());
          }
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
