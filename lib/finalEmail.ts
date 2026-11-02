import 'server-only';
import { createElement } from 'react';
import FinalEmail from '@/emails/FinalEmail';
import { inBatches } from '@/lib/batch';
import { sendEmail } from '@/lib/email';
import { getDict, isLang } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';
import { pageAll } from '@/lib/supabase/pageAll';
import { createServiceClient } from '@/lib/supabase/service';

// Who gets the closing e-mail: active participants with an e-mail and at least one match they
// have not rated yet (all reviews are open at the end of the study), with how many are left.
export async function finalCallRecipients() {
  const supabase = createServiceClient();
  const [people, matches, reviews] = await Promise.all([
    pageAll((a, b) => supabase.from('participants').select('id, name, email, lang, active, deleted_at, is_seed').order('id').range(a, b)),
    pageAll((a, b) => supabase.from('matches').select('id, a_id, b_id').order('id').range(a, b)),
    pageAll((a, b) => supabase.from('reviews').select('match_id, reviewer_id').order('id').range(a, b)),
  ]);
  for (const r of [people, matches, reviews]) if (r.error) throw r.error;
  const done = new Set(reviews.data.map((r) => `${r.match_id}|${r.reviewer_id}`));
  const pending = new Map<string, number>();
  for (const m of matches.data) for (const p of [m.a_id, m.b_id]) if (!done.has(`${m.id}|${p}`)) pending.set(p, (pending.get(p) ?? 0) + 1);
  return people.data
    .filter((p) => p.active && !p.deleted_at && !p.is_seed && p.email && pending.has(p.id))
    .map((p) => ({ id: p.id as string, name: p.name as string, email: p.email as string, lang: isLang(p.lang) ? p.lang : 'en', pending: pending.get(p.id)! }));
}

// Sends it, 5 at a time, once per person (email_log, kind final_call). Call again to finish.
export async function sendFinalCall(deadline: number): Promise<{ sent: number; recipients: number }> {
  const people = await finalCallRecipients();
  const sent = await inBatches(people, 5, deadline, (p) =>
    sendEmail({
      participantId: p.id,
      kind: 'final_call',
      to: p.email,
      subject: getDict(p.lang).emails.finalCall.subject,
      react: createElement(FinalEmail, { name: p.name, pending: p.pending, lang: p.lang, url: `${siteUrl()}/login?next=/me` }),
    }),
  );
  return { sent, recipients: people.length };
}
