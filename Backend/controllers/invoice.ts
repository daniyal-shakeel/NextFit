import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/** Admin: list invoices, optional userId filter */
export const list = async (req: Request, res: Response): Promise<Response> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 10));
    const skip = (page - 1) * limit;
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : undefined;

    const filter = userId && mongoose.isValidObjectId(userId)
      ? { userId: new mongoose.Types.ObjectId(userId) }
      : {};

    const [items, total] = await Promise.all([
      Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Invoice.countDocuments(filter),
    ]);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    console.error('Invoice list error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list invoices',
    });
  }
};
