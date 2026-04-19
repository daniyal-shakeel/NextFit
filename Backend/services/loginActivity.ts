import LoginActivity from '../models/LoginActivity.js';
import type { Request } from 'express';

export async function recordLoginActivity(
  userId: string,
  success: boolean,
  req: Request,
  failureReason?: string
): Promise<void> {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || undefined;
    const userAgent = (req.headers['user-agent'] as string)?.slice(0, 500);
    await LoginActivity.create({
      userId,
      ip,
      userAgent,
      success,
      failureReason: failureReason?.slice(0, 200),
    });
  } catch (err) {
    console.error('Failed to record login activity:', err);
  }
}
