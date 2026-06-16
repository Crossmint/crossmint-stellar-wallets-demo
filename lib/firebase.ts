/**
 * Firebase initialization (web).
 *
 * This app authenticates users via Firebase (configured as a 3P auth provider
 * on the Crossmint project, verifier claim `sub`). The Firebase ID token is
 * bridged into Crossmint by the auth provider via useCrossmint().setJwt().
 *
 * Web uses Firebase's default browserLocalPersistence, so users stay signed in
 * across reloads with no extra setup.
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { app };
