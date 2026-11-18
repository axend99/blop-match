import { describe, expect, it } from 'vitest';
import { ANIMALS, COLOURS, leaderboard, letterCount, pickNickname, scores } from '@/lib/game';

const people = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const matches = [
  { id: 'm1', a_id: 'a', b_id: 'b', reviewOpen: true },
  { id: 'm2', a_id: 'a', b_id: 'c', reviewOpen: true },
];

describe('scores', () => {
  const review = (match_id: string, reviewer_id: string, who_first: string | null = null, password_said: number | null = null) => ({
    match_id,
    reviewer_id,
    who_first,
    password_said,
  });

  it('counts a right guess straight away, without waiting for the review', () => {
    const s = scores({ people, matches, reviews: [], guesses: [{ match_id: 'm1', guesser_id: 'a', right: true, attempt: 1 }] });
    expect(s.get('a')).toMatchObject({ points: 5, rightGuesses: 1, badges: ['first_guess'] });
    expect(s.get('b')).toMatchObject({ points: 0 }); // being found out costs nothing
  });

  it('gives 5, 3 or 1 points by the try that found it', () => {
    const g = (match_id: string, attempt: number, right: boolean) => ({ match_id, guesser_id: 'a', attempt, right });
    const s = scores({ people, matches, reviews: [], guesses: [g('m1', 1, false), g('m1', 2, true), g('m2', 1, false), g('m2', 2, false), g('m2', 3, true)] });
    expect(s.get('a')).toMatchObject({ points: 3 + 1, rightGuesses: 2 });
  });

  it('adds the times said (max 3 per match), the first message (both may claim it) and each review', () => {
    const s = scores({
      people,
      matches,
      reviews: [review('m1', 'a', 'me', 3), review('m2', 'a', 'them', 9), review('m1', 'b', 'me', 1)],
      guesses: [],
    });
    expect(s.get('a')).toMatchObject({ said: 6, firstMessages: 1, reviews: 2, points: 6 + 1 + 2 });
    expect(s.get('a')!.badges).toEqual(['smooth_talker', 'icebreaker', 'full_detective']);
    expect(s.get('b')).toMatchObject({ said: 1, firstMessages: 1, reviews: 1, points: 3 });
  });

  it('awards full_detective only when every open match is reviewed', () => {
    expect(scores({ people, matches, reviews: [review('m1', 'a')], guesses: [] }).get('a')!.badges).not.toContain('full_detective');
    expect(scores({ people, matches: [], reviews: [], guesses: [] }).get('a')!.badges).toEqual([]);
  });
});

describe('leaderboard', () => {
  it('sorts by points then right guesses, shares ranks on ties and drops zeros', () => {
    const s = (points: number, rightGuesses = 0, said = 0) => ({ points, rightGuesses, said, firstMessages: 0, reviews: 0, badges: [] });
    const rows = leaderboard(new Map([['x', s(4, 1)], ['y', s(4, 1)], ['z', s(4, 0)], ['w', s(7)], ['q', s(0)]]));
    expect(rows.map((r) => [r.id, r.rank])).toEqual([['w', 1], ['x', 2], ['y', 2], ['z', 4]]);
  });
});

describe('pickNickname', () => {
  it('picks a free animal-colour pair, then adds a number when all are taken', () => {
    expect(pickNickname(new Set(), () => 0)).toBe(`${ANIMALS[0]}-${COLOURS[0]}`);
    expect(pickNickname(new Set([`${ANIMALS[0]}-${COLOURS[0]}`]), () => 0)).toBe(`${ANIMALS[0]}-${COLOURS[1]}`);
    const all = new Set(ANIMALS.flatMap((a) => COLOURS.map((c) => `${a}-${c}`)));
    expect(pickNickname(all, () => 0)).toBe(`${ANIMALS[0]}-${COLOURS[0]}-2`);
  });
});

describe('letterCount', () => {
  it('counts letters, accents included', () => {
    expect(letterCount('Coração')).toBe(7);
    expect(letterCount('мост')).toBe(4);
  });
});
