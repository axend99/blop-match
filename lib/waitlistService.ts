import 'server-only';
import { createElement } from 'react';
import WaitlistEmail from '@/emails/WaitlistEmail';
import { sendEmail } from '@/lib/email';
import { getDict, isLang } from '@/lib/i18n';
import { REVIEW_GRACE_MS } from '@/lib/review';
import { siteUrl } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';
import { dueWaitlist, waitlistUrl } from '@/lib/waitlist';

// Daily (cron): the BLOP app waiting-list invitation, once per person, 5 days after sign-up.
// Does nothing until WAITLIST_URL is set. The e-mail links to /go/waitlist, which counts the tap.
export async function sendWaitlistEmails(deadline: number): Promise<number> {
  if (!waitlistUrl()) return 0;
  const supabase = createServiceClient();
  const [people, sent] = await Promise.all([
    supabase.from('participants').select('id, name, email, lang, active, deleted_at, is_seed, created_at'),
    supabase.from('email_log').select('participant_id').eq('kind', 'waitlist'),
  ]);
  if (people.error) throw people.error;
  if (sent.error) throw sent.error;

  const byId = new Map(people.data.map((p) => [p.id, p]));
  const due = dueWaitlist(
    people.data.map((p) => ({
      id: p.id,
      createdAt: p.created_at,
      active: p.active,
      deleted: Boolean(p.deleted_at),
      hasEmail: Boolean(p.email),
      isSeed: p.is_seed,
    })),
    new Set(sent.data.map((r) => r.participant_id)),
    new Date(),
    REVIEW_GRACE_MS,
  );

  let count = 0;
  for (const id of due) {
    if (Date.now() > deadline) break;
    const p = byId.get(id)!;
    const lang = isLang(p.lang) ? p.lang : 'en';
    const ok = await sendEmail({
      participantId: p.id,
      kind: 'waitlist',
      to: p.email!,
      subject: getDict(lang).emails.waitlist.subject,
      react: createElement(WaitlistEmail, { name: p.name, lang, url: `${siteUrl()}/go/waitlist?src=email&p=${p.id}` }),
    });
    if (ok) count++;
  }
  return count;
}
