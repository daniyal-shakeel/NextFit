import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Address from '../models/Address.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import type { AuthPayload } from '../middleware/requirePermission.js';

function getUserId(req: Request): string | null {
  const auth = req.auth as AuthPayload | undefined;
  return auth?.id && auth.authMethod !== 'admin' ? auth.id : null;
}

/** List my addresses */
export const listMine = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    const items = await Address.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
    return res.status(HTTP_STATUS.OK).json({ success: true, data: { items } });
  } catch (e) {
    console.error('Address listMine error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list addresses',
    });
  }
};

/** Create address */
export const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    const body = req.body as { label?: string; street?: string; city?: string; state?: string; zipCode?: string; country?: string; isDefault?: boolean };
    const street = typeof body.street === 'string' ? body.street.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    if (!street || !city) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'street and city are required',
      });
    }
    const isDefault = Boolean(body.isDefault);
    if (isDefault) {
      await Address.updateMany(
        { userId: new mongoose.Types.ObjectId(userId) },
        { $set: { isDefault: false } }
      );
    }
    const address = await Address.create({
      userId: new mongoose.Types.ObjectId(userId),
      label: typeof body.label === 'string' ? body.label.trim() : '',
      street,
      city,
      state: typeof body.state === 'string' ? body.state.trim() : '',
      zipCode: typeof body.zipCode === 'string' ? body.zipCode.trim() : '',
      country: typeof body.country === 'string' ? body.country.trim() : '',
      isDefault,
    });
    return res.status(HTTP_STATUS.CREATED).json({ success: true, data: address });
  } catch (e) {
    console.error('Address create error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create address',
    });
  }
};

/** Update address */
export const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const id = req.params.id;
    if (!userId || !mongoose.isValidObjectId(userId) || !id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid id' });
    }
    const address = await Address.findOne({ _id: id, userId: new mongoose.Types.ObjectId(userId) });
    if (!address) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Address not found' });
    }
    const body = req.body as { label?: string; street?: string; city?: string; state?: string; zipCode?: string; country?: string; isDefault?: boolean };
    if (typeof body.street === 'string') address.street = body.street.trim();
    if (typeof body.city === 'string') address.city = body.city.trim();
    if (typeof body.label === 'string') address.label = body.label.trim();
    if (typeof body.state === 'string') address.state = body.state.trim();
    if (typeof body.zipCode === 'string') address.zipCode = body.zipCode.trim();
    if (typeof body.country === 'string') address.country = body.country.trim();
    if (typeof body.isDefault === 'boolean') {
      if (body.isDefault) {
        await Address.updateMany(
          { userId: new mongoose.Types.ObjectId(userId) },
          { $set: { isDefault: false } }
        );
        address.isDefault = true;
      } else {
        address.isDefault = false;
      }
    }
    await address.save();
    return res.status(HTTP_STATUS.OK).json({ success: true, data: address });
  } catch (e) {
    console.error('Address update error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update address',
    });
  }
};

/** Delete address */
export const remove = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const id = req.params.id;
    if (!userId || !mongoose.isValidObjectId(userId) || !id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid id' });
    }
    const result = await Address.findOneAndDelete({ _id: id, userId: new mongoose.Types.ObjectId(userId) });
    if (!result) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Address not found' });
    }
    return res.status(HTTP_STATUS.OK).json({ success: true, message: 'Address deleted' });
  } catch (e) {
    console.error('Address remove error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete address',
    });
  }
};

/** Set address as default */
export const setDefault = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    const id = req.params.id;
    if (!userId || !mongoose.isValidObjectId(userId) || !id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid id' });
    }
    const address = await Address.findOne({ _id: id, userId: new mongoose.Types.ObjectId(userId) });
    if (!address) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Address not found' });
    }
    await Address.updateMany(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: { isDefault: false } }
    );
    address.isDefault = true;
    await address.save();
    return res.status(HTTP_STATUS.OK).json({ success: true, data: address });
  } catch (e) {
    console.error('Address setDefault error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to set default address',
    });
  }
};
