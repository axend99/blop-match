'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getMyParticipant, getUser } from '@/lib/auth';
import { reviewTexts } from '@/lib/moderation';
import { moderate } from '@/lib/moderationService';
import { getMyMatches } from '@/lib/myMatches';
import { validateReview, type ReviewErrors, type ReviewInput } from '@/lib/review';
import { cleanGuess } from '@/lib/password';
import { addGuess, sendGuessAlert } from '@/lib/guessService';
import { reviewOpensAt } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

export type ReviewState = { errors?: ReviewErrors; failed?: boolean };

// Inserted with the service role: the RLS policy uses a fixed 3-day delay, while the app
// enforces REVIEW_DELAY_DAYS here. Only validated fields, the caller's own participant id
// and a match confirmed through get_my_matches() reach the insert.
export async function submitReview(matchId: string, input: ReviewInput, passwordGuess = ''): Promise<ReviewState> {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');

  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match || match.reviewed_by_me || reviewOpensAt(match.created_at) > new Date()) redirect('/me');

  // Asked only when both people have Instagram (the other's is null once anonymised).
  const result = validateReview(input, { askInstagram: Boolean(me.instagram && match.other_instagram) });
  if (!result.ok) return { errors: result.errors };

  // v2 password game: the last-chance guess (when they made contact) is saved as one of the
  // match's tries before the review, which closes guessing. A repeated word or no tries left
  // just means no new guess.
  const guess = me.cohort === 'v2' && result.data.contacted && !match.other_deleted ? cleanGuess(passwordGuess) : null;
  const guessed = guess ? (await addGuess({ matchId: match.match_id, meId: me.id, guess })).ok : false;

  const { error } = await createServiceClient()
    .from('reviews')
    .insert({ ...result.data, match_id: match.match_id, reviewer_id: me.id });
  if (error && error.code !== '23505') {
    console.error('[review] insert failed', error);
    return { failed: true };
  }
  if (!error) {
    // AI check of the comment: only alerts /admin. Registered before redirect(), which throws.
    after(async () => {
      if (guessed) {
        try {
          await sendGuessAlert({ matchId: match.match_id, guesserId: me.id });
        } catch (err) {
          console.error('[review] guess alert failed', err);
        }
      }
      try {
        await moderate(me.id, reviewTexts(result.data), match.match_id);
      } catch (err) {
        console.error('[review] moderation failed', err);
      }
    });
  }

  revalidatePath('/me');
  redirect('/me');
}
