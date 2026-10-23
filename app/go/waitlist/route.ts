import { NextResponse, type NextRequest } from 'next/server';
import { getMyParticipant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { waitlistUrl } from '@/lib/waitlist';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Counts a tap on the BLOP app waiting-list link (first per person and source), then sends the
// person to the waiting list. ?src=email&p=<participant id> from the e-mail; ?src=button from
// /me (the person comes from the session). Counting never blocks the redirect.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const target = waitlistUrl();
  const source = searchParams.get('src') === 'button' ? 'button' : 'email';
  try {
    const participantId =
      source === 'button' ? (await getMyParticipant())?.id : UUID.test(searchParams.get('p') ?? '') ? searchParams.get('p') : null;
    if (participantId) {
      const { error } = await createServiceClient()
        .from('waitlist_clicks')
        .upsert({ participant_id: participantId, source }, { onConflict: 'participant_id,source', ignoreDuplicates: true });
      if (error && error.code !== '23503') console.error('[waitlist] click not recorded', error);
    }
  } catch (err) {
    console.error('[waitlist] click not recorded', err);
  }
  return NextResponse.redirect(target ?? new URL('/me', origin));
}
