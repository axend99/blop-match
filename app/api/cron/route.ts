import { NextResponse, type NextRequest } from 'next/server';
import { runMatchingForAll } from '@/lib/matchingService';
import { runReviewEmails } from '@/lib/reviewService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily routine (SPEC §6): 1) matching, 2) review_open, 3) review_reminder.
// Each step has a time slice so the run fits in maxDuration; leftovers go out the next day.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const start = Date.now();

  // Preview deployments share the production database: never match real people from there.
  const matching = process.env.VERCEL_ENV === 'preview' ? 'skipped' : await runMatchingForAll(start + 20_000);
  const reviews = await runReviewEmails({ requests: start + 35_000, reminders: start + 50_000 });

  return NextResponse.json({ matching, ...reviews });
}
