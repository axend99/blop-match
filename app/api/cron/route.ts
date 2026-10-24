import { NextResponse, type NextRequest } from 'next/server';
import { runMatchingForAll } from '@/lib/matchingService';
import { runReviewEmails } from '@/lib/reviewService';
import { sendWaitlistEmails } from '@/lib/waitlistService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function step<T>(name: string, run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (err) {
    console.error(`[cron] ${name} failed`, err);
    return { error: String(err) };
  }
}

// Daily routine (SPEC §6): 1) matching, 2) match_nudge, review_open, review_reminder, 3) waiting-list invitation.
// Each step has a time slice so the run fits in maxDuration; leftovers go out the next day.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Preview deployments share the production database: never act on real people from there.
  if (process.env.VERCEL_ENV === 'preview') return NextResponse.json({ skipped: 'preview' });

  const start = Date.now();
  const matching = await step('matching', () => runMatchingForAll(start + 20_000));
  const reviews = await step('reviews', () => runReviewEmails({ nudges: start + 28_000, requests: start + 38_000, reminders: start + 50_000 }));
  const waitlist = await step('waitlist', () => sendWaitlistEmails(start + 50_000));
  return NextResponse.json({ matching, reviews, waitlist });
}
