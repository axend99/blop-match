import { NextResponse, type NextRequest } from 'next/server';
import { sendEarlyReminders } from '@/lib/reviewService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// One-off, team only (same secret as /api/cron): every pending review reminder now, for requests
// at least 12 h old, unanswered and not reminded yet. Call again if it reports more left.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV === 'preview') return NextResponse.json({ skipped: 'preview' });
  const sent = await sendEarlyReminders(Date.now() + 270_000);
  return NextResponse.json({ sent });
}
