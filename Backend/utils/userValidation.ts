import { IUser, AuthMethod } from '../models/User.js';
import { ValidationResult } from './validation.js';

/**
 * Validate user data based on authentication method
 * Ensures "one way only" registration constraint
 */
export const validateUserByAuthMethod = (
  authMethod: AuthMethod,
  data: {
    email?: string;
    password?: string;
    phone?: string;
    googleId?: string;
  }
): ValidationResult => {
  // Validate authMethod
  if (!Object.values(AuthMethod).includes(authMethod)) {
    return {
      isValid: false,
      error: 'Invalid authentication method',
    };
  }

  // Validate based on method
  switch (authMethod) {
    case AuthMethod.EMAIL:
      if (!data.email) {
        return { isValid: false, error: 'Email is required for email authentication' };
      }
      if (!data.password) {
        return { isValid: false, error: 'Password is required for email authentication' };
      }
      // Ensure other method fields are not provided
      if (data.phone) {
        return { isValid: false, error: 'Phone cannot be used with email authentication' };
      }
      if (data.googleId) {
        return { isValid: false, error: 'Google ID cannot be used with email authentication' };
      }
      break;

    case AuthMethod.PHONE:
      if (!data.phone) {
        return { isValid: false, error: 'Phone number is required for phone authentication' };
      }
      // Ensure other method fields are not provided
      if (data.email || data.password) {
        return { isValid: false, error: 'Email/Password cannot be used with phone authentication' };
      }
      if (data.googleId) {
        return { isValid: false, error: 'Google ID cannot be used with phone authentication' };
      }
      break;

    case AuthMethod.GOOGLE:
      if (!data.googleId) {
        return { isValid: false, error: 'Google ID is required for Google authentication' };
      }
      // Ensure other method fields are not provided
      if (data.email || data.password) {
        return { isValid: false, error: 'Email/Password cannot be used with Google authentication' };
      }
      if (data.phone) {
        return { isValid: false, error: 'Phone cannot be used with Google authentication' };
      }
      break;
  }

  return { isValid: true };
};

/**
 * Check if user can switch authentication methods
 * Returns false - users cannot switch methods after registration
 */
export const canSwitchAuthMethod = (): boolean => {
  return false; // One way only - cannot switch
};

/**
 * Get required fields for a specific auth method
 */
export const getRequiredFieldsForAuthMethod = (authMethod: AuthMethod): string[] => {
  switch (authMethod) {
    case AuthMethod.EMAIL:
      return ['email', 'password'];
    case AuthMethod.PHONE:
      return ['phone'];
    case AuthMethod.GOOGLE:
      return ['googleId'];
    default:
      return [];
  }
};

/**
 * Check if user has completed registration for their auth method
 */
export const isRegistrationComplete = (user: Partial<IUser>): boolean => {
  if (!user.authMethod) return false;

  switch (user.authMethod) {
    case AuthMethod.EMAIL:
      return !!(user.email && user.password && user.isEmailVerified);
    case AuthMethod.PHONE:
      return !!(user.phone && user.isPhoneVerified);
    case AuthMethod.GOOGLE:
      return !!user.googleId;
    default:
      return false;
  }
};

