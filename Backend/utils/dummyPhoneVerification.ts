/**
 * Dummy phone verification for development only.
 * Isolated so it can be removed without changing the main auth flow.
 * Development: backend accepts dummy phone+code OR Firebase idToken (you can use Firebase test numbers in dev).
 * Production: only Firebase idToken (real OTP).
 */

const DUMMY_VERIFICATION_CODE = '220622';
/** E.164 for allowed dummy numbers: +923287751754 and 03287751754 → same. */
const DUMMY_ALLOWED_E164 = '+923287751754';

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) return `+92${digits}`;
  if (digits.length >= 10) return `+92${digits.slice(-10)}`;
  return `+92${digits}`;
}

/**
 * Dummy allowed only in development (NODE_ENV === 'development').
 * Production always uses Firebase OTP.
 */
export function isDummyPhoneVerificationEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * If dummy mode is enabled and (dummyPhone, dummyCode) are valid, returns normalized E.164 phone.
 * Otherwise returns null (caller must use Firebase idToken).
 */
export function getDummyVerifiedPhone(dummyPhone: string | undefined, dummyCode: string | undefined): string | null {
  if (!isDummyPhoneVerificationEnabled()) return null;
  if (!dummyPhone || typeof dummyPhone !== 'string' || !dummyCode || typeof dummyCode !== 'string') return null;
  const normalized = toE164(dummyPhone.trim());
  if (normalized !== DUMMY_ALLOWED_E164) return null;
  if (dummyCode.trim() !== DUMMY_VERIFICATION_CODE) return null;
  return normalized;
}
