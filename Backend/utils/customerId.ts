/**
 * Server-generated customer ID for display and external reference.
 * Format: CUS-<prefix><random> (e.g. CUS-A1B2C3D4E5).
 * Uniqueness must be enforced by the caller (e.g. User model pre-save).
 */

const PREFIX = 'CUS-';
const RANDOM_LENGTH = 10;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous 0,O,1,I

/**
 * Generates a new customer ID string. Does not check DB uniqueness;
 * the model (e.g. User) should retry or ensure uniqueness on save.
 */
export function generateCustomerId(): string {
  let result = PREFIX;
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}
