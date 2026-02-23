import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/inventory
 * List all products with stock info. Requires inventory.read.
 */
export const list = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const products = await Product.find({})
      .sort({ name: 1 })
      .populate('categoryId', 'name slug')
      .lean();

    const data = products.map((p) => ({
      id: p._id,
      name: p.name,
      slug: p.slug,
      categoryId: p.categoryId,
      basePrice: p.basePrice,
      mainImageUrl: p.mainImageUrl,
      stockQuantity: p.stockQuantity ?? 0,
      lowStockThreshold: p.lowStockThreshold ?? 0,
      isLowStock:
        (p.lowStockThreshold ?? 0) > 0 && (p.stockQuantity ?? 0) <= (p.lowStockThreshold ?? 0),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { items: data },
    });
  } catch (e) {
    console.error('Inventory list error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list inventory',
    });
  }
};

/**
 * PATCH /api/inventory/:productId/stock
 * Update stock quantity and/or low-stock threshold. Requires inventory.update.
 */
export const updateStock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const productId = req.params.productId;
    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const body = req.body as { stockQuantity?: number; lowStockThreshold?: number };
    const stockQuantity =
      body.stockQuantity !== undefined ? Number(body.stockQuantity) : undefined;
    const lowStockThreshold =
      body.lowStockThreshold !== undefined ? Number(body.lowStockThreshold) : undefined;

    if (stockQuantity !== undefined && (Number.isNaN(stockQuantity) || stockQuantity < 0)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'stockQuantity must be a non-negative number',
      });
    }
    if (
      lowStockThreshold !== undefined &&
      (Number.isNaN(lowStockThreshold) || lowStockThreshold < 0)
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'lowStockThreshold must be a non-negative number',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (stockQuantity !== undefined) product.stockQuantity = stockQuantity;
    if (lowStockThreshold !== undefined) product.lowStockThreshold = lowStockThreshold;
    await product.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Stock updated',
      data: {
        id: product._id,
        stockQuantity: product.stockQuantity ?? 0,
        lowStockThreshold: product.lowStockThreshold ?? 0,
      },
    });
  } catch (e) {
    console.error('Inventory updateStock error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update stock',
    });
  }
};
