'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getMyParticipant, getUser } from '@/lib/auth';
import { addGuess, sendGuessAlert } from '@/lib/guessService';
import { getMyMatches } from '@/lib/myMatches';
import { cleanGuess } from '@/lib/password';

export type GuessState = { result?: { right: boolean; attempt: number; left: number }; error?: 'invalid' | 'full' | 'repeat' | 'failed' };

// A guess of the match's password, any time (3 tries per match); the answer comes back at once.
export async function guessPassword(matchId: string, input: string): Promise<GuessState> {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me || me.cohort !== 'v2') redirect('/me');
  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match || match.other_deleted) redirect('/me');

  const guess = cleanGuess(input);
  if (!guess) return { error: 'invalid' };
  const result = await addGuess({ matchId, meId: me.id, guess });
  if (!result.ok) return { error: result.error };

  after(async () => {
    try {
      await sendGuessAlert({ matchId, guesserId: me.id });
    } catch (err) {
      console.error('[guess] alert failed', err);
    }
  });
  revalidatePath(`/me/match/${matchId}`);
  revalidatePath('/me');
  return { result: { right: result.right, attempt: result.attempt, left: result.left } };
}
