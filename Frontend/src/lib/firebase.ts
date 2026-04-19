import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const appName = `nextfit-${String(import.meta.env.VITE_FIREBASE_PROJECT_ID || 'default')}`;

let app: FirebaseApp;
const existing = getApps().find((a) => a.name === appName);
if (existing) {
  app = existing as FirebaseApp;
} else {
  app = initializeApp(firebaseConfig, appName);
}

export const firebaseApp = app;
export const auth: Auth = getAuth(app);