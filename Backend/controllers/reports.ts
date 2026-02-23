import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'partially_refunded',
] as const;

/** Revenue = sum of order.total for orders that are completed (delivered) or in progress (not cancelled/refunded) */
const REVENUE_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;

/**
 * GET /api/reports
 * Returns aggregated stats for the reports dashboard. Requires reports.read.
 * Optional query: startDate, endDate (ISO date strings) to filter orders.
 */
export const getStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined;

    let orderFilter: Record<string, unknown> = {};
    if (startDate || endDate) {
      orderFilter.createdAt = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!Number.isNaN(d.getTime())) {
          (orderFilter.createdAt as Record<string, Date>).$gte = d;
        }
      }
      if (endDate) {
        const d = new Date(endDate);
        if (!Number.isNaN(d.getTime())) {
          (orderFilter.createdAt as Record<string, Date>).$lte = d;
        }
      }
      if (Object.keys(orderFilter.createdAt as object).length === 0) delete orderFilter.createdAt;
    }

    const [
      totalOrders,
      revenueResult,
      ordersByStatusResult,
      customerCount,
      productCount,
      categoryCount,
      lowStockAgg,
      recentOrders,
      lowStockProducts,
    ] = await Promise.all([
      Order.countDocuments(orderFilter),
      Order.aggregate<{ total: number }>([
        { $match: { ...orderFilter, status: { $in: [...REVENUE_STATUSES] } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate<{ _id: string; count: number }>([
        { $match: orderFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      User.countDocuments({}),
      Product.countDocuments({}),
      Category.countDocuments({}),
      Product.aggregate<{ n: number }>([
        { $match: { $expr: { $and: [{ $gt: ['$lowStockThreshold', 0] }, { $lte: ['$stockQuantity', '$lowStockThreshold'] }] } } },
        { $count: 'n' },
      ]),
      Order.find(orderFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name email')
        .lean(),
      Product.aggregate<{ _id: mongoose.Types.ObjectId; name: string; slug: string; stockQuantity: number; lowStockThreshold: number }>([
        { $match: { $expr: { $and: [{ $gt: ['$lowStockThreshold', 0] }, { $lte: ['$stockQuantity', '$lowStockThreshold'] }] } } },
        { $project: { name: 1, slug: 1, stockQuantity: 1, lowStockThreshold: 1 } },
        { $limit: 20 },
      ]),
    ]);

    const revenue = revenueResult[0]?.total ?? 0;
    const ordersByStatus: Record<string, number> = {};
    for (const s of ORDER_STATUSES) ordersByStatus[s] = 0;
    for (const row of ordersByStatusResult) {
      ordersByStatus[row._id] = row.count;
    }
    const lowStockCount = lowStockAgg[0]?.n ?? 0;

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        totalOrders,
        totalRevenue: revenue,
        ordersByStatus,
        customerCount,
        productCount,
        categoryCount,
        lowStockCount,
        recentOrders: recentOrders.map((o) => ({
          _id: o._id,
          userId: o.userId,
          status: o.status,
          total: o.total,
          createdAt: o.createdAt,
        })),
        lowStockProducts: lowStockProducts.map((p) => ({
          _id: p._id,
          name: p.name,
          slug: p.slug,
          stockQuantity: p.stockQuantity ?? 0,
          lowStockThreshold: p.lowStockThreshold ?? 0,
        })),
      },
    });
  } catch (e) {
    console.error('Reports getStats error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load reports',
    });
  }
};
