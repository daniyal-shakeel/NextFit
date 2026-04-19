const PREFIX = 'CUS-';
const RANDOM_LENGTH = 10;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 

export function generateCustomerId(): string {
  let result = PREFIX;
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}
