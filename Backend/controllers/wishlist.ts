import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Wishlist from '../models/Wishlist.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import type { AuthPayload } from '../middleware/requirePermission.js';

function getUserId(req: Request): string | null {
  const auth = req.auth as AuthPayload | undefined;
  return auth?.id && auth.authMethod !== 'admin' ? auth.id : null;
}

const MAX_ITEMS = 100;

export const getMine = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    let doc = await Wishlist.findOne({ userId }).populate('productIds');
    if (!doc) {
      doc = await Wishlist.create({ userId: new mongoose.Types.ObjectId(userId), productIds: [] });
    }
    return res.status(HTTP_STATUS.OK).json({ success: true, data: doc });
  } catch (e) {
    console.error('Wishlist getMine error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load wishlist',
    });
  }
};

export const updateMine = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    const productIds = (req.body?.productIds as unknown[]) || [];
    if (!Array.isArray(productIds)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'productIds must be an array',
      });
    }
    const ids = productIds
      .slice(0, MAX_ITEMS)
      .map((p) => (typeof p === 'string' && mongoose.isValidObjectId(p) ? new mongoose.Types.ObjectId(p) : null))
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const doc = await Wishlist.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: { productIds: ids } },
      { new: true, upsert: true, runValidators: true }
    );
    return res.status(HTTP_STATUS.OK).json({ success: true, data: doc });
  } catch (e) {
    console.error('Wishlist updateMine error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update wishlist',
    });
  }
};

export const addProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const productId = req.body?.productId ?? req.params?.productId;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Valid productId required' });
    }
    const oid = new mongoose.Types.ObjectId(productId as string);
    let doc = await Wishlist.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!doc) {
      doc = await Wishlist.create({ userId: new mongoose.Types.ObjectId(userId), productIds: [oid] });
    } else {
      if (doc.productIds.some((id) => id.equals(oid))) {
        return res.status(HTTP_STATUS.OK).json({ success: true, data: doc, message: 'Already in wishlist' });
      }
      if (doc.productIds.length >= MAX_ITEMS) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Wishlist is full',
        });
      }
      doc.productIds.push(oid);
      await doc.save();
    }
    return res.status(HTTP_STATUS.OK).json({ success: true, data: doc });
  } catch (e) {
    console.error('Wishlist addProduct error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to add to wishlist',
    });
  }
};

export const removeProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const rawProductId = req.params?.productId;
    const productId = typeof rawProductId === 'string' ? rawProductId : Array.isArray(rawProductId) ? rawProductId[0] : undefined;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    if (!productId || !mongoose.isValidObjectId(productId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Valid productId required' });
    }
    const oid = new mongoose.Types.ObjectId(productId);
    const doc = await Wishlist.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { productIds: oid } },
      { new: true }
    );
    return res.status(HTTP_STATUS.OK).json({ success: true, data: doc ?? { productIds: [] } });
  } catch (e) {
    console.error('Wishlist removeProduct error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to remove from wishlist',
    });
  }
};
