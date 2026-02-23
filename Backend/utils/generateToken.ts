/**
 * Token generation utilities
 */

import crypto from 'crypto';

/**
 * Generate a secure random token for email verification
 * @param length - Token length in bytes (default: 32 bytes = 64 hex characters)
 * @returns Random token as hex string
 */
export const generateVerificationToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a token with expiration timestamp
 * @returns Object with token and expiration time
 */
export const generateTokenWithExpiry = (expiresInHours: number = 24) => {
  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);
  
  return {
    token,
    expiresAt,
  };
};
