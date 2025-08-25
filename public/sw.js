
self.addEventListener("push", (event) => {
  const data = event.data.json();
  const { title, body, icon, data: notificationData } = data;

  const options = {
    body: body,
    icon: icon,
    badge: '/icons/icon-96x96.png',
    data: notificationData
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
                client = clientList[i];
            }
        }
        if (client) {
            client.navigate(urlToOpen);
            client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
