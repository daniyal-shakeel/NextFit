/**
 * Dummy phone verification for development only.
 * Frontend: always use Firebase (signInWithPhoneNumber → idToken). In dev you can use Firebase test numbers.
 * Backend: in development accepts dummy phone+code OR idToken; in production only idToken.
 */

export const DUMMY_PHONE_E164 = '+923287751754';
export const DUMMY_PHONE_DISPLAY = '+923287751754 or 03287751754';
export const DUMMY_VERIFICATION_CODE = '220622';

/** Frontend always uses Firebase (dev = Firebase test numbers, prod = real OTP). Dummy UI path disabled. */
export function isDummyPhoneVerificationEnabled(): boolean {
  return false;
}

export function isDummyAllowedPhone(normalizedE164: string): boolean {
  const digits = normalizedE164.replace(/\D/g, '');
  const e164 = digits.length === 10 ? `+92${digits}` : digits.length === 12 ? `+${digits}` : normalizedE164;
  return e164 === DUMMY_PHONE_E164;
}
