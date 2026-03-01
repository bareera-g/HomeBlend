/**
 * Firebase Firestore — configuration only (matches web app).
 * No Auth, Storage, Analytics — Firestore only.
 */
import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyAGXAdIIrqsx_5HLrkU3ilLb_H2OCLpnwk',
  authDomain: 'homeblend-5192f.firebaseapp.com',
  projectId: 'homeblend-5192f',
  storageBucket: 'homeblend-5192f.firebasestorage.app',
  messagingSenderId: '753671088483',
  appId: '1:753671088483:web:cf91851c1714e1f23f4b56',
  measurementId: 'G-RTN4JBPMET',
};

// Prevent duplicate initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export { app, firebaseConfig };
