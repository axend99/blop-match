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

// End of the study (Lisbon 09:00 = UTC in November): from then on no new matches and no e-mails
// except the closing one, and every review is open so everyone can still rate. The site stays up.
export const STUDY_ENDS_AT = '2026-11-03T09:00:00Z';

export function studyEnded(now = new Date()): boolean {
  return now.getTime() >= new Date(STUDY_ENDS_AT).getTime();
}

export function reviewOpensAt(matchCreatedAt: string): Date {
  const opens = new Date(matchCreatedAt).getTime() + reviewDelayDays() * 24 * 60 * 60 * 1000 - REVIEW_GRACE_MS;
  const regular = Math.max(opens, new Date(matchCreatedAt).getTime());
  return new Date(studyEnded() ? Math.min(regular, new Date(STUDY_ENDS_AT).getTime()) : regular);
}

export function reminderDelayDays(): number {
  return intEnv('REMINDER_DELAY_DAYS', 3);
}

// The BLOP website (brand name, the same in every language).
export const BLOP_WEBSITE = 'https://meetblop.com/';
export const BLOP_INSTAGRAM = 'https://www.instagram.com/meetblop/';
