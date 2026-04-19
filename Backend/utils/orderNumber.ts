
const PREFIX = 'ORD-';
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RANDOM_LENGTH = 8;

export function generateOrderNumber(): string {
  let result = PREFIX;
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}
