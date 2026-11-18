import { CATEGORIES, INTERESTS, interestByCode, type Category } from '@/lib/interests';

// Pure matching logic (SPEC §5). Persistence lives in lib/matchingService.ts.

export type MatchType = 'compatible' | 'control';

export type MatchingConfig = {
  maxCompatible: number;
  maxControl: number;
  minSharedCompatible: number; // v1 rule (analysis of matches created before v2)
  minScoreCompatible?: number; // v2 rule: compatible from this matchScore on, control below
  maxAgeGap?: number; // v2: no match (compatible or control) between people further apart in age
};

export type Candidate = {
  id: string;
  interests: string[];
  active: boolean;
  createdAt: string;
  age?: number | null; // tie-breaker: closer ages first
  lang?: string; // only people with the same language are matched (password game clues, conversation)
  talkAboutCode?: string | null; // the interest they want to talk about (match score bonus)
  compatibleCount: number;
  controlCount: number;
  matchedIds: Set<string>;
};

export type Proposal = {
  aId: string;
  bId: string;
  type: MatchType;
  score: number;
  sharedItems: string[];
  sharedCount: number;
  sharedByCategory: Record<Category, number>;
};

const CATALOG_ORDER = new Map(INTERESTS.map((interest, i) => [interest.code, i]));

export function shared(a: string[], b: string[]): string[] {
  const other = new Set(b);
  return [...new Set(a)]
    .filter((code) => other.has(code))
    .sort((x, y) => (CATALOG_ORDER.get(x) ?? 0) - (CATALOG_ORDER.get(y) ?? 0));
}

export function score(a: string[], b: string[]): number {
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : shared(a, b).length / union;
}

export function sharedByCategory(a: string[], b: string[]): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const code of shared(a, b)) {
    const interest = interestByCode(code);
    if (interest) counts[interest.category]++;
  }
  return counts;
}

// --- Match score (v2): ranks compatible candidates. From the v1 reviews (exploratory, n = 34):
// how many interests two people share barely told apart the matches they found interesting
// (everyone picks ~22), but WHAT they shared did. Personal tastes (music, animals, fitness) went
// with interest and broad, popular items (travel, dinners) did not; rare items add more; and the
// strongest signal of all was the other person's conversation topic being one of my interests.

export const CATEGORY_WEIGHT: Record<Category, number> = {
  music: 1.5,
  animals: 1.5,
  fitness: 1.25,
  sports: 1,
  movies: 1,
  hobbies: 1,
  food: 1, // neutral: shared food went with lower first-glance interest but better conversations (v1)
  activities: 0.5,
};

// Extra points for a shared item few people have: +2 under 15% of people, +1 under 30%.
export function rarityBonus(shareOfPeople: number): number {
  return shareOfPeople < 0.15 ? 2 : shareOfPeople < 0.3 ? 1 : 0;
}

// Bigger than any single shared item can be (1.5 × (1 + 2) = 4.5), per direction.
export const TALK_TOPIC_BONUS = 6;

// Share of people who chose each interest.
export function itemShares(people: { interests: string[] }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of people) for (const code of new Set(p.interests)) counts.set(code, (counts.get(code) ?? 0) + 1);
  return new Map([...counts].map(([code, n]) => [code, people.length ? n / people.length : 0]));
}

type Scored = { interests: string[]; talkAboutCode?: string | null };

// Each shared item: category weight × (1 + rarity bonus); plus TALK_TOPIC_BONUS when one person's
// conversation topic is among the other's interests (each direction counts). Unknown items count
// as common.
export function matchScore(a: Scored, b: Scored, shares: Map<string, number>): number {
  let total = 0;
  for (const code of shared(a.interests, b.interests)) {
    const category = interestByCode(code)?.category;
    total += (category ? CATEGORY_WEIGHT[category] : 1) * (1 + rarityBonus(shares.get(code) ?? 1));
  }
  if (a.talkAboutCode && b.interests.includes(a.talkAboutCode)) total += TALK_TOPIC_BONUS;
  if (b.talkAboutCode && a.interests.includes(b.talkAboutCode)) total += TALK_TOPIC_BONUS;
  return Math.round(total * 100) / 100;
}

// Compatibility points: one per shared interest, plus one when the two ages are at most
// AGE_CLOSE_YEARS apart (unknown age: no point).
export const AGE_CLOSE_YEARS = 5;

export function ageClose(a: number | null | undefined, b: number | null | undefined): boolean {
  return a != null && b != null && Math.abs(a - b) <= AGE_CLOSE_YEARS;
}

export function compatPoints(sharedCount: number, ageA: number | null | undefined, ageB: number | null | undefined): number {
  return sharedCount + (ageClose(ageA, ageB) ? 1 : 0);
}

// The group a match counts in for the analysis. v2 matches (created after v1 ended): by the match
// score, the same one that picks them. v1 matches: by compatibility points (below).
export function analysisGroup(
  m: { created_at: string; score: number | null; shared_count: number },
  ages: [number | null | undefined, number | null | undefined],
  config: Pick<MatchingConfig, 'minSharedCompatible' | 'minScoreCompatible'>,
  v1EndsAt: string,
): MatchType {
  if (m.created_at >= v1EndsAt && config.minScoreCompatible != null) {
    return (m.score ?? 0) >= config.minScoreCompatible ? 'compatible' : 'control';
  }
  return analysisType(compatPoints(m.shared_count, ages[0], ages[1]), config.minSharedCompatible);
}

// v1 rule: compatible from `minSharedCompatible` points on,
// control below. Applied to every match, so a match created under an older rule can count in the
// other group (the stored `type` is kept for the per-person limits and is shown in the CSV).
export function analysisType(points: number, minSharedCompatible: number): MatchType {
  return points >= minSharedCompatible ? 'compatible' : 'control';
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hasSlot(c: Candidate, type: MatchType, config: MatchingConfig): boolean {
  return type === 'compatible' ? c.compatibleCount < config.maxCompatible : c.controlCount < config.maxControl;
}

// Age gap to `person`; unknown ages go last.
function ageGap(person: Candidate, c: Candidate): number {
  return person.age == null || c.age == null ? Infinity : Math.abs(person.age - c.age);
}

// Tie-breakers after similarity for compatible picks: closest age, then fewer matches, then the
// oldest profile.
function tieBreak(person: Candidate, a: Candidate, b: Candidate): number {
  const gap = ageGap(person, a) - ageGap(person, b);
  return Number.isNaN(gap) || gap === 0 ? byFewestThenOldest(a, b) : gap;
}

// v2: the match score decides (MIN_SCORE_COMPATIBLE); without it, the v1 points rule.
function isCompatible(x: { points: number; score: number }, config: MatchingConfig): boolean {
  return config.minScoreCompatible != null ? x.score >= config.minScoreCompatible : x.points >= config.minSharedCompatible;
}

// Fewer matches first, then the oldest profile.
function byFewestThenOldest(a: Candidate, b: Candidate): number {
  const load = a.compatibleCount + a.controlCount - (b.compatibleCount + b.controlCount);
  return load !== 0 ? load : a.createdAt.localeCompare(b.createdAt);
}

// Proposes matches for `person` against `pool`. Counts and pairs are updated in memory
// (on `person` and the pool entries) so later slots in the same run respect the limits.
// v2: matches only between people of the same language (the password clue counts letters, and the
// conversation needs a shared language). People without one set are not held back.
function sameLang(a: Candidate, b: Candidate): boolean {
  return !a.lang || !b.lang || a.lang === b.lang;
}

// v2: same rule for compatible and control, so the comparison between the groups stays fair.
// Unknown ages are not held back.
function ageOk(a: Candidate, b: Candidate, maxGap: number | undefined): boolean {
  return maxGap == null || a.age == null || b.age == null || Math.abs(a.age - b.age) <= maxGap;
}

// `shares`: share of people with each interest (rarity bonus); by default from the pool.
export function planMatches(
  person: Candidate,
  pool: Candidate[],
  config: MatchingConfig,
  rng: () => number = Math.random,
  shares: Map<string, number> = itemShares(pool),
): Proposal[] {
  if (!person.active) return [];

  const slots: MatchType[] = [
    ...Array<MatchType>(Math.max(0, config.maxCompatible - person.compatibleCount)).fill('compatible'),
    ...Array<MatchType>(Math.max(0, config.maxControl - person.controlCount)).fill('control'),
  ];
  const proposals: Proposal[] = [];

  for (const type of shuffle(slots, rng)) {
    const candidates = pool
      .filter((c) => c.active && c.id !== person.id && !person.matchedIds.has(c.id) && hasSlot(c, type, config) && sameLang(person, c) && ageOk(person, c, config.maxAgeGap))
      .map((c) => {
        const common = shared(person.interests, c.interests);
        return { c, shared: common, points: compatPoints(common.length, person.age, c.age), score: matchScore(person, c, shares) };
      });

    let chosen: (typeof candidates)[number] | undefined;
    if (type === 'compatible') {
      chosen = candidates
        .filter((x) => isCompatible(x, config))
        .sort((x, y) => y.score - x.score || tieBreak(person, x.c, y.c))[0];
    } else {
      // Only pairs below the compatible threshold, so a control always counts as control. If
      // nobody qualifies, the slot stays open and the daily run tries again.
      // Age plays no part in picking a control: it measures the absence of compatibility.
      const below = candidates.filter((x) => !isCompatible(x, config));
      const none = below.filter((x) => x.shared.length === 0);
      chosen = none.length
        ? none[Math.floor(rng() * none.length)]
        : below.sort((x, y) => x.score - y.score || byFewestThenOldest(x.c, y.c))[0];
    }
    if (!chosen) continue; // no suitable person yet: the slot stays open for a later run

    const other = chosen.c;
    const [aId, bId] = person.id < other.id ? [person.id, other.id] : [other.id, person.id];
    proposals.push({
      aId,
      bId,
      type,
      score: chosen.score,
      sharedItems: chosen.shared,
      sharedCount: chosen.shared.length,
      sharedByCategory: sharedByCategory(person.interests, other.interests),
    });

    for (const c of [person, other]) {
      if (type === 'compatible') c.compatibleCount++;
      else c.controlCount++;
    }
    person.matchedIds.add(other.id);
    other.matchedIds.add(person.id);
  }

  return proposals;
}
