import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order, { type OrderStatus } from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Address from '../models/Address.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import type { AuthPayload } from '../middleware/requirePermission.js';
import { getShippingForSubtotal } from '../services/adminSettingsService.js';

const VALID_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered',
  'cancelled', 'refunded', 'partially_refunded',
];

const ADMIN_ORDER_USER_POPULATE = 'customerId name email googleEmail';

function getUserId(req: Request): string | null {
  const auth = req.auth as AuthPayload | undefined;
  return auth?.id && auth.authMethod !== 'admin' ? auth.id : null;
}

type ShippingSnapshot = {
  street?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  label?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
};

function provinceFromSaved(saved: Record<string, unknown>): string {
  const p = saved.province ?? saved.state;
  return typeof p === 'string' ? p : '';
}

export const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userIdRaw = getUserId(req);
    const customerId =
      userIdRaw && mongoose.isValidObjectId(userIdRaw) ? userIdRaw : null;
    const isAuthedCustomer = customerId !== null;

    const body = req.body as {
      lineItems?: Array<{ productId: string; quantity: number }>;
      discountCode?: string;
      addressId?: string;
      shippingAddress?: ShippingSnapshot;
      saveAddress?: boolean;
      setAsDefault?: boolean;
    };
    const lineItems = body?.lineItems;
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'lineItems array with at least one item (productId, quantity) is required',
      });
    }

    if (isAuthedCustomer) {
      const user = await User.findById(customerId);
      if (!user || user.accountStatus !== 'active') {
        return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Account not active' });
      }
    }

    let shippingSnapshot: ShippingSnapshot | undefined;

    if (isAuthedCustomer && body.addressId && mongoose.isValidObjectId(body.addressId)) {
      const saved = await Address.findOne({
        _id: body.addressId,
        userId: new mongoose.Types.ObjectId(customerId),
      }).lean();
      if (saved) {
        const s = saved as unknown as Record<string, unknown>;
        shippingSnapshot = {
          street: saved.street,
          city: saved.city,
          province: provinceFromSaved(s),
          zipCode: saved.zipCode,
          label: saved.label,
        };
      }
    }

    if (!shippingSnapshot && body.shippingAddress && typeof body.shippingAddress === 'object') {
      const s = body.shippingAddress as Record<string, unknown>;
      const provinceRaw =
        typeof s.province === 'string'
          ? s.province.trim()
          : typeof s.state === 'string'
            ? s.state.trim()
            : undefined;
      shippingSnapshot = {
        street: typeof s.street === 'string' ? s.street.trim() : undefined,
        city: typeof s.city === 'string' ? s.city.trim() : undefined,
        province: provinceRaw,
        zipCode:
          typeof s.zipCode === 'string'
            ? s.zipCode.trim()
            : typeof s.zip === 'string'
              ? s.zip.trim()
              : undefined,
        label: typeof s.label === 'string' ? s.label.trim() : undefined,
        firstName: typeof s.firstName === 'string' ? s.firstName.trim() : undefined,
        lastName: typeof s.lastName === 'string' ? s.lastName.trim() : undefined,
        phone: typeof s.phone === 'string' ? s.phone.trim() : undefined,
        email: typeof s.email === 'string' ? s.email.trim() : undefined,
      };
      if (isAuthedCustomer && body.saveAddress && shippingSnapshot.street && shippingSnapshot.city) {
        const isDefault = Boolean(body.setAsDefault);
        if (isDefault) {
          await Address.updateMany(
            { userId: new mongoose.Types.ObjectId(customerId) },
            { $set: { isDefault: false } }
          );
        }
        await Address.create({
          userId: new mongoose.Types.ObjectId(customerId),
          label: shippingSnapshot.label || 'Checkout',
          street: shippingSnapshot.street,
          city: shippingSnapshot.city,
          province: shippingSnapshot.province || '',
          zipCode: shippingSnapshot.zipCode || '',
          isDefault,
        });
      }
    }

    if (!shippingSnapshot?.street || !shippingSnapshot?.city) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'shippingAddress is required (street, city)',
      });
    }
    if (!shippingSnapshot?.phone) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'shippingAddress phone is required',
      });
    }

    const builtLines: { productId: mongoose.Types.ObjectId; name: string; quantity: number; priceAtOrder: number; subtotal: number }[] = [];
    let subtotal = 0;

    for (const item of lineItems.slice(0, 50)) {
      const pid = item?.productId;
      const qty = Math.max(1, Math.min(999, Number(item?.quantity) || 1));
      if (!pid || !mongoose.isValidObjectId(pid)) continue;
      const product = await Product.findById(pid);
      if (!product) continue;
      const priceAtOrder = product.basePrice;
      const lineSubtotal = priceAtOrder * qty;
      builtLines.push({
        productId: product._id,
        name: product.name,
        quantity: qty,
        priceAtOrder,
        subtotal: lineSubtotal,
      });
      subtotal += lineSubtotal;
    }

    if (builtLines.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'No valid line items',
      });
    }

    const discountAmount = 0; 
    const { shipping } = await getShippingForSubtotal(subtotal);
    const total = Math.max(0, subtotal - discountAmount + shipping);

    const order = await Order.create({
      ...(isAuthedCustomer ? { userId: new mongoose.Types.ObjectId(customerId) } : {}),
      status: 'pending',
      lineItems: builtLines,
      subtotal,
      discountAmount,
      discountCode: body.discountCode?.trim(),
      total,
      transactionIds: [],
      ...(shippingSnapshot && { shippingAddress: shippingSnapshot }),
    });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Order created',
      data: order,
    });
  } catch (e) {
    console.error('Order create error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create order',
    });
  }
};

export const listMine = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }

    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Order.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
    ]);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error('Order listMine error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list orders',
    });
  }
};

export const getMine = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const ref = String(req.params.id ?? '').trim();
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    if (!ref) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid order id' });
    }

    const byObjectId = mongoose.isValidObjectId(ref);
    const filter: Record<string, unknown> = { userId };
    if (byObjectId) filter._id = ref;
    else filter.orderNumber = ref;

    const order = await Order.findOne(filter);
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }
    return res.status(HTTP_STATUS.OK).json({ success: true, data: order });
  } catch (e) {
    console.error('Order getMine error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load order',
    });
  }
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  try {
    const limitRaw = req.query.limit;
    const skipRaw = req.query.skip;
    const pageRaw = req.query.page;
    const userIdParam = typeof req.query.userId === 'string' ? req.query.userId.trim() : undefined;
    const statusParam = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : undefined;

    let filter: Record<string, unknown> = {};
    if (userIdParam) {
      if (/^CUS-/i.test(userIdParam)) {
        const user = await User.findOne({ customerId: userIdParam }).select('_id').lean();
        if (user) filter = { userId: user._id };
        else filter = { userId: new mongoose.Types.ObjectId('000000000000000000000000') }; // no match
      } else if (mongoose.isValidObjectId(userIdParam)) {
        filter = { userId: userIdParam };
      }
    }

    if (statusParam) {
      const statuses = statusParam
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is OrderStatus => VALID_STATUSES.includes(s as OrderStatus));
      if (statuses.length) {
        filter.status = { $in: statuses };
      }
    }

    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (!Number.isNaN(d.getTime())) range.$lte = d;
      }
      if (Object.keys(range).length) {
        filter.createdAt = range;
      }
    }

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
      } else if (pageRaw !== undefined && String(pageRaw) !== '') {
        const p = Math.max(1, parseInt(String(pageRaw), 10) || 1);
        skip = (p - 1) * limit;
      }
    }

    let query = Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', ADMIN_ORDER_USER_POPULATE);
    if (limit !== undefined) {
      query = query.skip(skip).limit(limit);
    }

    const [items, total] = await Promise.all([query.lean(), Order.countDocuments(filter)]);

    const page = limit !== undefined ? Math.floor(skip / limit) + 1 : 1;
    const responseLimit = limit !== undefined ? limit : Math.max(total, 0);
    const totalPages = limit !== undefined ? Math.ceil(total / limit) : 1;

    const data: {
      items: typeof items;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasMore?: boolean;
    } = {
      items,
      total,
      page,
      limit: responseLimit,
      totalPages,
    };
    if (limit !== undefined) {
      data.hasMore = skip + items.length < total;
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data,
    });
  } catch (e) {
    console.error('Order list error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list orders',
    });
  }
};

export const getOne = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid order id' });
    }
    const order = await Order.findById(id).populate('userId', ADMIN_ORDER_USER_POPULATE);
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }
    return res.status(HTTP_STATUS.OK).json({ success: true, data: order });
  } catch (e) {
    console.error('Order getOne error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load order',
    });
  }
};

export const getPublic = async (req: Request, res: Response): Promise<Response> => {
  try {
    const ref = String(req.params.id ?? '').trim();
    if (!ref) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid order id' });
    }
    const byObjectId = mongoose.isValidObjectId(ref);
    const order = byObjectId
      ? await Order.findById(ref).select('-userId').lean()
      : await Order.findOne({ orderNumber: ref }).select('-userId').lean();
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }
    return res.status(HTTP_STATUS.OK).json({ success: true, data: order });
  } catch (e) {
    console.error('Order getPublic error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load order',
    });
  }
};

export const updateStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = req.params.id;
    const status = req.body?.status as string | undefined;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid order id' });
    }
    if (!status || typeof status !== 'string' || !VALID_STATUSES.includes(status as OrderStatus)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
    const order = await Order.findByIdAndUpdate(
      id,
      { status: status as OrderStatus },
      { new: true, runValidators: true }
    ).populate('userId', ADMIN_ORDER_USER_POPULATE);
    if (!order) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }
    return res.status(HTTP_STATUS.OK).json({ success: true, message: 'Order status updated', data: order });
  } catch (e) {
    console.error('Order updateStatus error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update order status',
    });
  }
};
