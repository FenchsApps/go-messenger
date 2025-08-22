// @ts-nocheck
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "coo-messenger-dut4g",
  "appId": "1:289105120218:web:0a828e96df9dc829edcee3",
  "storageBucket": "coo-messenger-dut4g.firebasestorage.app",
  "apiKey": "AIzaSyCJhbJ9Hx4ZzDneeSrPE-W1Hh7ifI1Ydxw",
  "authDomain": "coo-messenger-dut4g.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "289105120218"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
