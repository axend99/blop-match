import 'server-only';
import { createElement } from 'react';
import InviteEmail from '@/emails/InviteEmail';
import { adminEmails } from '@/lib/admin';
import { sendOther } from '@/lib/email';
import { canonicalEmail } from '@/lib/emailCanonical';
import { getDict } from '@/lib/i18n';
import { pendingInvites } from '@/lib/invite';
import { siteUrl } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

const subject = () => `${getDict('en').emails.invite.subject} / ${getDict('pt').emails.invite.subject}`;
const url = () => `${siteUrl()}/`;
const email = () => createElement(InviteEmail, { url: url() });
// Plain-text version, for mail apps that don't show HTML.
const text = () =>
  (['en', 'pt'] as const)
    .map((lang) => {
      const t = getDict(lang).emails.invite;
      return [t.greeting, t.intro, t.invite, t.how, t.help, `${t.button}: ${url()}`, t.signoff].join('\n\n');
    })
    .join('\n\n---\n\n');

export async function invitedCount(): Promise<number> {
  const { count, error } = await createServiceClient().from('invite_emails').select('email', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function sendInvitePreview(): Promise<boolean> {
  return sendOther(adminEmails(), `[teste] ${subject()}`, text(), email());
}

// One e-mail per address (nobody sees the others). The invite_emails row (the canonical
// mailbox) is written first, so a mailbox is never invited twice, even if the button is pressed twice; removed again if the
// send fails.
export async function sendInvites(emails: string[], deadline: number) {
  const supabase = createServiceClient();
  const [invited, banned, people] = await Promise.all([
    supabase.from('invite_emails').select('email'),
    supabase.from('banned_emails').select('email'),
    supabase.from('participants').select('email').not('email', 'is', null),
  ]);
  for (const r of [invited, banned, people]) if (r.error) throw r.error;
  const { toSend, skipped } = pendingInvites(emails, {
    invited: new Set(invited.data!.map((r) => r.email)),
    banned: new Set(banned.data!.map((r) => canonicalEmail(r.email))),
    participants: new Set(people.data!.map((r) => canonicalEmail(r.email!))),
  });

  let sent = 0;
  let failed = 0;
  let done = 0;
  for (const to of toSend) {
    if (Date.now() > deadline) break;
    done++;
    const { error } = await supabase.from('invite_emails').insert({ email: canonicalEmail(to) });
    if (error) {
      if (error.code === '23505') skipped.invited++;
      else failed++;
      continue;
    }
    if (await sendOther([to], subject(), text(), email())) sent++;
    else {
      failed++;
      await supabase.from('invite_emails').delete().eq('email', canonicalEmail(to));
    }
  }
  return { sent, failed, skipped, remaining: toSend.length - done };
}
