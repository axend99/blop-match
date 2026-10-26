import { CATEGORIES, INTERESTS, interestsByCategory, type Category } from '@/lib/interests';

// Pure statistics for /admin (SPEC §8). The unit of analysis is the review: one person
// rating one match, so a match gives up to two (non-independent) reviews. Values are kept
// raw; rounding happens only when displaying.

export type Group = 'compatible' | 'control';
export const GROUPS: Group[] = ['compatible', 'control'];
export const MIN_N = 15;

export type ReviewRow = {
  match_id: string;
  type: Group;
  shared_count: number;
  shared_by_category: Partial<Record<string, number>>;
  shared_items: string[];
  // Profile of the person who answered.
  age_range: string;
  time_in_city: string;
  origin: string;
  city: string;
  lang: string;
  // Answers.
  contacted: boolean;
  interest_1_7: number;
  comfort_1_7: number | null;
  why_not: string | null;
  talked: boolean | null;
  flow_1_7: number | null;
  common_ground_1_7: number | null;
  satisfaction_1_7: number | null;
  meet_again_1_7: number | null;
  met: string | null;
  next_step: boolean;
  ig_follow?: string | null; // null when not asked (one of the two has no Instagram)
  likes_concept?: boolean | null; // null on reviews sent before the question existed
  best_for?: string | null;
  party_interest?: string | null; // null on reviews sent before the question existed
  personality?: string | null; // introvert / extrovert / both; null before the question existed
};

export type ScoreField =
  | 'interest_1_7'
  | 'comfort_1_7'
  | 'flow_1_7'
  | 'common_ground_1_7'
  | 'satisfaction_1_7'
  | 'meet_again_1_7';

export type Stat = { value: number | null; n: number };

// Share of rows (0–1) where `pred` holds; n = all rows.
export function rate<T>(rows: T[], pred: (row: T) => boolean): Stat {
  return { value: rows.length ? rows.filter(pred).length / rows.length : null, n: rows.length };
}

// Mean of a 1–7 field, ignoring unanswered (null) values; n = answers.
export function mean(rows: ReviewRow[], field: ScoreField): Stat {
  const values = rows.map((r) => r[field]).filter((v): v is number => v !== null);
  return { value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, n: values.length };
}

export function byGroup(rows: ReviewRow[], group: Group | 'all'): ReviewRow[] {
  return group === 'all' ? rows : rows.filter((r) => r.type === group);
}

const talked = (r: ReviewRow) => r.talked === true;
const reachedOut = (r: ReviewRow) => r.contacted;
const met = (r: ReviewRow) => r.met === 'yes' || r.met === 'planned';

function difference(a: Stat, b: Stat): number | null {
  return a.value === null || b.value === null ? null : a.value - b.value;
}

// Average ranks (1-based) with ties sharing the mean of their positions.
function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const result = new Array<number>(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) result[order[k][1]] = rank;
    i = j + 1;
  }
  return result;
}

// Spearman's rho = Pearson correlation of the ranks. Undefined with n < 3 or no variance.
export function spearman(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3 || y.length !== n) return null;
  const rx = ranks(x);
  const ry = ranks(y);
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (rx[i] - mx) * (ry[i] - my);
    vx += (rx[i] - mx) ** 2;
    vy += (ry[i] - my) ** 2;
  }
  return vx === 0 || vy === 0 ? null : cov / Math.sqrt(vx * vy);
}

// --- Hypotheses (SPEC §8 block 1) ---

export type Status = 'above' | 'below' | 'insufficient';
export type Hypothesis = {
  id: 'H0' | 'H1' | 'H2' | 'H3' | 'H4';
  values: { label: string; value: number | null; kind: 'pp' | 'pct' | 'points' | 'rho' }[];
  ns: { label: string; n: number }[];
  status: Status;
  category?: Category; // H3: the category with the largest difference
};

// Targets compare raw values with a tiny tolerance, so float noise (0.7 − 0.55 = 0.1499…)
// never turns an exact hit into a miss.
const meets = (v: number | null, target: number) => v !== null && v >= target - 1e-9;

function status(enough: boolean, values: (number | null)[], meets: boolean): Status {
  if (!enough || values.some((v) => v === null)) return 'insufficient';
  return meets ? 'above' : 'below';
}

export type CategoryStat = {
  category: Category;
  satisfactionWith: Stat;
  satisfactionWithout: Stat;
  difference: number | null;
  talkedWith: Stat;
  talkedWithout: Stat;
  items: { code: string; satisfactionWith: Stat; satisfactionWithout: Stat; difference: number | null }[];
};

// Block 5 (H3): with vs without a shared item in each category, sorted by the difference.
export function byCategory(rows: ReviewRow[]): CategoryStat[] {
  return CATEGORIES.map((category) => {
    const withIt = rows.filter((r) => (r.shared_by_category[category] ?? 0) > 0);
    const without = rows.filter((r) => (r.shared_by_category[category] ?? 0) === 0);
    const satisfactionWith = mean(withIt, 'satisfaction_1_7');
    const satisfactionWithout = mean(without, 'satisfaction_1_7');
    return {
      category,
      satisfactionWith,
      satisfactionWithout,
      difference: difference(satisfactionWith, satisfactionWithout),
      talkedWith: rate(withIt, talked),
      talkedWithout: rate(without, talked),
      items: interestsByCategory(category).map(({ code }) => {
        const w = mean(rows.filter((r) => r.shared_items.includes(code)), 'satisfaction_1_7');
        const wo = mean(rows.filter((r) => !r.shared_items.includes(code)), 'satisfaction_1_7');
        return { code, satisfactionWith: w, satisfactionWithout: wo, difference: difference(w, wo) };
      }),
    };
  }).sort((a, b) => (b.difference ?? -Infinity) - (a.difference ?? -Infinity));
}

export function hypotheses(rows: ReviewRow[]): Hypothesis[] {
  const comp = byGroup(rows, 'compatible');
  const ctrl = byGroup(rows, 'control');

  const h0 = rate(rows, reachedOut);

  const talkedC = rate(comp, talked);
  const talkedK = rate(ctrl, talked);
  const satC = mean(comp, 'satisfaction_1_7');
  const satK = mean(ctrl, 'satisfaction_1_7');
  const talkedDiff = difference(talkedC, talkedK);
  const satDiff = difference(satC, satK);

  const pairs = rows.filter((r) => r.satisfaction_1_7 !== null);
  const rho = spearman(
    pairs.map((r) => r.shared_count),
    pairs.map((r) => r.satisfaction_1_7 as number),
  );

  // H3: only categories with enough reviews on both sides count; the value is the largest
  // (signed) difference among them.
  const eligible = byCategory(rows).filter(
    (c) => c.satisfactionWith.n >= MIN_N && c.satisfactionWithout.n >= MIN_N && c.difference !== null,
  );
  const best = eligible[0];

  const cgC = mean(comp, 'common_ground_1_7');
  const cgK = mean(ctrl, 'common_ground_1_7');
  const cgDiff = difference(cgC, cgK);

  return [
    {
      id: 'H0',
      values: [{ label: 'Contacto', value: h0.value, kind: 'pct' }],
      ns: [{ label: 'reviews', n: h0.n }],
      status: status(h0.n >= MIN_N, [h0.value], meets(h0.value, 0.4)),
    },
    {
      id: 'H1',
      values: [
        { label: 'Conversa (comp. − ctrl.)', value: talkedDiff, kind: 'pp' },
        { label: 'Satisfação (comp. − ctrl.)', value: satDiff, kind: 'points' },
      ],
      ns: [
        { label: 'reviews comp.', n: talkedC.n },
        { label: 'reviews ctrl.', n: talkedK.n },
        { label: 'satisfação comp.', n: satC.n },
        { label: 'satisfação ctrl.', n: satK.n },
      ],
      status: status(
        Math.min(talkedC.n, talkedK.n, satC.n, satK.n) >= MIN_N,
        [talkedDiff, satDiff],
        meets(talkedDiff, 0.15) && meets(satDiff, 1),
      ),
    },
    {
      id: 'H2',
      values: [{ label: 'ρ de Spearman', value: rho, kind: 'rho' }],
      ns: [{ label: 'reviews com satisfação', n: pairs.length }],
      status: status(pairs.length >= MIN_N, [rho], meets(rho, 0.3)),
    },
    {
      id: 'H3',
      category: best?.category,
      values: [{ label: 'Maior diferença (com − sem item)', value: best?.difference ?? null, kind: 'points' }],
      ns: best
        ? [
            { label: 'com item', n: best.satisfactionWith.n },
            { label: 'sem item', n: best.satisfactionWithout.n },
          ]
        : [],
      status: status(Boolean(best), [best?.difference ?? null], meets(best?.difference ?? null, 0.75)),
    },
    {
      id: 'H4',
      values: [{ label: 'Coisas em comum (comp. − ctrl.)', value: cgDiff, kind: 'points' }],
      ns: [
        { label: 'comp.', n: cgC.n },
        { label: 'ctrl.', n: cgK.n },
      ],
      status: status(Math.min(cgC.n, cgK.n) >= MIN_N, [cgDiff], meets(cgDiff, 1)),
    },
  ];
}

// --- Overview (block 2) ---

export type OverviewInput = {
  participants: { active: boolean; deleted: boolean }[];
  matches: { id: string; type: Group; created_at: string }[];
  reviews: { match_id: string }[];
  now: Date;
  delayDays: number;
  graceMs?: number; // same slack as reviewOpensAt()
};

// Response rate uses the same matches on both sides: reviews of matches whose review has
// opened, over two possible reviews per such match.
export function overview({ participants, matches, reviews, now, delayDays, graceMs = 0 }: OverviewInput) {
  const opensBefore = now.getTime() - delayDays * 24 * 60 * 60 * 1000 + graceMs;
  const open = new Set(matches.filter((m) => new Date(m.created_at).getTime() <= opensBefore).map((m) => m.id));
  const answered = reviews.filter((r) => open.has(r.match_id)).length;
  return {
    participants: participants.filter((p) => !p.deleted).length,
    activeParticipants: participants.filter((p) => p.active && !p.deleted).length,
    compatibleMatches: matches.filter((m) => m.type === 'compatible').length,
    controlMatches: matches.filter((m) => m.type === 'control').length,
    reviews: reviews.length,
    responseRate: { value: open.size ? answered / (2 * open.size) : null, n: 2 * open.size } as Stat,
  };
}

// --- Funnel (block 3) and mean scores (block 4) ---

export const FUNNEL_STAGES = [
  { key: 'match', label: 'Match', pred: () => true },
  { key: 'contact', label: 'Contacto', pred: reachedOut },
  { key: 'talked', label: 'Conversa', pred: talked },
  { key: 'next', label: 'Próximo passo', pred: (r: ReviewRow) => r.next_step },
  { key: 'met', label: 'Encontro (sim/combinado)', pred: met },
] as const;

export function funnel(rows: ReviewRow[]) {
  return FUNNEL_STAGES.map(({ key, label, pred }) => ({
    key,
    label,
    compatible: rate(byGroup(rows, 'compatible'), pred),
    control: rate(byGroup(rows, 'control'), pred),
  }));
}

export const SCORE_FIELDS: { field: ScoreField; label: string }[] = [
  { field: 'interest_1_7', label: 'Interesse' },
  { field: 'comfort_1_7', label: 'Conforto' },
  { field: 'flow_1_7', label: 'Fluidez' },
  { field: 'common_ground_1_7', label: 'Coisas em comum' },
  { field: 'satisfaction_1_7', label: 'Satisfação' },
  { field: 'meet_again_1_7', label: 'Vontade de repetir' },
];

export function scores(rows: ReviewRow[]) {
  return SCORE_FIELDS.map(({ field, label }) => ({
    field,
    label,
    compatible: mean(byGroup(rows, 'compatible'), field),
    control: mean(byGroup(rows, 'control'), field),
  }));
}

// --- Segments (block 6) ---

export const SEGMENTS = [
  { key: 'age_range', label: 'Idade' },
  { key: 'time_in_city', label: 'Tempo na cidade' },
  { key: 'origin', label: 'Origem' },
  { key: 'city', label: 'Cidade' },
  { key: 'lang', label: 'Idioma' },
] as const;

export type SegmentKey = (typeof SEGMENTS)[number]['key'];

export function segment(rows: ReviewRow[], key: SegmentKey) {
  const groups = new Map<string, ReviewRow[]>();
  for (const r of rows) {
    const value = key === 'city' ? r.city.trim().toLowerCase() : r[key];
    groups.set(value, [...(groups.get(value) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([value, rs]) => ({
      value,
      n: rs.length,
      contact: rate(rs, reachedOut),
      talked: rate(rs, talked),
      satisfaction: mean(rs, 'satisfaction_1_7'),
    }))
    .sort((a, b) => b.n - a.n || a.value.localeCompare(b.value));
}

// --- Dose-response (block 7) ---

export const DOSE_BUCKETS = ['0', '1', '2', '3', '4+'] as const;

export function doseResponse(rows: ReviewRow[]) {
  return DOSE_BUCKETS.map((bucket, i) => ({
    bucket,
    satisfaction: mean(
      rows.filter((r) => (i === 4 ? r.shared_count >= 4 : r.shared_count === i)),
      'satisfaction_1_7',
    ),
  }));
}

// --- Block 8: reasons, most picked items, "other" answers ---

export const WHY_NOT = ['no_time', 'not_interested', 'no_reply', 'shy', 'other'] as const;

export function whyNot(rows: ReviewRow[]) {
  return WHY_NOT.map((reason) => ({
    reason,
    compatible: rate(byGroup(rows, 'compatible').filter((r) => !r.contacted), (r) => r.why_not === reason),
    control: rate(byGroup(rows, 'control').filter((r) => !r.contacted), (r) => r.why_not === reason),
  }));
}

export function topItems(participants: { interests: string[] }[], limit = 15) {
  const counts = new Map(INTERESTS.map((i) => [i.code, 0]));
  for (const p of participants) for (const code of p.interests) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count, share: participants.length ? count / participants.length : 0 }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, limit);
}

export function otherAnswers(participants: { other_text: Partial<Record<string, string>> }[]) {
  return participants.flatMap((p) =>
    Object.entries(p.other_text)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([category, text]) => ({ category, text })),
  );
}

// --- Contact button taps (attempts to start a conversation) ---

// Taps are recorded since 21/10; the data was restarted on 22/10, so every match counts
// (including matches moved back by "Abrir avaliação agora").
export const CONTACT_TRACKING_SINCE = '2026-01-01T00:00:00Z';

export type ContactClickInput = {
  matches: { id: string; type: Group; a_id: string; b_id: string; created_at: string }[];
  deleted: Set<string>; // anonymised participant ids
  seed?: Set<string>; // seed (fake) participant ids: their matches count even if older than the tracking
  instagram?: Set<string>; // ids of people with Instagram (the button only shows for them); default: all
  clicks: { match_id: string; participant_id: string; channel: string; created_at: string }[];
  reviews: {
    match_id: string;
    reviewer_id: string;
    created_at: string;
    contacted: boolean;
    talked: boolean | null;
    who_first: string | null;
    why_not: string | null;
  }[];
  since?: string;
};

// Unit: one side of a match (a person in a match). Sides of matches created before the
// tracking started, or with an anonymised person (no buttons shown), are left out. In the
// comparison with the review, only taps made before the review count.
export function contactClicks({ matches, deleted, seed = new Set(), instagram, clicks, reviews, since = CONTACT_TRACKING_SINCE }: ContactClickInput) {
  const sinceMs = new Date(since).getTime();
  const tracked = (m: { a_id: string; b_id: string; created_at: string }) =>
    new Date(m.created_at).getTime() >= sinceMs || (seed.has(m.a_id) && seed.has(m.b_id));
  const sides = matches
    .filter((m) => tracked(m) && !deleted.has(m.a_id) && !deleted.has(m.b_id))
    .flatMap((m) => [
      { match: m.id, person: m.a_id, other: m.b_id, type: m.type },
      { match: m.id, person: m.b_id, other: m.a_id, type: m.type },
    ]);

  const tapsOf = (match: string, person: string) => clicks.filter((c) => c.match_id === match && c.participant_id === person);
  const reviewOf = new Map(reviews.map((r) => [`${r.match_id}|${r.reviewer_id}`, r]));

  const summarize = (group: Group | 'all') => {
    const own = sides.filter((s) => group === 'all' || s.type === group);
    const enriched = own.map((s) => {
      const taps = tapsOf(s.match, s.person);
      const review = reviewOf.get(`${s.match}|${s.person}`);
      const tappedBefore = review ? taps.some((t) => new Date(t.created_at) <= new Date(review.created_at)) : false;
      return { taps, review, tappedBefore, otherHasInstagram: !instagram || instagram.has(s.other) };
    });
    const reviewed = enriched.filter((e) => e.review);
    const tappedAndReviewed = reviewed.filter((e) => e.tappedBefore);
    const tappedNotContacted = reviewed.filter((e) => e.tappedBefore && !e.review!.contacted);
    return {
      sides: own.length,
      clicked: rate(enriched, (e) => e.taps.length > 0),
      whatsapp: rate(enriched, (e) => e.taps.some((t) => t.channel === 'whatsapp')),
      // Only sides where the other person has Instagram (no button otherwise).
      instagram: rate(
        enriched.filter((e) => e.otherHasInstagram),
        (e) => e.taps.some((t) => t.channel === 'instagram'),
      ),
      reviewed: reviewed.length,
      clickedContacted: rate(reviewed, (e) => e.tappedBefore && e.review!.contacted),
      clickedNotContacted: rate(reviewed, (e) => e.tappedBefore && !e.review!.contacted),
      notClickedContactedMe: rate(reviewed, (e) => !e.tappedBefore && e.review!.contacted && e.review!.who_first === 'me'),
      notClickedContactedThem: rate(reviewed, (e) => !e.tappedBefore && e.review!.contacted && e.review!.who_first === 'them'),
      neither: rate(reviewed, (e) => !e.tappedBefore && !e.review!.contacted),
      barrierReasons: WHY_NOT.map((reason) => ({
        reason,
        share: rate(tappedNotContacted, (e) => e.review!.why_not === reason),
      })),
      clickedThenTalked: rate(tappedAndReviewed, (e) => e.review!.talked === true),
    };
  };

  return { all: summarize('all'), compatible: summarize('compatible'), control: summarize('control') };
}

// --- "Do you follow each other on Instagram?" (asked only when both have Instagram) ---

export const IG_FOLLOW_OPTIONS = ['me', 'them', 'both', 'none'] as const;

export function igFollow(rows: ReviewRow[]) {
  return IG_FOLLOW_OPTIONS.map((option) => ({
    option,
    compatible: rate(byGroup(rows, 'compatible').filter((r) => r.ig_follow), (r) => r.ig_follow === option),
    control: rate(byGroup(rows, 'control').filter((r) => r.ig_follow), (r) => r.ig_follow === option),
  }));
}

// --- Admin data filter: real people, seed (fake) data, or everything ---

export type DataMode = 'reais' | 'seed' | 'tudo';

export function dataMode(value: string | undefined): DataMode {
  return value === 'seed' || value === 'tudo' ? value : 'reais';
}

// Matches keep both sides in the chosen set; reviews, taps and alerts follow their person.
export function filterAdminData<
  P extends { id: string; is_seed: boolean },
  M extends { a_id: string; b_id: string },
  R extends { reviewer_id: string },
  F extends { participant_id: string },
  C extends { participant_id: string },
>(data: { participants: P[]; matches: M[]; reviews: R[]; flags: F[]; clicks: C[] }, mode: DataMode) {
  if (mode === 'tudo') return data;
  const keep = new Set(data.participants.filter((p) => p.is_seed === (mode === 'seed')).map((p) => p.id));
  return {
    participants: data.participants.filter((p) => keep.has(p.id)),
    matches: data.matches.filter((m) => keep.has(m.a_id) && keep.has(m.b_id)),
    reviews: data.reviews.filter((r) => keep.has(r.reviewer_id)),
    flags: data.flags.filter((f) => keep.has(f.participant_id)),
    clicks: data.clicks.filter((c) => keep.has(c.participant_id)),
  };
}

// --- Participants tab: each person's matches, with both sides' reviews and taps ---

export function participantMatches<
  M extends { id: string; a_id: string; b_id: string; created_at: string },
  R extends { match_id: string; reviewer_id: string },
  C extends { match_id: string; participant_id: string; channel: string },
>({ matches, reviews, clicks }: { matches: M[]; reviews: R[]; clicks: C[] }) {
  const reviewOf = new Map(reviews.map((r) => [`${r.match_id}|${r.reviewer_id}`, r]));
  const tapsOf = new Map<string, string[]>();
  for (const c of clicks) {
    const key = `${c.match_id}|${c.participant_id}`;
    if (!tapsOf.get(key)?.includes(c.channel)) tapsOf.set(key, [...(tapsOf.get(key) ?? []), c.channel]);
  }
  const byPerson = new Map<string, { match: M; other: string; mine: R | null; theirs: R | null; myTaps: string[]; theirTaps: string[] }[]>();
  for (const match of [...matches].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    for (const [me, other] of [
      [match.a_id, match.b_id],
      [match.b_id, match.a_id],
    ]) {
      byPerson.set(me, [
        ...(byPerson.get(me) ?? []),
        {
          match,
          other,
          mine: reviewOf.get(`${match.id}|${me}`) ?? null,
          theirs: reviewOf.get(`${match.id}|${other}`) ?? null,
          myTaps: tapsOf.get(`${match.id}|${me}`) ?? [],
          theirTaps: tapsOf.get(`${match.id}|${other}`) ?? [],
        },
      ]);
    }
  }
  return byPerson;
}

// --- Sample overview (block 1): who the participants are and what their matches share ---

export const SAMPLE_FIELDS = [
  { key: 'age_range', label: 'Faixa etária' },
  { key: 'time_in_city', label: 'Tempo na cidade' },
  { key: 'origin', label: 'Origem' },
  { key: 'city', label: 'Cidade' },
  { key: 'lang', label: 'Idioma' },
] as const;
export type SampleField = (typeof SAMPLE_FIELDS)[number]['key'];

type SamplePerson = { id: string; deleted_at: string | null; active: boolean } & Record<SampleField, string> & {
    interests: string[];
  };
type SampleMatch = { a_id: string; b_id: string; type: Group; shared_count: number; shared_by_category: Partial<Record<string, number>> };

const cityKey = (city: string) => city.trim().toLowerCase(); // same as segment()
const share = (count: number, total: number): Stat => ({ value: total ? count / total : null, n: total });

// Base: people not anonymised (seed included) and the matches between two of them.
export function sample({ participants, matches, categories, cityTop = 6 }: {
  participants: SamplePerson[];
  matches: SampleMatch[];
  categories: readonly string[];
  cityTop?: number;
}) {
  const people = participants.filter((p) => !p.deleted_at);
  const ids = new Set(people.map((p) => p.id));
  const own = matches.filter((m) => ids.has(m.a_id) && ids.has(m.b_id));
  const byId = new Map(people.map((p) => [p.id, p]));

  const count = new Map<string, number>();
  for (const m of own) for (const id of [m.a_id, m.b_id]) count.set(id, (count.get(id) ?? 0) + 1);
  const perPerson = ['0', '1', '2', '3', '4+'].map((bucket, i) => ({
    bucket,
    share: share(people.filter((p) => (i === 4 ? (count.get(p.id) ?? 0) >= 4 : (count.get(p.id) ?? 0) === i)).length, people.length),
  }));

  const composition = SAMPLE_FIELDS.map(({ key, label }) => {
    const tally = new Map<string, number>();
    for (const p of people) {
      const value = key === 'city' ? cityKey(p.city) : p[key];
      tally.set(value, (tally.get(value) ?? 0) + 1);
    }
    let values = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (key === 'city' && values.length > cityTop + 1) {
      const rest = values.slice(cityTop).reduce((sum, [, n]) => sum + n, 0);
      values = [...values.slice(0, cityTop), ['__other', rest]];
    }
    return { key, label, values: values.map(([value, n]) => ({ value, share: share(n, people.length) })) };
  });

  const groups = { compatible: own.filter((m) => m.type === 'compatible'), control: own.filter((m) => m.type === 'control') };
  const perGroup = (pred: (m: SampleMatch) => boolean) => ({
    compatible: share(groups.compatible.filter(pred).length, groups.compatible.length),
    control: share(groups.control.filter(pred).length, groups.control.length),
  });
  const avg = (ms: SampleMatch[]): Stat => ({
    value: ms.length ? ms.reduce((s, m) => s + m.shared_count, 0) / ms.length : null,
    n: ms.length,
  });

  return {
    people: people.length,
    active: people.filter((p) => p.active).length,
    matches: own.length,
    compatible: groups.compatible.length,
    control: groups.control.length,
    perPersonMean: people.length ? (2 * own.length) / people.length : null,
    perPerson,
    interestsMean: people.length ? people.reduce((s, p) => s + p.interests.length, 0) / people.length : null,
    composition,
    sharedMean: { compatible: avg(groups.compatible), control: avg(groups.control) },
    sharedByCategory: categories.map((category) => ({
      category,
      ...perGroup((m) => (m.shared_by_category[category] ?? 0) > 0),
    })),
    sameProfile: SAMPLE_FIELDS.map(({ key, label }) => ({
      key,
      label,
      ...perGroup((m) => {
        const a = byId.get(m.a_id)!;
        const b = byId.get(m.b_id)!;
        return key === 'city' ? cityKey(a.city) === cityKey(b.city) : a[key] === b[key];
      }),
    })),
  };
}

// --- The idea itself: does the person like it, and is it better for friendship or dating ---

export const BEST_FOR_OPTIONS = ['friendship', 'dating', 'both'] as const;

export function conceptOpinion(rows: ReviewRow[]) {
  const answered = (g: Group | 'all') => byGroup(rows, g).filter((r) => r.likes_concept != null);
  const col = (g: Group | 'all') => ({
    likes: rate(answered(g), (r) => r.likes_concept === true),
    bestFor: BEST_FOR_OPTIONS.map((option) => ({ option, share: rate(answered(g), (r) => r.best_for === option) })),
  });
  return { all: col('all'), compatible: col('compatible'), control: col('control') };
}

// --- In-person party: would people come? One answer per person (their latest review) ---

export const PARTY_OPTIONS = ['yes', 'maybe', 'no'] as const;

export function partyInterest(reviews: { reviewer_id: string; party_interest?: string | null; created_at: string }[]) {
  const latest = new Map<string, { answer: string; at: string }>();
  for (const r of reviews) {
    if (!r.party_interest) continue;
    const current = latest.get(r.reviewer_id);
    if (!current || r.created_at > current.at) latest.set(r.reviewer_id, { answer: r.party_interest, at: r.created_at });
  }
  const counts = Object.fromEntries(PARTY_OPTIONS.map((o) => [o, 0])) as Record<(typeof PARTY_OPTIONS)[number], number>;
  for (const { answer } of latest.values()) if (answer in counts) counts[answer as keyof typeof counts]++;
  const interested = [...latest]
    .filter(([, v]) => v.answer === 'yes' || v.answer === 'maybe')
    .map(([id, v]) => ({ id, answer: v.answer as 'yes' | 'maybe' }));
  return { people: latest.size, counts, interested };
}

// --- Review progress: expected vs received, and where people stop (request → tap → form → review) ---

export type ProgressInput = {
  matches: { id: string; a_id: string; b_id: string; type: Group; created_at: string }[];
  people: Set<string>; // participants counted (filtered by the panel; anonymised people left out)
  requests: { match_id: string; participant_id: string; requested_at: string; reminded_at: string | null }[];
  reviews: { match_id: string; reviewer_id: string; created_at: string }[];
  clicks: { match_id: string; participant_id: string; source: string }[];
  views: { match_id: string; participant_id: string }[];
  now: Date;
  delayDays: number;
  graceMs: number;
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function reviewProgress(input: ProgressInput) {
  const key = (m: string, p: string) => `${m}|${p}`;
  const cutoff = input.now.getTime() - input.delayDays * 86_400_000 + input.graceMs;
  const sides = input.matches.flatMap((m) =>
    [m.a_id, m.b_id].filter((p) => input.people.has(p)).map((p) => ({ key: key(m.id, p), type: m.type, due: new Date(m.created_at).getTime() <= cutoff })),
  );
  const known = new Set(sides.map((s) => s.key));
  const inSides = <T>(rows: T[], k: (r: T) => string) => rows.filter((r) => known.has(k(r)));
  const requests = inSides(input.requests, (r) => key(r.match_id, r.participant_id));
  const reviews = inSides(input.reviews, (r) => key(r.match_id, r.reviewer_id));
  const reviewed = new Map(reviews.map((r) => [key(r.match_id, r.reviewer_id), r.created_at]));
  const clicks = inSides(input.clicks, (r) => key(r.match_id, r.participant_id));
  const viewed = new Set(inSides(input.views, (r) => key(r.match_id, r.participant_id)).map((r) => key(r.match_id, r.participant_id)));
  const clickedBy = (source: string) => new Set(clicks.filter((c) => c.source === source).map((c) => key(c.match_id, c.participant_id))).size;

  const due = sides.filter((s) => s.due);
  const group = (g: Group) => {
    const d = due.filter((s) => s.type === g);
    return { due: d.length, reviewed: d.filter((s) => reviewed.has(s.key)).length };
  };
  const reminded = requests.filter((r) => r.reminded_at);
  const hours = requests.flatMap((r) => {
    const at = reviewed.get(key(r.match_id, r.participant_id));
    return at ? [(new Date(at).getTime() - new Date(r.requested_at).getTime()) / 3_600_000] : [];
  });

  return {
    sides: sides.length,
    notDue: sides.length - due.length,
    due: due.length,
    requested: requests.length,
    reminded: reminded.length,
    clickedOpen: clickedBy('open'),
    clickedReminder: clickedBy('reminder'),
    viewed: viewed.size,
    reviewed: reviewed.size,
    reviewedAfterReminder: reminded.filter((r) => {
      const at = reviewed.get(key(r.match_id, r.participant_id));
      return at && new Date(at).getTime() > new Date(r.reminded_at!).getTime();
    }).length,
    waitingAfterRequest: requests.filter((r) => !r.reminded_at && !reviewed.has(key(r.match_id, r.participant_id))).length,
    waitingAfterReminder: reminded.filter((r) => !reviewed.has(key(r.match_id, r.participant_id))).length,
    medianHours: median(hours),
    compatible: group('compatible'),
    control: group('control'),
  };
}

// --- Personality (introvert / extrovert / both): one answer per person, their latest review ---

export const PERSONALITY_OPTIONS = ['introvert', 'extrovert', 'both'] as const;

export function personalityShares(reviews: { reviewer_id: string; personality?: string | null; created_at: string }[]) {
  const latest = new Map<string, { answer: string; at: string }>();
  for (const r of reviews) {
    if (!r.personality) continue;
    const current = latest.get(r.reviewer_id);
    if (!current || r.created_at > current.at) latest.set(r.reviewer_id, { answer: r.personality, at: r.created_at });
  }
  const people = latest.size;
  return {
    people,
    options: PERSONALITY_OPTIONS.map((option) => {
      const count = [...latest.values()].filter((v) => v.answer === option).length;
      return { option, count, share: people ? count / people : null };
    }),
  };
}
