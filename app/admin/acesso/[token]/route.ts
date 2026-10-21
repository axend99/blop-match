import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/admin';
import { SESSION_DAYS, signSession, tokenMatches } from '@/lib/adminSession';

// Shared access link for the team: /admin/acesso/<ADMIN_ACCESS_TOKEN>. Sets a signed cookie
// and redirects, so the token leaves the address bar. Wrong or disabled token → 404.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = process.env.ADMIN_ACCESS_TOKEN;
  if (!tokenMatches(token, secret)) return new NextResponse('Not found', { status: 404 });

  const response = NextResponse.redirect(new URL('/admin', request.nextUrl.origin));
  response.cookies.set(ADMIN_COOKIE, signSession(secret!, Date.now()), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/admin',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
