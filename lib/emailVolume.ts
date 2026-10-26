import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

// Gmail sends about 500 e-mails per rolling 24 h from one account (study e-mails, invitations and
// sign-in links all use it). /admin shows the count and warns from WARN_AT.
export const GMAIL_DAILY_LIMIT = 500;
export const WARN_AT = 400;

export async function emailsLast24h() {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [study, invites, logins] = await Promise.all([
    supabase.from('email_log').select('id', { count: 'exact', head: true }).gt('sent_at', since),
    supabase.from('invite_emails').select('email', { count: 'exact', head: true }).gt('sent_at', since),
    supabase.rpc('login_emails_since', { p_since: since }),
  ]);
  for (const r of [study, invites, logins]) if (r.error) throw r.error;
  const counts = { study: study.count ?? 0, invites: invites.count ?? 0, logins: (logins.data as number) ?? 0 };
  return { ...counts, total: counts.study + counts.invites + counts.logins };
}
