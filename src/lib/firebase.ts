
// @ts-nocheck
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging, onMessage } from 'firebase/messaging';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJhbJ9Hx4ZzDneeSrPE-W1Hh7ifI1Ydxw",
  authDomain: "coo-messenger-dut4g.firebaseapp.com",
  projectId: "coo-messenger-dut4g",
  storageBucket: "coo-messenger-dut4g.appspot.com",
  messagingSenderId: "289105120218",
  appId: "1:289105120218:web:0a828e96df9cee3"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Initialize Firebase Cloud Messaging and get a reference to the service
const getMessagingInstance = () => {
    if (typeof window !== 'undefined' && getApps().length > 0) {
        return getMessaging(app);
    }
    return null;
}

const messaging = getMessagingInstance();

if (messaging) {
    onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        const { title, body, icon, url } = payload.data;
        const notification = new Notification(title, {
            body: body,
            icon: icon
        });

        notification.onclick = () => {
             // Use the provided URL or fallback to the origin
            window.open(url || window.location.origin, '_blank');
        };
    });
}


// This enables offline persistence. It's best to call this only once.
try {
    if (typeof window !== 'undefined') {
        enableMultiTabIndexedDbPersistence(db)
            .catch((err) => {
              if (err.code === 'failed-precondition') {
                console.log('Firebase persistence failed: multiple tabs open.');
              } else if (err.code === 'unimplemented') {
                 console.log('Firebase persistence failed: browser does not support it.');
              }
            });
    }
} catch(e) {
    console.error("Firebase persistence error", e);
}


export { app, db, auth, storage, messaging, getMessaging, onMessage };
