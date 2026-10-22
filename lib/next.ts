// Where to return after signing in, e.g. /login?next=/me/report/<id> from an e-mail. Only
// paths inside /me/ are allowed (no other sites, no protocol-relative or backslash tricks).
export const NEXT_COOKIE = 'blop_next';

export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/me/') || value.includes('//') || value.includes('\\')) return null;
  return /^\/me\/[A-Za-z0-9/_-]*$/.test(value) ? value : null;
}
