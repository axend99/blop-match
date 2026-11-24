import 'server-only';
import { leaderboard, LEADERBOARD_SIZE, letterCount, MAX_GUESSES, scores, type Score } from '@/lib/game';
import { guessCounts } from '@/lib/password';
import { reviewDueAt, V1_ENDS_AT } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

// Loads the v2 password game with the service role and returns only what `meId` may see. My own
// guesses show right or wrong at once; the other person's password only once I found it or used my
// tries; their guesses about mine only after I reviewed the match (a reason to review).

export type MatchGame = {
  iReviewed: boolean;
  guessesLeft: number;
  myGuesses: { guess: string; right: boolean }[];
  found: boolean;
  hints: { letters: number; kind: string | null } | null; // about their password
  theirPassword: string | null; // once I found it or used my tries
  theirGuessCount: number;
  theirGuesses: { guess: string; right: boolean }[] | null; // null until I review
  theyCanStillGuess: boolean; // only meaningful once I reviewed
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
  invitedFriends: number; // friends who joined the game through my link (not capped)
};

export async function loadGame(meId: string): Promise<GameState> {
  const supabase = createServiceClient();
  const { data: people } = await supabase
    .from('participants')
    .select('id, name, password, password_kind, nickname, leaderboard_show_name, active, deleted_at, invited_by, is_ghost')
    .eq('cohort', 'v2')
    .is('deleted_at', null);
  const v2 = people ?? [];
  const ids = v2.map((p) => p.id);
  const byId = new Map(v2.map((p) => [p.id, p]));

  const { data: allMatches } = ids.length
    ? await supabase.from('matches').select('id, a_id, b_id, created_at').in('a_id', ids)
    : { data: [] };
  // The game is v2 only: matches from before v2 never count, even between people who joined v2.
  const matches = (allMatches ?? []).filter((m) => byId.has(m.b_id) && m.created_at >= V1_ENDS_AT);
  const matchIds = matches.map((m) => m.id);
  const [{ data: reviews }, { data: rawGuesses }] = matchIds.length
    ? await Promise.all([
        supabase.from('reviews').select('match_id, reviewer_id, who_first, password_said').in('match_id', matchIds),
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

  // Invites: friends in the game (v2, with a password) who joined through someone's link.
  const invites = new Map<string, number>();
  for (const p of v2) if (p.invited_by && p.password) invites.set(p.invited_by, (invites.get(p.invited_by) ?? 0) + 1);
  const all = scores({
    invites,
    people: v2.map((p) => ({ id: p.id })),
    matches: matches.map((m) => ({ ...m, reviewOpen: reviewDueAt(m.created_at) <= new Date() })),
    reviews: reviews ?? [],
    guesses,
  });
  // On the board: people still in the study who have a password.
  const board = leaderboard(new Map([...all].filter(([id]) => byId.get(id)?.active && byId.get(id)?.password && !byId.get(id)?.is_ghost)));
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
    const found = my.some((g) => g.right);
    const other = byId.get(otherId);
    myMatches.set(m.id, {
      iReviewed,
      guessesLeft: found ? 0 : Math.max(0, MAX_GUESSES - my.length),
      myGuesses: my.map((g) => ({ guess: g.guess, right: g.right })),
      found,
      hints: other?.password ? { letters: letterCount(other.password), kind: other.password_kind } : null,
      theirPassword: found || my.length >= MAX_GUESSES ? (other?.password ?? null) : null,
      theirGuessCount: theirs.length,
      theirGuesses: iReviewed ? theirs.map((g) => ({ guess: g.guess, right: g.right })) : null,
      theyCanStillGuess: iReviewed && theirs.length < MAX_GUESSES && !theirs.some((g) => g.right),
    });
  }

  const me = byId.get(meId);
  return {
    score: all.get(meId) ?? { points: 0, rightGuesses: 0, said: 0, firstMessages: 0, reviews: 0, invites: 0, badges: [] },
    invitedFriends: invites.get(meId) ?? 0,
    rank: mine?.rank ?? null,
    nickname: me?.nickname ?? null,
    showName: Boolean(me?.leaderboard_show_name),
    top,
    me: mine && !top.some((r) => r.isMe) ? row(mine) : null,
    matches: myMatches,
  };
}
