import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order, { type OrderStatus } from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Address from '../models/Address.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import type { AuthPayload } from '../middleware/requirePermission.js';

const VALID_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered',
  'cancelled', 'refunded', 'partially_refunded',
];

function getUserId(req: Request): string | null {
  const auth = req.auth as AuthPayload | undefined;
  return auth?.id && auth.authMethod !== 'admin' ? auth.id : null;
}

type ShippingSnapshot = {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  label?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
};

/** Customer: create order (from cart/checkout) */
export const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }

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

    const user = await User.findById(userId);
    if (!user || user.accountStatus !== 'active') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Account not active' });
    }

    let shippingSnapshot: ShippingSnapshot | undefined;

    if (body.addressId && mongoose.isValidObjectId(body.addressId)) {
      const saved = await Address.findOne({
        _id: body.addressId,
        userId: new mongoose.Types.ObjectId(userId),
      }).lean();
      if (saved) {
        shippingSnapshot = {
          street: saved.street,
          city: saved.city,
          state: saved.state,
          zipCode: saved.zipCode,
          country: saved.country,
          label: saved.label,
        };
      }
    }

    if (!shippingSnapshot && body.shippingAddress && typeof body.shippingAddress === 'object') {
      const s = body.shippingAddress;
      shippingSnapshot = {
        street: typeof s.street === 'string' ? s.street.trim() : undefined,
        city: typeof s.city === 'string' ? s.city.trim() : undefined,
        state: typeof s.state === 'string' ? s.state.trim() : undefined,
        zipCode: typeof s.zipCode === 'string' ? s.zipCode.trim() : (typeof (s as { zip?: string }).zip === 'string' ? (s as { zip: string }).zip.trim() : undefined),
        country: typeof s.country === 'string' ? s.country.trim() : undefined,
        label: typeof s.label === 'string' ? s.label.trim() : undefined,
        firstName: typeof s.firstName === 'string' ? s.firstName.trim() : undefined,
        lastName: typeof s.lastName === 'string' ? s.lastName.trim() : undefined,
        phone: typeof s.phone === 'string' ? s.phone.trim() : undefined,
        email: typeof s.email === 'string' ? s.email.trim() : undefined,
      };
      if (body.saveAddress && shippingSnapshot.street && shippingSnapshot.city) {
        const isDefault = Boolean(body.setAsDefault);
        if (isDefault) {
          await Address.updateMany(
            { userId: new mongoose.Types.ObjectId(userId) },
            { $set: { isDefault: false } }
          );
        }
        await Address.create({
          userId: new mongoose.Types.ObjectId(userId),
          label: shippingSnapshot.label || 'Checkout',
          street: shippingSnapshot.street,
          city: shippingSnapshot.city,
          state: shippingSnapshot.state || '',
          zipCode: shippingSnapshot.zipCode || '',
          country: shippingSnapshot.country || '',
          isDefault,
        });
      }
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

    const discountAmount = 0; // TODO: apply discountCode
    const total = Math.max(0, subtotal - discountAmount);

    const order = await Order.create({
      userId: new mongoose.Types.ObjectId(userId),
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

/** Customer: list my orders */
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

/** Customer: get one of my orders */
export const getMine = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const id = req.params.id;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid order id' });
    }

    const order = await Order.findOne({ _id: id, userId });
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

/** Admin: list all orders (optional userId filter; userId can be MongoDB _id or customerId e.g. CUS-xxx) */
export const list = async (req: Request, res: Response): Promise<Response> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 10));
    const skip = (page - 1) * limit;
    const userIdParam = typeof req.query.userId === 'string' ? req.query.userId.trim() : undefined;
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

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'customerId')
        .lean(),
      Order.countDocuments(filter),
    ]);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error('Order list error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list orders',
    });
  }
};

/** Admin: get one order */
export const getOne = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid order id' });
    }
    const order = await Order.findById(id).populate('userId', 'customerId');
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

/** Admin: update order status */
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
    );
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
