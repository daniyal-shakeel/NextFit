import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { getOrCreateAdminSettings, getPublicIntegrationStatus } from '../services/adminSettingsService.js';

function toPreferencesPayload(doc: {
  defaultStockQuantity: number;
  defaultLowStockThreshold: number;
  shippingRate: number;
  freeShippingMinSubtotal: number;
  aiDescriptionSuggestionsEnabled: boolean;
  aiTagSuggestionsEnabled: boolean;
  updatedAt?: Date;
}) {
  return {
    defaultStockQuantity: doc.defaultStockQuantity,
    defaultLowStockThreshold: doc.defaultLowStockThreshold,
    shippingRate: doc.shippingRate ?? 10,
    freeShippingMinSubtotal: doc.freeShippingMinSubtotal ?? 100,
    aiDescriptionSuggestionsEnabled: doc.aiDescriptionSuggestionsEnabled,
    aiTagSuggestionsEnabled: doc.aiTagSuggestionsEnabled,
    updatedAt: doc.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export const getAdminSettings = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const doc = await getOrCreateAdminSettings();
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        preferences: toPreferencesPayload(doc),
        integrations: getPublicIntegrationStatus(),
      },
    });
  } catch (err) {
    console.error('getAdminSettings error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load settings',
    });
  }
};

export const updateAdminSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const doc = await getOrCreateAdminSettings();
    const {
      defaultStockQuantity,
      defaultLowStockThreshold,
      shippingRate,
      freeShippingMinSubtotal,
      aiDescriptionSuggestionsEnabled,
      aiTagSuggestionsEnabled,
    } = req.body as Record<string, unknown>;

    if (defaultStockQuantity !== undefined) {
      const n = Number(defaultStockQuantity);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'defaultStockQuantity must be a number between 0 and 1000000',
        });
      }
      doc.defaultStockQuantity = Math.floor(n);
    }

    if (defaultLowStockThreshold !== undefined) {
      const n = Number(defaultLowStockThreshold);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'defaultLowStockThreshold must be a number between 0 and 1000000',
        });
      }
      doc.defaultLowStockThreshold = Math.floor(n);
    }

    if (shippingRate !== undefined) {
      const n = Number(shippingRate);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'shippingRate must be a number between 0 and 1000000',
        });
      }
      doc.shippingRate = n;
    }

    if (freeShippingMinSubtotal !== undefined) {
      const n = Number(freeShippingMinSubtotal);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'freeShippingMinSubtotal must be a number between 0 and 1000000000',
        });
      }
      doc.freeShippingMinSubtotal = n;
    }

    if (aiDescriptionSuggestionsEnabled !== undefined) {
      if (typeof aiDescriptionSuggestionsEnabled !== 'boolean') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'aiDescriptionSuggestionsEnabled must be a boolean',
        });
      }
      doc.aiDescriptionSuggestionsEnabled = aiDescriptionSuggestionsEnabled;
    }

    if (aiTagSuggestionsEnabled !== undefined) {
      if (typeof aiTagSuggestionsEnabled !== 'boolean') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'aiTagSuggestionsEnabled must be a boolean',
        });
      }
      doc.aiTagSuggestionsEnabled = aiTagSuggestionsEnabled;
    }

    await doc.save();

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Settings updated',
      data: {
        preferences: toPreferencesPayload(doc),
        integrations: getPublicIntegrationStatus(),
      },
    });
  } catch (err) {
    console.error('updateAdminSettings error:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update settings',
    });
  }
};
