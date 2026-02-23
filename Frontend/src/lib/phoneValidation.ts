/**
 * Pakistan (+92) phone validation and E.164 normalization (client-side)
 */

export const PAKISTAN_COUNTRY_CODE = '+92';
export const PAKISTAN_NATIONAL_LENGTH = 10;

export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Clean national number: strip spaces, dashes, leading 0
 */
function cleanNationalNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

/**
 * Validate Pakistan national number (10 digits, typically starting with 3 for mobile).
 * Returns validation result and E.164 normalized form (+92xxxxxxxxxx).
 */
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

  // Pakistani mobile typically starts with 3 (e.g. 300, 301, 302, 303, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399)
  if (!cleaned.startsWith('3')) {
    return { isValid: false, error: 'Pakistani mobile numbers start with 3 (e.g. 3001234567)' };
  }

  // Reject all same digit
  if (/^(\d)\1+$/.test(cleaned)) {
    return { isValid: false, error: 'Invalid phone number' };
  }

  const normalized = `${PAKISTAN_COUNTRY_CODE}${cleaned}`;
  return { isValid: true, normalized };
}

/**
 * Get E.164 phone from raw input (national number only, +92 fixed)
 */
export function toE164Pakistan(nationalNumber: string): string | null {
  const result = validatePakistanPhone(nationalNumber);
  return result.isValid ? result.normalized ?? null : null;
}
