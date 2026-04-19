import type { CookieOptions } from 'express';

const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getCookieOptions(overrides?: Partial<CookieOptions>): CookieOptions {
  if (process.env.NODE_ENV !== 'production') {
    return {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
      path: '/',
      ...overrides,
    };
  }
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: '/',
    ...overrides,
  };
}

export function getClearCookieOptions(): CookieOptions {
  return getCookieOptions({ maxAge: 0 });
}
