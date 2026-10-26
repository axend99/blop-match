// Review form rules (SPEC §7), mirroring the reviews table checks in 0001_init.sql.
// Answers of hidden branches are dropped, so the form can change answers freely.

export const WHO_FIRST = ['me', 'them'] as const;
export const WHY_NOT = ['no_time', 'not_interested', 'no_reply', 'shy', 'other'] as const;
export const MET = ['yes', 'planned', 'no'] as const;
export const IG_FOLLOW = ['me', 'them', 'both', 'none'] as const;
export const BEST_FOR = ['friendship', 'dating', 'both'] as const;
export const PARTY = ['yes', 'maybe', 'no'] as const;
export const PERSONALITY = ['introvert', 'extrovert', 'both'] as const;
export const MAX_COMMENT = 1000;

export type ReviewInput = Record<string, unknown>;

export type Review = {
  contacted: boolean;
  interest_1_7: number;
  who_first: (typeof WHO_FIRST)[number] | null;
  comfort_1_7: number | null;
  why_not: (typeof WHY_NOT)[number] | null;
  talked: boolean | null;
  flow_1_7: number | null;
  common_ground_1_7: number | null;
  satisfaction_1_7: number | null;
  meet_again_1_7: number | null;
  met: (typeof MET)[number] | null;
  ig_follow: (typeof IG_FOLLOW)[number] | null;
  likes_concept: boolean;
  best_for: (typeof BEST_FOR)[number];
  party_interest: (typeof PARTY)[number];
  personality: (typeof PERSONALITY)[number];
  comment: string | null;
};

export type ReviewField = keyof Review;
export type ReviewErrorKey = 'required' | 'tooLong';
export type ReviewErrors = Partial<Record<ReviewField, ReviewErrorKey>>;

const SCALES = ['flow_1_7', 'common_ground_1_7', 'satisfaction_1_7', 'meet_again_1_7'] as const;

const isBool = (v: unknown): v is boolean => v === true || v === false;
const isScale = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 7;
const oneOf = <T extends string>(options: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (options as readonly string[]).includes(v);

// `askInstagram`: both people have Instagram, so "who followed whom" is asked (and required).
export function validateReview(
  input: ReviewInput,
  { askInstagram = false }: { askInstagram?: boolean } = {},
): { ok: true; data: Review } | { ok: false; errors: ReviewErrors } {
  const errors: ReviewErrors = {};
  const data: Review = {
    contacted: false,
    interest_1_7: 0,
    who_first: null,
    comfort_1_7: null,
    why_not: null,
    talked: null,
    flow_1_7: null,
    common_ground_1_7: null,
    satisfaction_1_7: null,
    meet_again_1_7: null,
    met: null,
    ig_follow: null,
    likes_concept: false,
    best_for: 'friendship',
    party_interest: 'no',
    personality: 'both',
    comment: null,
  };

  if (isBool(input.contacted)) data.contacted = input.contacted;
  else errors.contacted = 'required';

  if (isScale(input.interest_1_7)) data.interest_1_7 = input.interest_1_7;
  else errors.interest_1_7 = 'required';

  if (input.contacted === true) {
    if (oneOf(WHO_FIRST, input.who_first)) data.who_first = input.who_first;
    else errors.who_first = 'required';
    if (isScale(input.comfort_1_7)) data.comfort_1_7 = input.comfort_1_7;
    else errors.comfort_1_7 = 'required';
    if (isBool(input.talked)) data.talked = input.talked;
    else errors.talked = 'required';

    if (input.talked === true) {
      for (const field of SCALES) {
        const value = input[field];
        if (isScale(value)) data[field] = value;
        else errors[field] = 'required';
      }
      if (oneOf(MET, input.met)) data.met = input.met;
      else errors.met = 'required';
    }
  } else if (input.contacted === false) {
    if (oneOf(WHY_NOT, input.why_not)) data.why_not = input.why_not;
    else errors.why_not = 'required';
  }

  if (askInstagram) {
    if (oneOf(IG_FOLLOW, input.ig_follow)) data.ig_follow = input.ig_follow;
    else errors.ig_follow = 'required';
  }

  // About the idea itself (always asked).
  if (isBool(input.likes_concept)) data.likes_concept = input.likes_concept;
  else errors.likes_concept = 'required';
  if (oneOf(BEST_FOR, input.best_for)) data.best_for = input.best_for;
  else errors.best_for = 'required';
  if (oneOf(PARTY, input.party_interest)) data.party_interest = input.party_interest;
  else errors.party_interest = 'required';
  if (oneOf(PERSONALITY, input.personality)) data.personality = input.personality;
  else errors.personality = 'required';

  if (typeof input.comment === 'string' && input.comment.trim()) {
    const comment = input.comment.trim();
    if (comment.length > MAX_COMMENT) errors.comment = 'tooLong';
    else data.comment = comment;
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

// Who gets review emails (SPEC §6). Pure, so the cron's selection is tested.

export type DueMatch = { id: string; aId: string; bId: string; createdAt: string };
export type DueRequest = { matchId: string; participantId: string; requestedAt: string; remindedAt: string | null };
export type DueParticipant = { id: string; active: boolean; deleted: boolean; hasEmail: boolean; held?: boolean };
export type Recipient = { matchId: string; participantId: string };

const DAY = 24 * 60 * 60 * 1000;
// The Hobby cron fires at any minute within its hour, so cutoffs get an hour of slack
// (otherwise a send could slip a whole day). reviewOpensAt() uses the same slack.
export const REVIEW_GRACE_MS = 60 * 60 * 1000;

// People who left, were anonymised or have no email get no review emails;
// they can still rate from /me.
function emailable(p: DueParticipant | undefined): boolean {
  return Boolean(p && p.active && !p.deleted && p.hasEmail);
}

// match_nudge ("have you talked?"): matches at least `nudgeDays` old but not yet due for the review
// request, for each side not nudged, not asked for a review yet and without a review. Skipped when
// the match was reported or either person left or is on hold (the e-mail invites to talk).
export function dueNudges(args: {
  matches: DueMatch[];
  nudged: Set<string>; // `${matchId}|${participantId}`
  requests: DueRequest[];
  reported: Set<string>; // match ids with a report
  reviewKeys: Set<string>;
  participants: Map<string, DueParticipant>;
  now: Date;
  nudgeDays: number;
  reviewDelayDays: number;
}): Recipient[] {
  const from = args.now.getTime() - args.nudgeDays * DAY + REVIEW_GRACE_MS;
  const until = args.now.getTime() - args.reviewDelayDays * DAY + REVIEW_GRACE_MS;
  const present = (p: DueParticipant | undefined) => Boolean(p && p.active && !p.deleted && !p.held);
  const requested = new Set(args.requests.map((r) => `${r.matchId}|${r.participantId}`));
  return args.matches
    .filter((m) => {
      const created = new Date(m.createdAt).getTime();
      return created <= from && created > until && !args.reported.has(m.id);
    })
    .flatMap((m) => [
      { matchId: m.id, participantId: m.aId, otherId: m.bId },
      { matchId: m.id, participantId: m.bId, otherId: m.aId },
    ])
    .filter(({ matchId, participantId, otherId }) => {
      const key = `${matchId}|${participantId}`;
      return (
        !args.nudged.has(key) &&
        !requested.has(key) &&
        !args.reviewKeys.has(key) &&
        emailable(args.participants.get(participantId)) &&
        present(args.participants.get(participantId)) &&
        present(args.participants.get(otherId))
      );
    })
    .map(({ matchId, participantId }) => ({ matchId, participantId }));
}

// review_open: matches at least `delayDays` old, for each side without a request or a review.
export function dueReviewRequests(args: {
  matches: DueMatch[];
  requests: DueRequest[];
  reviewKeys: Set<string>; // `${matchId}|${reviewerId}`
  participants: Map<string, DueParticipant>;
  now: Date;
  delayDays: number;
}): Recipient[] {
  const requested = new Set(args.requests.map((r) => `${r.matchId}|${r.participantId}`));
  const cutoff = args.now.getTime() - args.delayDays * DAY + REVIEW_GRACE_MS;
  return args.matches
    .filter((m) => new Date(m.createdAt).getTime() <= cutoff)
    .flatMap((m) => [m.aId, m.bId].map((participantId) => ({ matchId: m.id, participantId })))
    .filter(({ matchId, participantId }) => {
      const key = `${matchId}|${participantId}`;
      return !requested.has(key) && !args.reviewKeys.has(key) && emailable(args.participants.get(participantId));
    });
}

// The review request never lands on the heels of the "have you talked?" e-mail for the same match:
// it waits until `minHours` after it (the next run sends it). Late or manual runs can't stack them.
export const NUDGE_TO_REQUEST_MIN_HOURS = 20;

export function spacedFromNudge(due: Recipient[], nudgedAt: Map<string, string>, now: Date, minHours = NUDGE_TO_REQUEST_MIN_HOURS): Recipient[] {
  return due.filter((r) => {
    const at = nudgedAt.get(`${r.matchId}|${r.participantId}`);
    return !at || now.getTime() - new Date(at).getTime() >= minHours * 3_600_000;
  });
}

// review_reminder: a single reminder, `reminderDays` after review_open, if still no review.
export function dueReminders(args: {
  requests: DueRequest[];
  reviewKeys: Set<string>;
  participants: Map<string, DueParticipant>;
  now: Date;
  reminderDays: number;
}): Recipient[] {
  const cutoff = args.now.getTime() - args.reminderDays * DAY + REVIEW_GRACE_MS;
  return args.requests
    .filter(
      (r) =>
        !r.remindedAt &&
        new Date(r.requestedAt).getTime() <= cutoff &&
        !args.reviewKeys.has(`${r.matchId}|${r.participantId}`) &&
        emailable(args.participants.get(r.participantId)),
    )
    .map(({ matchId, participantId }) => ({ matchId, participantId }));
}
