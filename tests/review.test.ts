import { describe, expect, it } from 'vitest';
import { dueReminders, dueReviewRequests, validateReview, type DueParticipant } from '@/lib/review';
import { reviewOpensAt } from '@/lib/site';

const TALKED = {
  contacted: true,
  interest_1_7: 6,
  who_first: 'me',
  comfort_1_7: 5,
  talked: true,
  flow_1_7: 6,
  common_ground_1_7: 7,
  satisfaction_1_7: 6,
  meet_again_1_7: 5,
  met: 'planned',
  likes_concept: true,
  best_for: 'both',
  comment: '  Great chat  ',
};

describe('validateReview', () => {
  it('accepts the full "talked" branch and trims the comment', () => {
    const result = validateReview(TALKED);
    expect(result).toEqual({
      ok: true,
      data: { ...TALKED, why_not: null, ig_follow: null, comment: 'Great chat' },
    });
  });

  it('accepts contacted without a real conversation and clears the talked questions', () => {
    const result = validateReview({ ...TALKED, talked: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      talked: false,
      flow_1_7: null,
      common_ground_1_7: null,
      satisfaction_1_7: null,
      meet_again_1_7: null,
      met: null,
    });
  });

  it('accepts not contacted and drops answers from hidden branches', () => {
    const result = validateReview({ ...TALKED, contacted: false, why_not: 'shy', comment: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      contacted: false,
      interest_1_7: 6,
      who_first: null,
      comfort_1_7: null,
      why_not: 'shy',
      talked: null,
      flow_1_7: null,
      common_ground_1_7: null,
      satisfaction_1_7: null,
      meet_again_1_7: null,
      met: null,
      ig_follow: null,
      likes_concept: true,
      best_for: 'both',
      comment: null,
    });
  });

  it('requires the questions shown in each branch', () => {
    const idea = { likes_concept: true, best_for: 'friendship' };
    const notContacted = validateReview({ contacted: false, interest_1_7: 3, ...idea });
    expect(notContacted.ok || notContacted.errors).toEqual({ why_not: 'required' });

    const contacted = validateReview({ contacted: true, interest_1_7: 3, ...idea });
    expect(contacted.ok || contacted.errors).toEqual({ who_first: 'required', comfort_1_7: 'required', talked: 'required' });

    const talked = validateReview({ ...TALKED, flow_1_7: undefined, met: undefined });
    expect(talked.ok || talked.errors).toEqual({ flow_1_7: 'required', met: 'required' });

    const empty = validateReview({});
    expect(empty.ok || empty.errors).toEqual({ contacted: 'required', interest_1_7: 'required', likes_concept: 'required', best_for: 'required' });
  });

  it('rejects scales outside 1–7 and invalid options', () => {
    for (const bad of [0, 8, 3.5, '5', null]) {
      expect(validateReview({ ...TALKED, satisfaction_1_7: bad }).ok).toBe(false);
    }
    expect(validateReview({ ...TALKED, who_first: 'both' }).ok).toBe(false);
    expect(validateReview({ ...TALKED, met: 'maybe' }).ok).toBe(false);
    expect(validateReview({ contacted: false, interest_1_7: 2, why_not: 'busy' }).ok).toBe(false);
  });

  it('only accepts real booleans', () => {
    const result = validateReview({ ...TALKED, contacted: 'false' });
    expect(result.ok || result.errors).toMatchObject({ contacted: 'required' });
    expect(validateReview({ ...TALKED, talked: 'true' }).ok).toBe(false);
  });

  it('never passes extra keys through', () => {
    const result = validateReview({ ...TALKED, reviewer_id: 'x', match_id: 'y', next_step: true, id: 'z' });
    expect(result).toEqual(validateReview(TALKED));
  });

  it('limits the comment length', () => {
    const result = validateReview({ ...TALKED, comment: 'x'.repeat(1001) });
    expect(result.ok || result.errors).toEqual({ comment: 'tooLong' });
  });
});

describe('review email selection', () => {
  const now = new Date('2026-10-25T09:00:00Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
  const person = (id: string, patch: Partial<DueParticipant> = {}): [string, DueParticipant] => [
    id,
    { id, active: true, deleted: false, hasEmail: true, ...patch },
  ];
  const participants = new Map([person('a'), person('b'), person('c', { active: false }), person('d', { deleted: true, hasEmail: false })]);

  it('requests reviews for matches at least the delay old, once per person', () => {
    const matches = [
      { id: 'm1', aId: 'a', bId: 'b', createdAt: daysAgo(3) },
      { id: 'm2', aId: 'a', bId: 'b', createdAt: daysAgo(2) },
    ];
    const due = dueReviewRequests({ matches, requests: [], reviewKeys: new Set(), participants, now, delayDays: 3 });
    expect(due).toEqual([
      { matchId: 'm1', participantId: 'a' },
      { matchId: 'm1', participantId: 'b' },
    ]);
    const requests = [{ matchId: 'm1', participantId: 'a', requestedAt: daysAgo(0), remindedAt: null }];
    expect(
      dueReviewRequests({ matches, requests, reviewKeys: new Set(['m1|b']), participants, now, delayDays: 3 }),
    ).toEqual([]);
  });

  it('with REVIEW_DELAY_DAYS=0 every match is due right away', () => {
    const matches = [{ id: 'm1', aId: 'a', bId: 'b', createdAt: now.toISOString() }];
    expect(dueReviewRequests({ matches, requests: [], reviewKeys: new Set(), participants, now, delayDays: 0 })).toHaveLength(2);
  });

  it('skips people who left, were anonymised or have no email', () => {
    const matches = [{ id: 'm1', aId: 'c', bId: 'd', createdAt: daysAgo(5) }];
    expect(dueReviewRequests({ matches, requests: [], reviewKeys: new Set(), participants, now, delayDays: 3 })).toEqual([]);
  });

  it('sends a single reminder after the delay, only without a review', () => {
    const requests = [
      { matchId: 'm1', participantId: 'a', requestedAt: daysAgo(2), remindedAt: null },
      { matchId: 'm1', participantId: 'b', requestedAt: daysAgo(2), remindedAt: null },
      { matchId: 'm2', participantId: 'a', requestedAt: daysAgo(1), remindedAt: null },
      { matchId: 'm3', participantId: 'a', requestedAt: daysAgo(5), remindedAt: daysAgo(3) },
      { matchId: 'm4', participantId: 'c', requestedAt: daysAgo(5), remindedAt: null },
    ];
    const due = dueReminders({ requests, reviewKeys: new Set(['m1|b']), participants, now, reminderDays: 2 });
    expect(due).toEqual([{ matchId: 'm1', participantId: 'a' }]);
    expect(dueReminders({ requests, reviewKeys: new Set(), participants, now, reminderDays: 0 })).toHaveLength(3);
  });
});

describe('one hour of slack for the hourly cron window', () => {
  const now = new Date('2026-10-25T09:05:00Z');
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  const participants = new Map<string, DueParticipant>([
    ['a', { id: 'a', active: true, deleted: false, hasEmail: true }],
  ]);
  const DAY_MIN = 24 * 60;

  it('requests a review up to an hour early, not more', () => {
    const match = (createdAt: string) => [{ id: 'm', aId: 'a', bId: 'x', createdAt }];
    const due = (createdAt: string) =>
      dueReviewRequests({ matches: match(createdAt), requests: [], reviewKeys: new Set(), participants, now, delayDays: 3 });
    expect(due(minutesAgo(3 * DAY_MIN - 59))).toHaveLength(1);
    expect(due(minutesAgo(3 * DAY_MIN - 61))).toHaveLength(0);
  });

  it('reminds up to an hour early, not more', () => {
    const due = (requestedAt: string) =>
      dueReminders({ requests: [{ matchId: 'm', participantId: 'a', requestedAt, remindedAt: null }], reviewKeys: new Set(), participants, now, reminderDays: 2 });
    expect(due(minutesAgo(2 * DAY_MIN - 59))).toHaveLength(1);
    expect(due(minutesAgo(2 * DAY_MIN - 61))).toHaveLength(0);
  });

  it('opens the review page with the same slack, never before the match', () => {
    const created = '2026-10-20T10:00:00Z';
    expect(reviewOpensAt(created).toISOString()).toBe('2026-10-23T09:00:00.000Z');
    process.env.REVIEW_DELAY_DAYS = '0';
    expect(reviewOpensAt(created).toISOString()).toBe('2026-10-20T10:00:00.000Z');
    delete process.env.REVIEW_DELAY_DAYS;
  });
});

describe('Instagram question', () => {
  it('is required only when asked, and dropped otherwise', () => {
    const missing = validateReview(TALKED, { askInstagram: true });
    expect(missing.ok || missing.errors.ig_follow).toBe('required');
    const asked = validateReview({ ...TALKED, ig_follow: 'both' }, { askInstagram: true });
    expect(asked.ok && asked.data.ig_follow).toBe('both');
    const notAsked = validateReview({ ...TALKED, ig_follow: 'both' });
    expect(notAsked.ok && notAsked.data.ig_follow).toBeNull();
    const bad = validateReview({ ...TALKED, ig_follow: 'maybe' }, { askInstagram: true });
    expect(bad.ok).toBe(false);
  });
});

describe('questions about the idea', () => {
  it('are always required', () => {
    const { likes_concept, best_for, ...rest } = TALKED;
    void likes_concept;
    void best_for;
    const r = validateReview(rest);
    expect(r.ok || r.errors).toMatchObject({ likes_concept: 'required', best_for: 'required' });
    const bad = validateReview({ ...TALKED, best_for: 'work' });
    expect(bad.ok || bad.errors.best_for).toBe('required');
    const no = validateReview({ ...TALKED, likes_concept: false, best_for: 'dating' });
    expect(no.ok && [no.data.likes_concept, no.data.best_for]).toEqual([false, 'dating']);
  });
});
