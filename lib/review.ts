// Review form rules (SPEC §7), mirroring the reviews table checks in 0001_init.sql.
// Answers of hidden branches are dropped, so the form can change answers freely.

export const WHO_FIRST = ['me', 'them'] as const;
export const WHY_NOT = ['no_time', 'not_interested', 'no_reply', 'shy', 'other'] as const;
export const MET = ['yes', 'planned', 'no'] as const;
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

export function validateReview(input: ReviewInput): { ok: true; data: Review } | { ok: false; errors: ReviewErrors } {
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
export type DueParticipant = { id: string; active: boolean; deleted: boolean; hasEmail: boolean };
export type Recipient = { matchId: string; participantId: string };

const DAY = 24 * 60 * 60 * 1000;

// People who left, were anonymised or have no email get no review emails;
// they can still rate from /me.
function emailable(p: DueParticipant | undefined): boolean {
  return Boolean(p && p.active && !p.deleted && p.hasEmail);
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
  const cutoff = args.now.getTime() - args.delayDays * DAY;
  return args.matches
    .filter((m) => new Date(m.createdAt).getTime() <= cutoff)
    .flatMap((m) => [m.aId, m.bId].map((participantId) => ({ matchId: m.id, participantId })))
    .filter(({ matchId, participantId }) => {
      const key = `${matchId}|${participantId}`;
      return !requested.has(key) && !args.reviewKeys.has(key) && emailable(args.participants.get(participantId));
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
  const cutoff = args.now.getTime() - args.reminderDays * DAY;
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
