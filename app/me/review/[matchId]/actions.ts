'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyParticipant, getUser } from '@/lib/auth';
import { getMyMatches } from '@/lib/myMatches';
import { validateReview, type ReviewErrors, type ReviewInput } from '@/lib/review';
import { reviewOpensAt } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/service';

export type ReviewState = { errors?: ReviewErrors; failed?: boolean };

// Inserted with the service role: the RLS policy uses a fixed 3-day delay, while the app
// enforces REVIEW_DELAY_DAYS here. Only validated fields, the caller's own participant id
// and a match confirmed through get_my_matches() reach the insert.
export async function submitReview(matchId: string, input: ReviewInput): Promise<ReviewState> {
  if (!(await getUser())) redirect('/login');
  const me = await getMyParticipant();
  if (!me) redirect('/join');

  const match = (await getMyMatches()).find((m) => m.match_id === matchId);
  if (!match || match.reviewed_by_me || reviewOpensAt(match.created_at) > new Date()) redirect('/me');

  const result = validateReview(input);
  if (!result.ok) return { errors: result.errors };

  const { error } = await createServiceClient()
    .from('reviews')
    .insert({ ...result.data, match_id: match.match_id, reviewer_id: me.id });
  if (error && error.code !== '23505') {
    console.error('[review] insert failed', error);
    return { failed: true };
  }

  revalidatePath('/me');
  redirect('/me');
}
