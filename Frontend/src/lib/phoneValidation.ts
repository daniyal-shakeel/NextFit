export const PAKISTAN_COUNTRY_CODE = '+92';
export const PAKISTAN_NATIONAL_LENGTH = 10;

export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
  normalized?: string;
}

function cleanNationalNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

export function validatePakistanPhone(nationalNumber: string): PhoneValidationResult {
  if (nationalNumber == null || typeof nationalNumber !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const cleaned = cleanNationalNumber(nationalNumber.trim());

  if (cleaned.length === 0) {
    return { isValid: false, error: 'Please enter your phone number' };
  }

  if (!/^[0-9]+$/.test(cleaned)) {
    return { isValid: false, error: 'Only digits are allowed' };
  }

  if (cleaned.length !== PAKISTAN_NATIONAL_LENGTH) {
    return {
      isValid: false,
      error: `Must be ${PAKISTAN_NATIONAL_LENGTH} digits (e.g. 3001234567)`,
    };
  }

  if (!cleaned.startsWith('3')) {
    return { isValid: false, error: 'Pakistani mobile numbers start with 3 (e.g. 3001234567)' };
  }

  if (/^(\d)\1+$/.test(cleaned)) {
    return { isValid: false, error: 'Invalid phone number' };
  }

  const normalized = `${PAKISTAN_COUNTRY_CODE}${cleaned}`;
  return { isValid: true, normalized };
}

export function toE164Pakistan(nationalNumber: string): string | null {
  const result = validatePakistanPhone(nationalNumber);
  return result.isValid ? result.normalized ?? null : null;
}
