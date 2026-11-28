import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { campaignById } from '@/lib/campaigns';

// Admin only: shows a campaign's e-mail as it will be sent.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = campaignById(id);
  if (!(await isAdmin()) || !c) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(c.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
