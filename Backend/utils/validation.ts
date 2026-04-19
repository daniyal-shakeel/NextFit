import { ALLOWED_EMAIL_DOMAINS, isAllowedEmailDomain } from '../constants/emailDomains.js';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }

  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email must be a string' };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    return { isValid: false, error: 'Email cannot be empty' };
  }

  if (trimmedEmail.length > 254) {
    return { isValid: false, error: 'Email is too long (max 254 characters)' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  const strictEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!strictEmailRegex.test(trimmedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  if (trimmedEmail.includes('..')) {
    return { isValid: false, error: 'Email cannot contain consecutive dots' };
  }

  const [localPart, domain] = trimmedEmail.split('@');
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { isValid: false, error: 'Email local part cannot start or end with a dot' };
  }

  if (!domain) {
    return { isValid: false, error: 'Email must contain a domain' };
  }

  const domainRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!domainRegex.test(domain)) {
    return { isValid: false, error: 'Invalid email domain format' };
  }

  if (!isAllowedEmailDomain(domain)) {
    return { 
      isValid: false, 
      error: `Email domain not allowed. Please use one of the supported providers: ${ALLOWED_EMAIL_DOMAINS.slice(0, 5).join(', ')}...` 
    };
  }

  if (localPart.length > 64) {
    return { isValid: false, error: 'Email local part is too long (max 64 characters)' };
  }

  const invalidLocalChars = /[<>()[\]\\,;:@"]/;
  if (invalidLocalChars.test(localPart)) {
    return { isValid: false, error: 'Email contains invalid characters' };
  }

  return { isValid: true };
};

export interface StringValidationOptions {
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  trim?: boolean;
  allowEmpty?: boolean;
  pattern?: RegExp;
  customValidator?: (value: string) => boolean | string;
}

export const validateString = (
  value: string | undefined | null,
  options: StringValidationOptions = {}
): ValidationResult => {
  const {
    minLength = 0,
    maxLength = Infinity,
    required = false,
    trim = true,
    allowEmpty = false,
    pattern,
    customValidator,
  } = options;

  if (value === null || value === undefined) {
    if (required) {
      return { isValid: false, error: 'This field is required' };
    }
    return { isValid: true };
  }

  if (typeof value !== 'string') {
    return { isValid: false, error: 'Value must be a string' };
  }

  const processedValue = trim ? value.trim() : value;

  if (processedValue.length === 0) {
    if (required || !allowEmpty) {
      return { isValid: false, error: 'This field cannot be empty' };
    }
    return { isValid: true };
  }

  if (processedValue.length < minLength) {
    return { 
      isValid: false, 
      error: `Minimum length is ${minLength} characters` 
    };
  }

  if (processedValue.length > maxLength) {
    return { 
      isValid: false, 
      error: `Maximum length is ${maxLength} characters` 
    };
  }

  if (pattern && !pattern.test(processedValue)) {
    return { isValid: false, error: 'Value does not match required pattern' };
  }

  if (customValidator) {
    const customResult = customValidator(processedValue);
    if (customResult !== true) {
      return { 
        isValid: false, 
        error: typeof customResult === 'string' ? customResult : 'Validation failed' 
      };
    }
  }

  return { isValid: true };
};

export interface PhoneValidationOptions {
  countryCode?: string;
  allowInternational?: boolean;
  required?: boolean;
}

export const validatePhone = (
  phone: string | undefined | null,
  options: PhoneValidationOptions = {}
): ValidationResult => {
  const {
    countryCode = '',
    allowInternational = true,
    required = false,
  } = options;

  if (!phone) {
    if (required) {
      return { isValid: false, error: 'Phone number is required' };
    }
    return { isValid: true };
  }

  if (typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number must be a string' };
  }

  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.length === 0) {
    if (required) {
      return { isValid: false, error: 'Phone number cannot be empty' };
    }
    return { isValid: true };
  }

  if (!/^\+?[0-9]+$/.test(cleaned)) {
    return { isValid: false, error: 'Phone number can only contain digits and optional + prefix' };
  }

  const digitsOnly = cleaned.replace(/^\+/, '');

  if (allowInternational) {
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return { 
        isValid: false, 
        error: 'Phone number must be between 7 and 15 digits' 
      };
    }
  } else {
    if (digitsOnly.length < 7 || digitsOnly.length > 11) {
      return { 
        isValid: false, 
        error: 'Phone number length is invalid' 
      };
    }
  }

  if (countryCode && !cleaned.startsWith(`+${countryCode}`) && !cleaned.startsWith(countryCode)) {
    return { 
      isValid: false, 
      error: `Phone number must start with country code ${countryCode}` 
    };
  }

  if (/^(\d)\1+$/.test(digitsOnly)) {
    return { isValid: false, error: 'Phone number cannot be all the same digit' };
  }

  if (allowInternational && digitsOnly.length > 10 && !cleaned.startsWith('+')) {
    return { 
      isValid: false, 
      error: 'International phone numbers must start with +' 
    };
  }

  return { isValid: true };
};

const PAKISTAN_E164_PATTERN = /^\+92[0-9]{10}$/;

export function validatePakistanPhone(phone: string | undefined | null): ValidationResult & { normalized?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }
  const cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned.replace(/^0+/, '')}`;
  const digitsOnly = withPlus.replace(/\D/g, '');
  const normalized = digitsOnly.startsWith('92') && digitsOnly.length === 12
    ? `+${digitsOnly}`
    : digitsOnly.length === 10
      ? `+92${digitsOnly}`
      : withPlus;

  if (!PAKISTAN_E164_PATTERN.test(normalized)) {
    return {
      isValid: false,
      error: 'Only Pakistan (+92) numbers are allowed. Use 10 digits (e.g. 3001234567).',
      normalized: undefined,
    };
  }
  return { isValid: true, normalized };
}

export function splitE164(e164: string): { countryCode: string; rest: string } | null {
  if (!e164 || typeof e164 !== 'string') return null;
  const withPlus = e164.trim().startsWith('+') ? e164.trim() : `+${e164.trim().replace(/^\D/g, '')}`;
  const digits = withPlus.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('92') && digits.length === 12) {
    return { countryCode: '+92', rest: digits.slice(2) };
  }
  if (digits.length === 10) {
    return { countryCode: '+92', rest: digits };
  }
  for (const len of [3, 2, 1]) {
    if (digits.length > len) {
      const rest = digits.slice(len);
      if (rest.length >= 6) {
        return { countryCode: `+${digits.slice(0, len)}`, rest };
      }
    }
  }
  return null;
}

export interface CardValidationOptions {
  required?: boolean;
  cardType?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'any';
}

export const validateCard = (
  cardNumber: string | undefined | null,
  options: CardValidationOptions = {}
): ValidationResult => {
  const {
    required = false,
    cardType = 'any',
  } = options;

  if (!cardNumber) {
    if (required) {
      return { isValid: false, error: 'Card number is required' };
    }
    return { isValid: true };
  }

  if (typeof cardNumber !== 'string') {
    return { isValid: false, error: 'Card number must be a string' };
  }

  const cleaned = cardNumber.replace(/[\s\-]/g, '');

  if (cleaned.length === 0) {
    if (required) {
      return { isValid: false, error: 'Card number cannot be empty' };
    }
    return { isValid: true };
  }

  if (!/^[0-9]+$/.test(cleaned)) {
    return { isValid: false, error: 'Card number can only contain digits' };
  }

  if (cleaned.length < 13 || cleaned.length > 19) {
    return { 
      isValid: false, 
      error: 'Card number must be between 13 and 19 digits' 
    };
  }

  const firstDigit = cleaned[0];
  const firstTwoDigits = cleaned.substring(0, 2);
  const firstFourDigits = cleaned.substring(0, 4);

  if (cardType !== 'any') {
    let isValidType = false;
    
    switch (cardType) {
      case 'visa':
        isValidType = firstDigit === '4' && (cleaned.length === 13 || cleaned.length === 16);
        break;
      case 'mastercard':
        isValidType = (firstTwoDigits >= '51' && firstTwoDigits <= '55') && cleaned.length === 16;
        break;
      case 'amex':
        isValidType = (firstTwoDigits === '34' || firstTwoDigits === '37') && cleaned.length === 15;
        break;
      case 'discover':
        isValidType = (cleaned.startsWith('6011') || 
                      (firstFourDigits >= '6221' && firstFourDigits <= '6229') ||
                      (firstFourDigits >= '624' && firstFourDigits <= '626') ||
                      (firstFourDigits >= '6282' && firstFourDigits <= '6288') ||
                      cleaned.startsWith('65')) && cleaned.length === 16;
        break;
    }

    if (!isValidType) {
      return { 
        isValid: false, 
        error: `Card number does not match ${cardType} format` 
      };
    }
  }

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    return { isValid: false, error: 'Invalid card number (Luhn check failed)' };
  }

  if (/^(\d)\1+$/.test(cleaned)) {
    return { isValid: false, error: 'Card number cannot be all the same digit' };
  }

  return { isValid: true };
};

export const getCardType = (cardNumber: string): string | null => {
  if (!cardNumber) return null;

  const cleaned = cardNumber.replace(/[\s\-]/g, '');
  const firstDigit = cleaned[0];
  const firstTwoDigits = cleaned.substring(0, 2);
  const firstFourDigits = cleaned.substring(0, 4);

  if (firstDigit === '4' && (cleaned.length === 13 || cleaned.length === 16)) {
    return 'visa';
  }
  if ((firstTwoDigits >= '51' && firstTwoDigits <= '55') && cleaned.length === 16) {
    return 'mastercard';
  }
  if ((firstTwoDigits === '34' || firstTwoDigits === '37') && cleaned.length === 15) {
    return 'amex';
  }
  if ((cleaned.startsWith('6011') || 
       (firstFourDigits >= '6221' && firstFourDigits <= '6229') ||
       (firstFourDigits >= '624' && firstFourDigits <= '626') ||
       (firstFourDigits >= '6282' && firstFourDigits <= '6288') ||
       cleaned.startsWith('65')) && cleaned.length === 16) {
    return 'discover';
  }

  return null;
};

export const validate = {
  email: validateEmail,
  string: validateString,
  phone: validatePhone,
  card: validateCard,
  getCardType,
};

