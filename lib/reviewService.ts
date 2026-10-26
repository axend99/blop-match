import 'server-only';
import { createElement } from 'react';
import MatchNudgeEmail from '@/emails/MatchNudgeEmail';
import ReviewEmail from '@/emails/ReviewEmail';
import { inBatches } from '@/lib/batch';
import { sendEmail, sendOther, type EmailKind } from '@/lib/email';
import { getDict, interestLabel, isLang } from '@/lib/i18n';
import { dueNudges, dueReminders, dueReviewRequests, type DueParticipant, type Recipient } from '@/lib/review';
import { reminderDelayDays, reviewDelayDays, siteUrl } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';
import { pageAll } from '@/lib/supabase/pageAll';

type Person = {
  id: string;
  name: string;
  email: string | null;
  lang: string;
  active: boolean;
  deleted_at: string | null;
  pending_review: boolean;
};

async function loadState() {
  const supabase = createServiceClient();
  const [people, matches, requests, reviews, nudges, reports] = await Promise.all([
    pageAll((a, b) => supabase.from('participants').select('id, name, email, lang, active, deleted_at, pending_review').order('id').range(a, b)),
    pageAll((a, b) => supabase.from('matches').select('id, a_id, b_id, created_at, shared_items').order('id').range(a, b)),
    pageAll((a, b) =>
      supabase.from('review_requests').select('match_id, participant_id, requested_at, reminded_at, resent_at').order('match_id').order('participant_id').range(a, b),
    ),
    pageAll((a, b) => supabase.from('reviews').select('match_id, reviewer_id').order('id').range(a, b)),
    pageAll((a, b) => supabase.from('email_log').select('match_id, participant_id').eq('kind', 'match_nudge').order('id').range(a, b)),
    pageAll((a, b) => supabase.from('reports').select('match_id').order('id').range(a, b)),
  ]);
  for (const r of [people, matches, requests, reviews, nudges, reports]) if (r.error) throw r.error;

  const byId = new Map((people.data as Person[]).map((p) => [p.id, p]));
  const participants = new Map<string, DueParticipant>(
    [...byId.values()].map((p) => [
      p.id,
      { id: p.id, active: p.active, deleted: Boolean(p.deleted_at), hasEmail: Boolean(p.email), held: p.pending_review },
    ]),
  );
  return {
    supabase,
    byId,
    participants,
    matches: matches.data!.map((m) => ({ id: m.id, aId: m.a_id, bId: m.b_id, createdAt: m.created_at })),
    matchById: new Map(matches.data!.map((m) => [m.id, m])),
    requests: requests.data!.map((r) => ({
      matchId: r.match_id,
      participantId: r.participant_id,
      requestedAt: r.requested_at,
      remindedAt: r.reminded_at,
      resentAt: r.resent_at as string | null,
    })),
    reviewKeys: new Set(reviews.data!.map((r) => `${r.match_id}|${r.reviewer_id}`)),
    nudged: new Set(nudges.data!.map((r) => `${r.match_id}|${r.participant_id}`)),
    reported: new Set(reports.data!.flatMap((r) => (r.match_id ? [r.match_id as string] : []))),
  };
}

type State = Awaited<ReturnType<typeof loadState>>;

// E-mails sent at the same time (the SMTP connection is shared; Gmail copes with a few).
const BATCH = 5;

// The review e-mail (request or reminder) for one person and match; null without an address.
function reviewMessage(state: State, kind: Extract<EmailKind, 'review_open' | 'review_reminder'>, to: Recipient) {
  const person = state.byId.get(to.participantId);
  if (!person?.email) return null;
  const lang = isLang(person.lang) ? person.lang : 'en';
  const copyKey = kind === 'review_open' ? 'reviewOpen' : 'reviewReminder';
  const match = state.matchById.get(to.matchId);
  const partner = state.byId.get(match?.a_id === person.id ? match?.b_id : match?.a_id);
  const partnerName = partner && !partner.deleted_at ? partner.name : undefined;
  return {
    person,
    subject: getDict(lang).emails[copyKey].subject(partnerName),
    react: createElement(ReviewEmail, {
      kind: copyKey,
      name: person.name,
      partnerName,
      lang,
      // Through /go/review, which counts the tap for /admin.
      url: `${siteUrl()}/go/review?m=${to.matchId}&p=${person.id}&src=${kind === 'review_open' ? 'open' : 'reminder'}`,
      reportUrl: partnerName ? `${siteUrl()}/login?next=/me/report/${to.matchId}` : undefined,
    }),
  };
}

// Sends one review email. A false from sendEmail can also mean "already logged"
// (sent before), so that case still counts as done and is never retried forever.
async function send(state: State, kind: Extract<EmailKind, 'review_open' | 'review_reminder'>, to: Recipient): Promise<boolean> {
  const message = reviewMessage(state, kind, to);
  if (!message) return false;
  const sent = await sendEmail({ participantId: message.person.id, kind, matchId: to.matchId, to: message.person.email!, subject: message.subject, react: message.react });
  if (sent) return true;
  const { data } = await state.supabase
    .from('email_log')
    .select('id')
    .eq('participant_id', message.person.id)
    .eq('kind', kind)
    .eq('match_id', to.matchId)
    .maybeSingle();
  return Boolean(data);
}

// match_nudge: "have you talked to your match?" the day before the review request (the e-mail
// says the request comes tomorrow). sendEmail's email_log row makes it once per person and match.
async function sendNudges(state: State, deadline: number): Promise<number> {
  const nudgeDays = reviewDelayDays() - 1;
  if (nudgeDays < 1) return 0;
  const due = dueNudges({
    matches: state.matches,
    nudged: state.nudged,
    requests: state.requests,
    reported: state.reported,
    reviewKeys: state.reviewKeys,
    participants: state.participants,
    now: new Date(),
    nudgeDays,
    reviewDelayDays: reviewDelayDays(),
  });
  return inBatches(due, BATCH, deadline, async (to) => {
    const person = state.byId.get(to.participantId);
    const match = state.matchById.get(to.matchId);
    const partner = state.byId.get(match?.a_id === to.participantId ? match?.b_id : match?.a_id);
    if (!person?.email || !match || !partner) return false;
    const lang = isLang(person.lang) ? person.lang : 'en';
    const first = (match.shared_items as string[] | null)?.[0];
    return sendEmail({
      participantId: person.id,
      kind: 'match_nudge',
      matchId: to.matchId,
      to: person.email,
      subject: getDict(lang).emails.matchNudge.subject(partner.name),
      react: createElement(MatchNudgeEmail, {
        name: person.name,
        partnerName: partner.name,
        sharedItem: first ? interestLabel(first, lang) : undefined,
        lang,
        url: `${siteUrl()}/login?next=/me/match/${to.matchId}`,
        reportUrl: `${siteUrl()}/login?next=/me/report/${to.matchId}`,
      }),
    });
  });
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
  return inBatches(due, BATCH, deadline, async (to) => {
    const { data: inserted, error } = await state.supabase
      .from('review_requests')
      .upsert({ match_id: to.matchId, participant_id: to.participantId }, { onConflict: 'match_id,participant_id', ignoreDuplicates: true })
      .select('match_id');
    if (error) {
      console.error('[reviews] request insert failed', error);
      return false;
    }
    if (!inserted?.length) return false; // Another run already took it.
    if (await send(state, 'review_open', to)) return true;
    await state.supabase.from('review_requests').delete().eq('match_id', to.matchId).eq('participant_id', to.participantId);
    return false;
  });
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
  return inBatches(due, BATCH, deadline, async (to) => {
    if (!(await send(state, 'review_reminder', to))) return false;
    await state.supabase
      .from('review_requests')
      .update({ reminded_at: new Date().toISOString() })
      .eq('match_id', to.matchId)
      .eq('participant_id', to.participantId);
    return true;
  });
}

// Admin shortcut for testers: moves the match back so its review is open now, then sends the
// "rate this interaction" e-mail to both sides right away (same rules as the cron: active, with
// e-mail, not yet asked, not yet answered). Returns how many e-mails went out.
export async function openReviewNow(matchId: string): Promise<number> {
  const supabase = createServiceClient();
  const createdAt = new Date(Date.now() - reviewDelayDays() * 24 * 60 * 60 * 1000 - 60_000).toISOString();
  const { data, error } = await supabase.from('matches').update({ created_at: createdAt }).eq('id', matchId).select('id');
  if (error) throw error;
  if (!data?.length) return 0;
  const state = await loadState();
  state.matches = state.matches.filter((m) => m.id === matchId);
  return sendReviewRequests(state, Date.now() + 30_000);
}

// Review requests sent with the old link (it did not bring people back to the form after signing
// in): sent once more with the current link, to those who have not answered yet.
export const OLD_REVIEW_LINK_BEFORE = '2026-10-26T15:45:00Z'; // when the fixed link went live

function oldLinkRequests(state: State) {
  return state.requests.filter(
    (r) =>
      new Date(r.requestedAt).getTime() < new Date(OLD_REVIEW_LINK_BEFORE).getTime() &&
      !r.resentAt &&
      !state.reviewKeys.has(`${r.matchId}|${r.participantId}`) &&
      state.participants.get(r.participantId)?.active &&
      state.participants.get(r.participantId)?.hasEmail &&
      !state.participants.get(r.participantId)?.deleted,
  );
}

// E-mails already due but not sent yet (they go out in the next hourly run), for /admin.
export async function emailBacklog() {
  const state = await loadState();
  const now = new Date();
  const nudgeDays = reviewDelayDays() - 1;
  const base = { reviewKeys: state.reviewKeys, participants: state.participants, now };
  return {
    nudges:
      nudgeDays < 1
        ? 0
        : dueNudges({ ...base, matches: state.matches, nudged: state.nudged, requests: state.requests, reported: state.reported, nudgeDays, reviewDelayDays: reviewDelayDays() }).length,
    requests: dueReviewRequests({ ...base, matches: state.matches, requests: state.requests, delayDays: reviewDelayDays() }).length,
    reminders: dueReminders({ ...base, requests: state.requests, reminderDays: reminderDelayDays() }).length,
  };
}

export async function countOldLinkRequests(): Promise<number> {
  return oldLinkRequests(await loadState()).length;
}

export async function resendOldLinkRequests(deadline: number): Promise<number> {
  const state = await loadState();
  return inBatches(oldLinkRequests(state), BATCH, deadline, async (r) => {
    const to = { matchId: r.matchId, participantId: r.participantId };
    // Marked first, so a second click can't send it twice; unmarked if the e-mail fails.
    const { data, error } = await state.supabase
      .from('review_requests')
      .update({ resent_at: new Date().toISOString() })
      .eq('match_id', to.matchId)
      .eq('participant_id', to.participantId)
      .is('resent_at', null)
      .select('match_id');
    if (error || !data?.length) return false;
    const message = reviewMessage(state, 'review_open', to);
    if (message && (await sendOther([message.person.email!], message.subject, message.subject, message.react))) return true;
    await state.supabase.from('review_requests').update({ resent_at: null }).eq('match_id', to.matchId).eq('participant_id', to.participantId);
    return false;
  });
}

export async function runReviewEmails(deadlines: { nudges: number; requests: number; reminders: number }) {
  const state = await loadState();
  const matchNudge = await sendNudges(state, deadlines.nudges);
  const reviewOpen = await sendReviewRequests(state, deadlines.requests);
  const reviewReminder = await sendReviewReminders(state, deadlines.reminders);
  return { matchNudge, reviewOpen, reviewReminder };
}
