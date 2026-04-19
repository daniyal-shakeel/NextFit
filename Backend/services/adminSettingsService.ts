import AdminSettings from '../models/AdminSettings.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

export async function getOrCreateAdminSettings() {
  let doc = await AdminSettings.findOne({});
  if (!doc) {
    doc = await AdminSettings.create({});
  }
  return doc;
}

export async function getShippingForSubtotal(subtotal: number): Promise<{ shipping: number }> {
  const doc = await getOrCreateAdminSettings();
  const r = Number(doc.shippingRate);
  const rate = Number.isFinite(r) ? Math.max(0, r) : 10;
  const th = Number(doc.freeShippingMinSubtotal);
  const threshold = Number.isFinite(th) ? Math.max(0, th) : 100;
  const shipping = subtotal >= threshold ? 0 : rate;
  return { shipping };
}

export function getPublicIntegrationStatus() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const smtpHost = process.env.SMTP_HOST || (nodeEnv === 'development' ? 'localhost' : '');
  return {
    jwtSecretConfigured: Boolean(process.env.JWT_SECRET && String(process.env.JWT_SECRET).length > 0),
    adminEnvLoginConfigured: Boolean(
      process.env.ADMIN_EMAIL?.trim() && process.env.ADMIN_PASSWORD !== undefined && process.env.ADMIN_PASSWORD !== ''
    ),
    mongodbUriSet: Boolean(process.env.MONGODB_URI?.trim()),
    cloudinaryConfigured: isCloudinaryConfigured(),
    firebaseConfigured: Boolean(
      (process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ?? '') !== '' ||
        (process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ?? '') !== ''
    ),
    aiServiceConfigured: Boolean(process.env.NEXTFIT_ADMIN_CONSOLE_API_KEY_GROQ?.trim()),
    virtualTryOnConfigured: Boolean(process.env.MODAL_AI_URL?.trim()),
    emailSmtpHostConfigured: Boolean(smtpHost),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
    adminUrl: process.env.ADMIN_URL || 'http://localhost:5173',
    nodeEnv,
  };
}
