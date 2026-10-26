import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The button of the review e-mails: counts the tap (first per person, match and e-mail), then
// opens the review form (which asks to sign in first if needed and comes back). Counting never
// blocks the redirect.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const matchId = searchParams.get('m') ?? '';
  const participantId = searchParams.get('p') ?? '';
  const source = searchParams.get('src') === 'reminder' ? 'reminder' : 'open';
  if (!UUID.test(matchId)) return NextResponse.redirect(new URL('/me', origin));
  if (UUID.test(participantId)) {
    try {
      const { error } = await createServiceClient()
        .from('review_clicks')
        .upsert({ match_id: matchId, participant_id: participantId, source }, { onConflict: 'match_id,participant_id,source', ignoreDuplicates: true });
      if (error && error.code !== '23503') console.error('[review] click not recorded', error);
    } catch (err) {
      console.error('[review] click not recorded', err);
    }
  }
  return NextResponse.redirect(new URL(`/me/review/${matchId}`, origin));
}
