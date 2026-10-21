import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

const OTP_TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup'];

// Handles Google OAuth and PKCE magic links (?code=) and email templates
// that link with ?token_hash= (works even if opened in another browser).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (!ok) return NextResponse.redirect(new URL('/login?error=auth', origin));

  // Admins who are not participants go straight to the panel instead of the sign-up form.
  const { data } = await supabase.auth.getUser();
  if (isAdminEmail(data.user?.email)) {
    const { data: participant } = await supabase.from('participants').select('id').maybeSingle();
    if (!participant) return NextResponse.redirect(new URL('/admin', origin));
  }
  return NextResponse.redirect(new URL('/join', origin));
}
