// Import and configure the Firebase SDK
// It's important to include this file in the public directory of your project.
// Otherwise, the service worker will not be able to intercept requests.
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJhbJ9Hx4ZzDneeSrPE-W1Hh7ifI1Ydxw",
  authDomain: "coo-messenger-dut4g.firebaseapp.com",
  projectId: "coo-messenger-dut4g",
  storageBucket: "coo-messenger-dut4g.appspot.com",
  messagingSenderId: "289105120218",
  appId: "1:289105120218:web:0a828e96df9cee3"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/favicon.ico',
    data: {
        url: payload.data.url // Pass the URL from the data payload
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    const urlToOpen = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(function(clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                client.focus();
                return client.navigate(urlToOpen);
            }
            return clients.openWindow(urlToOpen);
        })
    );
});
