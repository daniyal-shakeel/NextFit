/**
 * Server-generated order number for display and external reference.
 * Format: ORD-<prefix><random> (e.g. ORD-A1B2C3D4E5).
 * Uniqueness must be enforced by the caller (e.g. Order model pre-save).
 */

const PREFIX = 'ORD-';
const RANDOM_LENGTH = 10;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous 0,O,1,I

/**
 * Generates a new order number string. Does not check DB uniqueness;
 * the model (e.g. Order) should retry or ensure uniqueness on save.
 */
export function generateOrderNumber(): string {
  let result = PREFIX;
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}
