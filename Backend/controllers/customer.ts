import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Address from '../models/Address.js';
import Order from '../models/Order.js';
import User, {
  AccountStatus,
  AuthMethod,
  type IShippingAddress,
  type IBillingAddress,
  type IPaymentMethod,
} from '../models/User.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import { MONGODB_ERROR_NAMES } from '../constants/errorCodes.js';
import type { AuthPayload } from '../middleware/requirePermission.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

const ADDRESS_LABELS: AddressLabel[] = ['home', 'office', 'other'];
type AddressLabel = 'home' | 'office' | 'other';

function getUserId(req: Request): string | null {
  const auth = req.auth as AuthPayload | undefined;
  return auth?.id && auth.authMethod !== 'admin' ? auth.id : null;
}

function sanitizeUserForResponse(user: import('../models/User.js').IUser) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete (obj as Record<string, unknown>).password;
  delete (obj as Record<string, unknown>).otpCode;
  return obj;
}

function getDisplayPhone(user: { phone?: string; phoneCountryCode?: string }): string | undefined {
  const p = user.phone;
  const cc = user.phoneCountryCode;
  if (!p) return undefined;
  if (typeof p === 'string' && (p.startsWith('+') || p.length > 15)) return p.trim(); // legacy full E.164
  return `${cc || ''}${p}`.trim() || undefined;
}

function shippingDedupKey(a: {
  street?: string;
  city?: string;
  postalCode?: string;
  label?: string;
}): string {
  return [
    String(a.street ?? '').trim().toLowerCase(),
    String(a.city ?? '').trim().toLowerCase(),
    String(a.postalCode ?? '').trim(),
    String(a.label ?? '').trim().toLowerCase(),
  ].join('|');
}

function mergeShippingForAdmin(
  embedded: IShippingAddress[] | undefined,
  addressDocs: Array<{
    _id: unknown;
    label?: string;
    street?: string;
    city?: string;
    province?: string;
    zipCode?: string;
    isDefault?: boolean;
  }>
): Array<Record<string, unknown>> {
  const fromCollection = addressDocs.map((a) => ({
    _id: String(a._id),
    source: 'address_book' as const,
    label: (a.label && String(a.label).trim()) || undefined,
    street: a.street ?? '',
    city: a.city ?? '',
    province: a.province ?? '',
    postalCode: a.zipCode ?? '',
    isDefault: Boolean(a.isDefault),
  }));

  const fromEmbedded = (embedded ?? []).map((a) => ({
    source: 'profile_embedded' as const,
    label:
      typeof a.label === 'string'
        ? a.label
        : a.label != null
          ? String(a.label)
          : undefined,
    street: a.street ?? '',
    city: a.city ?? '',
    province: a.province ?? '',
    postalCode: a.postalCode ?? '',
    deliveryInstructions: a.deliveryInstructions,
    isDefault: Boolean(a.isDefault),
  }));

  if (fromCollection.length === 0) return fromEmbedded;
  if (fromEmbedded.length === 0) return fromCollection;

  const keys = new Set(fromCollection.map((r) => shippingDedupKey(r)));
  const extra = fromEmbedded.filter((e) => !keys.has(shippingDedupKey(e)));
  return [...fromCollection, ...extra];
}

const ORDER_STATUSES_EXCLUDED_FROM_SPEND = new Set([
  'cancelled',
  'refunded',
  'partially_refunded',
]);

const HIGH_PAYING_MIN_SPEND = 25_000;
const ORDER_STATUSES_PIPELINE = new Set(['pending', 'confirmed', 'processing', 'shipped']);

async function buildCustomerOrderInsights(userId: string) {
  const oid = new mongoose.Types.ObjectId(userId);
  const orders = await Order.find({ userId: oid }).select('total status createdAt currency').lean();

  let totalSpent = 0;
  let revenueOrderCount = 0;
  let activePipelineCount = 0;
  let deliveredCount = 0;
  let lastOrderAt: Date | null = null;
  let firstOrderAt: Date | null = null;
  let currency = 'PKR';

  for (const o of orders) {
    const created = o.createdAt ? new Date(o.createdAt) : null;
    if (created && !Number.isNaN(created.getTime())) {
      if (!lastOrderAt || created > lastOrderAt) lastOrderAt = created;
      if (!firstOrderAt || created < firstOrderAt) firstOrderAt = created;
    }
    if (typeof o.currency === 'string' && o.currency.trim()) {
      currency = o.currency.trim();
    }

    const st = String(o.status ?? '');
    if (!ORDER_STATUSES_EXCLUDED_FROM_SPEND.has(st)) {
      totalSpent += Number(o.total) || 0;
      revenueOrderCount += 1;
    }
    if (ORDER_STATUSES_PIPELINE.has(st)) activePipelineCount += 1;
    if (st === 'delivered') deliveredCount += 1;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    orderCount: orders.length,
    revenueOrderCount,
    totalSpent: round2(totalSpent),
    averageOrderValue: revenueOrderCount > 0 ? round2(totalSpent / revenueOrderCount) : 0,
    lastOrderAt: lastOrderAt?.toISOString() ?? null,
    firstOrderAt: firstOrderAt?.toISOString() ?? null,
    currency,
    activePipelineCount,
    deliveredCount,
    cancelledOrRefundedCount: orders.filter((o) =>
      ORDER_STATUSES_EXCLUDED_FROM_SPEND.has(String(o.status ?? ''))
    ).length,
  };
}

export const getMe = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid user id',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Account is suspended or deleted',
      });
    }

    const data = sanitizeUserForResponse(user);
    const email = user.authMethod === AuthMethod.GOOGLE ? (user.email || user.googleEmail) : user.email;
    const avatar = user.avatar || (user.authMethod === AuthMethod.GOOGLE ? user.googleAvatar : undefined);
    const phone = getDisplayPhone(user);
    const bm = user.bodyMeasurements;
    const measurements = bm
      ? {
          chest: bm.chest,
          waist: bm.waist,
          hips: bm.hips,
          height: bm.height,
          weight: bm.weight,
          shirtSize: bm.preferredShirtSize,
          pantsSize: bm.preferredPantsSize,
        }
      : undefined;
    const phoneNumberRest = user.phone && !String(user.phone).startsWith('+') && String(user.phone).length <= 15
      ? user.phone
      : undefined;
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...data,
        email,
        avatar,
        phone,
        phoneCountryCode: user.phoneCountryCode,
        phoneNumber: phoneNumberRest,
        measurements,
      },
    });
  } catch (e) {
    console.error('Customer getMe error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load profile',
    });
  }
};

export const updateMe = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid user id',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Account is suspended or deleted',
      });
    }

    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Request body is required',
      });
    }

    const nameTrim = typeof body.name === 'string' ? body.name.trim() : '';
    if (body.name !== undefined) {
      if (nameTrim.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Name cannot be empty',
        });
      }
      if (nameTrim.length > 100) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Name cannot exceed 100 characters',
        });
      }
      user.name = nameTrim;
    }

    if (body.email !== undefined && user.authMethod === AuthMethod.EMAIL) {
      const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRaw.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Email is required for your account',
        });
      }
      if (!emailRegex.test(emailRaw)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Invalid email format',
        });
      }
      if (emailRaw.length > 254) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Email is too long',
        });
      }
      const existing = await User.findOne({ email: emailRaw, _id: { $ne: user._id } });
      if (existing) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'This email is already in use',
        });
      }
      user.email = emailRaw;
    }

    if (body.email !== undefined && (user.authMethod === AuthMethod.PHONE || user.authMethod === AuthMethod.GOOGLE)) {
      const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRaw.length > 0) {
        if (!emailRegex.test(emailRaw)) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Invalid email format',
          });
        }
        if (emailRaw.length > 254) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: 'Email is too long',
          });
        }
        const existing = await User.findOne({ email: emailRaw, _id: { $ne: user._id } });
        if (existing) {
          return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: 'This email is already in use',
          });
        }
        user.email = emailRaw;
      } else {
        user.email = undefined;
      }
    }

    if (typeof body.avatar === 'string' && body.avatar.trim().length > 0) {
      const url = body.avatar.trim();
      if (url.length > 2000) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Avatar URL is too long',
        });
      }
      user.avatar = url;
    }

    if (body.phoneCountryCode !== undefined || body.phone !== undefined) {
      const rawCode = typeof body.phoneCountryCode === 'string' ? body.phoneCountryCode.trim() : (user.phoneCountryCode ?? '');
      const rawRest = typeof body.phone === 'string' ? body.phone.trim().replace(/\D/g, '') : (user.phone ?? '');
      const code = rawCode.length > 0 ? (rawCode.startsWith('+') ? rawCode : `+${rawCode}`).slice(0, 6) : undefined;
      const rest = rawRest.slice(0, 20);
      if (rest.length > 0 && (!code || code.length < 2)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Phone country code is required when phone number is set (e.g. +92)',
        });
      }
      if (code && rest.length > 0) {
        const existing = await User.findOne({
          phoneCountryCode: code,
          phone: rest,
          _id: { $ne: user._id },
        });
        if (existing) {
          return res.status(HTTP_STATUS.CONFLICT).json({
            success: false,
            message: 'This phone number is already in use',
          });
        }
      }
      const canClear = user.authMethod !== AuthMethod.PHONE;
      if (code && rest.length > 0) {
        user.phoneCountryCode = code;
        user.phone = rest;
      } else if (canClear) {
        user.phoneCountryCode = undefined;
        user.phone = undefined;
      }
    }

    if (body.measurements !== undefined && typeof body.measurements === 'object' && body.measurements !== null) {
      const m = body.measurements as Record<string, unknown>;
      const num = (val: unknown, min: number, max: number): number | undefined => {
        const n = typeof val === 'number' ? val : typeof val === 'string' ? parseFloat(val) : NaN;
        if (Number.isNaN(n)) return undefined;
        if (n < min || n > max) return undefined;
        return n;
      };
      user.bodyMeasurements = {
        chest: num(m.chest, 0, 100),
        waist: num(m.waist, 0, 100),
        hips: num(m.hips, 0, 100),
        height: num(m.height, 0, 300),
        weight: num(m.weight, 0, 500),
        preferredShirtSize: typeof m.shirtSize === 'string' ? m.shirtSize.trim().slice(0, 20) : typeof m.preferredShirtSize === 'string' ? (m.preferredShirtSize as string).trim().slice(0, 20) : undefined,
        preferredPantsSize: typeof m.pantsSize === 'string' ? m.pantsSize.trim().slice(0, 20) : typeof m.preferredPantsSize === 'string' ? (m.preferredPantsSize as string).trim().slice(0, 20) : undefined,
      };
    }

    if (Array.isArray(body.shippingAddresses)) {
      const max = 20;
      const list = (body.shippingAddresses as unknown[]).slice(0, max).filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null);
      user.shippingAddresses = list.map((a) => {
        const label = ADDRESS_LABELS.includes((a.label as AddressLabel) || '') ? (a.label as AddressLabel) : 'home';
        return {
          label,
          street: String(a.street ?? '').trim().slice(0, 200),
          city: String(a.city ?? '').trim().slice(0, 100),
          province: String(a.province ?? a.state ?? '').trim().slice(0, 100),
          postalCode: String(a.postalCode ?? '').trim().slice(0, 20),
          deliveryInstructions: String(a.deliveryInstructions ?? '').trim().slice(0, 500),
          isDefault: Boolean(a.isDefault),
        } as IShippingAddress;
      });
      if (user.shippingAddresses.length > 0 && user.defaultShippingAddressIndex >= user.shippingAddresses.length) {
        user.defaultShippingAddressIndex = 0;
      }
    }

    if (typeof body.defaultShippingAddressIndex === 'number' && body.defaultShippingAddressIndex >= 0) {
      const idx = Math.min(Math.floor(body.defaultShippingAddressIndex), (user.shippingAddresses?.length ?? 1) - 1);
      user.defaultShippingAddressIndex = Math.max(0, idx);
    }

    if (body.billingAddress !== undefined) {
      if (body.billingAddress === null) {
        user.billingAddress = undefined;
      } else if (typeof body.billingAddress === 'object' && body.billingAddress !== null) {
        const b = body.billingAddress as Record<string, unknown>;
        user.billingAddress = {
          street: String(b.street ?? '').trim().slice(0, 200),
          city: String(b.city ?? '').trim().slice(0, 100),
          province: String(b.province ?? b.state ?? '').trim().slice(0, 100),
          postalCode: String(b.postalCode ?? '').trim().slice(0, 20),
        };
      }
    }

    if (Array.isArray(body.paymentMethods)) {
      const max = 10;
      const list = (body.paymentMethods as unknown[]).slice(0, max).filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null && typeof (p as Record<string, unknown>).paymentToken === 'string');
      user.paymentMethods = list.map((p: Record<string, unknown>) => ({
        paymentToken: String(p.paymentToken).trim(),
        brand: typeof p.brand === 'string' ? p.brand.trim() : undefined,
        last4: typeof p.last4 === 'string' ? p.last4.trim().slice(0, 4) : undefined,
        expiryMonth: typeof p.expiryMonth === 'number' && p.expiryMonth >= 1 && p.expiryMonth <= 12 ? p.expiryMonth : undefined,
        expiryYear: typeof p.expiryYear === 'number' && p.expiryYear >= 2000 && p.expiryYear <= 2100 ? p.expiryYear : undefined,
        isDefault: Boolean(p.isDefault),
      })) as IPaymentMethod[];
    }

    await user.save();

    const data = sanitizeUserForResponse(user);
    const email = user.authMethod === AuthMethod.GOOGLE ? (user.email || user.googleEmail) : user.email;
    const avatar = user.avatar || (user.authMethod === AuthMethod.GOOGLE ? user.googleAvatar : undefined);
    const phone = getDisplayPhone(user);
    const bm = user.bodyMeasurements;
    const measurements = bm
      ? {
          chest: bm.chest,
          waist: bm.waist,
          hips: bm.hips,
          height: bm.height,
          weight: bm.weight,
          shirtSize: bm.preferredShirtSize,
          pantsSize: bm.preferredPantsSize,
        }
      : undefined;
    const phoneNumberRest = user.phone && !String(user.phone).startsWith('+') && String(user.phone).length <= 15 ? user.phone : undefined;
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Profile updated',
      data: {
        ...data,
        email,
        avatar,
        phone,
        phoneCountryCode: user.phoneCountryCode,
        phoneNumber: phoneNumberRest,
        measurements,
      },
    });
  } catch (e) {
    console.error('Customer updateMe error:', e);
    const err = e as { name?: string; errors?: Record<string, { message?: string }> };
    if (err.name === MONGODB_ERROR_NAMES.VALIDATION_ERROR) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation failed',
        errors: err.errors ? Object.values(err.errors).map((e2) => e2.message) : [],
      });
    }
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

export const uploadAvatarHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (!file || !file.buffer) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'No image file provided. Upload a JPEG, PNG, GIF, or WebP (max 10MB).',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'User not found',
      });
    }
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Account is suspended or deleted',
      });
    }

    const avatarUrl = await uploadToCloudinary(file.buffer);
    if (!avatarUrl) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message: 'Image upload is temporarily unavailable. Please try again later.',
      });
    }
    user.avatar = avatarUrl;
    await user.save();

    const data = sanitizeUserForResponse(user);
    const email = user.authMethod === AuthMethod.GOOGLE ? (user.email || user.googleEmail) : user.email;
    const avatar = user.avatar || (user.authMethod === AuthMethod.GOOGLE ? user.googleAvatar : undefined);
    const phone = getDisplayPhone(user);
    const bm = user.bodyMeasurements;
    const measurements = bm
      ? {
          chest: bm.chest,
          waist: bm.waist,
          hips: bm.hips,
          height: bm.height,
          weight: bm.weight,
          shirtSize: bm.preferredShirtSize,
          pantsSize: bm.preferredPantsSize,
        }
      : undefined;

    const phoneNumberRest = user.phone && !String(user.phone).startsWith('+') && String(user.phone).length <= 15 ? user.phone : undefined;
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Avatar updated',
      data: {
        ...data,
        email,
        avatar,
        phone,
        phoneCountryCode: user.phoneCountryCode,
        phoneNumber: phoneNumberRest,
        measurements,
      },
    });
  } catch (e) {
    console.error('Customer uploadAvatar error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update avatar',
    });
  }
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  try {
    const limitRaw = req.query.limit;
    const skipRaw = req.query.skip;
    const pageRaw = req.query.page;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
    const authMethodParam = typeof req.query.authMethod === 'string' ? req.query.authMethod.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const filter: Record<string, unknown> = {};
    if (status && ['active', 'suspended', 'deleted'].includes(status)) {
      filter.accountStatus = status;
    }
    if (
      authMethodParam &&
      (Object.values(AuthMethod) as string[]).includes(authMethodParam)
    ) {
      filter.authMethod = authMethodParam;
    }
    if (search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(search), 'i') },
        { email: new RegExp(escapeRegex(search), 'i') },
        { googleEmail: new RegExp(escapeRegex(search), 'i') },
        { phone: new RegExp(escapeRegex(search), 'i') },
        { customerId: new RegExp(escapeRegex(search), 'i') },
      ];
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

    let query = User.find(filter).select('-password -otpCode').sort({ createdAt: -1 });
    if (limit !== undefined) {
      query = query.skip(skip).limit(limit);
    }

    const [usersRaw, total] = await Promise.all([query.lean(), User.countDocuments(filter)]);
    const users = (usersRaw as unknown as Record<string, unknown>[]).map((u) => ({
      ...u,
      phone: getDisplayPhone(u as { phone?: string; phoneCountryCode?: string }),
    })) as Array<Record<string, unknown> & { _id: unknown; phone?: string | undefined }>;

    const excludedStatuses = [...ORDER_STATUSES_EXCLUDED_FROM_SPEND];
    let items: (typeof users[number] & { highPaying: boolean })[];
    if (users.length === 0) {
      items = [];
    } else {
      const userObjectIds = users.map((u) => new mongoose.Types.ObjectId(String(u._id)));
      const spendByUser = await Order.aggregate<{ _id: mongoose.Types.ObjectId; totalSpent: number }>([
        {
          $match: {
            userId: { $in: userObjectIds },
            status: { $nin: excludedStatuses },
          },
        },
        {
          $group: {
            _id: '$userId',
            totalSpent: { $sum: '$total' },
          },
        },
      ]);
      const highIds = new Set(
        spendByUser
          .filter((r) => (r.totalSpent ?? 0) >= HIGH_PAYING_MIN_SPEND)
          .map((r) => String(r._id))
      );
      items = users.map((u) => ({
        ...u,
        highPaying: highIds.has(String(u._id)),
      }));
    }

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
      data.hasMore = skip + users.length < total;
    }

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data,
    });
  } catch (e) {
    console.error('Customer list error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to list customers',
    });
  }
};

export const getOne = async (req: Request, res: Response): Promise<Response> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || typeof id !== 'string' || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid customer id',
      });
    }

    const user = await User.findById(id).select('-password -otpCode');
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const addressDocs = await Address.find({ userId: new mongoose.Types.ObjectId(id) })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    const data = sanitizeUserForResponse(user);
    const shippingAddresses = mergeShippingForAdmin(user.shippingAddresses, addressDocs);
    const insights = await buildCustomerOrderInsights(id);
    const highPaying = insights.totalSpent >= HIGH_PAYING_MIN_SPEND;

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        ...data,
        email: user.authMethod === AuthMethod.GOOGLE ? user.googleEmail : user.email,
        avatar: user.authMethod === AuthMethod.GOOGLE ? user.googleAvatar : user.avatar,
        phone: getDisplayPhone(user),
        shippingAddresses,
        insights,
        highPaying,
      },
    });
  } catch (e) {
    console.error('Customer getOne error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load customer',
    });
  }
};

export const updateStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid customer id',
      });
    }

    const body = req.body as { status?: string };
    const status = body?.status;
    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'status must be "active" or "suspended"',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Customer not found',
      });
    }

    user.accountStatus = status as AccountStatus;
    await user.save();

    const data = sanitizeUserForResponse(user);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: status === 'suspended' ? 'Customer suspended' : 'Customer unsuspended',
      data: {
        ...data,
        email: user.authMethod === AuthMethod.GOOGLE ? user.googleEmail : user.email,
        avatar: user.authMethod === AuthMethod.GOOGLE ? user.googleAvatar : user.avatar,
      },
    });
  } catch (e) {
    console.error('Customer updateStatus error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update status',
    });
  }
};

export const getLoginActivity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Invalid customer id',
      });
    }
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 50));
    const LoginActivity = (await import('../models/LoginActivity.js')).default;
    const activities = await LoginActivity.find({ userId: new mongoose.Types.ObjectId(id) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: activities,
    });
  } catch (e) {
    console.error('Customer getLoginActivity error:', e);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to load login activity',
    });
  }
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
