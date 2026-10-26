import { describe, expect, it } from 'vitest';
import {
  partyInterest,
  personalityShares,
  reviewProgress,
  byCategory,
  conceptOpinion,
  contactClicks,
  dataMode,
  doseResponse,
  filterAdminData,
  funnel,
  hypotheses,
  igFollow,
  mean,
  otherAnswers,
  overview,
  participantMatches,
  rate,
  sample,
  scores,
  segment,
  spearman,
  topItems,
  whyNot,
  type ReviewRow,
} from '@/lib/stats';

let id = 0;
function row(patch: Partial<ReviewRow> = {}): ReviewRow {
  id++;
  return {
    match_id: `m${id}`,
    type: 'compatible',
    shared_count: 2,
    shared_by_category: { music: 2, sports: 0, food: 0, hobbies: 0 },
    shared_items: ['music_rock', 'music_pop'],
    age_range: '25-30',
    time_in_city: '2y+',
    origin: 'this_city',
    city: 'Lisbon',
    lang: 'en',
    contacted: true,
    interest_1_7: 5,
    comfort_1_7: 5,
    why_not: null,
    talked: true,
    flow_1_7: 5,
    common_ground_1_7: 5,
    satisfaction_1_7: 5,
    meet_again_1_7: 5,
    met: 'no',
    next_step: true,
    ...patch,
  };
}

const notContacted = (patch: Partial<ReviewRow> = {}) =>
  row({
    contacted: false,
    why_not: 'no_time',
    comfort_1_7: null,
    talked: null,
    flow_1_7: null,
    common_ground_1_7: null,
    satisfaction_1_7: null,
    meet_again_1_7: null,
    met: null,
    next_step: false,
    ...patch,
  });

const many = (n: number, make: () => ReviewRow) => Array.from({ length: n }, make);
const status = (rows: ReviewRow[], h: string) => hypotheses(rows).find((x) => x.id === h)!;

describe('rate and mean', () => {
  it('rate counts all rows; null talked counts as no', () => {
    expect(rate([row(), notContacted()], (r) => r.talked === true)).toEqual({ value: 0.5, n: 2 });
    expect(rate([], () => true)).toEqual({ value: null, n: 0 });
  });

  it('mean ignores unanswered values and reports n of answers', () => {
    expect(mean([row({ satisfaction_1_7: 6 }), row({ satisfaction_1_7: 3 }), notContacted()], 'satisfaction_1_7')).toEqual({
      value: 4.5,
      n: 2,
    });
  });
});

describe('spearman', () => {
  it('is 1 for a perfect monotonic relation and -1 for the inverse', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 100])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
  });

  it('uses average ranks for ties', () => {
    // x ranks: 1.5, 1.5, 3, 4; y ranks: 1, 2, 3, 4
    expect(spearman([0, 0, 1, 2], [1, 2, 3, 4])).toBeCloseTo(0.9487, 3);
  });

  it('is undefined with fewer than 3 pairs or no variance', () => {
    expect(spearman([1, 2], [1, 2])).toBeNull();
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe('hypotheses', () => {
  it('H0: insufficient below 15 reviews, then compares the raw rate with 40%', () => {
    expect(status(many(14, () => row()), 'H0').status).toBe('insufficient');
    // 6 of 15 = exactly 40% → above
    const rows = [...many(6, () => row()), ...many(9, () => notContacted())];
    expect(status(rows, 'H0').status).toBe('above');
    expect(status([...many(6, () => row()), ...many(10, () => notContacted())], 'H0').status).toBe('below');
  });

  it('H1 needs both conditions and enough reviews in each group', () => {
    const comp = many(15, () => row({ satisfaction_1_7: 6 }));
    const ctrlTalked = many(15, () => row({ type: 'control', satisfaction_1_7: 4 }));
    const ctrlNot = many(5, () => notContacted({ type: 'control' }));
    // talked: 100% vs 75% (+25 pp); satisfaction 6 vs 4 (+2) → above
    expect(status([...comp, ...ctrlTalked, ...ctrlNot], 'H1').status).toBe('above');
    // satisfaction difference below 1 → below, even with the talked gap
    const compLow = many(15, () => row({ satisfaction_1_7: 4.5 }));
    expect(status([...compLow, ...ctrlTalked, ...ctrlNot], 'H1').status).toBe('below');
    // control satisfaction answered by only 10 → insufficient
    expect(status([...comp, ...many(10, () => row({ type: 'control', satisfaction_1_7: 4 }))], 'H1').status).toBe(
      'insufficient',
    );
  });

  it('H1 counts an exact +15 pp and +1.0 as above despite float noise (14/20 vs 11/20, 5.3 vs 4.3)', () => {
    // 0.7 − 0.55 = 0.1499… and 5.3 − 4.3 = 0.9999… in floating point
    expect(0.7 - 0.55 < 0.15).toBe(true);
    const comp = [...many(14, () => row({ satisfaction_1_7: 5.3 })), ...many(6, () => row({ talked: false, satisfaction_1_7: 5.3 }))];
    const ctrl = [
      ...many(11, () => row({ type: 'control', satisfaction_1_7: 4.3 })),
      ...many(9, () => row({ type: 'control', talked: false, satisfaction_1_7: 4.3 })),
    ];
    expect(status([...comp, ...ctrl], 'H1').status).toBe('above');
  });

  it('H1 at exactly 15 pp (85 vs 100) is above', () => {
    const h = hypotheses([
      ...many(100, () => row({ satisfaction_1_7: 7 })),
      ...many(85, () => row({ type: 'control', satisfaction_1_7: 1 })),
      ...many(15, () => notContacted({ type: 'control' })),
    ]).find((x) => x.id === 'H1')!;
    expect(h.values[0].value).toBeCloseTo(0.15); // exactly 15 pp
    expect(h.status).toBe('above');
  });

  it('H2: Spearman between shared count and satisfaction, in its 3 states', () => {
    const up = many(15, () => row()).map((r, i) => ({ ...r, shared_count: i, satisfaction_1_7: 1 + Math.floor(i / 3) }));
    expect(status(up, 'H2').status).toBe('above');
    const down = up.map((r, i) => ({ ...r, satisfaction_1_7: 7 - Math.floor(i / 3) }));
    expect(status(down, 'H2').status).toBe('below');
    expect(status(up.slice(0, 14), 'H2').status).toBe('insufficient');
  });

  it('H3 takes the largest difference among categories with n ≥ 15 on both sides', () => {
    const withMusic = many(15, () => row({ satisfaction_1_7: 6 }));
    const withoutMusic = many(15, () =>
      row({ satisfaction_1_7: 5, shared_by_category: { music: 0, sports: 1 }, shared_items: ['sports_surf'] }),
    );
    const h = status([...withMusic, ...withoutMusic], 'H3');
    expect(h.category).toBe('music');
    expect(h.values[0].value).toBeCloseTo(1);
    expect(h.status).toBe('above');
    expect(status([...withMusic, ...withoutMusic.slice(0, 14)], 'H3').status).toBe('insufficient');
  });

  it('H4: common ground difference, in its 3 states (exact 1.0 counts)', () => {
    const comp = many(15, () => row({ common_ground_1_7: 5.3 }));
    expect(status([...comp, ...many(15, () => row({ type: 'control', common_ground_1_7: 4.3 }))], 'H4').status).toBe('above');
    expect(status([...comp, ...many(15, () => row({ type: 'control', common_ground_1_7: 4.5 }))], 'H4').status).toBe('below');
    expect(status([...comp, ...many(14, () => row({ type: 'control', common_ground_1_7: 4 }))], 'H4').status).toBe('insufficient');
  });

  it('H3 exposes the category separately (translated by the page)', () => {
    const rows = [
      ...many(15, () => row({ satisfaction_1_7: 5.75 })),
      ...many(15, () => row({ satisfaction_1_7: 5, shared_by_category: { sports: 1 }, shared_items: ['sports_surf'] })),
    ];
    const h = status(rows, 'H3');
    expect(h.category).toBe('music');
    expect(h.status).toBe('above'); // exactly +0.75
  });
});

describe('blocks', () => {
  it('overview: response rate only over matches whose review has opened', () => {
    const now = new Date('2026-10-25T09:00:00Z');
    const o = overview({
      participants: [
        { active: true, deleted: false },
        { active: false, deleted: false },
        { active: false, deleted: true },
      ],
      matches: [
        { id: 'a', type: 'compatible', created_at: '2026-10-20T00:00:00Z' },
        { id: 'b', type: 'control', created_at: '2026-10-24T00:00:00Z' },
      ],
      reviews: [{ match_id: 'a' }, { match_id: 'b' }],
      now,
      delayDays: 3,
    });
    expect(o).toMatchObject({ participants: 2, activeParticipants: 1, compatibleMatches: 1, controlMatches: 1, reviews: 2 });
    expect(o.responseRate).toEqual({ value: 0.5, n: 2 });
    // a match 2 days 23.5 h old counts as open with the 1 h grace
    const grace = overview({
      participants: [],
      matches: [{ id: 'c', type: 'compatible', created_at: '2026-10-22T09:30:00Z' }],
      reviews: [{ match_id: 'c' }],
      now,
      delayDays: 3,
      graceMs: 3_600_000,
    });
    expect(grace.responseRate).toEqual({ value: 0.5, n: 2 });
  });

  it('funnel: shares per group, base = reviews', () => {
    const f = funnel([row({ met: 'planned' }), notContacted(), row({ type: 'control' })]);
    expect(f.map((s) => s.label)).toEqual(['Match', 'Contacto', 'Conversa', 'Próximo passo', 'Encontro (sim/combinado)']);
    expect(f[1].compatible).toEqual({ value: 0.5, n: 2 });
    expect(f[4].compatible).toEqual({ value: 0.5, n: 2 });
    expect(f[4].control).toEqual({ value: 0, n: 1 });
  });

  it('scores per group', () => {
    const s = scores([row({ interest_1_7: 7 }), row({ type: 'control', interest_1_7: 3 })]);
    expect(s[0]).toMatchObject({ compatible: { value: 7, n: 1 }, control: { value: 3, n: 1 } });
  });

  it('byCategory: treats a missing key as 0 and sorts by difference', () => {
    const cats = byCategory([row({ satisfaction_1_7: 7 }), row({ satisfaction_1_7: 3, shared_by_category: {}, shared_items: [] })]);
    const music = cats.find((c) => c.category === 'music')!;
    expect(music.satisfactionWith).toEqual({ value: 7, n: 1 });
    expect(music.satisfactionWithout).toEqual({ value: 3, n: 1 });
    expect(cats[0].category).toBe('music');
    expect(music.items.find((i) => i.code === 'music_rock')?.difference).toBe(4);
  });

  it('segment groups by profile value (city ignores case)', () => {
    const s = segment([row({ city: 'Lisbon' }), row({ city: ' lisbon ' }), notContacted({ city: 'Porto' })], 'city');
    expect(s[0]).toMatchObject({ value: 'lisbon', n: 2, contact: { value: 1, n: 2 } });
    expect(s[1]).toMatchObject({ value: 'porto', n: 1, contact: { value: 0, n: 1 } });
  });

  it('dose-response buckets with 4+', () => {
    const d = doseResponse([row({ shared_count: 0, satisfaction_1_7: 2 }), row({ shared_count: 6, satisfaction_1_7: 6 }), row({ shared_count: 4, satisfaction_1_7: 4 })]);
    expect(d.map((b) => b.bucket)).toEqual(['0', '1', '2', '3', '4+']);
    expect(d[0].satisfaction).toEqual({ value: 2, n: 1 });
    expect(d[4].satisfaction).toEqual({ value: 5, n: 2 });
  });

  it('why_not shares among non-contacted reviews per group', () => {
    const w = whyNot([notContacted(), notContacted({ why_not: 'shy' }), row()]);
    expect(w.find((x) => x.reason === 'shy')?.compatible).toEqual({ value: 0.5, n: 2 });
  });

  it('top items and other answers', () => {
    const people = [
      { interests: ['music_rock', 'food_wine'], other_text: { music: 'synthwave' } },
      { interests: ['music_rock'], other_text: {} },
    ];
    expect(topItems(people, 2)).toEqual([
      { code: 'music_rock', count: 2, share: 1 },
      { code: 'food_wine', count: 1, share: 0.5 },
    ]);
    expect(otherAnswers(people)).toEqual([{ category: 'music', text: 'synthwave' }]);
  });
});

describe('contactClicks', () => {
  const since = '2026-10-21T08:00:00Z';
  const at = (h: number) => new Date(Date.UTC(2026, 9, 22, h)).toISOString();
  const match = (id: string, type: 'compatible' | 'control', a: string, b: string, created = at(0)) => ({
    id,
    type,
    a_id: a,
    b_id: b,
    created_at: created,
  });
  const review = (m: string, who: string, created: string, patch: Partial<{ contacted: boolean; talked: boolean | null; who_first: string | null; why_not: string | null }> = {}) => ({
    match_id: m,
    reviewer_id: who,
    created_at: created,
    contacted: true,
    talked: true,
    who_first: 'me',
    why_not: null,
    ...patch,
  });
  const click = (m: string, who: string, channel: string, created: string) => ({ match_id: m, participant_id: who, channel, created_at: created });

  it('counts each side once, sides independently, per channel and per group', () => {
    const r = contactClicks({
      matches: [match('m1', 'compatible', 'a', 'b'), match('m2', 'control', 'c', 'd')],
      deleted: new Set(),
      clicks: [click('m1', 'a', 'whatsapp', at(1)), click('m1', 'a', 'instagram', at(2)), click('m2', 'd', 'instagram', at(1))],
      reviews: [],
      since,
    });
    expect(r.all.clicked).toEqual({ value: 0.5, n: 4 });
    expect(r.compatible.clicked).toEqual({ value: 0.5, n: 2 });
    expect(r.compatible.whatsapp).toEqual({ value: 0.5, n: 2 });
    expect(r.control.instagram).toEqual({ value: 0.5, n: 2 });
    expect(r.all.reviewed).toBe(0);
    expect(r.all.clickedContacted).toEqual({ value: null, n: 0 });
  });

  it('crosses taps made before the review with what the review says', () => {
    const r = contactClicks({
      matches: [match('m1', 'compatible', 'a', 'b'), match('m2', 'compatible', 'c', 'd')],
      deleted: new Set(),
      clicks: [
        click('m1', 'a', 'whatsapp', at(1)), // before review: tapped and contacted
        click('m1', 'b', 'whatsapp', at(1)), // before review: tapped, not contacted (barrier)
        click('m2', 'c', 'whatsapp', at(9)), // after the review: does not count there
      ],
      reviews: [
        review('m1', 'a', at(5), { talked: true }),
        review('m1', 'b', at(5), { contacted: false, talked: null, who_first: null, why_not: 'no_reply' }),
        review('m2', 'c', at(5), { contacted: false, talked: null, who_first: null, why_not: 'shy' }),
        review('m2', 'd', at(5), { who_first: 'them' }),
      ],
      since,
    });
    const c = r.compatible;
    expect(c.clicked).toEqual({ value: 0.75, n: 4 }); // the late tap still counts as a tap
    expect(c.reviewed).toBe(4);
    expect(c.clickedContacted).toEqual({ value: 0.25, n: 4 });
    expect(c.clickedNotContacted).toEqual({ value: 0.25, n: 4 });
    expect(c.notClickedContactedThem).toEqual({ value: 0.25, n: 4 });
    expect(c.neither).toEqual({ value: 0.25, n: 4 });
    expect(c.barrierReasons.find((x) => x.reason === 'no_reply')?.share).toEqual({ value: 1, n: 1 });
    expect(c.clickedThenTalked).toEqual({ value: 0.5, n: 2 });
  });

  it('splits contact without a tap by who reached out, and keeps sides without a review out of the comparison', () => {
    const r = contactClicks({
      matches: [match('m1', 'control', 'a', 'b'), match('m2', 'control', 'c', 'd')],
      deleted: new Set(),
      clicks: [],
      reviews: [review('m1', 'a', at(5), { who_first: 'me' }), review('m1', 'b', at(5), { who_first: 'them' }), review('m2', 'c', at(5))],
      since,
    });
    expect(r.control.sides).toBe(4);
    expect(r.control.reviewed).toBe(3); // d has no review
    expect(r.control.notClickedContactedMe).toEqual({ value: 2 / 3, n: 3 });
    expect(r.control.notClickedContactedThem).toEqual({ value: 1 / 3, n: 3 });
  });

  it('leaves out matches before the tracking started and sides with an anonymised person', () => {
    const r = contactClicks({
      matches: [
        match('old', 'compatible', 'a', 'b', '2026-10-20T00:00:00Z'),
        match('gone', 'compatible', 'c', 'x'),
        match('ok', 'control', 'e', 'f'),
      ],
      deleted: new Set(['x']),
      clicks: [click('old', 'a', 'whatsapp', at(1))],
      reviews: [review('old', 'a', at(5)), review('gone', 'c', at(5))],
      since,
    });
    expect(r.all.sides).toBe(2);
    expect(r.all.reviewed).toBe(0);
    expect(r.compatible.sides).toBe(0);
  });
});

describe('contactClicks with seed', () => {
  it('counts seed-only matches created before tracking started', () => {
    const matches = [
      { id: 'old', type: 'compatible' as const, a_id: 's1', b_id: 's2', created_at: '2026-10-01T00:00:00Z' },
      { id: 'mixed', type: 'compatible' as const, a_id: 's1', b_id: 'r1', created_at: '2026-10-01T00:00:00Z' },
    ];
    const result = contactClicks({
      matches,
      deleted: new Set(),
      seed: new Set(['s1', 's2']),
      clicks: [{ match_id: 'old', participant_id: 's1', channel: 'whatsapp', created_at: '2026-10-02T00:00:00Z' }],
      reviews: [],
      since: '2026-10-21T00:00:00Z',
    });
    expect(result.all.sides).toBe(2);
  });
});

describe('filterAdminData', () => {
  const data = {
    participants: [
      { id: 'r1', is_seed: false },
      { id: 'r2', is_seed: false },
      { id: 's1', is_seed: true },
      { id: 's2', is_seed: true },
    ],
    matches: [
      { id: 'm1', a_id: 'r1', b_id: 'r2' },
      { id: 'm2', a_id: 's1', b_id: 's2' },
      { id: 'm3', a_id: 'r1', b_id: 's1' },
    ],
    reviews: [{ reviewer_id: 'r1' }, { reviewer_id: 's2' }],
    flags: [{ participant_id: 's1' }],
    clicks: [{ participant_id: 'r2' }, { participant_id: 's1' }],
  };

  it('defaults to real data', () => {
    expect(dataMode(undefined)).toBe('reais');
    expect(dataMode('nope')).toBe('reais');
    expect(dataMode('seed')).toBe('seed');
    expect(dataMode('tudo')).toBe('tudo');
  });

  it('keeps only real people and matches with both sides real', () => {
    const f = filterAdminData(data, 'reais');
    expect(f.participants.map((p) => p.id)).toEqual(['r1', 'r2']);
    expect(f.matches.map((m) => m.id)).toEqual(['m1']);
    expect(f.reviews).toEqual([{ reviewer_id: 'r1' }]);
    expect(f.flags).toEqual([]);
    expect(f.clicks).toEqual([{ participant_id: 'r2' }]);
  });

  it('keeps only seed data', () => {
    const f = filterAdminData(data, 'seed');
    expect(f.participants.map((p) => p.id)).toEqual(['s1', 's2']);
    expect(f.matches.map((m) => m.id)).toEqual(['m2']);
    expect(f.flags).toHaveLength(1);
  });

  it('keeps everything', () => {
    expect(filterAdminData(data, 'tudo')).toBe(data);
  });
});

describe('Instagram', () => {
  it('rates Instagram taps only where the other person has Instagram', () => {
    const matches = [
      { id: 'm1', type: 'compatible' as const, a_id: 'a', b_id: 'b', created_at: '2026-10-22T00:00:00Z' },
    ];
    const result = contactClicks({
      matches,
      deleted: new Set(),
      instagram: new Set(['a']), // b has no Instagram: a never sees the button
      clicks: [{ match_id: 'm1', participant_id: 'b', channel: 'instagram', created_at: '2026-10-22T01:00:00Z' }],
      reviews: [],
      since: '2026-10-21T00:00:00Z',
    });
    expect(result.all.instagram).toEqual({ value: 1, n: 1 });
    expect(result.all.clicked.n).toBe(2);
  });

  it('splits "who followed whom" by group, over the reviews where it was asked', () => {
    const rows = [
      row({ type: 'compatible', ig_follow: 'both' }),
      row({ type: 'compatible', ig_follow: 'none' }),
      row({ type: 'compatible', ig_follow: null }),
      row({ type: 'control', ig_follow: 'me' }),
    ];
    const both = igFollow(rows).find((f) => f.option === 'both')!;
    expect(both.compatible).toEqual({ value: 0.5, n: 2 });
    expect(both.control).toEqual({ value: 0, n: 1 });
  });
});

describe('participantMatches', () => {
  it("lists each person's matches, newest first, with both reviews and taps", () => {
    const matches = [
      { id: 'm1', a_id: 'a', b_id: 'b', created_at: '2026-10-01' },
      { id: 'm2', a_id: 'a', b_id: 'c', created_at: '2026-10-02' },
    ];
    const reviews = [{ match_id: 'm1', reviewer_id: 'b' }];
    const clicks = [
      { match_id: 'm1', participant_id: 'a', channel: 'whatsapp' },
      { match_id: 'm1', participant_id: 'a', channel: 'whatsapp' },
    ];
    const byPerson = participantMatches({ matches, reviews, clicks });
    expect(byPerson.get('a')!.map((x) => x.match.id)).toEqual(['m2', 'm1']);
    const ab = byPerson.get('a')![1];
    expect(ab).toMatchObject({ other: 'b', mine: null, theirs: { reviewer_id: 'b' }, myTaps: ['whatsapp'], theirTaps: [] });
    expect(byPerson.get('b')![0]).toMatchObject({ other: 'a', mine: { reviewer_id: 'b' }, theirTaps: ['whatsapp'] });
    expect(byPerson.get('d')).toBeUndefined();
  });
});

describe('sample', () => {
  const person = (id: string, patch: Partial<Record<string, unknown>> = {}) => ({
    id,
    deleted_at: null as string | null,
    active: true,
    age_range: '25-30',
    time_in_city: '2y+',
    origin: 'this_city',
    city: 'Lisbon',
    lang: 'pt',
    interests: ['a', 'b'],
    ...patch,
  });
  const m = (a: string, b: string, type: 'compatible' | 'control', byCat: Record<string, number> = {}) => ({
    a_id: a,
    b_id: b,
    type,
    shared_count: Object.values(byCat).reduce((s, n) => s + n, 0),
    shared_by_category: byCat,
  });

  it('counts people, matches between live people and matches per person', () => {
    const s = sample({
      participants: [person('a'), person('b', { city: ' lisbon ' }), person('c', { active: false }), person('d', { deleted_at: '2026-10-01' })],
      matches: [m('a', 'b', 'compatible', { music: 2 }), m('a', 'c', 'control'), m('a', 'd', 'compatible', { music: 1 })],
      categories: ['music', 'food'],
    });
    expect(s).toMatchObject({ people: 3, active: 2, matches: 2, compatible: 1, control: 1 });
    expect(s.perPersonMean).toBeCloseTo(4 / 3);
    expect(s.perPerson.map((b) => b.share.value)).toEqual([0, 2 / 3, 1 / 3, 0, 0]);
    expect(s.composition.find((c) => c.key === 'city')!.values).toEqual([{ value: 'lisbon', share: { value: 1, n: 3 } }]);
    expect(s.sharedByCategory[0]).toMatchObject({ category: 'music', compatible: { value: 1, n: 1 }, control: { value: 0, n: 1 } });
    expect(s.sameProfile.find((x) => x.key === 'city')!.compatible).toEqual({ value: 1, n: 1 });
    expect(s.sharedMean.compatible).toEqual({ value: 2, n: 1 });
  });

  it('groups small cities and handles an empty sample', () => {
    const cities = ['A', 'B', 'C', 'D'];
    const s = sample({ participants: cities.map((c, i) => person(`p${i}`, { city: c })), matches: [], categories: [], cityTop: 2 });
    expect(s.composition.find((c) => c.key === 'city')!.values.map((v) => v.value)).toEqual(['a', 'b', '__other']);
    const empty = sample({ participants: [], matches: [], categories: ['music'] });
    expect(empty.perPersonMean).toBeNull();
    expect(empty.sharedByCategory[0].compatible).toEqual({ value: null, n: 0 });
  });
});

describe('conceptOpinion', () => {
  it('shares over the reviews that answered, by group', () => {
    const rows = [
      row({ type: 'compatible', likes_concept: true, best_for: 'friendship' }),
      row({ type: 'compatible', likes_concept: false, best_for: 'dating' }),
      row({ type: 'control', likes_concept: true, best_for: 'both' }),
      row({ type: 'control', likes_concept: null, best_for: null }),
    ];
    const c = conceptOpinion(rows);
    expect(c.all.likes).toEqual({ value: 2 / 3, n: 3 });
    expect(c.compatible.bestFor.find((b) => b.option === 'dating')!.share).toEqual({ value: 0.5, n: 2 });
    expect(c.control.likes).toEqual({ value: 1, n: 1 });
  });
});

describe('partyInterest', () => {
  it('keeps each person latest answer and lists who said yes or maybe', () => {
    const r = (reviewer_id: string, party_interest: string | null, created_at: string) => ({ reviewer_id, party_interest, created_at });
    const p = partyInterest([
      r('a', 'no', '2026-10-25T10:00:00Z'),
      r('a', 'yes', '2026-10-26T10:00:00Z'),
      r('b', 'maybe', '2026-10-25T10:00:00Z'),
      r('c', 'no', '2026-10-25T10:00:00Z'),
      r('d', null, '2026-10-25T10:00:00Z'),
    ]);
    expect(p.people).toBe(3);
    expect(p.counts).toEqual({ yes: 1, maybe: 1, no: 1 });
    expect(p.interested).toEqual([
      { id: 'a', answer: 'yes' },
      { id: 'b', answer: 'maybe' },
    ]);
  });
});

describe('reviewProgress', () => {
  it('counts expected vs received reviews and each step in between', () => {
    const now = new Date('2026-10-30T12:00:00Z');
    const p = reviewProgress({
      matches: [
        { id: 'm1', a_id: 'a', b_id: 'b', type: 'compatible', created_at: '2026-10-25T09:00:00Z' }, // due
        { id: 'm2', a_id: 'a', b_id: 'c', type: 'control', created_at: '2026-10-25T09:00:00Z' }, // due, c anonymised
        { id: 'm3', a_id: 'b', b_id: 'd', type: 'compatible', created_at: '2026-10-30T09:00:00Z' }, // not yet due
      ],
      people: new Set(['a', 'b', 'd']),
      requests: [
        { match_id: 'm1', participant_id: 'a', requested_at: '2026-10-27T09:00:00Z', reminded_at: '2026-10-30T09:00:00Z' },
        { match_id: 'm1', participant_id: 'b', requested_at: '2026-10-27T09:00:00Z', reminded_at: null },
        { match_id: 'm2', participant_id: 'a', requested_at: '2026-10-27T09:00:00Z', reminded_at: null },
      ],
      reviews: [
        { match_id: 'm1', reviewer_id: 'a', created_at: '2026-10-30T10:00:00Z' }, // after the reminder: 73 h
        { match_id: 'm1', reviewer_id: 'b', created_at: '2026-10-27T10:00:00Z' }, // 1 h
      ],
      clicks: [
        { match_id: 'm1', participant_id: 'a', source: 'reminder' },
        { match_id: 'm1', participant_id: 'b', source: 'open' },
        { match_id: 'm2', participant_id: 'c', source: 'open' }, // anonymised: left out
      ],
      views: [
        { match_id: 'm1', participant_id: 'a' },
        { match_id: 'm1', participant_id: 'b' },
        { match_id: 'm2', participant_id: 'a' },
      ],
      now,
      delayDays: 2,
      graceMs: 3_600_000,
    });
    expect(p).toEqual({
      sides: 5, // m1: a, b · m2: a (c anonymised) · m3: b, d
      notDue: 2,
      due: 3,
      requested: 3,
      reminded: 1,
      clickedOpen: 1,
      clickedReminder: 1,
      viewed: 3,
      reviewed: 2,
      reviewedAfterReminder: 1,
      waitingAfterRequest: 1,
      waitingAfterReminder: 0,
      medianHours: 37,
      compatible: { due: 2, reviewed: 2 },
      control: { due: 1, reviewed: 0 },
    });
  });
});

describe('personalityShares', () => {
  it('counts each person once, by their latest answer', () => {
    const r = (reviewer_id: string, personality: string | null, created_at: string) => ({ reviewer_id, personality, created_at });
    const p = personalityShares([
      r('a', 'introvert', '2026-10-25T10:00:00Z'),
      r('a', 'both', '2026-10-26T10:00:00Z'),
      r('b', 'extrovert', '2026-10-25T10:00:00Z'),
      r('c', null, '2026-10-25T10:00:00Z'),
    ]);
    expect(p.people).toBe(2);
    expect(p.options).toEqual([
      { option: 'introvert', count: 0, share: 0 },
      { option: 'extrovert', count: 1, share: 0.5 },
      { option: 'both', count: 1, share: 0.5 },
    ]);
  });
});
