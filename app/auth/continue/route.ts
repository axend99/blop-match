import { NextResponse, type NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

// Where to go right after signing in (magic link, Google redirect or Google button).
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL('/login?error=auth', origin));

  // Admins who are not participants go straight to the panel instead of the sign-up form.
  if (isAdminEmail(data.user.email)) {
    const { data: participant } = await supabase.from('participants').select('id').maybeSingle();
    if (!participant) return NextResponse.redirect(new URL('/admin', origin));
  }
  return NextResponse.redirect(new URL('/join', origin));
}
