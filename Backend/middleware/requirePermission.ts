import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import type { Permission } from '../constants/permissions.js';

export interface AuthPayload extends JwtPayload {
  id?: string;
  email?: string;
  authMethod?: string;
  permissions?: string[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const token = req.cookies?.adminAuthToken ?? req.cookies?.authToken ?? (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'No authentication token found',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string') {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    let decoded: AuthPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as AuthPayload;
    } catch {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    req.auth = decoded;

    const permissions = decoded.permissions;
    if (!Array.isArray(permissions) || !permissions.includes(permission)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const token = req.cookies?.adminAuthToken ?? req.cookies?.authToken ?? (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'No authentication token found',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || typeof jwtSecret !== 'string') {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    let decoded: AuthPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as AuthPayload;
    } catch {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    req.auth = decoded;

    const tokenPermissions = decoded.permissions;
    const allowed =
      Array.isArray(tokenPermissions) &&
      permissions.some((p) => tokenPermissions.includes(p));
    if (!allowed) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}

export function requireCustomerAuth(req: Request, res: Response, next: NextFunction): void | Response {
  const token =
    req.cookies?.authToken ??
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'No authentication token found',
    });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || typeof jwtSecret !== 'string') {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Server configuration error',
    });
  }

  let decoded: AuthPayload;
  try {
    decoded = jwt.verify(token, jwtSecret) as AuthPayload;
  } catch {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  if (decoded.authMethod === 'admin' && decoded.id === 'admin') {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Admin token not allowed for this endpoint',
    });
  }

  req.auth = decoded;
  next();
}
