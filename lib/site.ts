export function siteUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || undefined;
}

export function reviewDelayDays(): number {
  return intEnv('REVIEW_DELAY_DAYS', 3);
}

function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function matchingConfig() {
  return {
    maxCompatible: intEnv('MAX_COMPATIBLE', 3),
    maxControl: intEnv('MAX_CONTROL', 1),
    minSharedCompatible: intEnv('MIN_SHARED_COMPATIBLE', 2),
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
  return new Date(new Date(matchCreatedAt).getTime() + reviewDelayDays() * 24 * 60 * 60 * 1000);
}

export function reminderDelayDays(): number {
  return intEnv('REMINDER_DELAY_DAYS', 2);
}
