import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Address from '../models/Address.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import type { AuthPayload } from '../middleware/requirePermission.js';

function getUserId(req: Request): string | null {
  const auth = req.auth as AuthPayload | undefined;
  return auth?.id && auth.authMethod !== 'admin' ? auth.id : null;
}

type AddressBody = {
  label?: string;
  street?: string;
  city?: string;
  province?: string;
  state?: string;
  zipCode?: string;
  isDefault?: boolean;
};

function provinceFromBody(body: AddressBody): string {
  if (typeof body.province === 'string') return body.province.trim();
  if (typeof body.state === 'string') return body.state.trim();
  return '';
}

/** Accepts lean docs, toObject() output, or other plain shapes without unsafe casts to Record */
type AddressOutInput = {
  _id?: unknown;
  userId?: unknown;
  label?: unknown;
  street?: unknown;
  city?: unknown;
  province?: unknown;
  state?: unknown;
  zipCode?: unknown;
  isDefault?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function normalizeAddressOut(raw: AddressOutInput) {
  const province =
    (typeof raw.province === 'string' && raw.province) ||
    (typeof raw.state === 'string' ? raw.state : '') ||
    '';
  return {
    _id: raw._id,
    userId: raw.userId,
    label: raw.label ?? '',
    street: raw.street ?? '',
    city: raw.city ?? '',
    province,
    zipCode: raw.zipCode ?? '',
    isDefault: Boolean(raw.isDefault),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export const listMine = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    const items = await Address.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
    const normalized = items.map((doc) => normalizeAddressOut(doc));
    return res.status(HTTP_STATUS.OK).json({ success: true, data: { items: normalized } });
  } catch (e) {
    console.error('Address listMine error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list addresses',
    });
  }
};

export const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }
    const body = req.body as AddressBody;
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
      province: provinceFromBody(body),
      zipCode: typeof body.zipCode === 'string' ? body.zipCode.trim() : '',
      isDefault,
    });
    return res
      .status(HTTP_STATUS.CREATED)
      .json({ success: true, data: normalizeAddressOut(address.toObject()) });
  } catch (e) {
    console.error('Address create error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create address',
    });
  }
};

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
    const body = req.body as AddressBody;
    if (typeof body.street === 'string') address.street = body.street.trim();
    if (typeof body.city === 'string') address.city = body.city.trim();
    if (typeof body.label === 'string') address.label = body.label.trim();
    if (typeof body.province === 'string' || typeof body.state === 'string') {
      address.province = provinceFromBody(body);
    }
    if (typeof body.zipCode === 'string') address.zipCode = body.zipCode.trim();
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
    return res
      .status(HTTP_STATUS.OK)
      .json({ success: true, data: normalizeAddressOut(address.toObject()) });
  } catch (e) {
    console.error('Address update error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update address',
    });
  }
};

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
    return res
      .status(HTTP_STATUS.OK)
      .json({ success: true, data: normalizeAddressOut(address.toObject()) });
  } catch (e) {
    console.error('Address setDefault error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to set default address',
    });
  }
};
