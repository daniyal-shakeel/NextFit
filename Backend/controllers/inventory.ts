import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import InventoryStockLog from '../models/InventoryStockLog.js';
import Category from '../models/Category.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import type { AuthPayload } from '../middleware/requirePermission.js';

const ORDER_STATUSES_EXCLUDED_FROM_SALES = ['cancelled', 'refunded', 'partially_refunded'] as const;

const DEAD_STOCK_MIN_ON_HAND = 10;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isHealthyStock(stock: number, threshold: number): boolean {
  if (threshold > 0) return stock > threshold;
  return stock > 0;
}

export const list = async (req: Request, res: Response): Promise<Response> => {
  try {
    const limitRaw = req.query.limit;
    const skipRaw = req.query.skip;
    const stockFilter = typeof req.query.stockFilter === 'string' ? req.query.stockFilter.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const andParts: Record<string, unknown>[] = [];
    if (search) {
      andParts.push({
        $or: [
          { name: new RegExp(escapeRegex(search), 'i') },
          { slug: new RegExp(escapeRegex(search), 'i') },
        ],
      });
    }
    if (stockFilter === 'out') {
      andParts.push({ stockQuantity: 0 });
    } else if (stockFilter === 'low') {
      andParts.push({
        lowStockThreshold: { $gt: 0 },
        $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
      });
    } else if (stockFilter === 'healthy') {
      andParts.push({
        $or: [
          {
            $and: [
              { lowStockThreshold: { $gt: 0 } },
              { $expr: { $gt: ['$stockQuantity', '$lowStockThreshold'] } },
            ],
          },
          {
            $and: [{ lowStockThreshold: 0 }, { stockQuantity: { $gt: 0 } }],
          },
        ],
      });
    }

    const filter: Record<string, unknown> =
      andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0]! : { $and: andParts };

    let limit: number | undefined;
    let skip = 0;
    if (limitRaw !== undefined && String(limitRaw) !== '') {
      const n = Number(limitRaw);
      if (!Number.isFinite(n) || n < 1 || n > 500) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid limit query (use 1–500)',
        });
      }
      limit = Math.floor(n);
      if (skipRaw !== undefined && String(skipRaw) !== '') {
        const s = Number(skipRaw);
        if (!Number.isFinite(s) || s < 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Invalid skip query',
          });
        }
        skip = Math.floor(s);
      }
    }

    let query = Product.find(filter).populate('categoryId', 'name slug').sort({ name: 1 });
    if (limit !== undefined) {
      query = query.skip(skip).limit(limit);
    }

    const [products, total] = await Promise.all([query.lean(), Product.countDocuments(filter)]);
    const rows = products as unknown as Record<string, unknown>[];

    const data = rows.map((p) => {
      const stockQuantity = Number(p.stockQuantity ?? 0);
      const lowStockThreshold = Number(p.lowStockThreshold ?? 0);
      return {
        id: p._id,
        name: p.name,
        slug: p.slug,
        categoryId: p.categoryId,
        basePrice: p.basePrice,
        mainImageUrl: p.mainImageUrl,
        stockQuantity,
        lowStockThreshold,
        isLowStock: lowStockThreshold > 0 && stockQuantity <= lowStockThreshold,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    const page = limit !== undefined ? Math.floor(skip / limit) + 1 : 1;
    const responseLimit = limit !== undefined ? limit : Math.max(total, 0);
    const totalPages = limit !== undefined ? Math.ceil(total / limit) : 1;

    const payload: {
      items: typeof data;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasMore?: boolean;
    } = {
      items: data,
      total,
      page,
      limit: responseLimit,
      totalPages,
    };
    if (limit !== undefined) {
      payload.hasMore = skip + data.length < total;
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: payload,
    });
  } catch (e) {
    console.error('Inventory list error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list inventory',
    });
  }
};

type ProductLean = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  stockQuantity: number;
  lowStockThreshold: number;
  basePrice: number;
  categoryId?: unknown;
};

export const getAnalytics = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const products = await Product.find({})
      .select('name slug stockQuantity lowStockThreshold basePrice categoryId')
      .lean<ProductLean[]>();

    const totalSkuCount = products.length;

    let lowStockAlertsCount = 0;
    let outOfStockCount = 0;
    let inStockHealthyCount = 0;
    let totalInventoryValue = 0;

    for (const p of products) {
      const stock = Number(p.stockQuantity ?? 0);
      const th = Number(p.lowStockThreshold ?? 0);
      const price = Number(p.basePrice ?? 0);
      totalInventoryValue += stock * price;

      if (stock === 0) outOfStockCount += 1;
      if (th > 0 && stock <= th) lowStockAlertsCount += 1;
      if (isHealthyStock(stock, th)) inStockHealthyCount += 1;
    }

    let mostStocked: { productId: string; name: string; stockQuantity: number } | null = null;
    let leastStocked: { productId: string; name: string; stockQuantity: number } | null = null;
    if (products.length > 0) {
      const byStock = [...products].sort((a, b) => Number(b.stockQuantity) - Number(a.stockQuantity));
      const top = byStock[0];
      mostStocked = {
        productId: String(top._id),
        name: top.name,
        stockQuantity: Number(top.stockQuantity ?? 0),
      };

      const positive = products.filter((p) => Number(p.stockQuantity) > 0);
      if (positive.length > 0) {
        const minP = positive.reduce((a, b) =>
          Number(a.stockQuantity) <= Number(b.stockQuantity) ? a : b
        );
        leastStocked = {
          productId: String(minP._id),
          name: minP.name,
          stockQuantity: Number(minP.stockQuantity ?? 0),
        };
      } else {
        const minP = products.reduce((a, b) =>
          Number(a.stockQuantity) <= Number(b.stockQuantity) ? a : b
        );
        leastStocked = {
          productId: String(minP._id),
          name: minP.name,
          stockQuantity: Number(minP.stockQuantity ?? 0),
        };
      }
    }

    const categoryAgg = await Product.aggregate<{
      _id: mongoose.Types.ObjectId;
      skuCount: number;
      totalUnits: number;
    }>([
      {
        $group: {
          _id: '$categoryId',
          skuCount: { $sum: 1 },
          totalUnits: { $sum: '$stockQuantity' },
        },
      },
    ]);

    const catIds = categoryAgg.map((c) => c._id).filter(Boolean);
    const categories = await Category.find({ _id: { $in: catIds } })
      .select('name')
      .lean();
    const catName = new Map(categories.map((c) => [String(c._id), c.name]));

    const categoryBreakdown = categoryAgg.map((c) => ({
      categoryId: String(c._id),
      categoryName: catName.get(String(c._id)) ?? '—',
      skuCount: c.skuCount,
      totalUnits: c.totalUnits,
    }));

    const soldAgg = await Order.aggregate<{ _id: mongoose.Types.ObjectId; unitsSold: number }>([
      { $match: { status: { $nin: [...ORDER_STATUSES_EXCLUDED_FROM_SALES] } } },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: '$lineItems.productId',
          unitsSold: { $sum: '$lineItems.quantity' },
        },
      },
    ]);
    const soldMap = new Map(soldAgg.map((s) => [String(s._id), s.unitsSold]));

    const deadStock = products
      .filter((p) => {
        const stock = Number(p.stockQuantity ?? 0);
        const sold = soldMap.get(String(p._id)) ?? 0;
        return stock >= DEAD_STOCK_MIN_ON_HAND && sold === 0;
      })
      .map((p) => ({
        productId: String(p._id),
        name: p.name,
        stockQuantity: Number(p.stockQuantity ?? 0),
      }))
      .sort((a, b) => b.stockQuantity - a.stockQuantity)
      .slice(0, 10);

    const withSales = products.map((p) => ({
      productId: String(p._id),
      name: p.name,
      unitsSold: soldMap.get(String(p._id)) ?? 0,
    }));
    const topSelling = [...withSales].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
    const slowMoving = [...withSales].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 5);

    const restockAgg = await InventoryStockLog.aggregate<{ _id: mongoose.Types.ObjectId; restockCount: number }>([
      {
        $match: {
          $expr: { $gt: ['$newStock', '$previousStock'] },
        },
      },
      {
        $group: {
          _id: '$productId',
          restockCount: { $sum: 1 },
        },
      },
      { $sort: { restockCount: -1 } },
      { $limit: 10 },
    ]);

    const restockFrequency = await Promise.all(
      restockAgg.map(async (r) => {
        const prod = await Product.findById(r._id).select('name').lean();
        return {
          productId: String(r._id),
          name: prod?.name ?? '—',
          restockCount: r.restockCount,
        };
      })
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        totalSkuCount,
        lowStockAlertsCount,
        outOfStockCount,
        inStockHealthyCount,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        mostStocked,
        leastStocked,
        categoryBreakdown,
        deadStock,
        topSelling,
        slowMoving,
        restockFrequency,
        currency: 'PKR',
      },
    });
  } catch (e) {
    console.error('Inventory analytics error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load inventory analytics',
    });
  }
};

export const getMovements = async (req: Request, res: Response): Promise<Response> => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit), 10) || 40));
    const skip = Math.max(0, parseInt(String(req.query.skip), 10) || 0);

    const productIdParam = typeof req.query.productId === 'string' ? req.query.productId.trim() : '';
    const productSearch = typeof req.query.productSearch === 'string' ? req.query.productSearch.trim() : '';
    const changedBy = typeof req.query.changedBy === 'string' ? req.query.changedBy.trim() : '';
    const dateFromRaw = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateToRaw = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';

    const andParts: Record<string, unknown>[] = [];

    if (productIdParam && mongoose.isValidObjectId(productIdParam)) {
      andParts.push({ productId: new mongoose.Types.ObjectId(productIdParam) });
    } else if (productSearch) {
      const prods = await Product.find({
        $or: [
          { name: new RegExp(escapeRegex(productSearch), 'i') },
          { slug: new RegExp(escapeRegex(productSearch), 'i') },
        ],
      })
        .select('_id')
        .lean();
      const ids = prods.map((p) => p._id);
      if (ids.length === 0) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          data: { items: [], total: 0, limit, skip, hasMore: false },
        });
      }
      andParts.push({ productId: { $in: ids } });
    }

    if (changedBy) {
      const re = new RegExp(escapeRegex(changedBy), 'i');
      andParts.push({
        $or: [{ changedByEmail: re }, { changedById: re }],
      });
    }

    if (dateFromRaw || dateToRaw) {
      const range: Record<string, Date> = {};
      if (dateFromRaw) {
        const d = new Date(dateFromRaw);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
      }
      if (dateToRaw) {
        const d = new Date(dateToRaw);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          range.$lte = d;
        }
      }
      if (Object.keys(range).length > 0) {
        andParts.push({ createdAt: range });
      }
    }

    const match: Record<string, unknown> =
      andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0]! : { $and: andParts };

    const [rows, total] = await Promise.all([
      InventoryStockLog.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('productId', 'name slug')
        .lean(),
      InventoryStockLog.countDocuments(match),
    ]);

    const items = rows.map((r) => {
      const pop = r.productId as { name?: string; slug?: string } | null;
      return {
        _id: r._id,
        productId: typeof r.productId === 'object' && r.productId && '_id' in r.productId ? String((r.productId as { _id: unknown })._id) : String(r.productId),
        productName: pop?.name ?? '—',
        productSlug: pop?.slug,
        previousStock: r.previousStock,
        newStock: r.newStock,
        previousThreshold: r.previousThreshold,
        newThreshold: r.newThreshold,
        changedByEmail: r.changedByEmail ?? null,
        changedById: r.changedById ?? null,
        createdAt: r.createdAt,
      };
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        items,
        total,
        limit,
        skip,
        hasMore: skip + items.length < total,
      },
    });
  } catch (e) {
    console.error('Inventory movements error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load stock movements',
    });
  }
};

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

    const prevStock = product.stockQuantity ?? 0;
    const prevTh = product.lowStockThreshold ?? 0;

    if (stockQuantity !== undefined) product.stockQuantity = stockQuantity;
    if (lowStockThreshold !== undefined) product.lowStockThreshold = lowStockThreshold;
    await product.save();

    const auth = req.auth as AuthPayload | undefined;
    await InventoryStockLog.create({
      productId: product._id,
      previousStock: prevStock,
      newStock: product.stockQuantity ?? 0,
      previousThreshold: prevTh,
      newThreshold: product.lowStockThreshold ?? 0,
      changedByEmail: auth?.email,
      changedById: auth?.id,
    });

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
