'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getMyMatches } from '@/lib/myMatches';
import { REPORT_REASONS, MAX_REPORT_DETAILS } from '@/lib/report';
import { createServiceClient } from '@/lib/supabase/service';
import { fileReport, notifyAdminsOfReport } from '@/lib/verification';

// Only a match of the caller (checked through get_my_matches) can be reported; the reported
// person is worked out here, never taken from the form.
export async function submitReport(matchId: string, formData: FormData): Promise<void> {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');
  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match || match.other_deleted) redirect('/me');

  const reason = String(formData.get('reason') ?? '');
  // Browsers send line breaks as \r\n; count them as one character, like the form does.
  const details = String(formData.get('details') ?? '').replace(/\r\n/g, '\n').trim();
  const base = `/me/report/${matchId}`;
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) redirect(`${base}?error=reason`);
  if (details.length > MAX_REPORT_DETAILS) redirect(`${base}?error=long`);

  const { data } = await createServiceClient().from('matches').select('a_id, b_id').eq('id', matchId).single();
  if (!data) redirect('/me');
  const reportedId = data.a_id === me.id ? data.b_id : data.a_id;

  const filed = await fileReport({ matchId, reporterId: me.id, reportedId, reason, details: details || null });
  if (!filed) redirect(`${base}?done=already`);
  after(() => notifyAdminsOfReport());
  redirect(`${base}?done=sent`);
}
