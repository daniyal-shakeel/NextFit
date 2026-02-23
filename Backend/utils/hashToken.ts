/**
 * Token hashing utilities for secure storage
 */

import crypto from 'crypto';

/**
 * Hash a token using SHA-256
 * @param token - Raw token to hash
 * @returns Hashed token as hex string
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Compare a raw token with a hashed token
 * @param rawToken - Raw token from user
 * @param hashedToken - Hashed token from database
 * @returns True if tokens match
 */
export const compareToken = (rawToken: string, hashedToken: string): boolean => {
  const hashedInput = hashToken(rawToken);
  // Use timing-safe comparison to prevent timing attacks
  if (hashedInput.length !== hashedToken.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(hashedInput, 'utf8'),
    Buffer.from(hashedToken, 'utf8')
  );
};
