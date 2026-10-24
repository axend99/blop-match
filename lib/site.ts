import { REVIEW_GRACE_MS } from '@/lib/review';

export function siteUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || undefined;
}

export function reviewDelayDays(): number {
  return intEnv('REVIEW_DELAY_DAYS', 1);
}

function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function matchingConfig() {
  return {
    maxCompatible: intEnv('MAX_COMPATIBLE', 3),
    maxControl: intEnv('MAX_CONTROL', 1),
    minSharedCompatible: intEnv('MIN_SHARED_COMPATIBLE', 8),
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

export function reviewOpensAt(matchCreatedAt: string): Date {
  const opens = new Date(matchCreatedAt).getTime() + reviewDelayDays() * 24 * 60 * 60 * 1000 - REVIEW_GRACE_MS;
  return new Date(Math.max(opens, new Date(matchCreatedAt).getTime()));
}

export function reminderDelayDays(): number {
  return intEnv('REMINDER_DELAY_DAYS', 3);
}

// The BLOP website (brand name, the same in every language).
export const BLOP_WEBSITE = 'https://meetblop.com/';
export const BLOP_INSTAGRAM = 'https://www.instagram.com/meetblop/';
