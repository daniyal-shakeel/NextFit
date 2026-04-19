import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

const AVATAR_FOLDER = 'nextfit/avatars';

let configApplied = false;

function getConfig(): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
  return null;
}

function ensureConfig(): boolean {
  if (configApplied) return true;
  const cfg = getConfig();
  if (cfg) {
    cloudinary.config({
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey,
      api_secret: cfg.apiSecret,
    });
    configApplied = true;
    return true;
  }
  return false;
}

export function isCloudinaryConfigured(): boolean {
  return getConfig() !== null;
}

export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string = AVATAR_FOLDER
): Promise<string | null> {
  if (!ensureConfig()) {
    console.warn('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env');
    return null;
  }

  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (err: Error | undefined, result: UploadApiResponse | undefined) => {
        if (err) {
          console.error('Cloudinary upload error:', err);
          resolve(null);
          return;
        }
        resolve(result?.secure_url ?? null);
      }
    );
    uploadStream.end(buffer);
  });
}
