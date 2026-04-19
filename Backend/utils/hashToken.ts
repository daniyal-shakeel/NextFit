
import crypto from 'crypto';

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
export const compareToken = (rawToken: string, hashedToken: string): boolean => {
  const hashedInput = hashToken(rawToken);
  if (hashedInput.length !== hashedToken.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(hashedInput, 'utf8'),
    Buffer.from(hashedToken, 'utf8')
  );
};
