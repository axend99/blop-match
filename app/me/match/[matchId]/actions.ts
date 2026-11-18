'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getMyParticipant, getUser } from '@/lib/auth';
import { addGuess, sendGuessAlert } from '@/lib/guessService';
import { getMyMatches } from '@/lib/myMatches';
import { cleanGuess } from '@/lib/password';

export type GuessState = { saved?: boolean; error?: 'invalid' | 'full' | 'repeat' | 'failed' };

// A guess of the match's password, any time before rating the conversation (rating closes it).
export async function guessPassword(matchId: string, input: string): Promise<GuessState> {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me || me.cohort !== 'v2') redirect('/me');
  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match || match.reviewed_by_me || match.other_deleted) redirect('/me');

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
  return { saved: true };
}
