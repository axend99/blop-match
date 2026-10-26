import { CATEGORIES, INTERESTS, interestByCode, type Category } from '@/lib/interests';

// Pure matching logic (SPEC §5). Persistence lives in lib/matchingService.ts.

export type MatchType = 'compatible' | 'control';

export type MatchingConfig = {
  maxCompatible: number;
  maxControl: number;
  minSharedCompatible: number;
};

export type Candidate = {
  id: string;
  interests: string[];
  active: boolean;
  createdAt: string;
  age?: number | null; // tie-breaker: closer ages first
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

// The group a match counts in for the analysis: compatible when the pair shares at least
// `minSharedCompatible` interests, control otherwise. Applied to every match, so a match created
// under an older, lower threshold can count as control (the stored `type` is kept for the per-person
// limits and is shown alongside in the CSV).
export function analysisType(sharedCount: number, minSharedCompatible: number): MatchType {
  return sharedCount >= minSharedCompatible ? 'compatible' : 'control';
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

// Tie-breakers after similarity: closest age, then fewer matches, then the oldest profile.
function tieBreak(person: Candidate, a: Candidate, b: Candidate): number {
  const gap = ageGap(person, a) - ageGap(person, b);
  return Number.isNaN(gap) || gap === 0 ? byFewestThenOldest(a, b) : gap;
}

// Fewer matches first, then the oldest profile.
function byFewestThenOldest(a: Candidate, b: Candidate): number {
  const load = a.compatibleCount + a.controlCount - (b.compatibleCount + b.controlCount);
  return load !== 0 ? load : a.createdAt.localeCompare(b.createdAt);
}

// Proposes matches for `person` against `pool`. Counts and pairs are updated in memory
// (on `person` and the pool entries) so later slots in the same run respect the limits.
export function planMatches(
  person: Candidate,
  pool: Candidate[],
  config: MatchingConfig,
  rng: () => number = Math.random,
): Proposal[] {
  if (!person.active) return [];

  const slots: MatchType[] = [
    ...Array<MatchType>(Math.max(0, config.maxCompatible - person.compatibleCount)).fill('compatible'),
    ...Array<MatchType>(Math.max(0, config.maxControl - person.controlCount)).fill('control'),
  ];
  const proposals: Proposal[] = [];

  for (const type of shuffle(slots, rng)) {
    const candidates = pool
      .filter((c) => c.active && c.id !== person.id && !person.matchedIds.has(c.id) && hasSlot(c, type, config))
      .map((c) => ({ c, shared: shared(person.interests, c.interests), score: score(person.interests, c.interests) }));

    let chosen: (typeof candidates)[number] | undefined;
    if (type === 'compatible') {
      chosen = candidates
        .filter((x) => x.shared.length >= config.minSharedCompatible)
        .sort((x, y) => y.score - x.score || tieBreak(person, x.c, y.c))[0];
    } else {
      // Only pairs below the compatible threshold, so a control always counts as control. If
      // nobody qualifies, the slot stays open and the daily run tries again.
      const below = candidates.filter((x) => x.shared.length < config.minSharedCompatible);
      const none = below.filter((x) => x.shared.length === 0);
      chosen = none.length
        ? none[Math.floor(rng() * none.length)]
        : below.sort((x, y) => x.score - y.score || tieBreak(person, x.c, y.c))[0];
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
