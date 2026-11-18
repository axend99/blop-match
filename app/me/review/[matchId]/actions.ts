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
import { checkGuess } from '@/lib/guessCheck';
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

  const supabase = createServiceClient();
  // v2 only (v2 people are only matched with v2), and only when they made contact.
  const guess = me.cohort === 'v2' && result.data.contacted ? cleanGuess(passwordGuess) : null;
  // Right or wrong is decided now (translations count: heart = coração) and never shown
  // before both people have reviewed (lib/passwordGame.ts).
  let guessRight: boolean | null = null;
  if (guess) {
    const { data: m } = await supabase.from('matches').select('a_id, b_id').eq('id', match.match_id).maybeSingle();
    const otherId = m && (m.a_id === me.id ? m.b_id : m.a_id);
    const { data: other } = otherId ? await supabase.from('participants').select('password').eq('id', otherId).maybeSingle() : { data: null };
    guessRight = await checkGuess(guess, other?.password ?? null);
  }

  const { error } = await supabase
    .from('reviews')
    .insert({
      ...result.data,
      match_id: match.match_id,
      reviewer_id: me.id,
      password_guess: guess,
      password_guess_right: guessRight,
    });
  if (error && error.code !== '23505') {
    console.error('[review] insert failed', error);
    return { failed: true };
  }
  if (!error) {
    // AI check of the comment: only alerts /admin. Registered before redirect(), which throws.
    after(async () => {
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
