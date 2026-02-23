/**
 * Firebase client config for Phone Auth (Pakistan +92 only)
 */
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'REDACTED',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'REDACTED',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'REDACTED',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'REDACTED',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'REDACTED',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'REDACTED',
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0] as FirebaseApp;
}

export const firebaseApp = app;
export const auth: Auth = getAuth(app);
