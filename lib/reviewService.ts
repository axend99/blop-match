import 'server-only';
import { createElement } from 'react';
import ReviewEmail from '@/emails/ReviewEmail';
import { sendEmail, type EmailKind } from '@/lib/email';
import { getDict, isLang } from '@/lib/i18n';
import { dueReminders, dueReviewRequests, type DueParticipant, type Recipient } from '@/lib/review';
import { reminderDelayDays, reviewDelayDays, siteUrl } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

type Person = { id: string; name: string; email: string | null; lang: string; active: boolean; deleted_at: string | null };

async function loadState() {
  const supabase = createServiceClient();
  const [people, matches, requests, reviews] = await Promise.all([
    supabase.from('participants').select('id, name, email, lang, active, deleted_at'),
    supabase.from('matches').select('id, a_id, b_id, created_at'),
    supabase.from('review_requests').select('match_id, participant_id, requested_at, reminded_at'),
    supabase.from('reviews').select('match_id, reviewer_id'),
  ]);
  for (const r of [people, matches, requests, reviews]) if (r.error) throw r.error;

  const byId = new Map((people.data as Person[]).map((p) => [p.id, p]));
  const participants = new Map<string, DueParticipant>(
    [...byId.values()].map((p) => [p.id, { id: p.id, active: p.active, deleted: Boolean(p.deleted_at), hasEmail: Boolean(p.email) }]),
  );
  return {
    supabase,
    byId,
    participants,
    matches: matches.data!.map((m) => ({ id: m.id, aId: m.a_id, bId: m.b_id, createdAt: m.created_at })),
    requests: requests.data!.map((r) => ({
      matchId: r.match_id,
      participantId: r.participant_id,
      requestedAt: r.requested_at,
      remindedAt: r.reminded_at,
    })),
    reviewKeys: new Set(reviews.data!.map((r) => `${r.match_id}|${r.reviewer_id}`)),
  };
}

type State = Awaited<ReturnType<typeof loadState>>;

// Sends one review email. A false from sendEmail can also mean "already logged"
// (sent before), so that case still counts as done and is never retried forever.
async function send(state: State, kind: Extract<EmailKind, 'review_open' | 'review_reminder'>, to: Recipient): Promise<boolean> {
  const person = state.byId.get(to.participantId);
  if (!person?.email) return false;
  const lang = isLang(person.lang) ? person.lang : 'en';
  const copyKey = kind === 'review_open' ? 'reviewOpen' : 'reviewReminder';
  const sent = await sendEmail({
    participantId: person.id,
    kind,
    matchId: to.matchId,
    to: person.email,
    subject: getDict(lang).emails[copyKey].subject,
    react: createElement(ReviewEmail, { kind: copyKey, name: person.name, lang, url: `${siteUrl()}/me/review/${to.matchId}` }),
  });
  if (sent) return true;
  const { data } = await state.supabase
    .from('email_log')
    .select('id')
    .eq('participant_id', person.id)
    .eq('kind', kind)
    .eq('match_id', to.matchId)
    .maybeSingle();
  return Boolean(data);
}

// review_open: records the request first (its primary key blocks duplicates between runs),
// then emails; if the email fails, the request is removed so the next run retries.
async function sendReviewRequests(state: State, deadline: number): Promise<number> {
  const due = dueReviewRequests({
    matches: state.matches,
    requests: state.requests,
    reviewKeys: state.reviewKeys,
    participants: state.participants,
    now: new Date(),
    delayDays: reviewDelayDays(),
  });
  let sent = 0;
  for (const to of due) {
    if (Date.now() > deadline) break;
    const { data: inserted, error } = await state.supabase
      .from('review_requests')
      .upsert({ match_id: to.matchId, participant_id: to.participantId }, { onConflict: 'match_id,participant_id', ignoreDuplicates: true })
      .select('match_id');
    if (error) {
      console.error('[reviews] request insert failed', error);
      continue;
    }
    if (!inserted?.length) continue; // Another run already took it.
    if (await send(state, 'review_open', to)) sent++;
    else
      await state.supabase.from('review_requests').delete().eq('match_id', to.matchId).eq('participant_id', to.participantId);
  }
  return sent;
}

// review_reminder: a single reminder per request. Uses the requests loaded at the start of
// the run, so a request created in this run never gets its reminder in the same run.
async function sendReviewReminders(state: State, deadline: number): Promise<number> {
  const due = dueReminders({
    requests: state.requests,
    reviewKeys: state.reviewKeys,
    participants: state.participants,
    now: new Date(),
    reminderDays: reminderDelayDays(),
  });
  let sent = 0;
  for (const to of due) {
    if (Date.now() > deadline) break;
    if (!(await send(state, 'review_reminder', to))) continue;
    sent++;
    await state.supabase
      .from('review_requests')
      .update({ reminded_at: new Date().toISOString() })
      .eq('match_id', to.matchId)
      .eq('participant_id', to.participantId);
  }
  return sent;
}

export async function runReviewEmails(deadlines: { requests: number; reminders: number }) {
  const state = await loadState();
  const reviewOpen = await sendReviewRequests(state, deadlines.requests);
  const reviewReminder = await sendReviewReminders(state, deadlines.reminders);
  return { reviewOpen, reviewReminder };
}
