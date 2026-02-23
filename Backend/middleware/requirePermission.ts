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

/**
 * Middleware: verify JWT from cookie or Authorization header and require a permission.
 * Attaches decoded payload to req.auth. If token lacks the required permission, responds 403.
 */
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

/**
 * Middleware: verify user (customer) JWT from authToken cookie or Bearer only.
 * Rejects admin token so only real customers can access "me" routes.
 * Attaches decoded payload to req.auth.
 */
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
