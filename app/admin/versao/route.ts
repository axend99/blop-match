import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { ADMIN_VERSION_COOKIE } from '@/lib/adminVersion';
import { studyVersion } from '@/lib/stats';

// /admin/versao?v=v1|v2|todos&back=/admin/... : remembers the version and goes back.
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return new NextResponse('Not found', { status: 404 });
  const version = studyVersion(request.nextUrl.searchParams.get('v') ?? undefined);
  const back = request.nextUrl.searchParams.get('back') ?? '/admin';
  const target = back.startsWith('/admin') && !back.startsWith('//') ? back : '/admin';
  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.set(ADMIN_VERSION_COOKIE, version, { path: '/admin', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 365 });
  return response;
}
