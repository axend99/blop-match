import { describe, expect, it } from 'vitest';
import { ANIMALS, COLOURS, leaderboard, pickNickname, scores } from '@/lib/game';

const people = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const matches = [
  { id: 'm1', a_id: 'a', b_id: 'b', reviewOpen: true },
  { id: 'm2', a_id: 'a', b_id: 'c', reviewOpen: true },
];

describe('scores', () => {
  it('counts a right guess only after the guesser reviewed', () => {
    const guesses = [{ match_id: 'm1', guesser_id: 'a', right: true }];
    const before = scores({ people, matches, reviews: [], guesses });
    expect(before.get('a')).toMatchObject({ points: 0, rightGuesses: 0, badges: ['first_guess'] });
    const after = scores({ people, matches, reviews: [{ match_id: 'm1', reviewer_id: 'a', who_first: 'me' }], guesses });
    expect(after.get('a')).toMatchObject({ points: 3 + 1, rightGuesses: 1, reviews: 1 });
    expect(after.get('a')!.badges).toEqual(['first_guess', 'icebreaker']);
  });

  it('gives the spy points when the other is done guessing and never got it', () => {
    const wrong = [{ match_id: 'm1', guesser_id: 'b', right: false }];
    const reviews = [{ match_id: 'm1', reviewer_id: 'a', who_first: null }];
    // b may still guess: no spy points yet
    expect(scores({ people, matches, reviews, guesses: wrong }).get('a')!.survived).toBe(0);
    // b reviewed: done
    const s = scores({ people, matches, reviews: [...reviews, { match_id: 'm1', reviewer_id: 'b', who_first: null }], guesses: wrong });
    expect(s.get('a')).toMatchObject({ survived: 1, points: 2 + 1 });
    // b used the 3 tries: done too
    const three = [1, 2, 3].map(() => ({ match_id: 'm1', guesser_id: 'b', right: false }));
    expect(scores({ people, matches, reviews, guesses: three }).get('a')!.survived).toBe(1);
    // nobody guessed: nothing to survive
    expect(scores({ people, matches, reviews, guesses: [] }).get('a')!.survived).toBe(0);
  });

  it('awards full_detective when every open match is reviewed', () => {
    const reviews = [
      { match_id: 'm1', reviewer_id: 'a', who_first: null },
      { match_id: 'm2', reviewer_id: 'a', who_first: null },
    ];
    expect(scores({ people, matches, reviews, guesses: [] }).get('a')!.badges).toContain('full_detective');
    expect(scores({ people, matches, reviews: reviews.slice(0, 1), guesses: [] }).get('a')!.badges).not.toContain('full_detective');
    expect(scores({ people, matches: [], reviews: [], guesses: [] }).get('a')!.badges).toEqual([]);
  });
});

describe('leaderboard', () => {
  it('sorts by points then right guesses, shares ranks on ties and drops zeros', () => {
    const s = (points: number, rightGuesses = 0, survived = 0) => ({ points, rightGuesses, survived, reviews: 0, badges: [] });
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
