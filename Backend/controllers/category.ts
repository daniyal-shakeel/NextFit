import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { MONGODB_ERROR_CODES, MONGODB_ERROR_NAMES } from '../constants/errorCodes.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function isValidCloudinaryUrl(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const s = raw.trim();
  if (!s || s.length > 2000) return false;
  if (s.startsWith('data:')) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return u.hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
}

export const getCategories = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 }).lean();
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: categories.map((c) => ({
        id: c._id,
        name: c.name,
        slug: c.slug,
        imageUrl: c.imageUrl,
        description: c.description,
        productCount: c.productCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err) {
    console.error('getCategories error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
};

export const getCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid category ID',
      });
    }
    const category = await Category.findById(id).lean();
    if (!category) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Category not found',
      });
    }
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        description: category.description,
        productCount: category.productCount,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  } catch (err) {
    console.error('getCategory error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch category',
    });
  }
};

export const addCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const { name, imageUrl, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Category name is required',
      });
    }

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Category image URL is required',
      });
    }
    if (!isValidCloudinaryUrl(imageUrl)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid image. Please upload via the admin panel.',
      });
    }

    const slug = slugify(name);
    if (!slug) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Category name must contain at least one alphanumeric character',
      });
    }

    const category = await Category.create({
      name: name.trim(),
      slug,
      imageUrl: imageUrl.trim(),
      description: typeof description === 'string' ? description.trim() : '',
    });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Category created successfully',
      data: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        description: category.description,
        productCount: category.productCount,
        createdAt: category.createdAt,
      },
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; name?: string; errors?: Record<string, { message?: string }> };
    if (mongoErr.code === MONGODB_ERROR_CODES.DUPLICATE_KEY || mongoErr.name === MONGODB_ERROR_NAMES.MONGO_SERVER_ERROR) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'A category with this name or slug already exists',
      });
    }
    if (mongoErr.name === MONGODB_ERROR_NAMES.VALIDATION_ERROR && mongoErr.errors) {
      const messages = Object.values(mongoErr.errors).map((e) => e?.message).filter(Boolean);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: messages[0] ?? 'Validation error',
        errors: messages,
      });
    }
    console.error('addCategory error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create category',
    });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid category ID',
      });
    }
    const category = await Category.findById(id);
    if (!category) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Category not found',
      });
    }
    const { name, imageUrl, description } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Category name must be a non-empty string',
        });
      }
      category.name = name.trim();
      category.slug = slugify(name);
    }
    if (imageUrl !== undefined) {
      if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Category image URL must be a non-empty string',
        });
      }
      if (!isValidCloudinaryUrl(imageUrl)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid image. Please upload via the admin panel.',
        });
      }
      category.imageUrl = imageUrl.trim();
    }
    if (description !== undefined) {
      category.description = typeof description === 'string' ? description.trim() : '';
    }
    await category.save();
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Category updated successfully',
      data: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        description: category.description,
        productCount: category.productCount,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; name?: string; errors?: Record<string, { message?: string }> };
    if (mongoErr.code === MONGODB_ERROR_CODES.DUPLICATE_KEY || mongoErr.name === MONGODB_ERROR_NAMES.MONGO_SERVER_ERROR) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'A category with this name or slug already exists',
      });
    }
    if (mongoErr.name === MONGODB_ERROR_NAMES.VALIDATION_ERROR && mongoErr.errors) {
      const messages = Object.values(mongoErr.errors).map((e) => e?.message).filter(Boolean);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: messages[0] ?? 'Validation error',
        errors: messages,
      });
    }
    console.error('updateCategory error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update category',
    });
  }
};

export const uploadCategoryImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file || !file.buffer) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'No image file provided. Upload a JPEG, PNG, or WebP (max 2MB).',
      });
    }
    const url = await uploadToCloudinary(file.buffer, 'nextfit/categories');
    if (!url) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'Image upload is temporarily unavailable. Please try again later.',
      });
    }
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { imageUrl: url },
    });
  } catch (err) {
    console.error('uploadCategoryImage error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to upload image',
    });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid category ID',
      });
    }
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Category not found',
      });
    }
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (err) {
    console.error('deleteCategory error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete category',
    });
  }
};
