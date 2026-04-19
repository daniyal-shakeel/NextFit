import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { MONGODB_ERROR_CODES, MONGODB_ERROR_NAMES } from '../constants/errorCodes.js';
import { getOrCreateAdminSettings } from '../services/adminSettingsService.js';

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function ensureArrayOfStrings(value: unknown, defaultVal: string[] = []): string[] {
  if (!Array.isArray(value)) return defaultVal;
  return value.filter((item): item is string => typeof item === 'string').map((s) => String(s).trim()).filter(Boolean);
}

function ensureNumber(value: unknown, min?: number, max?: number): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  if (min !== undefined && n < min) return null;
  if (max !== undefined && n > max) return null;
  return n;
}

function toProductResponse(p: {
  _id: unknown;
  name: string;
  slug: string;
  description: string;
  categoryId: unknown;
  basePrice: number;
  mainImageUrl: string;
  imageUrls?: string[];
  features?: string[];
  rating?: number;
  reviewCount?: number;
  isCustomizable?: boolean;
  tags?: string[];
  stockQuantity?: number;
  lowStockThreshold?: number;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: p._id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    categoryId: p.categoryId,
    basePrice: p.basePrice,
    mainImageUrl: p.mainImageUrl,
    imageUrls: p.imageUrls ?? [],
    features: p.features ?? [],
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    isCustomizable: p.isCustomizable ?? false,
    tags: p.tags ?? [],
    stockQuantity: p.stockQuantity ?? 0,
    lowStockThreshold: p.lowStockThreshold ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export const getFeaturedProducts = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const limit = 4;
    const tagged = await Product.find({ tags: { $exists: true, $ne: [] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('categoryId', 'name slug')
      .lean();
    const taggedIds = new Set(tagged.map((p) => p._id.toString()));
    const latest = await Product.find()
      .sort({ createdAt: -1 })
      .populate('categoryId', 'name slug')
      .lean();
    const combined: typeof latest = [];
    if (tagged.length > 0) {
      combined.push(tagged[0]);
    }
    for (const p of latest) {
      if (combined.length >= limit) break;
      if (!taggedIds.has(p._id.toString())) {
        combined.push(p);
      }
    }
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: combined.map(toProductResponse),
    });
  } catch (err) {
    console.error('getFeaturedProducts error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch featured products',
    });
  }
};

export const getProductsPublic = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { categoryId, categorySlug } = req.query;
    const filter: Record<string, unknown> = {};
    if (categoryId && typeof categoryId === 'string' && mongoose.isValidObjectId(categoryId)) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
    if (categorySlug && typeof categorySlug === 'string') {
      const Category = (await import('../models/Category.js')).default;
      const cat = await Category.findOne({ slug: categorySlug.trim() }).lean();
      if (cat) filter.categoryId = cat._id;
    }
    const products = await Product.find(filter).sort({ createdAt: -1 }).populate('categoryId', 'name slug').lean();
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: products.map(toProductResponse),
    });
  } catch (err) {
    console.error('getProductsPublic error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch products',
    });
  }
};

export const getProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { categoryId, limit: limitRaw, skip: skipRaw } = req.query;
    const filter: Record<string, unknown> = {};
    if (categoryId) {
      if (typeof categoryId !== 'string' || !mongoose.isValidObjectId(categoryId)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid categoryId query',
        });
      }
      filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    let limit: number | undefined;
    let skip = 0;
    if (limitRaw !== undefined && limitRaw !== '') {
      const n = Number(limitRaw);
      if (!Number.isFinite(n) || n < 1 || n > 500) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid limit query (use 1–500)',
        });
      }
      limit = Math.floor(n);
    }
    if (skipRaw !== undefined && skipRaw !== '') {
      const s = Number(skipRaw);
      if (!Number.isFinite(s) || s < 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid skip query',
        });
      }
      skip = Math.floor(s);
    }

    let productQuery = Product.find(filter).sort({ createdAt: -1 }).populate('categoryId', 'name slug');
    if (limit !== undefined) {
      productQuery = productQuery.skip(skip).limit(limit);
    }
    const products = await productQuery.lean();

    const payload: {
      success: boolean;
      data: ReturnType<typeof toProductResponse>[];
      total?: number;
      hasMore?: boolean;
    } = {
      success: true,
      data: products.map(toProductResponse),
    };

    if (limit !== undefined) {
      const total = await Product.countDocuments(filter);
      payload.total = total;
      payload.hasMore = skip + products.length < total;
    }

    return res.status(HTTP_STATUS.OK).json(payload);
  } catch (err) {
    console.error('getProducts error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch products',
    });
  }
};

export const getProductPublic = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    const product = await Product.findById(id).populate('categoryId', 'name slug').lean();
    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found',
      });
    }
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: toProductResponse(product),
    });
  } catch (err) {
    console.error('getProductPublic error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch product',
    });
  }
};

export const getProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    const product = await Product.findById(id).populate('categoryId', 'name slug').lean();
    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found',
      });
    }
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: toProductResponse(product),
    });
  } catch (err) {
    console.error('getProduct error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch product',
    });
  }
};

export const addProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const {
      name,
      description,
      categoryId,
      basePrice,
      mainImageUrl,
      imageUrls,
      features,
      tags,
      isCustomizable,
      rating,
      reviewCount,
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Product name is required',
      });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Product description is required',
      });
    }
    if (!categoryId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Category is required',
      });
    }
    if (!mongoose.isValidObjectId(categoryId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid category ID',
      });
    }
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Category not found',
      });
    }

    const price = ensureNumber(basePrice, 0);
    if (price === null) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Base price is required and must be a non-negative number',
      });
    }
    if (!mainImageUrl || typeof mainImageUrl !== 'string' || !mainImageUrl.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Main image URL is required',
      });
    }

    let slug = slugify(name);
    if (!slug) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Product name must contain at least one alphanumeric character',
      });
    }
    let existing = await Product.findOne({ slug });
    let suffix = 1;
    while (existing) {
      slug = `${slugify(name)}-${suffix}`;
      existing = await Product.findOne({ slug });
      suffix++;
      if (suffix > 1000) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Could not generate unique slug from name',
        });
      }
    }

    const adminDefaults = await getOrCreateAdminSettings();

    const product = await Product.create({
      name: name.trim(),
      slug,
      description: description.trim(),
      categoryId: new mongoose.Types.ObjectId(categoryId),
      basePrice: price,
      mainImageUrl: mainImageUrl.trim(),
      imageUrls: ensureArrayOfStrings(imageUrls),
      features: ensureArrayOfStrings(features),
      tags: ensureArrayOfStrings(tags),
      isCustomizable: Boolean(isCustomizable),
      rating: Math.min(5, Math.max(0, ensureNumber(rating, 0, 5) ?? 0)),
      reviewCount: Math.max(0, ensureNumber(reviewCount, 0) ?? 0),
      stockQuantity: adminDefaults.defaultStockQuantity,
      lowStockThreshold: adminDefaults.defaultLowStockThreshold,
    });

    await Category.findByIdAndUpdate(categoryId, { $inc: { productCount: 1 } });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        categoryId: product.categoryId,
        basePrice: product.basePrice,
        mainImageUrl: product.mainImageUrl,
        imageUrls: product.imageUrls,
        features: product.features,
        tags: product.tags,
        rating: product.rating,
        reviewCount: product.reviewCount,
        isCustomizable: product.isCustomizable,
        stockQuantity: product.stockQuantity ?? 0,
        lowStockThreshold: product.lowStockThreshold ?? 0,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; name?: string; errors?: Record<string, { message?: string }> };
    if (mongoErr.code === MONGODB_ERROR_CODES.DUPLICATE_KEY || mongoErr.name === MONGODB_ERROR_NAMES.MONGO_SERVER_ERROR) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'A product with this slug already exists',
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
    console.error('addProduct error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create product',
    });
  }
};


export const updateProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (!req.body || typeof req.body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const {
      name,
      description,
      categoryId,
      basePrice,
      mainImageUrl,
      imageUrls,
      features,
      tags,
      isCustomizable,
      rating,
      reviewCount,
      stockQuantity,
      lowStockThreshold,
    } = req.body;

    const oldCategoryId = product.categoryId?.toString();

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Product name must be a non-empty string',
        });
      }
      const trimmedName = name.trim();
      const nameChanged = trimmedName !== product.name;
      product.name = trimmedName;
      if (nameChanged) {
        const newSlug = slugify(trimmedName);
        if (newSlug) {
          const existing = await Product.findOne({
            slug: newSlug,
            _id: { $ne: product._id },
          });
          if (existing) {
            return res.status(HTTP_STATUS.CONFLICT).json({
              success: false,
              message: 'A product with this name (slug) already exists',
            });
          }
          product.slug = newSlug;
        }
      }
    }
    if (description !== undefined) {
      if (typeof description !== 'string') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Description must be a string',
        });
      }
      product.description = description.trim();
    }
    if (categoryId !== undefined) {
      if (!mongoose.isValidObjectId(categoryId)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid category ID',
        });
      }
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Category not found',
        });
      }
      product.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
    if (basePrice !== undefined) {
      const price = ensureNumber(basePrice, 0);
      if (price === null) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Base price must be a non-negative number',
        });
      }
      product.basePrice = price;
    }
    if (mainImageUrl !== undefined) {
      if (typeof mainImageUrl !== 'string' || !mainImageUrl.trim()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Main image URL must be a non-empty string',
        });
      }
      product.mainImageUrl = mainImageUrl.trim();
    }
    if (imageUrls !== undefined) product.imageUrls = ensureArrayOfStrings(imageUrls);
    if (features !== undefined) product.features = ensureArrayOfStrings(features);
    if (tags !== undefined) product.tags = ensureArrayOfStrings(tags);
    if (isCustomizable !== undefined) product.isCustomizable = Boolean(isCustomizable);
    if (rating !== undefined) {
      const r = ensureNumber(rating, 0, 5);
      if (r !== null) product.rating = r;
    }
    if (reviewCount !== undefined) {
      const rc = ensureNumber(reviewCount, 0);
      if (rc !== null) product.reviewCount = rc;
    }
    if (stockQuantity !== undefined) {
      const sq = ensureNumber(stockQuantity, 0);
      if (sq !== null) product.stockQuantity = sq;
    }
    if (lowStockThreshold !== undefined) {
      const lst = ensureNumber(lowStockThreshold, 0);
      if (lst !== null) product.lowStockThreshold = lst;
    }

    await product.save();

    const newCategoryId = product.categoryId?.toString();
    if (oldCategoryId && newCategoryId && oldCategoryId !== newCategoryId) {
      await Category.findByIdAndUpdate(oldCategoryId, { $inc: { productCount: -1 } });
      await Category.findByIdAndUpdate(newCategoryId, { $inc: { productCount: 1 } });
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Product updated successfully',
      data: {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        categoryId: product.categoryId,
        basePrice: product.basePrice,
        mainImageUrl: product.mainImageUrl,
        imageUrls: product.imageUrls,
        features: product.features,
        tags: product.tags,
        rating: product.rating,
        reviewCount: product.reviewCount,
        isCustomizable: product.isCustomizable,
        stockQuantity: product.stockQuantity ?? 0,
        lowStockThreshold: product.lowStockThreshold ?? 0,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; name?: string; errors?: Record<string, { message?: string }> };
    if (mongoErr.code === MONGODB_ERROR_CODES.DUPLICATE_KEY || mongoErr.name === MONGODB_ERROR_NAMES.MONGO_SERVER_ERROR) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'A product with this slug already exists',
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
    console.error('updateProduct error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update product',
    });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid product ID',
      });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found',
      });
    }
    const categoryId = product.categoryId?.toString();
    await product.deleteOne();
    if (categoryId) {
      await Category.findByIdAndUpdate(categoryId, { $inc: { productCount: -1 } });
    }
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (err) {
    console.error('deleteProduct error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete product',
    });
  }
};
