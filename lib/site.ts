export function siteUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || undefined;
}

export function reviewDelayDays(): number {
  const days = Number(process.env.REVIEW_DELAY_DAYS);
  return Number.isInteger(days) && days >= 0 ? days : 3;
}
