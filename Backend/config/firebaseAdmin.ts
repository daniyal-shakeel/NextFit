/**
 * Firebase Admin SDK for verifying phone auth ID tokens (Pakistan +92 only)
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let initialized = false;

export function getFirebaseAdmin(): admin.app.App {
  if (!admin.apps.length) {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
      throw new Error(
        'Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (JSON string) or FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file).'
      );
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
  }
  return admin.app();
}

function getServiceAccount(): admin.ServiceAccount | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      return JSON.parse(json) as admin.ServiceAccount;
    } catch {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON');
      return null;
    }
  }
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (pathEnv) {
    try {
      const resolved = resolve(process.cwd(), pathEnv);
      const data = JSON.parse(readFileSync(resolved, 'utf8'));
      return data as admin.ServiceAccount;
    } catch (err) {
      console.error('Failed to load Firebase service account from path:', err);
      return null;
    }
  }
  return null;
}

export function isFirebaseAdminInitialized(): boolean {
  return initialized || admin.apps.length > 0;
}
