import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { getOrCreateAdminSettings } from '../services/adminSettingsService.js';

export const getPublicShipping = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const doc = await getOrCreateAdminSettings();
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        shippingRate: doc.shippingRate ?? 10,
        freeShippingMinSubtotal: doc.freeShippingMinSubtotal ?? 100,
      },
    });
  } catch (err) {
    console.error('getPublicShipping error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load shipping settings',
    });
  }
};
