/**
 * Firebase Firestore — configuration only.
 * No Auth, Storage, Analytics, or Realtime Database — Firestore only.
 */
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAGXAdIIrqsx_5HLrkU3ilLb_H2OCLpnwk",
  authDomain: "homeblend-5192f.firebaseapp.com",
  projectId: "homeblend-5192f",
  storageBucket: "homeblend-5192f.firebasestorage.app",
  messagingSenderId: "753671088483",
  appId: "1:753671088483:web:cf91851c1714e1f23f4b56",
  measurementId: "G-RTN4JBPMET",
};

const app = initializeApp(firebaseConfig);

if (import.meta.env.DEV) {
  console.log("[HomeBlend] Firebase Firestore (projectId: homeblend-5192f)");
}

export { app, firebaseConfig };
