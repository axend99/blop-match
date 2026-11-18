import 'server-only';
import { leaderboard, LEADERBOARD_SIZE, MAX_GUESSES, scores, type Score } from '@/lib/game';
import { guessCounts } from '@/lib/password';
import { reviewOpensAt } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

// Loads the v2 password game with the service role and returns only what `meId` may see:
// right/wrong of my guesses, the other person's password and their guesses' words only after I
// reviewed that match (the review closes my guessing).

export type MatchGame = {
  iReviewed: boolean;
  guessesLeft: number;
  myGuesses: { guess: string; right: boolean | null }[]; // right is null until I review
  theirGuessCount: number;
  theirGuesses: { guess: string; right: boolean }[] | null; // null until I review
  theyCanStillGuess: boolean;
  theirPassword: string | null; // null until I review
};

export type BoardRow = { rank: number; points: number; isMe: boolean; firstName: string | null; nickname: string | null };

export type GameState = {
  score: Score;
  rank: number | null;
  nickname: string | null;
  showName: boolean;
  top: BoardRow[];
  me: BoardRow | null; // my row when I'm outside the top
  matches: Map<string, MatchGame>;
};

export async function loadGame(meId: string): Promise<GameState> {
  const supabase = createServiceClient();
  const { data: people } = await supabase
    .from('participants')
    .select('id, name, password, nickname, leaderboard_show_name, active, deleted_at')
    .eq('cohort', 'v2')
    .is('deleted_at', null);
  const v2 = people ?? [];
  const ids = v2.map((p) => p.id);
  const byId = new Map(v2.map((p) => [p.id, p]));

  const { data: allMatches } = ids.length
    ? await supabase.from('matches').select('id, a_id, b_id, created_at').in('a_id', ids)
    : { data: [] };
  const matches = (allMatches ?? []).filter((m) => byId.has(m.b_id));
  const matchIds = matches.map((m) => m.id);
  const [{ data: reviews }, { data: rawGuesses }] = matchIds.length
    ? await Promise.all([
        supabase.from('reviews').select('match_id, reviewer_id, who_first').in('match_id', matchIds),
        supabase.from('password_guesses').select('match_id, guesser_id, guess, is_right, attempt').in('match_id', matchIds).order('attempt'),
      ])
    : [{ data: [] }, { data: [] }];

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const otherOf = (matchId: string, id: string) => {
    const m = matchById.get(matchId)!;
    return m.a_id === id ? m.b_id : m.a_id;
  };
  const guesses = (rawGuesses ?? [])
    .filter((g) => matchById.has(g.match_id))
    .map((g) => ({ ...g, right: guessCounts(g.is_right, g.guess, byId.get(otherOf(g.match_id, g.guesser_id))?.password ?? null) }));

  const all = scores({
    people: v2.map((p) => ({ id: p.id })),
    matches: matches.map((m) => ({ ...m, reviewOpen: reviewOpensAt(m.created_at) <= new Date() })),
    reviews: reviews ?? [],
    guesses,
  });
  // On the board: people still in the study who have a password.
  const board = leaderboard(new Map([...all].filter(([id]) => byId.get(id)?.active && byId.get(id)?.password)));
  const row = (r: (typeof board)[number]): BoardRow => {
    const p = byId.get(r.id)!;
    return { rank: r.rank, points: r.score.points, isMe: r.id === meId, firstName: p.leaderboard_show_name ? p.name : null, nickname: p.nickname };
  };
  const top = board.slice(0, LEADERBOARD_SIZE).map(row);
  const mine = board.find((r) => r.id === meId);

  const reviewed = new Set((reviews ?? []).map((r) => `${r.match_id}|${r.reviewer_id}`));
  const myMatches = new Map<string, MatchGame>();
  for (const m of matches) {
    if (m.a_id !== meId && m.b_id !== meId) continue;
    const otherId = otherOf(m.id, meId);
    const iReviewed = reviewed.has(`${m.id}|${meId}`);
    const my = guesses.filter((g) => g.match_id === m.id && g.guesser_id === meId);
    const theirs = guesses.filter((g) => g.match_id === m.id && g.guesser_id === otherId);
    myMatches.set(m.id, {
      iReviewed,
      guessesLeft: iReviewed ? 0 : Math.max(0, MAX_GUESSES - my.length),
      myGuesses: my.map((g) => ({ guess: g.guess, right: iReviewed ? g.right : null })),
      theirGuessCount: theirs.length,
      theirGuesses: iReviewed ? theirs.map((g) => ({ guess: g.guess, right: g.right })) : null,
      theyCanStillGuess: !reviewed.has(`${m.id}|${otherId}`) && theirs.length < MAX_GUESSES,
      theirPassword: iReviewed ? (byId.get(otherId)?.password ?? null) : null,
    });
  }

  const me = byId.get(meId);
  return {
    score: all.get(meId) ?? { points: 0, rightGuesses: 0, survived: 0, reviews: 0, badges: [] },
    rank: mine?.rank ?? null,
    nickname: me?.nickname ?? null,
    showName: Boolean(me?.leaderboard_show_name),
    top,
    me: mine && !top.some((r) => r.isMe) ? row(mine) : null,
    matches: myMatches,
  };
}
