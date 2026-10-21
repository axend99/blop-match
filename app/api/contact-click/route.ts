import { NextResponse, type NextRequest } from 'next/server';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getMyMatches } from '@/lib/myMatches';
import { createServiceClient } from '@/lib/supabase/service';

const CHANNELS = ['whatsapp', 'instagram'];
const done = () => new NextResponse(null, { status: 204 });

// Records a tap on a match's WhatsApp/Instagram button (sent with sendBeacon). Only the
// caller's own taps on their own, non-anonymised matches; the first tap per channel is kept.
// Always answers 204: tracking never affects the participant.
export async function POST(request: NextRequest) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return done();

  let body: { matchId?: unknown; channel?: unknown };
  try {
    body = JSON.parse(await request.text());
  } catch {
    return done();
  }
  if (typeof body.matchId !== 'string' || typeof body.channel !== 'string' || !CHANNELS.includes(body.channel)) {
    return done();
  }

  try {
    if (!(await getUser())) return done();
    const me = await getMyParticipant();
    if (!me) return done();
    const match = (await getMyMatches()).find((m) => m.match_id === body.matchId && !m.other_deleted);
    if (!match) return done();
    const { error } = await createServiceClient()
      .from('contact_clicks')
      .upsert(
        { match_id: match.match_id, participant_id: me.id, channel: body.channel },
        { onConflict: 'match_id,participant_id,channel', ignoreDuplicates: true },
      );
    if (error) console.error('[contact-click] insert failed', error);
  } catch (err) {
    console.error('[contact-click] failed', err);
  }
  return done();
}
