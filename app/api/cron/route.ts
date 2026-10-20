import { NextResponse, type NextRequest } from 'next/server';
import { runMatchingForAll } from '@/lib/matchingService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily routine (SPEC §6). Step 1: matching for everyone with free slots.
// Phase 4 adds review_open and review_reminder.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Leave headroom under maxDuration for the later steps.
  const matching = await runMatchingForAll(Date.now() + 40_000);
  return NextResponse.json({ matching });
}
