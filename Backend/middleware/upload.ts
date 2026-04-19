import multer from 'multer';
import { HTTP_STATUS } from '../constants/errorCodes.js';

const AVATAR_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const CATEGORY_IMAGE_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const CATEGORY_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const memoryStorage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Use JPEG, PNG, GIF, or WebP.'));
  }
  cb(null, true);
};

export const avatarUploadMulter = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: AVATAR_MAX_SIZE },
});

const categoryImageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (!CATEGORY_ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Use JPEG, PNG, or WebP.'));
  }
  cb(null, true);
};

export const categoryImageUploadMulter = multer({
  storage: memoryStorage,
  fileFilter: categoryImageFileFilter,
  limits: { fileSize: CATEGORY_IMAGE_MAX_SIZE },
});

export function handleMulterError(
  err: unknown,
  res: { status: (n: number) => { json: (o: object) => void } }
) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Avatar must be 10MB or smaller',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid file. Use a single image (JPEG, PNG, GIF, or WebP).',
      });
    }
  }
  return res.status(HTTP_STATUS.BAD_REQUEST).json({
    success: false,
    message: err instanceof Error ? err.message : 'Upload failed',
  });
}

export function handleCategoryImageMulterError(
  err: unknown,
  res: { status: (n: number) => { json: (o: object) => void } }
) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Image must be 2MB or smaller',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid file. Use a single image (JPEG, PNG, or WebP).',
      });
    }
  }
  return res.status(HTTP_STATUS.BAD_REQUEST).json({
    success: false,
    message: err instanceof Error ? err.message : 'Upload failed',
  });
}
