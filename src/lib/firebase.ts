// @ts-nocheck
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// IMPORTANT: Replace this with your own Firebase project configuration!
// You can get this from the Firebase console:
// Project settings > General > Your apps > Web app > Firebase SDK snippet > Config
const firebaseConfig = {
  "projectId": "YOUR_PROJECT_ID",
  "appId": "YOUR_APP_ID",
  "storageBucket": "YOUR_STORAGE_BUCKET",
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_AUTH_DOMAIN",
  "measurementId": "YOUR_MEASUREMENT_ID",
  "messagingSenderId": "YOUR_MESSAGING_SENDER_ID"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
