// Waiting list for the BLOP app (pure parts). The invitation goes out WAITLIST_DELAY_DAYS after
// sign-up to everyone still in the study with an e-mail (pending profiles included).
export const WAITLIST_DELAY_DAYS = 5;
const DAY = 24 * 60 * 60 * 1000;

export type WaitlistPerson = { id: string; createdAt: string; active: boolean; deleted: boolean; hasEmail: boolean; isSeed: boolean };

// `graceMs`: the daily cron fires at any minute of its hour (same slack as the review e-mails).
export function dueWaitlist(people: WaitlistPerson[], sent: Set<string>, now: Date, graceMs: number): string[] {
  const cutoff = now.getTime() - WAITLIST_DELAY_DAYS * DAY + graceMs;
  return people
    .filter((p) => p.active && !p.deleted && p.hasEmail && !p.isSeed && !sent.has(p.id))
    .filter((p) => new Date(p.createdAt).getTime() <= cutoff)
    .map((p) => p.id);
}

// Only a valid http(s) address turns the feature on (e-mail, /me card and redirect).
export function waitlistUrl(): string | undefined {
  const value = process.env.WAITLIST_URL?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
