// The v2 password game, gamified: points, badges and the leaderboard. Pure functions (tested in
// tests/game.test.ts); lib/gameService.ts loads the data.
//
// Rules: each person guesses their match's password at any time, up to MAX_GUESSES tries per
// match, and sees right away whether they got it. Points: finding the password, each time you
// managed to say yours (self-reported in the review, up to 3 per match), sending the first message
// (self-reported; both may claim it) and each review. Nothing rewards hiding the word.

export const MAX_GUESSES = 3;
export const MAX_SAID = 3;
export const POINTS = { detective: 3, said: 1, firstMessage: 1, review: 1 } as const;
export const PRIZE_PLACES = 3;
export const LEADERBOARD_SIZE = 10;
export const SMOOTH_TALKER_TIMES = 5;

export const BADGES = ['first_guess', 'sharp_eye', 'smooth_talker', 'icebreaker', 'full_detective'] as const;
export type Badge = (typeof BADGES)[number];

export type GamePerson = { id: string };
export type GameMatch = { id: string; a_id: string; b_id: string; reviewOpen: boolean };
export type GameReview = { match_id: string; reviewer_id: string; who_first: string | null; password_said: number | null };
// `right` already resolved (stored verdict, or the plain comparison when there is none).
export type GameGuess = { match_id: string; guesser_id: string; right: boolean };

export type Score = {
  points: number;
  rightGuesses: number; // matches where I found their password
  said: number; // times I said my password (up to MAX_SAID per match)
  firstMessages: number; // matches where I say I sent the first message
  reviews: number;
  badges: Badge[];
};

export function scores({ people, matches, reviews, guesses }: {
  people: GamePerson[];
  matches: GameMatch[];
  reviews: GameReview[];
  guesses: GameGuess[];
}): Map<string, Score> {
  const reviewOf = new Map(reviews.map((r) => [`${r.match_id}|${r.reviewer_id}`, r]));
  const result = new Map<string, Score>();
  for (const p of people) {
    const mine = matches.filter((m) => m.a_id === p.id || m.b_id === p.id);
    const myGuesses = guesses.filter((g) => g.guesser_id === p.id);
    const myReviews = mine.flatMap((m) => reviewOf.get(`${m.id}|${p.id}`) ?? []);
    const rightGuesses = mine.filter((m) => myGuesses.some((g) => g.match_id === m.id && g.right)).length;
    const said = myReviews.reduce((sum, r) => sum + Math.min(MAX_SAID, Math.max(0, r.password_said ?? 0)), 0);
    const firstMessages = myReviews.filter((r) => r.who_first === 'me').length;
    const open = mine.filter((m) => m.reviewOpen);
    const badges: Badge[] = [];
    if (myGuesses.length > 0) badges.push('first_guess');
    if (rightGuesses >= 3) badges.push('sharp_eye');
    if (said >= SMOOTH_TALKER_TIMES) badges.push('smooth_talker');
    if (firstMessages > 0) badges.push('icebreaker');
    if (open.length > 0 && open.every((m) => reviewOf.has(`${m.id}|${p.id}`))) badges.push('full_detective');
    result.set(p.id, {
      points:
        rightGuesses * POINTS.detective + said * POINTS.said + firstMessages * POINTS.firstMessage + myReviews.length * POINTS.review,
      rightGuesses,
      said,
      firstMessages,
      reviews: myReviews.length,
      badges,
    });
  }
  return result;
}

export type Ranked = { id: string; rank: number; score: Score };

// Most points first; ties broken by right guesses, then times the password was said. Equal scores share a
// rank (1, 1, 3), so a tie on the podium means both get the prize. People with 0 points are left out.
export function leaderboard(all: Map<string, Score>): Ranked[] {
  const rows = [...all.entries()]
    .filter(([, s]) => s.points > 0)
    .sort(([a, x], [b, y]) => y.points - x.points || y.rightGuesses - x.rightGuesses || y.said - x.said || a.localeCompare(b));
  const key = (s: Score) => `${s.points}|${s.rightGuesses}|${s.said}`;
  let rank = 0;
  return rows.map(([id, score], i) => {
    if (i === 0 || key(rows[i - 1][1]) !== key(score)) rank = i + 1;
    return { id, score, rank };
  });
}

// Hints shown to the match: number of letters (accents count as letters).
export function letterCount(word: string): number {
  return [...word.normalize('NFC')].filter((c) => /\p{L}/u.test(c)).length;
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
