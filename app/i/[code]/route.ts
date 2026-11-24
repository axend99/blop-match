import { NextResponse, type NextRequest } from 'next/server';
import { isInviteCode } from '@/lib/game';
import { INVITE_COOKIE } from '@/lib/invites';

// Invite link (/i/<code>): remembers who invited (30 days, this browser) and opens the home page.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL('/', request.url));
  if (isInviteCode(code)) {
    response.cookies.set(INVITE_COOKIE, code, { path: '/', maxAge: 30 * 24 * 60 * 60, sameSite: 'lax', httpOnly: true, secure: true });
  }
  return response;
}
