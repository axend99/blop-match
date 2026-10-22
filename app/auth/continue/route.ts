import { NextResponse, type NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { NEXT_COOKIE, safeNext } from '@/lib/next';
import { createClient } from '@/lib/supabase/server';
import { isBanned } from '@/lib/verification';

// Where to go right after signing in (magic link, Google redirect or Google button):
// banned → out; admin without profile → /admin; no profile → /join; else the page the person
// was going to (e.g. a report link from an e-mail), or /join (which sends profiles to /me).
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL('/login?error=auth', origin));

  if (await isBanned(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=banned', origin));
  }

  const { data: participant } = await supabase.from('participants').select('id').maybeSingle();
  if (!participant && isAdminEmail(data.user.email)) return NextResponse.redirect(new URL('/admin', origin));

  let saved: string | undefined;
  try {
    saved = decodeURIComponent(request.cookies.get(NEXT_COOKIE)?.value ?? '');
  } catch {
    saved = undefined;
  }
  const next = participant ? safeNext(saved) : null;
  const response = NextResponse.redirect(new URL(next ?? '/join', origin));
  response.cookies.delete(NEXT_COOKIE);
  return response;
}
