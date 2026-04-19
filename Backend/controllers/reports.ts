import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User, { AccountStatus } from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Cart from '../models/Cart.js';
import Wishlist from '../models/Wishlist.js';
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

const REVENUE_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;

const REFUND_STATUSES = ['refunded', 'partially_refunded'] as const;

const STATUS_IN_REVENUE = [...REVENUE_STATUSES];
const STATUS_IN_REFUND = [...REFUND_STATUSES];

type OrderFilter = Record<string, unknown>;

function revenueMatch(filter: OrderFilter) {
  return { ...filter, status: { $in: STATUS_IN_REVENUE } };
}

function rollingRevenueWindows() {
  const now = Date.now();
  const day = 86400000;
  const last7Start = new Date(now - 7 * day);
  const prev7Start = new Date(now - 14 * day);
  const last30Start = new Date(now - 30 * day);
  const prev30Start = new Date(now - 60 * day);
  return {
    last7: { createdAt: { $gte: last7Start }, status: { $in: STATUS_IN_REVENUE } },
    prev7: {
      createdAt: { $gte: prev7Start, $lt: last7Start },
      status: { $in: STATUS_IN_REVENUE },
    },
    last30: { createdAt: { $gte: last30Start }, status: { $in: STATUS_IN_REVENUE } },
    prev30: {
      createdAt: { $gte: prev30Start, $lt: last30Start },
      status: { $in: STATUS_IN_REVENUE },
    },
  };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export const getStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined;

    let orderFilter: OrderFilter = {};
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

    const revMatch = revenueMatch(orderFilter);
    const rolling = rollingRevenueWindows();

    let previousPeriodAov: { revenue: number; count: number } | null = null;
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e.getTime() > s.getTime()) {
        const len = e.getTime() - s.getTime();
        const prevStart = new Date(s.getTime() - len);
        const prevFilter: OrderFilter = {
          createdAt: { $gte: prevStart, $lt: s },
          status: { $in: STATUS_IN_REVENUE },
        };
        const [prevRev, prevCnt] = await Promise.all([
          Order.aggregate<{ total: number }>([
            { $match: prevFilter },
            { $group: { _id: null, total: { $sum: '$total' } } },
          ]),
          Order.countDocuments(prevFilter),
        ]);
        previousPeriodAov = {
          revenue: prevRev[0]?.total ?? 0,
          count: prevCnt,
        };
      }
    }

    const [
      totalOrders,
      revenueResult,
      ordersByStatusResult,
      customerCount,
      activeCustomerCount,
      productCount,
      categoryCount,
      lowStockAgg,
      recentOrders,
      lowStockProducts,
      revenueOrderCount,
      refundTotalAgg,
      bestSellingByRevenue,
      bestSellingByQuantity,
      worstSellingByQuantity,
      mostRefundedProducts,
      mostCancelledProducts,
      revenueByCategory,
      topCustomersBySpend,
      repeatVsOneTime,
      abandonedCartProducts,
      cartAbandonmentAgg,
      wishlistedNotPurchased,
      customersWithAbandonedCarts,
      ordersByHour,
      ordersByWeekday,
      revLast7,
      revPrev7,
      revLast30,
      revPrev30,
      recentCustomerLogins,
    ] = await Promise.all([
      Order.countDocuments(orderFilter),
      Order.aggregate<{ total: number }>([
        { $match: revMatch },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate<{ _id: string; count: number }>([
        { $match: orderFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      User.countDocuments({}),
      User.countDocuments({ accountStatus: AccountStatus.ACTIVE }),
      Product.countDocuments({}),
      Category.countDocuments({}),
      Product.aggregate<{ n: number }>([
        {
          $match: {
            $expr: {
              $and: [{ $gt: ['$lowStockThreshold', 0] }, { $lte: ['$stockQuantity', '$lowStockThreshold'] }],
            },
          },
        },
        { $count: 'n' },
      ]),
      Order.find(orderFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name email')
        .lean(),
      Product.aggregate<{
        _id: mongoose.Types.ObjectId;
        name: string;
        slug: string;
        stockQuantity: number;
        lowStockThreshold: number;
      }>([
        {
          $match: {
            $expr: {
              $and: [{ $gt: ['$lowStockThreshold', 0] }, { $lte: ['$stockQuantity', '$lowStockThreshold'] }],
            },
          },
        },
        { $project: { name: 1, slug: 1, stockQuantity: 1, lowStockThreshold: 1 } },
        { $limit: 20 },
      ]),
      Order.countDocuments(revMatch),
      Order.aggregate<{ total: number }>([
        { $match: { ...orderFilter, status: { $in: STATUS_IN_REFUND } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate<{
        _id: mongoose.Types.ObjectId;
        revenue: number;
        quantity: number;
        name: string;
        slug: string;
      }>([
        { $match: revMatch },
        { $unwind: '$lineItems' },
        {
          $group: {
            _id: '$lineItems.productId',
            revenue: { $sum: '$lineItems.subtotal' },
            quantity: { $sum: '$lineItems.quantity' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'p',
          },
        },
        { $unwind: '$p' },
        {
          $project: {
            _id: 1,
            revenue: 1,
            quantity: 1,
            name: '$p.name',
            slug: '$p.slug',
          },
        },
      ]),
      Order.aggregate<{
        _id: mongoose.Types.ObjectId;
        revenue: number;
        quantity: number;
        name: string;
        slug: string;
      }>([
        { $match: revMatch },
        { $unwind: '$lineItems' },
        {
          $group: {
            _id: '$lineItems.productId',
            revenue: { $sum: '$lineItems.subtotal' },
            quantity: { $sum: '$lineItems.quantity' },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'p',
          },
        },
        { $unwind: '$p' },
        {
          $project: {
            _id: 1,
            revenue: 1,
            quantity: 1,
            name: '$p.name',
            slug: '$p.slug',
          },
        },
      ]),
      Order.aggregate<{
        _id: mongoose.Types.ObjectId;
        revenue: number;
        quantity: number;
        name: string;
        slug: string;
      }>([
        { $match: revMatch },
        { $unwind: '$lineItems' },
        {
          $group: {
            _id: '$lineItems.productId',
            revenue: { $sum: '$lineItems.subtotal' },
            quantity: { $sum: '$lineItems.quantity' },
          },
        },
        { $match: { quantity: { $gt: 0 } } },
        { $sort: { quantity: 1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'p',
          },
        },
        { $unwind: '$p' },
        {
          $project: {
            _id: 1,
            revenue: 1,
            quantity: 1,
            name: '$p.name',
            slug: '$p.slug',
          },
        },
      ]),
      Order.aggregate<{
        _id: mongoose.Types.ObjectId;
        quantity: number;
        revenue: number;
        name: string;
        slug: string;
      }>([
        { $match: { ...orderFilter, status: { $in: STATUS_IN_REFUND } } },
        { $unwind: '$lineItems' },
        {
          $group: {
            _id: '$lineItems.productId',
            quantity: { $sum: '$lineItems.quantity' },
            revenue: { $sum: '$lineItems.subtotal' },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'p',
          },
        },
        { $unwind: '$p' },
        {
          $project: {
            _id: 1,
            quantity: 1,
            revenue: 1,
            name: '$p.name',
            slug: '$p.slug',
          },
        },
      ]),
      Order.aggregate<{
        _id: mongoose.Types.ObjectId;
        quantity: number;
        revenue: number;
        name: string;
        slug: string;
      }>([
        { $match: { ...orderFilter, status: 'cancelled' } },
        { $unwind: '$lineItems' },
        {
          $group: {
            _id: '$lineItems.productId',
            quantity: { $sum: '$lineItems.quantity' },
            revenue: { $sum: '$lineItems.subtotal' },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'p',
          },
        },
        { $unwind: '$p' },
        {
          $project: {
            _id: 1,
            quantity: 1,
            revenue: 1,
            name: '$p.name',
            slug: '$p.slug',
          },
        },
      ]),
      Order.aggregate<{ categoryId: mongoose.Types.ObjectId; name: string; revenue: number }>([
        { $match: revMatch },
        { $unwind: '$lineItems' },
        {
          $lookup: {
            from: 'products',
            localField: 'lineItems.productId',
            foreignField: '_id',
            as: 'prod',
          },
        },
        { $unwind: '$prod' },
        {
          $group: {
            _id: '$prod.categoryId',
            revenue: { $sum: '$lineItems.subtotal' },
          },
        },
        { $sort: { revenue: -1 } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'cat',
          },
        },
        { $unwind: '$cat' },
        {
          $project: {
            categoryId: '$_id',
            name: '$cat.name',
            revenue: 1,
          },
        },
      ]),
      Order.aggregate<{
        _id: mongoose.Types.ObjectId;
        totalSpend: number;
        lastOrderAt: Date;
        name?: string;
        email?: string;
        customerId?: string;
      }>([
        { $match: revMatch },
        {
          $group: {
            _id: '$userId',
            totalSpend: { $sum: '$total' },
            lastOrderAt: { $max: '$createdAt' },
          },
        },
        { $sort: { totalSpend: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'u',
          },
        },
        { $unwind: '$u' },
        {
          $project: {
            _id: 1,
            totalSpend: 1,
            lastOrderAt: 1,
            name: '$u.name',
            email: { $ifNull: ['$u.email', '$u.googleEmail'] },
            customerId: '$u.customerId',
          },
        },
      ]),
      Order.aggregate<{ oneTimeBuyers: number; repeatBuyers: number }>([
        { $match: revMatch },
        { $group: { _id: '$userId', orderCount: { $sum: 1 } } },
        {
          $group: {
            _id: null,
            oneTimeBuyers: {
              $sum: { $cond: [{ $eq: ['$orderCount', 1] }, 1, 0] },
            },
            repeatBuyers: {
              $sum: { $cond: [{ $gt: ['$orderCount', 1] }, 1, 0] },
            },
          },
        },
      ]),
      Cart.aggregate<{
        productId: mongoose.Types.ObjectId;
        name: string;
        slug: string;
        quantityInCarts: number;
      }>([
        { $match: { 'items.0': { $exists: true } } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'orders',
            let: { uid: '$userId', pid: '$items.productId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userId', '$$uid'] },
                      { $in: ['$status', STATUS_IN_REVENUE] },
                    ],
                  },
                },
              },
              { $unwind: '$lineItems' },
              { $match: { $expr: { $eq: ['$lineItems.productId', '$$pid'] } } },
              { $limit: 1 },
            ],
            as: 'bought',
          },
        },
        { $match: { bought: { $size: 0 } } },
        {
          $group: {
            _id: '$items.productId',
            quantityInCarts: { $sum: '$items.quantity' },
          },
        },
        { $sort: { quantityInCarts: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'p',
          },
        },
        { $unwind: '$p' },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            name: '$p.name',
            slug: '$p.slug',
            quantityInCarts: 1,
          },
        },
      ]),
      Cart.aggregate<{ cartsWithItems: number; noRevenueOrder: number }>([
        { $match: { 'items.0': { $exists: true } } },
        {
          $lookup: {
            from: 'orders',
            let: { uid: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$userId', '$$uid'] }, { $in: ['$status', STATUS_IN_REVENUE] }],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: 'hasRevenueOrder',
          },
        },
        {
          $group: {
            _id: null,
            cartsWithItems: { $sum: 1 },
            noRevenueOrder: {
              $sum: {
                $cond: [{ $eq: [{ $size: '$hasRevenueOrder' }, 0] }, 1, 0],
              },
            },
          },
        },
      ]),
      Wishlist.aggregate<{
        productId: mongoose.Types.ObjectId;
        name: string;
        slug: string;
        interestedUsers: number;
      }>([
        { $match: { productIds: { $exists: true, $ne: [] } } },
        { $unwind: '$productIds' },
        {
          $lookup: {
            from: 'orders',
            let: { uid: '$userId', pid: '$productIds' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userId', '$$uid'] },
                      { $in: ['$status', STATUS_IN_REVENUE] },
                    ],
                  },
                },
              },
              { $unwind: '$lineItems' },
              { $match: { $expr: { $eq: ['$lineItems.productId', '$$pid'] } } },
              { $limit: 1 },
            ],
            as: 'bought',
          },
        },
        { $match: { bought: { $size: 0 } } },
        {
          $group: {
            _id: '$productIds',
            interestedUsers: { $sum: 1 },
          },
        },
        { $sort: { interestedUsers: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'p',
          },
        },
        { $unwind: '$p' },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            name: '$p.name',
            slug: '$p.slug',
            interestedUsers: 1,
          },
        },
      ]),
      Cart.aggregate<{
        userId: mongoose.Types.ObjectId;
        name?: string;
        email?: string;
        customerId?: string;
        cartItemCount: number;
      }>([
        { $match: { 'items.0': { $exists: true } } },
        {
          $lookup: {
            from: 'orders',
            let: { uid: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$userId', '$$uid'] }, { $in: ['$status', STATUS_IN_REVENUE] }],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: 'hasRevenueOrder',
          },
        },
        { $match: { hasRevenueOrder: { $size: 0 } } },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'u',
          },
        },
        { $unwind: '$u' },
        {
          $project: {
            userId: '$userId',
            name: '$u.name',
            email: { $ifNull: ['$u.email', '$u.googleEmail'] },
            customerId: '$u.customerId',
            cartItemCount: { $size: '$items' },
          },
        },
        { $limit: 40 },
      ]),
      Order.aggregate<{ _id: number; count: number }>([
        { $match: orderFilter },
        { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate<{ _id: number; count: number }>([
        { $match: orderFilter },
        { $group: { _id: { $dayOfWeek: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate<{ total: number }>([
        { $match: rolling.last7 },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate<{ total: number }>([
        { $match: rolling.prev7 },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate<{ total: number }>([
        { $match: rolling.last30 },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate<{ total: number }>([
        { $match: rolling.prev30 },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      User.find({
        accountStatus: AccountStatus.ACTIVE,
        lastLoginAt: { $exists: true, $ne: null },
      })
        .sort({ lastLoginAt: -1 })
        .limit(12)
        .select('name email googleEmail customerId lastLoginAt avatar')
        .lean(),
    ]);

    const revenue = revenueResult[0]?.total ?? 0;
    const ordersByStatus: Record<string, number> = {};
    for (const s of ORDER_STATUSES) ordersByStatus[s] = 0;
    for (const row of ordersByStatusResult) {
      ordersByStatus[row._id] = row.count;
    }
    const lowStockCount = lowStockAgg[0]?.n ?? 0;
    const refundTotal = refundTotalAgg[0]?.total ?? 0;
    const grossForRefundRate = revenue + refundTotal;
    const refundRatePercent = grossForRefundRate > 0 ? (refundTotal / grossForRefundRate) * 100 : 0;

    const averageOrderValue = revenueOrderCount > 0 ? revenue / revenueOrderCount : 0;

    let averageOrderValuePrevious = 0;
    let averageOrderValueChangePercent: number | null = null;
    if (previousPeriodAov && previousPeriodAov.count > 0) {
      averageOrderValuePrevious = previousPeriodAov.revenue / previousPeriodAov.count;
      averageOrderValueChangePercent = pctChange(averageOrderValue, averageOrderValuePrevious);
    }

    const cartAb = cartAbandonmentAgg[0];
    const cartsWithItemsCount = cartAb?.cartsWithItems ?? 0;
    const cartsNoRevenueOrder = cartAb?.noRevenueOrder ?? 0;
    const cartAbandonmentRatePercent =
      cartsWithItemsCount > 0 ? (cartsNoRevenueOrder / cartsWithItemsCount) * 100 : 0;

    const repeatRow = repeatVsOneTime[0];
    const revenueLast7 = revLast7[0]?.total ?? 0;
    const revenuePrev7 = revPrev7[0]?.total ?? 0;
    const revenueLast30 = revLast30[0]?.total ?? 0;
    const revenuePrev30 = revPrev30[0]?.total ?? 0;

    const ordersByHourMap = new Map<number, number>();
    for (const row of ordersByHour) ordersByHourMap.set(row._id, row.count);
    const ordersByHourFilled = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: ordersByHourMap.get(hour) ?? 0,
    }));

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const ordersByWeekdayMap = new Map<number, number>();
    for (const row of ordersByWeekday) ordersByWeekdayMap.set(row._id, row.count);
    const ordersByWeekdayFilled = weekdayLabels.map((label, i) => {
      const mongoDow = i + 1;
      return { weekday: mongoDow, label, count: ordersByWeekdayMap.get(mongoDow) ?? 0 };
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        totalOrders,
        totalRevenue: revenue,
        revenueOrderCount,
        averageOrderValue,
        averageOrderValuePrevious,
        averageOrderValueChangePercent,
        refundTotal,
        refundRatePercent,
        ordersByStatus,
        customerCount,
        activeCustomerCount,
        productCount,
        categoryCount,
        lowStockCount,
        recentOrders: recentOrders.map((o) => ({
          _id: o._id,
          orderNumber: o.orderNumber,
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
        cartConversion: {
          abandonedCartProducts,
          cartAbandonmentRatePercent,
          cartsWithItemsCount,
          cartsWithItemsNoRevenueOrderCount: cartsNoRevenueOrder,
          wishlistedNotPurchased,
          customersWithAbandonedCarts,
        },
        productPerformance: {
          bestSellingByRevenue,
          bestSellingByQuantity,
          worstSellingByQuantity,
          mostRefundedProducts,
          mostCancelledProducts,
        },
        revenueInsights: {
          revenueByCategory,
          topCustomersBySpend,
        },
        customerRecentLogins: recentCustomerLogins.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email ?? u.googleEmail,
          customerId: u.customerId,
          lastLoginAt: u.lastLoginAt,
          avatar: u.avatar,
        })),
        customerInsights: {
          oneTimeBuyers: repeatRow?.oneTimeBuyers ?? 0,
          repeatBuyers: repeatRow?.repeatBuyers ?? 0,
        },
        timeBased: {
          ordersByHourUtc: ordersByHourFilled,
          ordersByWeekdayUtc: ordersByWeekdayFilled,
          revenueLast7Days: revenueLast7,
          revenuePrevious7Days: revenuePrev7,
          revenueWowChangePercent: pctChange(revenueLast7, revenuePrev7),
          revenueLast30Days: revenueLast30,
          revenuePrevious30Days: revenuePrev30,
          revenueMomChangePercent: pctChange(revenueLast30, revenuePrev30),
        },
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
