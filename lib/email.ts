import 'server-only';
import { render } from '@react-email/components';
import nodemailer from 'nodemailer';
import { createServiceClient } from '@/lib/supabase/service';
import { siteUrl } from '@/lib/site';

export type EmailKind = 'welcome' | 'new_match' | 'review_open' | 'review_reminder';

type SendEmailArgs = {
  participantId: string;
  kind: EmailKind;
  matchId?: string | null;
  to: string;
  subject: string;
  react: React.ReactElement;
};

export function emailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM && siteUrl(),
  );
}

// Any SMTP server works (Gmail with an app password today, a custom domain later).
function transport() {
  const port = Number(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// Sends at most once per (participant, kind, match): the email_log row is written first,
// so its unique constraint blocks duplicates even under concurrent calls. If the process
// dies between the insert and the send the email is lost; acceptable at this scale.
export async function sendEmail({ participantId, kind, matchId = null, to, subject, react }: SendEmailArgs): Promise<boolean> {
  if (!emailConfigured()) {
    console.warn(`[email] not configured, skipping ${kind} to participant ${participantId}`);
    return false;
  }

  const supabase = createServiceClient();
  const { data: log, error: logError } = await supabase
    .from('email_log')
    .insert({ participant_id: participantId, kind, match_id: matchId })
    .select('id')
    .single();
  if (logError) {
    if (logError.code !== '23505') console.error('[email] log insert failed', logError);
    return false;
  }

  try {
    await transport().sendMail({ from: process.env.EMAIL_FROM, to, subject, html: await render(react) });
    return true;
  } catch (error) {
    console.error(`[email] ${kind} send failed`, error);
    await supabase.from('email_log').delete().eq('id', log.id);
    return false;
  }
}
