import { describe, expect, it } from 'vitest';
import { ageClose, analysisGroup, analysisType, CATEGORY_WEIGHT, compatPoints, itemShares, matchScore, planMatches, rarityBonus, score, shared, sharedByCategory, TALK_TOPIC_BONUS, type Candidate, type MatchingConfig } from '@/lib/matching';

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

describe('compatibility points and analysisType', () => {
  it('adds one point when ages are at most 5 years apart (unknown age: none)', () => {
    expect([ageClose(25, 30), ageClose(25, 31), ageClose(25, null), ageClose(undefined, 25)]).toEqual([true, false, false, false]);
    expect(compatPoints(8, 22, 27)).toBe(9);
    expect(compatPoints(8, 22, 28)).toBe(8);
  });

  it('is compatible from the threshold on, control below', () => {
    expect([0, 8, 9, 17].map((n) => analysisType(n, 9))).toEqual(['control', 'control', 'compatible', 'compatible']);
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

  it('only matches people with the same language', () => {
    const me = person(ROCK, { lang: 'pt' });
    const english = person(ROCK, { lang: 'en' });
    const portuguese = person(ROCK_LIKE, { lang: 'pt' });
    const ids = planMatches(me, [me, english, portuguese], CONFIG, seeded()).flatMap((p) => [p.aId, p.bId]);
    expect(ids).toContain(portuguese.id);
    expect(ids).not.toContain(english.id);
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

  it('breaks similarity ties by closest age, then fewer matches, then the oldest profile', () => {
    const me = person(ROCK, { age: 25 });
    const old = person(ROCK, { age: 40 });
    const near = person(ROCK, { age: 27 });
    const unknown = person(ROCK, { age: null });
    const one = { ...CONFIG, maxCompatible: 1, maxControl: 0 };
    const [p] = planMatches(me, [me, old, near, unknown], one, seeded());
    expect([p.aId, p.bId]).toContain(near.id);

    const me2 = person(ROCK, { age: 25 });
    const busy = person(ROCK, { age: 26, compatibleCount: 1 });
    const free = person(ROCK, { age: 24 });
    const [q] = planMatches(me2, [me2, busy, free], one, seeded());
    expect([q.aId, q.bId]).toContain(free.id); // same gap (1 year): fewer matches wins
  });

  it('counts close ages as a point for compatible matches', () => {
    const one = { ...CONFIG, minSharedCompatible: 3, maxCompatible: 1, maxControl: 0 };
    const me = person(ROCK, { age: 25 });
    const close = person(ROCK_LIKE, { age: 28 }); // 2 shared + age = 3 points
    expect(planMatches(me, [me, close], one, seeded())).toHaveLength(1);
    const me2 = person(ROCK, { age: 25 });
    const far = person(ROCK_LIKE, { age: 40 }); // 2 shared, no age point
    expect(planMatches(me2, [me2, far], one, seeded())).toEqual([]);
  });

  it('ignores age when picking a control', () => {
    const ctl = { ...CONFIG, maxCompatible: 0, minSharedCompatible: 5 }; // both stay below the threshold
    const me = person(ROCK, { age: 25 });
    const near = person(['music_rock', 'music_fado', 'music_kpop', 'sports_padel', 'food_indian', 'hob_videogames'], { age: 25, createdAt: '2026-10-29T00:00:00Z' });
    const older = person(['music_rock', 'music_fado', 'music_kpop', 'sports_padel', 'food_indian', 'hob_videogames'], { age: 60, createdAt: '2026-10-01T00:00:00Z' });
    const [p] = planMatches(me, [me, near, older], ctl, seeded());
    expect([p.aId, p.bId]).toContain(older.id); // same similarity: oldest profile, not closest age
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

describe('matchScore', () => {
  const common = new Map([['act_travel', 0.8], ['music_rock', 0.5], ['animals_dogs', 0.1], ['food_italian', 0.6]]);

  it('weights each shared item by category and rarity', () => {
    expect(rarityBonus(0.1)).toBe(2);
    expect(rarityBonus(0.2)).toBe(1);
    expect(rarityBonus(0.5)).toBe(0);
    expect(matchScore({ interests: ['act_travel'] }, { interests: ['act_travel'] }, common)).toBe(CATEGORY_WEIGHT.activities);
    expect(matchScore({ interests: ['animals_dogs'] }, { interests: ['animals_dogs'] }, common)).toBe(CATEGORY_WEIGHT.animals * 3);
    // a rare personal taste beats two broad ones
    expect(matchScore({ interests: ['animals_dogs'] }, { interests: ['animals_dogs'] }, common)).toBeGreaterThan(
      matchScore({ interests: ['act_travel', 'food_italian'] }, { interests: ['act_travel', 'food_italian'] }, common),
    );
  });

  it('gives the conversation-topic bonus in each direction, bigger than any single item', () => {
    const a = { interests: ['music_rock', 'act_travel'], talkAboutCode: 'music_rock' };
    const b = { interests: ['music_rock'], talkAboutCode: 'animals_dogs' };
    expect(matchScore(a, b, common)).toBe(CATEGORY_WEIGHT.music + TALK_TOPIC_BONUS);
    expect(matchScore(a, { ...b, talkAboutCode: 'act_travel' }, common)).toBe(CATEGORY_WEIGHT.music + 2 * TALK_TOPIC_BONUS);
    expect(TALK_TOPIC_BONUS).toBeGreaterThan(Math.max(...Object.values(CATEGORY_WEIGHT)) * 3);
  });

  it('computes the share of people with each interest', () => {
    expect(itemShares([{ interests: ['a', 'b'] }, { interests: ['a'] }])).toEqual(new Map([['a', 1], ['b', 0.5]]));
  });
});

describe('planMatches with the v2 rules', () => {
  it('picks the candidate whose talk topic I share and never one outside the age gap', () => {
    const cfg = { ...CONFIG, maxControl: 0, maxCompatible: 1, minSharedCompatible: 2, maxAgeGap: 5 };
    const me = person(ROCK, { age: 22 });
    const plain = person(ROCK, { age: 23 });
    const topic = person([...ROCK_LIKE], { age: 24, talkAboutCode: 'music_rock' });
    const older = person(ROCK, { age: 35, talkAboutCode: 'music_rock' });
    const [p] = planMatches(me, [me, plain, topic, older], cfg, seeded());
    expect([p.aId, p.bId]).toContain(topic.id);
    const onlyOlder = planMatches(person(ROCK, { age: 22 }), [older], cfg, seeded());
    expect(onlyOlder).toHaveLength(0);
  });
});

describe('v2: the match score decides compatibility', () => {
  it('only offers a compatible match from MIN_SCORE_COMPATIBLE on, and controls below it', () => {
    const cfg = { maxCompatible: 1, maxControl: 1, minSharedCompatible: 2, minScoreCompatible: 14 };
    const shares = new Map<string, number>(); // unknown = common: 1 point × category weight per item
    const me = person(ROCK, { talkAboutCode: 'music_rock' });
    const sameButNoTopic = person(ROCK); // 6 shared, score 1.5+1.5+1.5+1.25+1+0.5 = 7.25 + 6 (my topic) = 13.25
    const proposals = planMatches(me, [me, sameButNoTopic], cfg, seeded(), shares);
    expect(proposals.map((p) => p.type)).toEqual(['control']);
    const withTopic = person(ROCK, { talkAboutCode: 'fit_gym' }); // + 6 more = 19.25
    const next = planMatches(person(ROCK, { talkAboutCode: 'music_rock' }), [withTopic], cfg, seeded(), shares);
    expect(next.map((p) => p.type)).toContain('compatible');
  });

  it('groups v2 matches by score and v1 matches by points', () => {
    const cfg = { minSharedCompatible: 9, minScoreCompatible: 14 };
    const end = '2026-11-03T09:00:00Z';
    expect(analysisGroup({ created_at: '2026-11-18T10:00:00+00:00', score: 15, shared_count: 3 }, [20, 21], cfg, end)).toBe('compatible');
    expect(analysisGroup({ created_at: '2026-11-18T10:00:00+00:00', score: 13.9, shared_count: 12 }, [20, 21], cfg, end)).toBe('control');
    expect(analysisGroup({ created_at: '2026-10-20T10:00:00+00:00', score: 0.3, shared_count: 8 }, [20, 21], cfg, end)).toBe('compatible');
    expect(analysisGroup({ created_at: '2026-10-20T10:00:00+00:00', score: 0.3, shared_count: 7 }, [20, 40], cfg, end)).toBe('control');
  });
});

describe('invites', () => {
  it('never matches a person with the friend who invited them', () => {
    const cfg = { maxCompatible: 3, maxControl: 1, minSharedCompatible: 2 };
    const me = person(ROCK);
    const friend = person(ROCK, { invitedBy: me.id });
    const stranger = person(ROCK_LIKE);
    const ids = planMatches(me, [me, friend, stranger], cfg, seeded()).flatMap((p) => [p.aId, p.bId]);
    expect(ids).not.toContain(friend.id);
    expect(ids).toContain(stranger.id);
    const back = planMatches(friend, [friend, me], cfg, seeded()).flatMap((p) => [p.aId, p.bId]);
    expect(back).not.toContain(me.id);
  });
});
