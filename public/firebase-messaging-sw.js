// Scripts for firebase and firebase messaging
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJhbJ9Hx4ZzDneeSrPE-W1Hh7ifI1Ydxw",
  authDomain: "coo-messenger-dut4g.firebaseapp.com",
  projectId: "coo-messenger-dut4g",
  storageBucket: "coo-messenger-dut4g.appspot.com",
  messagingSenderId: "289105120218",
  appId: "1:289105120218:web:0a828e96df9cee3"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: payload.data.icon,
    data: {
        url: payload.data.url
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const urlToOpen = event.notification.data.url || '/';
    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url == urlToOpen && 'focus' in client)
                    return client.focus();
            }
            if (clients.openWindow)
                return clients.openWindow(urlToOpen);
        })
    );
});
