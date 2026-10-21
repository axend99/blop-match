import 'server-only';
import { cookies } from 'next/headers';
import { getUser } from '@/lib/auth';
import { verifySession } from '@/lib/adminSession';

export const ADMIN_COOKIE = 'admin_session';

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined): boolean {
  return Boolean(email) && adminEmails().includes(email!.toLowerCase());
}

// Admin = logged in with an e-mail from ADMIN_EMAILS, or holding a valid cookie from the
// shared access link.
export async function isAdmin(): Promise<boolean> {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (verifySession(cookie, process.env.ADMIN_ACCESS_TOKEN, Date.now())) return true;
  const user = await getUser();
  return isAdminEmail(user?.email);
}
