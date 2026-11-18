import 'server-only';
import { guessCounts } from '@/lib/password';
import { createServiceClient } from '@/lib/supabase/service';

export type GameResult =
  | { state: 'waiting' } // I reviewed, the other has not yet
  | {
      state: 'revealed';
      theirPassword: string | null;
      myGuess: string | null;
      myGuessRight: boolean;
      theirGuess: string | null;
      theirGuessRight: boolean;
    };

// The v2 password game for one of my matches. The other person's password is read with the
// service role and only returned once BOTH reviews exist; before that nothing about it leaves
// the server. `matchId` must already be confirmed as mine (get_my_matches).
export async function getGameResult(matchId: string, me: { id: string; password: string | null }): Promise<GameResult | null> {
  const supabase = createServiceClient();
  const [{ data: match }, { data: reviews }] = await Promise.all([
    supabase.from('matches').select('a_id, b_id').eq('id', matchId).maybeSingle(),
    supabase.from('reviews').select('reviewer_id, password_guess, password_guess_right').eq('match_id', matchId),
  ]);
  if (!match) return null;
  const otherId = match.a_id === me.id ? match.b_id : match.a_id;
  const mine = reviews?.find((r) => r.reviewer_id === me.id);
  const theirs = reviews?.find((r) => r.reviewer_id === otherId);
  if (!mine) return null; // the review comes first: no spoilers before it
  if (!theirs) return { state: 'waiting' };

  const { data: other } = await supabase.from('participants').select('password').eq('id', otherId).maybeSingle();
  const theirPassword = other?.password ?? null;
  return {
    state: 'revealed',
    theirPassword,
    myGuess: mine.password_guess,
    myGuessRight: guessCounts(mine.password_guess_right, mine.password_guess, theirPassword),
    theirGuess: theirs.password_guess,
    theirGuessRight: guessCounts(theirs.password_guess_right, theirs.password_guess, me.password),
  };
}
