import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Signed cookie for the shared /admin access link (pure, so it is tested).
// Format: `<expiresAtMs>.<hex HMAC-SHA256>`, keyed by the access token, so rotating the
// token invalidates every session. A missing or short token disables the link entirely.

export const MIN_TOKEN_LENGTH = 32;
export const SESSION_DAYS = 30;

export function tokenUsable(token: string | undefined): token is string {
  return typeof token === 'string' && token.length >= MIN_TOKEN_LENGTH;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest();

// Constant-time comparison of the link's token with the configured one.
export function tokenMatches(input: string, token: string | undefined): boolean {
  return tokenUsable(token) && timingSafeEqual(sha256(input), sha256(token));
}

function signature(expiresAt: number, token: string): string {
  return createHmac('sha256', sha256(`admin-session:${token}`)).update(String(expiresAt)).digest('hex');
}

export function signSession(token: string, now: number): string {
  const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return `${expiresAt}.${signature(expiresAt, token)}`;
}

export function verifySession(cookie: string | undefined, token: string | undefined, now: number): boolean {
  if (!cookie || !tokenUsable(token)) return false;
  const match = /^(\d{1,15})\.([0-9a-f]{64})$/.exec(cookie);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  return timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(signature(expiresAt, token), 'hex'));
}
