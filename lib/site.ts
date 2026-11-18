import { REVIEW_GRACE_MS } from '@/lib/review';

export function siteUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || undefined;
}

export function reviewDelayDays(): number {
  return intEnv('REVIEW_DELAY_DAYS', 2);
}

function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function matchingConfig() {
  return {
    maxCompatible: intEnv('MAX_COMPATIBLE', 3),
    maxControl: intEnv('MAX_CONTROL', 1),
    minSharedCompatible: intEnv('MIN_SHARED_COMPATIBLE', 9), // compatibility points, see compatPoints
    // v2: compatible from this match score on (about the top 1 in 5 eligible pairs in v1 data).
    minScoreCompatible: intEnv('MIN_SCORE_COMPATIBLE', 14),
    maxAgeGap: intEnv('MAX_AGE_GAP', 5), // v2: no match between people more than this many years apart
  };
}

// The day a match's review opens, formatted in the study's time zone.
export function formatDate(date: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Lisbon',
  }).format(date);
}

// End of v1 (Lisbon 09:00 = UTC in November). v1 participants (cohort 'v1') get no more e-mails
// and no new matches (see lib/email.ts and lib/matchingService.ts); every v1 review is open so
// they can still rate. v2 (cohort 'v2', sign-ups from then on) follows the normal flow.
export const V1_ENDS_AT = '2026-11-03T09:00:00Z';

// Reviews open as soon as the match exists (the review page asks to contact the person first).
export function reviewOpensAt(matchCreatedAt: string): Date {
  return new Date(matchCreatedAt);
}

// When the review is due: the review e-mail goes out then (same delay as the cron), and from then
// on the app reminds the person (the /me card, the tab badge).
export function reviewDueAt(matchCreatedAt: string): Date {
  const created = new Date(matchCreatedAt).getTime();
  const opens = created + reviewDelayDays() * 24 * 60 * 60 * 1000 - REVIEW_GRACE_MS;
  const regular = Math.max(opens, created);
  const v1End = new Date(V1_ENDS_AT).getTime();
  return new Date(created < v1End ? Math.min(regular, v1End) : regular);
}

export function reminderDelayDays(): number {
  return intEnv('REMINDER_DELAY_DAYS', 3);
}

// The BLOP website (brand name, the same in every language).
export const BLOP_WEBSITE = 'https://meetblop.com/';
export const BLOP_INSTAGRAM = 'https://www.instagram.com/meetblop/';
