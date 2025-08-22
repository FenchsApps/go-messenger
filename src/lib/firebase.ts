// @ts-nocheck
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// IMPORTANT: Replace this with your own Firebase project configuration!
// You can get this from the Firebase console:
// Project settings > General > Your apps > Web app > Firebase SDK snippet > Config
const firebaseConfig = {

  apiKey: "AIzaSyCJhbJ9Hx4ZzDneeSrPE-W1Hh7ifI1Ydxw",

  authDomain: "coo-messenger-dut4g.firebaseapp.com",

  projectId: "coo-messenger-dut4g",

  storageBucket: "coo-messenger-dut4g.firebasestorage.app",

  messagingSenderId: "289105120218",

  appId: "1:289105120218:web:0a828e96df9dc829edcee3"

};




const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);


// This enables offline persistence. It's best to call this only once.
try {
  enableMultiTabIndexedDbPersistence(db)
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.log('Firebase persistence failed: multiple tabs open.');
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence
         console.log('Firebase persistence failed: browser does not support it.');
      }
    });
} catch(e) {
    console.error("Firebase persistence error", e);
}


export { app, db, auth, storage };
