import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import type { AuthPayload } from '../middleware/requirePermission.js';
import { MAX_ITEMS, MAX_QUANTITY, MIN_QUANTITY } from '../models/Cart.js';

const SHIPPING_FREE_THRESHOLD = 100;
const SHIPPING_COST = 10;

function getUserId(req: Request): string | null {
  const auth = req.auth as AuthPayload | undefined;
  return auth?.id && auth.authMethod !== 'admin' ? auth.id : null;
}

function ensureQuantity(value: unknown): number {
  const n = Number(value);
  if (Number.isNaN(n) || n < MIN_QUANTITY) return MIN_QUANTITY;
  if (n > MAX_QUANTITY) return MAX_QUANTITY;
  return Math.floor(n);
}

function trimOptionalString(value: unknown, maxLen: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s.slice(0, maxLen);
}

interface PopulatedItem {
  _id: mongoose.Types.ObjectId;
  productId: { _id: mongoose.Types.ObjectId; name: string; basePrice: number; mainImageUrl?: string };
  quantity: number;
  size?: string;
  color?: string;
}

async function buildCartPayload(doc: { items: PopulatedItem[] } | null): Promise<{
  items: Array<{
    id: string;
    productId: string;
    product: { id: string; name: string; basePrice: number; mainImageUrl?: string };
    quantity: number;
    size?: string;
    color?: string;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
}> {
  if (!doc || !doc.items || doc.items.length === 0) {
    return { items: [], subtotal: 0, shipping: 0, total: 0 };
  }
  const items = doc.items.map((it) => {
    const product = it.productId as unknown as { _id: mongoose.Types.ObjectId; name: string; basePrice: number; mainImageUrl?: string };
    const unitPrice = Number(product?.basePrice) || 0;
    const qty = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, it.quantity));
    const lineTotal = unitPrice * qty;
    return {
      id: (it._id as mongoose.Types.ObjectId).toString(),
      productId: (product?._id ?? it.productId).toString(),
      product: {
        id: (product?._id ?? it.productId).toString(),
        name: product?.name ?? '',
        basePrice: unitPrice,
        mainImageUrl: product?.mainImageUrl,
      },
      quantity: qty,
      size: it.size,
      color: it.color,
      unitPrice,
      lineTotal,
    };
  });
  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const shipping = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;
  return { items, subtotal, shipping, total };
}

export const getMine = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    let doc = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) })
      .populate('items.productId', 'name basePrice mainImageUrl')
      .lean();
    if (!doc) {
      await Cart.create({ userId: new mongoose.Types.ObjectId(userId), items: [] });
      doc = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) })
        .populate('items.productId', 'name basePrice mainImageUrl')
        .lean();
    }
    const payload = await buildCartPayload(doc as unknown as { items: PopulatedItem[] });
    return res.status(HTTP_STATUS.OK).json({ success: true, data: payload });
  } catch (e) {
    console.error('Cart getMine error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load cart',
    });
  }
};

export const updateMine = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    const raw = req.body?.items;
    if (!Array.isArray(raw)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'items must be an array of { productId, quantity, size?, color? }',
      });
    }
    const items: { productId: mongoose.Types.ObjectId; quantity: number; size?: string; color?: string }[] = [];
    for (let i = 0; i < Math.min(raw.length, MAX_ITEMS); i++) {
      const it = raw[i];
      const pid = it?.productId;
      if (!pid || !mongoose.isValidObjectId(pid)) continue;
      const product = await Product.findById(pid);
      if (!product) continue;
      const quantity = ensureQuantity(it?.quantity);
      const size = trimOptionalString(it?.size, 50);
      const color = trimOptionalString(it?.color, 50);
      items.push({
        productId: new mongoose.Types.ObjectId(pid),
        quantity,
        ...(size !== undefined && { size }),
        ...(color !== undefined && { color }),
      });
    }
    const doc = await Cart.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: { items } },
      { new: true, upsert: true, runValidators: true }
    );
    const populated = await Cart.findById(doc._id)
      .populate('items.productId', 'name basePrice mainImageUrl')
      .lean();
    const payload = await buildCartPayload(populated as unknown as { items: PopulatedItem[] });
    return res.status(HTTP_STATUS.OK).json({ success: true, data: payload });
  } catch (e) {
    console.error('Cart updateMine error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update cart',
    });
  }
};

export const addItem = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const productId = req.body?.productId ?? req.params?.productId;
    const quantity = ensureQuantity(req.body?.quantity ?? 1);
    const size = trimOptionalString(req.body?.size, 50);
    const color = trimOptionalString(req.body?.color, 50);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Valid productId is required',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Product not found',
      });
    }

    const oid = new mongoose.Types.ObjectId(productId as string);
    let doc = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!doc) {
      doc = await Cart.create({
        userId: new mongoose.Types.ObjectId(userId),
        items: [{ productId: oid, quantity, size, color }],
      });
    } else {
      const sameLine = doc.items.find(
        (i) =>
          i.productId.equals(oid) &&
          (i.size ?? '') === (size ?? '') &&
          (i.color ?? '') === (color ?? '')
      );
      if (sameLine) {
        sameLine.quantity = Math.min(MAX_QUANTITY, sameLine.quantity + quantity);
      } else {
        if (doc.items.length >= MAX_ITEMS) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: `Cart cannot exceed ${MAX_ITEMS} items`,
          });
        }
        doc.items.push({ productId: oid, quantity, size, color });
      }
      await doc.save();
    }

    const populated = await Cart.findById(doc._id)
      .populate('items.productId', 'name basePrice mainImageUrl')
      .lean();
    const payload = await buildCartPayload(populated as unknown as { items: PopulatedItem[] });
    return res.status(HTTP_STATUS.OK).json({ success: true, data: payload });
  } catch (e) {
    console.error('Cart addItem error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to add to cart',
    });
  }
};

export const updateItem = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const itemId = req.params?.itemId;
    const quantity = ensureQuantity(req.body?.quantity ?? 1);

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    if (!itemId || !mongoose.isValidObjectId(itemId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Valid itemId is required',
      });
    }

    const doc = await Cart.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      'items._id': new mongoose.Types.ObjectId(itemId),
    });
    if (!doc) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Cart item not found',
      });
    }
    const item = doc.items.id(itemId as string);
    if (!item) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Cart item not found',
      });
    }
    item.quantity = quantity;
    await doc.save();

    const populated = await Cart.findById(doc._id)
      .populate('items.productId', 'name basePrice mainImageUrl')
      .lean();
    const payload = await buildCartPayload(populated as unknown as { items: PopulatedItem[] });
    return res.status(HTTP_STATUS.OK).json({ success: true, data: payload });
  } catch (e) {
    console.error('Cart updateItem error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update cart item',
    });
  }
};

export const removeItem = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const itemId = req.params?.itemId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    if (!itemId || !mongoose.isValidObjectId(itemId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Valid itemId is required',
      });
    }

    const doc = await Cart.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { items: { _id: new mongoose.Types.ObjectId(itemId) } } },
      { new: true }
    );
    if (!doc) {
      const payload = await buildCartPayload(null);
      return res.status(HTTP_STATUS.OK).json({ success: true, data: payload });
    }
    const populated = await Cart.findById(doc._id)
      .populate('items.productId', 'name basePrice mainImageUrl')
      .lean();
    const payload = await buildCartPayload(populated as unknown as { items: PopulatedItem[] });
    return res.status(HTTP_STATUS.OK).json({ success: true, data: payload });
  } catch (e) {
    console.error('Cart removeItem error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to remove from cart',
    });
  }
};
