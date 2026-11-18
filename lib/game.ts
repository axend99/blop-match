// The v2 password game, gamified: points, badges and the leaderboard. Pure functions (tested in
// tests/game.test.ts); lib/gameService.ts loads the data.
//
// Rules: each person guesses their match's password at any time, up to MAX_GUESSES tries per
// match, and only finds out whether they got it right after rating the conversation (the review
// closes their guessing). Points only count once the person who earns them has reviewed that
// match, so the leaderboard never gives a result away early.

export const MAX_GUESSES = 3;
export const POINTS = { detective: 3, spy: 2, review: 1 } as const;
export const PRIZE_PLACES = 3;
export const LEADERBOARD_SIZE = 10;

export const BADGES = ['first_guess', 'sharp_eye', 'secret_agent', 'icebreaker', 'full_detective'] as const;
export type Badge = (typeof BADGES)[number];

export type GamePerson = { id: string };
export type GameMatch = { id: string; a_id: string; b_id: string; reviewOpen: boolean };
export type GameReview = { match_id: string; reviewer_id: string; who_first: string | null };
// `right` already resolved (stored verdict, or the plain comparison when there is none).
export type GameGuess = { match_id: string; guesser_id: string; right: boolean };

export type Score = {
  points: number;
  rightGuesses: number; // detective: matches where I found their password (counted after my review)
  survived: number; // spy: matches where they guessed and never found mine (both done)
  reviews: number;
  badges: Badge[];
};

const other = (m: GameMatch, id: string) => (m.a_id === id ? m.b_id : m.a_id);

export function scores({ people, matches, reviews, guesses }: {
  people: GamePerson[];
  matches: GameMatch[];
  reviews: GameReview[];
  guesses: GameGuess[];
}): Map<string, Score> {
  const reviewed = new Set(reviews.map((r) => `${r.match_id}|${r.reviewer_id}`));
  const guessesOf = new Map<string, GameGuess[]>();
  for (const g of guesses) {
    const key = `${g.match_id}|${g.guesser_id}`;
    guessesOf.set(key, [...(guessesOf.get(key) ?? []), g]);
  }
  const done = (matchId: string, id: string) =>
    reviewed.has(`${matchId}|${id}`) || (guessesOf.get(`${matchId}|${id}`)?.length ?? 0) >= MAX_GUESSES;

  const result = new Map<string, Score>();
  for (const p of people) {
    const mine = matches.filter((m) => m.a_id === p.id || m.b_id === p.id);
    let rightGuesses = 0;
    let survived = 0;
    let myReviews = 0;
    for (const m of mine) {
      if (!reviewed.has(`${m.id}|${p.id}`)) continue;
      myReviews++;
      if (guessesOf.get(`${m.id}|${p.id}`)?.some((g) => g.right)) rightGuesses++;
      const theirs = guessesOf.get(`${m.id}|${other(m, p.id)}`) ?? [];
      if (theirs.length > 0 && !theirs.some((g) => g.right) && done(m.id, other(m, p.id))) survived++;
    }
    const open = mine.filter((m) => m.reviewOpen);
    const badges: Badge[] = [];
    if (guesses.some((g) => g.guesser_id === p.id)) badges.push('first_guess');
    if (rightGuesses >= 3) badges.push('sharp_eye');
    if (survived >= 3) badges.push('secret_agent');
    if (reviews.some((r) => r.reviewer_id === p.id && r.who_first === 'me')) badges.push('icebreaker');
    if (open.length > 0 && open.every((m) => reviewed.has(`${m.id}|${p.id}`))) badges.push('full_detective');
    result.set(p.id, {
      points: rightGuesses * POINTS.detective + survived * POINTS.spy + myReviews * POINTS.review,
      rightGuesses,
      survived,
      reviews: myReviews,
      badges,
    });
  }
  return result;
}

export type Ranked = { id: string; rank: number; score: Score };

// Most points first; ties broken by right guesses, then passwords kept safe. Equal scores share a
// rank (1, 1, 3), so a tie on the podium means both get the prize. People with 0 points are left out.
export function leaderboard(all: Map<string, Score>): Ranked[] {
  const rows = [...all.entries()]
    .filter(([, s]) => s.points > 0)
    .sort(([a, x], [b, y]) => y.points - x.points || y.rightGuesses - x.rightGuesses || y.survived - x.survived || a.localeCompare(b));
  const key = (s: Score) => `${s.points}|${s.rightGuesses}|${s.survived}`;
  let rank = 0;
  return rows.map(([id, score], i) => {
    if (i === 0 || key(rows[i - 1][1]) !== key(score)) rank = i + 1;
    return { id, score, rank };
  });
}

// --- Nicknames: "Violet Flamingo" (EN) / "Flamingo Violeta" (PT), stored as "flamingo-violet" ---

export const ANIMALS = ['flamingo', 'penguin', 'octopus', 'kangaroo', 'giraffe', 'panda', 'koala', 'llama', 'otter', 'fox', 'owl', 'dolphin', 'sloth', 'hedgehog', 'toucan', 'seal'] as const;
// Colours that don't change with gender in Portuguese.
export const COLOURS = ['violet', 'turquoise', 'lime', 'pink', 'orange', 'coral', 'lilac', 'magenta', 'mint', 'cherry'] as const;

// A random nickname not in `taken`; after all combinations are used, a number is added.
export function pickNickname(taken: Set<string>, random: () => number = Math.random): string {
  const free: string[] = [];
  for (const a of ANIMALS) for (const c of COLOURS) if (!taken.has(`${a}-${c}`)) free.push(`${a}-${c}`);
  if (free.length > 0) return free[Math.floor(random() * free.length)];
  for (let n = 2; ; n++) {
    const key = `${ANIMALS[Math.floor(random() * ANIMALS.length)]}-${COLOURS[Math.floor(random() * COLOURS.length)]}-${n}`;
    if (!taken.has(key)) return key;
  }
}

// "flamingo-violet" (or "flamingo-violet-2") in the reader's language.
export function nicknameLabel(
  key: string | null,
  t: { animals: Record<string, string>; colours: Record<string, string>; nickname: (animal: string, colour: string) => string },
): string {
  const [animal, colour, n] = (key ?? '').split('-');
  if (!t.animals[animal] || !t.colours[colour]) return 'Blop';
  return `${t.nickname(t.animals[animal], t.colours[colour])}${n ? ` ${n}` : ''}`;
}
