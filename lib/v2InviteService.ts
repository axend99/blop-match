import 'server-only';
import { createElement } from 'react';
import V2InviteEmail from '@/emails/V2InviteEmail';
import { adminEmails } from '@/lib/admin';
import { isE2eEmail } from '@/lib/e2eUsers';
import { sendAdminNotice, sendEmail } from '@/lib/email';
import { getDict, isLang } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';
import { pageAll } from '@/lib/supabase/pageAll';

// v1 → v2 invitation, sent from /admin only (never by the cron). Once per person (email_log).
const url = () => `${siteUrl()}/login?next=/me/whats-new`;

// v1 people still in the study who can be invited, and those already invited.
export async function v2InviteAudience() {
  const supabase = createServiceClient();
  const [people, sent] = await Promise.all([
    pageAll((a, b) =>
      supabase.from('participants').select('id, name, email, lang, active, deleted_at, is_seed, pending_review, cohort').order('id').range(a, b),
    ),
    pageAll((a, b) => supabase.from('email_log').select('participant_id').eq('kind', 'v2_invite').order('id').range(a, b)),
  ]);
  if (people.error) throw people.error;
  if (sent.error) throw sent.error;
  const invited = new Set(sent.data.map((r) => r.participant_id));
  const eligible = people.data.filter(
    (p) => p.cohort === 'v1' && p.active && !p.deleted_at && !p.is_seed && !p.pending_review && p.email && !isE2eEmail(p.email),
  );
  return { pending: eligible.filter((p) => !invited.has(p.id)), invited: invited.size };
}

export async function sendV2InvitePreview(): Promise<number> {
  const to = adminEmails();
  for (const lang of ['pt', 'en'] as const) {
    const copy = getDict(lang).emails.v2Invite;
    await sendAdminNotice(to, `[teste] ${copy.subject}`, copy.body, createElement(V2InviteEmail, { name: 'Equipa BLOP', lang, url: url() }));
  }
  return to.length;
}

export async function sendV2Invites(deadline: number) {
  const { pending } = await v2InviteAudience();
  let sent = 0;
  let failed = 0;
  let done = 0;
  for (const p of pending) {
    if (Date.now() > deadline) break;
    done++;
    const lang = isLang(p.lang) ? p.lang : 'en';
    const ok = await sendEmail({
      participantId: p.id,
      kind: 'v2_invite',
      to: p.email!,
      subject: getDict(lang).emails.v2Invite.subject,
      react: createElement(V2InviteEmail, { name: p.name, lang, url: url() }),
    });
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed, remaining: pending.length - done };
}
