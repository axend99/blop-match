import 'server-only';
import { isAdminEmail, adminEmails } from '@/lib/admin';
import { sendAdminNotice } from '@/lib/email';
import { canonicalEmail } from '@/lib/emailCanonical';
import { profileTexts } from '@/lib/moderation';
import { runMatchingFor } from '@/lib/matchingService';
import { moderate } from '@/lib/moderationService';
import { siteUrl } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

// Who may receive new matches. A person is held (pending_review) while their new profile is
// being checked, when the check flagged something or failed, and when they were reported.
// Everything here runs with the service role, on the server only.

// Only the exact banned address is refused outright (login and sign-up).
export async function isBanned(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const { data, error } = await createServiceClient()
    .from('banned_emails')
    .select('email')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// Same mailbox as a banned address or as another live profile (e.g. ana.silva+2@gmail.com
// vs anasilva@gmail.com): not refused, but the new profile waits for an admin, with the reason.
// Returned as profile alerts (field "email"), which hold the person like any other alert.
export async function mailboxAlerts(email: string, userId: string) {
  const canonical = canonicalEmail(email);
  const supabase = createServiceClient();
  const [banned, people] = await Promise.all([
    supabase.from('banned_emails').select('email'),
    supabase.from('participants').select('name, email, user_id').not('email', 'is', null).is('deleted_at', null),
  ]);
  if (banned.error) throw banned.error;
  if (people.error) throw people.error;
  const alerts: { field: string; text: string; status: 'flagged'; category: string; reason: string }[] = [];
  if ((banned.data ?? []).some((b) => canonicalEmail(b.email) === canonical)) {
    alerts.push({ field: 'email', text: email, status: 'flagged', category: 'banned_mailbox', reason: 'Mesma caixa de e-mail que uma conta banida.' });
  }
  const same = (people.data ?? []).filter((p) => p.user_id !== userId && canonicalEmail(p.email as string) === canonical);
  if (same.length) {
    alerts.push({
      field: 'email',
      text: email,
      status: 'flagged',
      category: 'same_mailbox',
      reason: `Mesma caixa de e-mail que outro perfil: ${same.map((p) => p.name).join(', ')}.`,
    });
  }
  return alerts;
}

// The one rule to let someone back in: no open report against them and no unseen alert on
// their profile (alerts on review comments, which have a match_id, do not hold anyone).
async function canResume(participantId: string): Promise<{ ok: boolean; openReports: number }> {
  const supabase = createServiceClient();
  const [reports, flags] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reported_id', participantId).is('resolved_at', null),
    supabase
      .from('content_flags')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', participantId)
      .is('match_id', null)
      .is('resolved_at', null),
  ]);
  if (reports.error) throw reports.error;
  if (flags.error) throw flags.error;
  return { ok: !reports.count && !flags.count, openReports: reports.count ?? 0 };
}

export type ResumeResult = 'resumed' | 'held' | 'unchanged';

// Clears pending_review if allowed; matching runs only when this call changed the row
// (a double click, a ban or an earlier approval change nothing).
export async function resumeIfClear(participantId: string): Promise<ResumeResult> {
  if (!(await canResume(participantId)).ok) return 'held';
  const { data, error } = await createServiceClient()
    .from('participants')
    .update({ pending_review: false })
    .eq('id', participantId)
    .eq('pending_review', true)
    .is('deleted_at', null)
    .select('id');
  if (error) throw error;
  if (!data?.length) return 'unchanged';
  // A report filed between the check and the update holds the person again.
  if (!(await canResume(participantId)).ok) {
    await createServiceClient().from('participants').update({ pending_review: true }).eq('id', participantId);
    return 'held';
  }
  await runMatchingFor(participantId);
  return 'resumed';
}

// New profile (after sign-up, in after()): AI check, then matching only if it came back clean.
export async function verifyNewProfile(participantId: string, profile: Parameters<typeof profileTexts>[0]) {
  const outcome = await moderate(participantId, profileTexts(profile));
  if (outcome === 'clean') await resumeIfClear(participantId);
}

async function resolveProfileFlags(participantId: string) {
  const { error } = await createServiceClient()
    .from('content_flags')
    .update({ resolved_at: new Date().toISOString() })
    .eq('participant_id', participantId)
    .is('match_id', null)
    .is('resolved_at', null);
  if (error) throw error;
}

// Admin: approve a held profile (its profile alerts count as seen).
export async function approveProfile(participantId: string): Promise<ResumeResult> {
  await resolveProfileFlags(participantId);
  return resumeIfClear(participantId);
}

// Admin: run the AI check again (e.g. it failed the first time); old profile alerts are
// marked as seen first so a clean result can let the person in.
export async function recheckProfile(participantId: string): Promise<ResumeResult | 'flagged' | 'error'> {
  const { data: p, error } = await createServiceClient()
    .from('participants')
    .select('name, talk_about, other_text, deleted_at')
    .eq('id', participantId)
    .maybeSingle();
  if (error) throw error;
  if (!p || p.deleted_at) return 'unchanged';
  await resolveProfileFlags(participantId);
  const outcome = await moderate(participantId, profileTexts({ name: p.name, talk_about: p.talk_about, other_text: p.other_text ?? {} }));
  return outcome === 'clean' ? resumeIfClear(participantId) : outcome;
}

// Admin: ban. Refuses admins and seed; removes the person and everything linked in one
// transaction (ban_participant), then deletes the login. The e-mail stays blocked.
export async function banParticipant(participantId: string, reason: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data: p, error } = await supabase.from('participants').select('email, is_seed').eq('id', participantId).maybeSingle();
  if (error) throw error;
  if (!p?.email || p.is_seed || isAdminEmail(p.email)) return false;
  const { data: userId, error: banError } = await supabase.rpc('ban_participant', { p_id: participantId, p_reason: reason });
  if (banError) throw banError;
  if (userId) {
    const { error: authError } = await supabase.auth.admin.deleteUser(userId as string);
    if (authError) console.error('[ban] auth user not deleted (e-mail still blocked)', authError);
  }
  return true;
}

// Admin: archive a report; the person comes back if nothing else holds them.
export async function dismissReport(reportId: string): Promise<ResumeResult> {
  const { data, error } = await createServiceClient()
    .from('reports')
    .update({ resolved_at: new Date().toISOString(), resolution: 'dismissed' })
    .eq('id', reportId)
    .is('resolved_at', null)
    .select('reported_id');
  if (error) throw error;
  const reported = data?.[0]?.reported_id as string | undefined;
  return reported ? resumeIfClear(reported) : 'unchanged';
}

// A participant reports one of their matches: stored, the reported person is held, the team
// gets a short e-mail (no names, no text). Returns false when already reported.
export async function fileReport(args: {
  matchId: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  details: string | null;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('reports').insert({
    match_id: args.matchId,
    reporter_id: args.reporterId,
    reported_id: args.reportedId,
    reason: args.reason,
    details: args.details,
  });
  if (error) {
    if (error.code === '23505') return false;
    throw error;
  }
  const { error: holdError } = await supabase.from('participants').update({ pending_review: true }).eq('id', args.reportedId);
  if (holdError) console.error('[report] could not hold the reported person', holdError);
  return true;
}

export async function notifyAdminsOfReport(): Promise<void> {
  await sendAdminNotice(
    adminEmails(),
    'Nova denúncia no BLOP Match',
    `Há uma nova denúncia para ver.\n\n${siteUrl()}/admin/verificacao`,
  );
}
