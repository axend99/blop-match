import 'server-only';
import { adminEmails } from '@/lib/admin';
import { emailConfigured, sendHtml } from '@/lib/email';
import { canonicalEmail } from '@/lib/emailCanonical';
import { createServiceClient } from '@/lib/supabase/service';
import { pageAll } from '@/lib/supabase/pageAll';
import * as partyDec4 from '@/emails/campaigns/partyDec4';

// One-off e-mail campaigns, sent from /admin to a pasted list of addresses. To add one: put the
// HTML in emails/campaigns/<name>.ts (exporting `html` and `text`) and list it here.
export const CAMPAIGNS = [
  {
    id: 'party-dec4',
    title: 'Festa BLOP — 4 de dezembro (EN)',
    subject: "Something's happening 👀",
    replyTo: 'founders@meetblop.com',
    ...partyDec4,
  },
] as const;

export type CampaignId = (typeof CAMPAIGNS)[number]['id'];
export const campaignById = (id: string) => CAMPAIGNS.find((c) => c.id === id);

// How many mailboxes already got each campaign.
export async function campaignCounts(): Promise<Record<string, number>> {
  const { data } = await pageAll((a, b) => createServiceClient().from('campaign_sends').select('campaign, email').order('email').range(a, b));
  const counts: Record<string, number> = {};
  for (const r of data ?? []) counts[r.campaign] = (counts[r.campaign] ?? 0) + 1;
  return counts;
}

export async function sendCampaignPreview(id: string): Promise<number> {
  const c = campaignById(id);
  const to = adminEmails();
  if (!c) return 0;
  let sent = 0;
  for (const email of to) if (await sendHtml(email, `[teste] ${c.subject}`, c.html, c.text, c.replyTo)) sent++;
  return sent;
}

// One e-mail per address (nobody sees the others). The campaign_sends row (canonical mailbox) is
// written first, so a mailbox never gets the same campaign twice; removed if the send fails.
// Banned addresses are skipped.
export async function sendCampaign(id: string, emails: string[], deadline: number) {
  const c = campaignById(id);
  if (!c || !emailConfigured()) return { sent: 0, already: 0, banned: 0, failed: emails.length, remaining: 0 };
  const supabase = createServiceClient();
  const { data: bannedRows } = await pageAll((a, b) => supabase.from('banned_emails').select('email').order('email').range(a, b));
  const banned = new Set((bannedRows ?? []).map((r) => canonicalEmail(r.email)));
  let sent = 0;
  let already = 0;
  let skipped = 0;
  let failed = 0;
  let done = 0;
  for (const to of emails) {
    if (Date.now() > deadline) break;
    done++;
    const mailbox = canonicalEmail(to);
    if (banned.has(mailbox)) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from('campaign_sends').insert({ campaign: c.id, email: mailbox });
    if (error) {
      if (error.code === '23505') already++;
      else failed++;
      continue;
    }
    if (await sendHtml(to, c.subject, c.html, c.text, c.replyTo)) sent++;
    else {
      failed++;
      await supabase.from('campaign_sends').delete().eq('campaign', c.id).eq('email', mailbox);
    }
  }
  return { sent, already, banned: skipped, failed, remaining: emails.length - done };
}
