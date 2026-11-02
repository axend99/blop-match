import { NextResponse, type NextRequest } from 'next/server';
import { sendFinalCall } from '@/lib/finalEmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Team only (same secret as /api/cron), called once by the scheduler at the end of the study:
// the closing e-mail to everyone with reviews still to send. Safe to call again (once per person).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV === 'preview') return NextResponse.json({ skipped: 'preview' });
  return NextResponse.json(await sendFinalCall(Date.now() + 270_000));
}
