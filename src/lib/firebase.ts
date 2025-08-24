
// @ts-nocheck
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

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

// In-App Messaging is initialized automatically by the Firebase SDK.
// We provide a wrapper function that can be called from client components
// to ensure code depending on it runs, but it doesn't need to do anything.
const getInAppMessaging = async () => {
    if (typeof window !== 'undefined') {
        // FIAM initializes automatically. This function is just a placeholder
        // to ensure client-side execution context for components that use it.
        return Promise.resolve(null);
    }
    return Promise.resolve(null);
};


export { app, db, auth, storage, getInAppMessaging };
