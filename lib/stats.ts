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
};

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
      status: status(h0.n >= MIN_N, [h0.value], (h0.value ?? 0) >= 0.4),
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
        (talkedDiff ?? 0) >= 0.15 && (satDiff ?? 0) >= 1,
      ),
    },
    {
      id: 'H2',
      values: [{ label: 'ρ de Spearman', value: rho, kind: 'rho' }],
      ns: [{ label: 'reviews com satisfação', n: pairs.length }],
      status: status(pairs.length >= MIN_N, [rho], (rho ?? 0) >= 0.3),
    },
    {
      id: 'H3',
      values: [{ label: best ? `Maior diferença (${best.category})` : 'Maior diferença', value: best?.difference ?? null, kind: 'points' }],
      ns: best
        ? [
            { label: 'com item', n: best.satisfactionWith.n },
            { label: 'sem item', n: best.satisfactionWithout.n },
          ]
        : [],
      status: status(Boolean(best), [best?.difference ?? null], (best?.difference ?? 0) >= 0.75),
    },
    {
      id: 'H4',
      values: [{ label: 'Coisas em comum (comp. − ctrl.)', value: cgDiff, kind: 'points' }],
      ns: [
        { label: 'comp.', n: cgC.n },
        { label: 'ctrl.', n: cgK.n },
      ],
      status: status(Math.min(cgC.n, cgK.n) >= MIN_N, [cgDiff], (cgDiff ?? 0) >= 1),
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
};

// Response rate uses the same matches on both sides: reviews of matches whose review has
// opened, over two possible reviews per such match.
export function overview({ participants, matches, reviews, now, delayDays }: OverviewInput) {
  const opensBefore = now.getTime() - delayDays * 24 * 60 * 60 * 1000;
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
