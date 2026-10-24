import { describe, expect, it } from 'vitest';
import { analysisType, planMatches, score, shared, sharedByCategory, type Candidate, type MatchingConfig } from '@/lib/matching';

const CONFIG: MatchingConfig = { maxCompatible: 3, maxControl: 1, minSharedCompatible: 2 };

// Deterministic pseudo-random generator for reproducible tests.
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

let n = 0;
function person(interests: string[], patch: Partial<Candidate> = {}): Candidate {
  n++;
  return {
    id: `p${String(n).padStart(3, '0')}`,
    interests,
    active: true,
    createdAt: `2026-10-${String(n).padStart(2, '0')}T00:00:00Z`,
    compatibleCount: 0,
    controlCount: 0,
    matchedIds: new Set(),
    ...patch,
  };
}

const ROCK = ['music_rock', 'music_pop', 'music_indie', 'fit_gym', 'food_wine', 'act_beach'];
const ROCK_LIKE = ['music_rock', 'music_pop', 'music_jazz', 'sports_surf', 'food_brunch', 'hob_reading'];
const OPPOSITE = ['music_fado', 'music_kpop', 'music_metal', 'sports_padel', 'food_indian', 'hob_videogames'];

describe('analysisType', () => {
  it('is compatible from the threshold on, control below', () => {
    expect([0, 7, 8, 17].map((n) => analysisType(n, 8))).toEqual(['control', 'control', 'compatible', 'compatible']);
  });
});

describe('score and shared', () => {
  it('computes Jaccard over all items', () => {
    // shared: rock, pop → 2; union: 6 + 6 - 2 = 10
    expect(score(ROCK, ROCK_LIKE)).toBeCloseTo(0.2);
    expect(score(ROCK, ROCK)).toBe(1);
    expect(score(ROCK, OPPOSITE)).toBe(0);
    expect(score([], [])).toBe(0);
  });

  it('lists shared items in catalog order and counts them by category', () => {
    expect(shared(['music_pop', 'music_rock', 'food_wine'], ['food_wine', 'music_rock', 'music_pop'])).toEqual([
      'music_rock',
      'music_pop',
      'food_wine',
    ]);
    expect(sharedByCategory(ROCK, ROCK_LIKE)).toEqual({ music: 2, sports: 0, fitness: 0, movies: 0, animals: 0, food: 0, activities: 0, hobbies: 0 });
  });
});

describe('planMatches', () => {
  it('fills compatible slots with the highest score and the control slot with 0 shared', () => {
    const me = person(ROCK);
    const best = person(ROCK);
    const good = person(ROCK_LIKE);
    const opposite = person(OPPOSITE);
    const proposals = planMatches(me, [me, best, good, opposite], CONFIG, seeded());

    const compatible = proposals.filter((p) => p.type === 'compatible');
    const control = proposals.filter((p) => p.type === 'control');
    expect(compatible.map((p) => [p.aId, p.bId].find((id) => id !== me.id))).toEqual(
      expect.arrayContaining([best.id, good.id]),
    );
    expect(control).toHaveLength(1);
    expect([control[0].aId, control[0].bId]).toContain(opposite.id);
    expect(control[0].sharedCount).toBe(0);
  });

  it('requires the minimum shared items for a compatible match', () => {
    const me = person(ROCK);
    const one = person(['music_rock', 'music_fado', 'music_kpop', 'sports_padel', 'food_indian', 'hob_videogames']);
    const proposals = planMatches(me, [me, one], CONFIG, seeded());
    expect(proposals.every((p) => p.type === 'control')).toBe(true);
  });

  it('falls back to the lowest score for control when nobody has 0 shared, and stores the real count', () => {
    const me = person(ROCK);
    const close = person(ROCK);
    const far = person(['music_rock', 'music_fado', 'music_kpop', 'sports_padel', 'food_indian', 'hob_videogames']);
    const tight = { ...CONFIG, maxCompatible: 0 };
    const [proposal] = planMatches(me, [me, close, far], tight, seeded());
    expect(proposal.type).toBe('control');
    expect([proposal.aId, proposal.bId]).toContain(far.id);
    expect(proposal.sharedCount).toBe(1);
  });

  it('never picks a control at or above the compatible threshold: the slot stays open', () => {
    const me = person(ROCK);
    const close = person(ROCK_LIKE); // 2 shared = the threshold
    const tight = { ...CONFIG, maxCompatible: 0 };
    expect(planMatches(me, [me, close], tight, seeded())).toEqual([]);
    expect(me.controlCount).toBe(0);
  });

  it('leaves compatible slots open when nobody reaches the threshold', () => {
    const me = person(ROCK);
    const far = person(['music_rock', 'music_fado', 'music_kpop', 'sports_padel', 'food_indian', 'hob_videogames']);
    const proposals = planMatches(me, [me, far], CONFIG, seeded());
    expect(proposals.map((p) => p.type)).toEqual(['control']);
    expect(me.compatibleCount).toBe(0);
  });

  it('respects the per-type limits on both sides', () => {
    const me = person(ROCK);
    const full = person(ROCK, { compatibleCount: 3 });
    const others = Array.from({ length: 6 }, () => person(ROCK_LIKE));
    const opposites = Array.from({ length: 3 }, () => person(OPPOSITE));
    const proposals = planMatches(me, [me, full, ...others, ...opposites], CONFIG, seeded());

    expect(proposals.filter((p) => p.type === 'compatible')).toHaveLength(3);
    expect(proposals.filter((p) => p.type === 'control')).toHaveLength(1);
    expect(proposals.some((p) => p.aId === full.id || p.bId === full.id)).toBe(false);
    expect(me.compatibleCount).toBe(3);
    expect(me.controlCount).toBe(1);
  });

  it('never proposes duplicate pairs, also when run again', () => {
    const people = [person(ROCK), person(ROCK), person(ROCK_LIKE), person(OPPOSITE), person(ROCK_LIKE)];
    const pairs = new Set<string>();
    for (let round = 0; round < 3; round++) {
      for (const p of people) {
        for (const proposal of planMatches(p, people, CONFIG, seeded(round + 1))) {
          const key = `${proposal.aId}|${proposal.bId}`;
          expect(pairs.has(key)).toBe(false);
          expect(proposal.aId < proposal.bId).toBe(true);
          pairs.add(key);
        }
      }
    }
    for (const p of people) {
      expect(p.compatibleCount).toBeLessThanOrEqual(CONFIG.maxCompatible);
      expect(p.controlCount).toBeLessThanOrEqual(CONFIG.maxControl);
    }
  });

  it('never matches an inactive person, on either side', () => {
    const me = person(ROCK);
    const inactive = person(ROCK, { active: false });
    expect(planMatches(me, [me, inactive], CONFIG, seeded())).toEqual([]);
    expect(planMatches(inactive, [inactive, me], CONFIG, seeded())).toEqual([]);
  });

  it('breaks score ties by fewest matches, then oldest', () => {
    const one = { ...CONFIG, maxCompatible: 1, maxControl: 0 };
    const me = person(ROCK);
    const busyOld = person(ROCK, { compatibleCount: 2, createdAt: '2026-01-01T00:00:00Z' });
    const freeNew = person(ROCK, { createdAt: '2026-09-01T00:00:00Z' });
    const freeOld = person(ROCK, { createdAt: '2026-02-01T00:00:00Z' });
    const [proposal] = planMatches(me, [me, busyOld, freeNew, freeOld], one, seeded());
    expect([proposal.aId, proposal.bId]).toContain(freeOld.id);
  });

  it('shuffles the slots so control is not always last', () => {
    const firstTypes = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const me = person(ROCK);
      const pool = [me, person(ROCK), person(ROCK_LIKE), person(ROCK), person(OPPOSITE)];
      firstTypes.add(planMatches(me, pool, CONFIG, seeded(seed))[0].type);
    }
    expect(firstTypes).toEqual(new Set(['compatible', 'control']));
  });
});
