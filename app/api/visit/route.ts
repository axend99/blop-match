import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { VISIT_STEPS } from '@/lib/visits';

// Link-preview crawlers don't run JavaScript; WhatsApp/Instagram in-app browsers are real people.
const BOT = /bot|crawl|spider|headless/i;
const done = () => new NextResponse(null, { status: 204 });

// Counts one browser session reaching a funnel page (sent with sendBeacon by VisitBeacon).
// Anonymous: only the page and the day are stored. Always answers 204.
export async function POST(request: NextRequest) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return done();
  if (BOT.test(request.headers.get('user-agent') ?? '')) return done();

  let step: unknown;
  try {
    step = JSON.parse(await request.text()).step;
  } catch {
    return done();
  }
  if (typeof step !== 'string' || !(VISIT_STEPS as readonly string[]).includes(step)) return done();

  const { error } = await createServiceClient().rpc('bump_visit', { p_step: step });
  if (error) console.error('[visit] not recorded', error);
  return done();
}
