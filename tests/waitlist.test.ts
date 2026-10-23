import { describe, expect, it } from 'vitest';
import { dueWaitlist, type WaitlistPerson } from '@/lib/waitlist';

const now = new Date('2026-10-30T09:30:00Z');
const person = (id: string, daysAgo: number, patch: Partial<WaitlistPerson> = {}): WaitlistPerson => ({
  id,
  createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  active: true,
  deleted: false,
  hasEmail: true,
  isSeed: false,
  ...patch,
});

describe('dueWaitlist', () => {
  it('invites people 5 days after sign-up, once, while still in the study', () => {
    const people = [
      person('due', 5),
      person('early', 4.9),
      person('sent', 8),
      person('left', 6, { active: false }),
      person('anon', 6, { deleted: true }),
      person('seed', 6, { isSeed: true, hasEmail: false }),
    ];
    expect(dueWaitlist(people, new Set(['sent']), now, 0)).toEqual(['due']);
    expect(dueWaitlist(people, new Set(['sent']), now, 3 * 3_600_000)).toEqual(['due', 'early']);
  });
});
