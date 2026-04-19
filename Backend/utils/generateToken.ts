import crypto from 'crypto';

export const generateVerificationToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

export const generateTokenWithExpiry = (expiresInHours: number = 24) => {
  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);
  
  return {
    token,
    expiresAt,
  };
};
